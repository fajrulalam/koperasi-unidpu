const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const { bridgeSignature } = require("./loanProgression");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Run this test through the Firebase Firestore emulator.");
}

const projectId = process.env.GCLOUD_PROJECT || "demo-koperasi";
const secret = process.env.INTERNAL_PAYROLL_HMAC_SECRET;
if (!secret) throw new Error("INTERNAL_PAYROLL_HMAC_SECRET is required.");

admin.initializeApp({ projectId });
const db = admin.firestore();
const functionBase = `http://127.0.0.1:5001/${projectId}/us-central1`;

function activeLoan({ id, userId, name, principal, tenor, paid, balance }) {
  const activatedAt = admin.firestore.Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"));
  return {
    id,
    userId,
    status: "Disetujui dan Aktif",
    jumlahPinjaman: principal,
    tenor,
    jumlahMenyicil: paid,
    sisaHutang: balance,
    tanggalDisetujui: activatedAt,
    userData: { namaLengkap: name },
    history: [{ status: "Disetujui dan Aktif", timestamp: activatedAt }],
  };
}

async function bridge(payload) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(`${functionBase}/payrollLoanBridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-payroll-timestamp": timestamp,
      "x-payroll-signature": bridgeSignature(secret, timestamp, body),
    },
    body,
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

function requestPayload({ action, operationId, employee, expectedDeduction, plan }) {
  return {
    schemaVersion: 1,
    action,
    payrollPeriod: "2026-07",
    operationId,
    slipId: operationId.replace(/^payroll_/, ""),
    employee,
    expectedDeduction,
    ...(plan ? { plan } : {}),
    actor: { uid: "finance-1", name: "Finance" },
  };
}

async function createManualActor() {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `finance-${Date.now()}@example.test`,
        password: "integration-test-password",
        returnSecureToken: true,
      }),
    },
  );
  const identity = await response.json();
  assert.equal(response.status, 200, JSON.stringify(identity));
  await db.collection("users").doc(identity.localId).set({
    uid: identity.localId,
    nama: "Koperasi Finance",
    role: "BAK",
  });
  return identity;
}

async function callManualInstallment({ identity, loanId }) {
  const response = await fetch(`${functionBase}/recordManualLoanInstallment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${identity.idToken}`,
    },
    body: JSON.stringify({ data: { loanId, payrollPeriod: "2026-07", isProduction: true } }),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

async function main() {
  const loanA = activeLoan({
    id: "loan-final",
    userId: "borrower-one",
    name: "Integration Employee",
    principal: 3_900_000,
    tenor: 12,
    paid: 11,
    balance: 325_000,
  });
  const loanB = activeLoan({
    id: "loan-active",
    userId: "borrower-one",
    name: "Integration Employee",
    principal: 1_200_000,
    tenor: 12,
    paid: 2,
    balance: 1_000_000,
  });
  await Promise.all([
    db.collection("simpanPinjam").doc(loanA.id).set(loanA),
    db.collection("simpanPinjam").doc(loanB.id).set(loanB),
  ]);

  const employee = {
    id: "employee-one",
    name: "Integration Employee",
    koperasiAuthUid: "borrower-one",
  };
  const base = { operationId: "payroll_2026_07_employee_one", employee, expectedDeduction: 425_000 };
  const plan = await bridge(requestPayload({ action: "preview", ...base }));
  const applyPayload = requestPayload({ action: "apply", ...base, plan });
  const concurrent = await Promise.all([bridge(applyPayload), bridge(applyPayload)]);
  const outcomes = concurrent.flatMap((receipt) => receipt.loans.map((loan) => loan.outcome));
  assert(outcomes.includes("paid_off"));
  assert(outcomes.includes("advanced"));
  assert.equal(outcomes.filter((outcome) => outcome === "already_applied").length, 2);

  const [finalSnapshot, activeSnapshot] = await Promise.all([
    db.collection("simpanPinjam").doc(loanA.id).get(),
    db.collection("simpanPinjam").doc(loanB.id).get(),
  ]);
  assert.equal(finalSnapshot.data().jumlahMenyicil, 12);
  assert.equal(finalSnapshot.data().sisaHutang, 0);
  assert.equal(finalSnapshot.data().status, "Lunas");
  assert.equal(activeSnapshot.data().jumlahMenyicil, 3);

  const manualLoan = activeLoan({
    id: "loan-manual-race",
    userId: "borrower-two",
    name: "Manual Race Employee",
    principal: 1_200_000,
    tenor: 12,
    paid: 2,
    balance: 1_000_000,
  });
  await db.collection("simpanPinjam").doc(manualLoan.id).set(manualLoan);
  const manualEmployee = {
    id: "employee-two",
    name: "Manual Race Employee",
    koperasiAuthUid: "borrower-two",
  };
  const manualBase = {
    operationId: "payroll_2026_07_employee_two",
    employee: manualEmployee,
    expectedDeduction: 100_000,
  };
  const manualPlan = await bridge(requestPayload({ action: "preview", ...manualBase }));
  const identity = await createManualActor();
  await Promise.all([
    bridge(requestPayload({ action: "apply", ...manualBase, plan: manualPlan })),
    callManualInstallment({ identity, loanId: manualLoan.id }),
  ]);

  const racedSnapshot = await db.collection("simpanPinjam").doc(manualLoan.id).get();
  const racedData = racedSnapshot.data();
  assert.equal(racedData.jumlahMenyicil, 3);
  assert.equal(
    racedData.history.filter(
      (entry) => entry.status === "Pembayaran Cicilan" && entry.payrollPeriod === "2026-07",
    ).length,
    1,
  );
  assert.equal(
    (await db.collection("payrollInstallmentProgressions").doc("2026-07__loan-manual-race").get()).exists,
    true,
  );

  process.stdout.write("Payroll loan emulator integration passed.\n");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
