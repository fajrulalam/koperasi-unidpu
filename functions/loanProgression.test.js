const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LoanProgressionError,
  bridgeSignature,
  hashPlan,
  isBridgeSignatureValid,
  isManualRoleAllowed,
  progressLoanData,
  resolveInstallmentPlan,
  resolveLoanStatus,
} = require("./loanProgression");

const timestamp = (seconds) => ({ seconds, nanoseconds: 0 });
const timestampAt = (iso) => timestamp(Math.floor(new Date(iso).getTime() / 1000));

test("bridge signatures reject tampering and stale requests", () => {
  const body = JSON.stringify({ action: "preview" });
  const requestTimestamp = "1775000000";
  const signature = bridgeSignature("a-secure-shared-secret", requestTimestamp, body);
  assert.equal(isBridgeSignatureValid({
    secret: "a-secure-shared-secret",
    timestamp: requestTimestamp,
    body,
    signature,
    nowSeconds: 1775000010,
  }), true);
  assert.equal(isBridgeSignatureValid({
    secret: "a-secure-shared-secret",
    timestamp: requestTimestamp,
    body: `${body} `,
    signature,
    nowSeconds: 1775000010,
  }), false);
  assert.equal(isBridgeSignatureValid({
    secret: "a-secure-shared-secret",
    timestamp: requestTimestamp,
    body,
    signature,
    nowSeconds: 1775001000,
  }), false);
});

test("manual installment authority is limited to existing Simpan Pinjam roles", () => {
  assert.equal(isManualRoleAllowed("BAK"), true);
  assert.equal(isManualRoleAllowed("Wakil Rektor 2"), true);
  assert.equal(isManualRoleAllowed("Member"), false);
  assert.equal(isManualRoleAllowed("Cashier"), false);
});

function activeLoan(overrides = {}) {
  return {
    id: "loan-1",
    userId: "koperasi-user-1",
    status: "Disetujui dan Aktif",
    jumlahPinjaman: 3_900_000,
    tenor: 12,
    jumlahMenyicil: 10,
    sisaHutang: 650_000,
    tanggalDisetujui: timestamp(1_767_225_600),
    userData: { namaLengkap: "Siti Rofiah" },
    history: [{ status: "Disetujui dan Aktif", timestamp: timestamp(1_767_225_600) }],
    ...overrides,
  };
}

test("UID matching creates a deterministic frozen installment plan", () => {
  const plan = resolveInstallmentPlan({
    loans: [activeLoan()],
    employee: { name: "Different Name", koperasiAuthUid: "koperasi-user-1" },
    payrollPeriod: "2026-07",
    expectedDeduction: 325_000,
  });

  assert.equal(plan.matchType, "uid");
  assert.equal(plan.loans.length, 1);
  assert.equal(plan.loans[0].paidAfter, 11);
  assert.equal(plan.loans[0].balanceAfter, 325_000);
  assert.equal(plan.planHash, hashPlan(plan));
});

test("name overrides are used only when UID has no eligible loan", () => {
  const plan = resolveInstallmentPlan({
    loans: [activeLoan()],
    employee: { name: "Siti Rofi'ah, A. Md.", koperasiAuthUid: "stale-uid" },
    payrollPeriod: "2026-07",
    expectedDeduction: 325_000,
  });
  assert.equal(plan.matchType, "name");
  assert.equal(plan.resolvedUserId, "koperasi-user-1");
});

test("all active loans under the resolved borrower are included", () => {
  const second = activeLoan({ id: "loan-2", jumlahPinjaman: 1_200_000, tenor: 12, jumlahMenyicil: 2, sisaHutang: 1_000_000 });
  const plan = resolveInstallmentPlan({
    loans: [activeLoan(), second],
    employee: { name: "Siti Rofiah", koperasiAuthUid: "koperasi-user-1" },
    payrollPeriod: "2026-07",
    expectedDeduction: 425_000,
  });
  assert.deepEqual(plan.loans.map((loan) => loan.loanId), ["loan-1", "loan-2"]);
});

test("pending restructuring keeps the original monthly installment payable", () => {
  const originalLoan = activeLoan({
    id: "lxZoVJ1IIDfPJGembkSb",
    userId: "8k7erklRjiaJzXIJ4RJjfn38O9k1",
    status: "Menunggu Persetujuan Restrukturisasi",
    jumlahPinjaman: 2_000_000,
    tenor: 10,
    jumlahMenyicil: 8,
    sisaHutang: 400_000,
    restructuredToLoanId: "F9Q2sLi7czDl2wfqGfB6",
    userData: { namaLengkap: "Khamim Mansyur" },
    history: [
      { status: "Disetujui dan Aktif", timestamp: timestampAt("2025-11-10T00:00:00+07:00") },
      { status: "Pembayaran Cicilan", timestamp: timestampAt("2026-07-07T00:00:00+07:00") },
      { status: "Menunggu Persetujuan Restrukturisasi", timestamp: timestampAt("2026-08-03T00:00:00+07:00") },
    ],
  });
  const pendingReplacement = activeLoan({
    id: "F9Q2sLi7czDl2wfqGfB6",
    userId: "8k7erklRjiaJzXIJ4RJjfn38O9k1",
    status: "Menunggu Persetujuan Wakil Rektor 2",
    jumlahPinjaman: 4_800_000,
    tenor: 12,
    jumlahMenyicil: 0,
    sisaHutang: 4_800_000,
    restructuredFromLoanId: "lxZoVJ1IIDfPJGembkSb",
    userData: { namaLengkap: "Khamim Mansyur" },
    history: [
      { status: "Menunggu Persetujuan Wakil Rektor 2", timestamp: timestampAt("2026-08-03T00:00:00+07:00") },
    ],
  });
  const employee = {
    id: "Loyalis_070",
    name: "Khamim Mansyur,S.AB",
    koperasiAuthUid: "8k7erklRjiaJzXIJ4RJjfn38O9k1",
  };

  const augustPlan = resolveInstallmentPlan({
    loans: [originalLoan, pendingReplacement],
    employee,
    payrollPeriod: "2026-08",
    expectedDeduction: 200_000,
  });
  assert.deepEqual(augustPlan.loans.map((loan) => loan.loanId), ["lxZoVJ1IIDfPJGembkSb"]);
  assert.equal(augustPlan.loans[0].paidAfter, 9);
  assert.equal(augustPlan.loans[0].balanceAfter, 200_000);

  const progression = progressLoanData({
    loan: originalLoan,
    planItem: augustPlan.loans[0],
    payrollPeriod: "2026-08",
    operationId: "2026_08_Loyalis_070",
    actor: { uid: "finance-1", name: "Finance", source: "internal_bak_payroll" },
    timestamp: timestampAt("2026-08-31T00:00:00+07:00"),
  });
  assert.equal(progression.update.status, "Menunggu Persetujuan Restrukturisasi");
  assert.equal(progression.update.jumlahMenyicil, 9);
  assert.equal(progression.update.sisaHutang, 200_000);

  const progressedLoan = { ...originalLoan, ...progression.update };
  assert.equal(resolveLoanStatus(progressedLoan), "Menunggu Persetujuan Restrukturisasi");
  const septemberPlan = resolveInstallmentPlan({
    loans: [progressedLoan, pendingReplacement],
    employee,
    payrollPeriod: "2026-09",
    expectedDeduction: 200_000,
  });
  assert.equal(septemberPlan.loans[0].paidBefore, 9);
  assert.equal(septemberPlan.loans[0].willPayOff, true);
});

test("ambiguous fallback borrowers block the plan", () => {
  assert.throws(
    () => resolveInstallmentPlan({
      loans: [activeLoan(), activeLoan({ id: "loan-2", userId: "koperasi-user-2" })],
      employee: { name: "Siti Rofiah" },
      payrollPeriod: "2026-07",
      expectedDeduction: 650_000,
    }),
    (error) => error instanceof LoanProgressionError && error.code === "AMBIGUOUS_BORROWER",
  );
});

test("inactive and future-activation loans do not enter payroll", () => {
  const plan = resolveInstallmentPlan({
    loans: [
      activeLoan({ id: "paid", status: "Lunas", history: [{ status: "Lunas", timestamp: timestamp(1_767_225_600) }] }),
      activeLoan({ id: "future", tanggalDisetujui: "2026-08-01T00:00:00.000Z", history: [] }),
    ],
    employee: { name: "Siti Rofiah", koperasiAuthUid: "koperasi-user-1" },
    payrollPeriod: "2026-07",
    expectedDeduction: 0,
  });
  assert.deepEqual(plan.loans, []);
});

test("deduction mismatch blocks draft preparation", () => {
  assert.throws(
    () => resolveInstallmentPlan({
      loans: [activeLoan()],
      employee: { name: "Siti Rofiah", koperasiAuthUid: "koperasi-user-1" },
      payrollPeriod: "2026-07",
      expectedDeduction: 300_000,
    }),
    (error) => error instanceof LoanProgressionError && error.code === "DEDUCTION_MISMATCH",
  );
});

test("final installment records payment and Lunas atomically", () => {
  const loan = activeLoan({ jumlahMenyicil: 11, sisaHutang: 325_000 });
  const plan = resolveInstallmentPlan({
    loans: [loan],
    employee: { name: "Siti Rofiah", koperasiAuthUid: "koperasi-user-1" },
    payrollPeriod: "2026-07",
    expectedDeduction: 325_000,
  });
  const result = progressLoanData({
    loan,
    planItem: plan.loans[0],
    payrollPeriod: "2026-07",
    operationId: "2026_07_employee-1",
    actor: { uid: "finance-1", name: "Finance", source: "internal_bak_payroll" },
    timestamp: timestamp(1_775_000_000),
  });

  assert.equal(result.update.status, "Lunas");
  assert.equal(result.update.jumlahMenyicil, 12);
  assert.equal(result.update.sisaHutang, 0);
  assert.deepEqual(result.update.history.slice(-2).map((entry) => entry.status), [
    "Pembayaran Cicilan",
    "Lunas",
  ]);
  assert.equal(result.receipt.outcome, "paid_off");
});

test("changed loan counters invalidate the frozen plan", () => {
  const loan = activeLoan();
  const plan = resolveInstallmentPlan({
    loans: [loan],
    employee: { name: "Siti Rofiah", koperasiAuthUid: "koperasi-user-1" },
    payrollPeriod: "2026-07",
    expectedDeduction: 325_000,
  });
  assert.throws(
    () => progressLoanData({
      loan: { ...loan, jumlahMenyicil: 11, sisaHutang: 325_000 },
      planItem: plan.loans[0],
      payrollPeriod: "2026-07",
      operationId: "2026_07_employee-1",
      actor: { uid: "finance-1", source: "internal_bak_payroll" },
      timestamp: timestamp(1_775_000_000),
    }),
    (error) => error instanceof LoanProgressionError && error.code === "LOAN_STATE_CHANGED",
  );
});
