const admin = require("firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const {
  ACTIVE_STATUS,
  LoanProgressionError,
  buildPlanItem,
  isBridgeSignatureValid,
  isManualRoleAllowed,
  hashPlan,
  isPayrollEligibleLoan,
  progressLoanData,
  resolveInstallmentPlan,
  resolveMatchedEligibleLoans,
  resolveLoanStatus,
} = require("./loanProgression");

const payrollHmacSecret = defineSecret("INTERNAL_PAYROLL_HMAC_SECRET");
const MAX_SIGNATURE_AGE_SECONDS = 300;

function bridgeErrorStatus(error) {
  if (!(error instanceof LoanProgressionError)) return 500;
  if (["LOAN_STATE_CHANGED", "LOAN_NOT_ACTIVE"].includes(error.code)) return 409;
  return 400;
}

function verifyBridgeSignature(req) {
  const timestampHeader = req.get("x-payroll-timestamp") || "";
  const signature = req.get("x-payroll-signature") || "";
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody.toString("utf8")
    : JSON.stringify(req.body || {});
  if (!isBridgeSignatureValid({
    secret: payrollHmacSecret.value(),
    timestamp: timestampHeader,
    body: rawBody,
    signature,
    nowSeconds,
    maxAgeSeconds: MAX_SIGNATURE_AGE_SECONDS,
  })) {
    throw new LoanProgressionError("INVALID_SIGNATURE", "Tanda tangan permintaan tidak valid.");
  }
}

function validateBridgePayload(payload) {
  if (!payload || payload.schemaVersion !== 1) {
    throw new LoanProgressionError("INVALID_PAYLOAD", "Payload integrasi tidak valid.");
  }
  if (!["preview", "apply"].includes(payload.action)) {
    throw new LoanProgressionError("INVALID_ACTION", "Aksi integrasi tidak valid.");
  }
  if (!/^\d{4}-\d{2}$/.test(payload.payrollPeriod || "")) {
    throw new LoanProgressionError("INVALID_PERIOD", "Periode payroll tidak valid.");
  }
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(payload.operationId || "")) {
    throw new LoanProgressionError("INVALID_OPERATION", "operationId tidak valid.");
  }
  if (
    !payload.employee ||
    typeof payload.employee.id !== "string" ||
    typeof payload.employee.name !== "string" ||
    !Number.isSafeInteger(payload.expectedDeduction) ||
    payload.expectedDeduction < 0
  ) {
    throw new LoanProgressionError("INVALID_EMPLOYEE", "Identitas pegawai atau potongan tidak valid.");
  }
}

function markerId(payrollPeriod, loanId) {
  return `${payrollPeriod}__${loanId}`;
}

function actorFromPayload(payload) {
  const uid = typeof payload.actor?.uid === "string" ? payload.actor.uid : "unknown";
  const name = typeof payload.actor?.name === "string" ? payload.actor.name : null;
  return { uid, name, source: "internal_bak_payroll" };
}

async function loadProductionLoans() {
  const snapshot = await admin.firestore().collection("simpanPinjam").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function previewPlan(payload) {
  const loans = await loadProductionLoans();
  return resolveInstallmentPlan({
    loans,
    employee: payload.employee,
    payrollPeriod: payload.payrollPeriod,
    expectedDeduction: payload.expectedDeduction,
  });
}

function validateSubmittedPlan(payload) {
  const plan = payload.plan;
  if (
    !plan ||
    plan.schemaVersion !== 1 ||
    plan.payrollPeriod !== payload.payrollPeriod ||
    plan.expectedDeduction !== payload.expectedDeduction ||
    !Array.isArray(plan.loans) ||
    typeof plan.planHash !== "string" ||
    hashPlan(plan) !== plan.planHash
  ) {
    throw new LoanProgressionError("PLAN_TAMPERED", "Rencana cicilan payroll tidak valid atau berubah.");
  }
  return plan;
}

async function applyPlan(payload) {
  const submittedPlan = validateSubmittedPlan(payload);
  const db = admin.firestore();
  const loansCollection = db.collection("simpanPinjam");
  const markersCollection = db.collection("payrollInstallmentProgressions");

  return db.runTransaction(async (transaction) => {
    const allLoansSnapshot = await transaction.get(loansCollection);
    const allLoans = allLoansSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const submittedIds = new Set(submittedPlan.loans.map((loan) => loan.loanId));
    const markerRefs = submittedPlan.loans.map((loan) =>
      markersCollection.doc(markerId(payload.payrollPeriod, loan.loanId)),
    );
    const markerSnapshots = await Promise.all(markerRefs.map((ref) => transaction.get(ref)));
    const currentMatched = resolveMatchedEligibleLoans({
      loans: allLoans,
      employee: payload.employee,
      payrollPeriod: payload.payrollPeriod,
    });
    const currentIds = new Set(currentMatched.loans.map((loan) => loan.id));

    // An already-applied final installment is no longer in the active query,
    // so its immutable marker participates in the current expected set.
    markerSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists) currentIds.add(submittedPlan.loans[index].loanId);
    });
    if (
      submittedIds.size !== currentIds.size ||
      [...submittedIds].some((loanId) => !currentIds.has(loanId))
    ) {
      throw new LoanProgressionError(
        "PLAN_STALE",
        "Daftar pinjaman aktif berubah setelah draf payroll disimpan.",
        { submittedLoanIds: [...submittedIds], currentLoanIds: [...currentIds] },
      );
    }

    const timestamp = Timestamp.now();
    const receipts = [];
    for (let index = 0; index < submittedPlan.loans.length; index += 1) {
      const item = submittedPlan.loans[index];
      const markerSnapshot = markerSnapshots[index];
      if (markerSnapshot.exists) {
        const marker = markerSnapshot.data();
        const sameTransition =
          marker.receipt?.installmentAmount === item.installmentAmount &&
          marker.receipt?.paidBefore === item.paidBefore &&
          marker.receipt?.paidAfter === item.paidAfter &&
          marker.receipt?.tenor === item.tenor;
        if ((marker.planHash && marker.planHash !== submittedPlan.planHash) || !sameTransition) {
          throw new LoanProgressionError(
            "MARKER_CONFLICT",
            `Pinjaman ${item.loanId} sudah diproses dengan rencana berbeda untuk periode ini.`,
          );
        }
        receipts.push({ ...marker.receipt, outcome: "already_applied" });
        continue;
      }

      const loanSnapshot = allLoansSnapshot.docs.find((doc) => doc.id === item.loanId);
      if (!loanSnapshot) {
        throw new LoanProgressionError("LOAN_NOT_FOUND", `Pinjaman ${item.loanId} tidak ditemukan.`);
      }
      const progression = progressLoanData({
        loan: loanSnapshot.data(),
        planItem: item,
        payrollPeriod: payload.payrollPeriod,
        operationId: payload.operationId,
        actor: actorFromPayload(payload),
        timestamp,
      });
      transaction.update(loanSnapshot.ref, {
        ...progression.update,
        updatedAt: timestamp,
      });
      transaction.create(markerRefs[index], {
        schemaVersion: 1,
        payrollPeriod: payload.payrollPeriod,
        loanId: item.loanId,
        borrowerUserId: item.borrowerUserId || null,
        employeeId: payload.employee.id,
        internalSlipId: payload.slipId || null,
        operationId: payload.operationId,
        planHash: submittedPlan.planHash,
        source: "internal_bak_payroll",
        actor: actorFromPayload(payload),
        receipt: progression.receipt,
        createdAt: timestamp,
      });
      receipts.push(progression.receipt);
    }

    return {
      schemaVersion: 1,
      operationId: payload.operationId,
      payrollPeriod: payload.payrollPeriod,
      planHash: submittedPlan.planHash,
      status: receipts.length === 0 ? "not_applicable" : "applied",
      loans: receipts,
    };
  });
}

const payrollLoanBridge = onRequest(
  { secrets: [payrollHmacSecret], timeoutSeconds: 60, memory: "256MiB", cors: false },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Gunakan POST." } });
        return;
      }
      verifyBridgeSignature(req);
      validateBridgePayload(req.body);
      const result = req.body.action === "preview"
        ? await previewPlan(req.body)
        : await applyPlan(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Payroll loan bridge failed", error);
      res.status(bridgeErrorStatus(error)).json({
        error: {
          code: error.code || "INTERNAL",
          message: error instanceof Error ? error.message : "Integrasi Koperasi gagal.",
          details: error.details || null,
        },
      });
    }
  },
);

async function requireManualActor(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Login Koperasi diperlukan.");
  const db = admin.firestore();
  let snapshot = await db.collection("users").doc(auth.uid).get();
  if (!snapshot.exists) {
    const querySnapshot = await db.collection("users").where("uid", "==", auth.uid).limit(1).get();
    snapshot = querySnapshot.docs[0];
  }
  const role = snapshot?.data()?.role;
  if (!isManualRoleAllowed(role)) {
    throw new HttpsError("permission-denied", "Anda tidak berwenang mencatat cicilan.");
  }
  return { uid: auth.uid, name: snapshot.data()?.nama || auth.token?.name || null, role };
}

const recordManualLoanInstallment = onCall({ timeoutSeconds: 30, memory: "256MiB" }, async (request) => {
  const actor = await requireManualActor(request.auth);
  const { loanId, payrollPeriod, isProduction = true } = request.data || {};
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(loanId || "") || !/^\d{4}-\d{2}$/.test(payrollPeriod || "")) {
    throw new HttpsError("invalid-argument", "Pinjaman atau periode tidak valid.");
  }
  const db = admin.firestore();
  const loanCollection = isProduction ? "simpanPinjam" : "simpanPinjam_testing";
  const markerCollection = isProduction
    ? "payrollInstallmentProgressions"
    : "payrollInstallmentProgressions_testing";
  const loanRef = db.collection(loanCollection).doc(loanId);
  const markerRef = db.collection(markerCollection).doc(markerId(payrollPeriod, loanId));

  try {
    return await db.runTransaction(async (transaction) => {
      const [loanSnapshot, markerSnapshot] = await Promise.all([
        transaction.get(loanRef),
        transaction.get(markerRef),
      ]);
      if (markerSnapshot.exists) {
        return { ...markerSnapshot.data().receipt, outcome: "already_applied", idempotent: true };
      }
      if (!loanSnapshot.exists) {
        throw new LoanProgressionError("LOAN_NOT_FOUND", "Pinjaman tidak ditemukan.");
      }
      const loan = loanSnapshot.data();
      const resolvedStatus = resolveLoanStatus(loan);
      if (
        resolvedStatus !== ACTIVE_STATUS ||
        (Number(loan.sisaHutang) || 0) <= 0 ||
        (Number(loan.jumlahMenyicil) || 0) >= (Number(loan.tenor) || 0)
      ) {
        throw new LoanProgressionError("LOAN_NOT_ACTIVE", "Pinjaman tidak dapat dicicil.");
      }
      const planItem = buildPlanItem({ id: loanId, ...loan });
      const timestamp = Timestamp.now();
      const progression = progressLoanData({
        loan,
        planItem,
        payrollPeriod,
        operationId: `manual_${payrollPeriod}_${loanId}`,
        actor: { uid: actor.uid, name: actor.name, source: "koperasi_manual" },
        timestamp,
      });
      const update = {
        ...progression.update,
        updatedAt: timestamp,
      };
      transaction.update(loanRef, update);
      transaction.create(markerRef, {
        schemaVersion: 1,
        payrollPeriod,
        loanId,
        borrowerUserId: loan.userId || null,
        operationId: `manual_${payrollPeriod}_${loanId}`,
        planHash: null,
        source: "koperasi_manual",
        actor,
        receipt: progression.receipt,
        createdAt: timestamp,
      });
      return { ...progression.receipt, idempotent: false };
    });
  } catch (error) {
    if (error instanceof LoanProgressionError) {
      throw new HttpsError("failed-precondition", error.message, { code: error.code });
    }
    throw error;
  }
});

module.exports = { payrollLoanBridge, recordManualLoanInstallment };
