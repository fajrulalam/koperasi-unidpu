import {
  buildCashflowRows,
  censorAmount,
  filterRowsByAccount,
  getClosingsByDate,
  getMonthKeysBetween,
  getMonthRange,
  getPaymentBreakdown,
  getPreviousMonthKey,
  isReportSubmitted,
  reconcileDay,
  summarizeSales,
  summarizeSalesByDate,
  toLocalDateKey,
} from "./cashflowUtils";

describe("payment breakdown", () => {
  test("puts the voucher portion into Kredit and the rest into its method", () => {
    expect(
      getPaymentBreakdown({
        total: 100000,
        kreditAmount: 30000,
        cashAmount: 50000,
        qrisAmount: 20000,
      })
    ).toEqual({ cash: 50000, qris: 20000, kredit: 30000 });
  });

  test("reads legacy voucher discounts as Kredit", () => {
    expect(
      getPaymentBreakdown({
        total: 80000,
        voucherDiscount: 80000,
        discountedTotal: 0,
        cashAmount: 0,
        qrisAmount: 0,
      })
    ).toEqual({ cash: 0, qris: 0, kredit: 80000 });
  });

  test("reads transactions written before split payments existed", () => {
    expect(getPaymentBreakdown({ total: 25000, isPaidViaQris: true })).toEqual(
      { cash: 0, qris: 25000, kredit: 0 }
    );
    expect(
      getPaymentBreakdown({
        total: 40000,
        voucherDiscount: 15000,
        discountedTotal: 25000,
      })
    ).toEqual({ cash: 25000, qris: 0, kredit: 15000 });
  });

  test("summarizes a day of sales per account", () => {
    expect(
      summarizeSales([
        { total: 10000, cashAmount: 10000, qrisAmount: 0 },
        { total: 5000.4, cashAmount: 0, qrisAmount: 5000.4 },
        { total: 20000, kreditAmount: 20000, cashAmount: 0, qrisAmount: 0 },
      ])
    ).toEqual({ cash: 10000, qris: 5000, kredit: 20000, total: 35000, count: 3 });
  });
});

describe("end-of-day reconciliation", () => {
  test("compares counted money with sales minus expenses per account", () => {
    const result = reconcileDay({
      sales: { cash: 500000, qris: 200000, kredit: 75000 },
      expenses: { cash: 40000, qris: 0, kredit: 0 },
      actual: { cash: 455000, qris: 200000 },
    });

    expect(result.expected).toEqual({ cash: 460000, qris: 200000, kredit: 75000 });
    expect(result.actual).toEqual({ cash: 455000, qris: 200000, kredit: 75000 });
    expect(result.discrepancy).toEqual({ cash: -5000, qris: 0, kredit: 0 });
  });
});

describe("cashflow ledger rows", () => {
  const opening = { cash: 1000000, qris: 0, kredit: 50000 };
  const reports = [
    {
      date: "2026-10-01",
      submittedBy: "kasir@unipdu.ac.id",
      systemSalesCash: 300000,
      systemSalesQris: 100000,
      systemSalesKredit: 40000,
      discrepancyCash: -2000,
      discrepancyQris: 0,
      discrepancyKredit: 0,
      isDiscrepancyConfirmed: false,
    },
    {
      date: "2026-10-02",
      submittedBy: "kasir@unipdu.ac.id",
      systemSalesCash: 200000,
      systemSalesQris: 0,
      systemSalesKredit: 0,
      anchorQris: 90000,
    },
  ];
  const expenses = [
    { id: "e1", date: "2026-10-01", category: "Token Listrik", amount: 50000, sourceAccount: "cash" },
    { id: "e2", date: "2026-10-02", category: "Es Batu", amount: 5000, sourceAccount: "qris" },
  ];
  const transfers = [
    { id: "t1", date: "2026-10-02", amount: 60000, fromAccount: "kredit", toAccount: "cash", description: "Pelunasan Kredit" },
  ];

  const rows = buildCashflowRows({ reports, expenses, transfers, opening });

  test("orders each day as sales, discrepancy, expenses, transfers, adjustment", () => {
    expect(rows.map((row) => row.rowType)).toEqual([
      "opening",
      "sales",
      "discrepancy",
      "expense",
      "sales",
      "expense",
      "transfer",
      "adjustment",
      "closing",
    ]);
  });

  test("runs a balance per account", () => {
    const closing = rows[rows.length - 1].balances;
    // cash: 1.000.000 + 300.000 - 2.000 - 50.000 + 200.000 + 60.000
    expect(closing.cash).toBe(1508000);
    // kredit: 50.000 + 40.000 - 60.000 settled into cash
    expect(closing.kredit).toBe(30000);
  });

  test("anchors pin the balance after that day's expenses", () => {
    const adjustment = rows.find((row) => row.rowType === "adjustment");
    // qris before anchor: 100.000 - 5.000 = 95.000
    expect(adjustment.amounts.qris).toBe(-5000);
    expect(adjustment.balances.qris).toBe(90000);
    expect(adjustment.anchoredAccounts).toEqual(["qris"]);
  });

  test("records each day's closing balance", () => {
    expect(getClosingsByDate(rows)).toEqual({
      "2026-10-01": { cash: 1248000, qris: 100000, kredit: 90000 },
      "2026-10-02": { cash: 1508000, qris: 90000, kredit: 30000 },
    });
  });

  test("filters rows that do not touch the selected account", () => {
    const kreditRows = filterRowsByAccount(rows, "kredit").map(
      (row) => row.rowType
    );
    expect(kreditRows).toEqual(["opening", "sales", "sales", "transfer", "closing"]);
  });
});

describe("sales rows come from the POS, not from Laporan Harian", () => {
  const ts = (iso) => ({ toDate: () => new Date(iso) });
  const opening = { cash: 0, qris: 0, kredit: 0 };

  test("summarizes the POS's transactions per local day", () => {
    const days = summarizeSalesByDate([
      { createdAt: ts("2026-10-06T22:52:00"), total: 40000, qrisAmount: 40000, cashAmount: 0, kreditAmount: 0 },
      { createdAt: ts("2026-10-06T09:00:00"), total: 10000, cashAmount: 10000, qrisAmount: 0, kreditAmount: 0 },
      { createdAt: ts("2026-10-05T12:00:00"), total: 25000, kreditAmount: 25000, cashAmount: 0, qrisAmount: 0 },
      { total: 99999 }, // no date: ignored
    ]);
    expect(days).toEqual([
      { date: "2026-10-05", cash: 0, qris: 0, kredit: 25000, total: 25000, count: 1 },
      { date: "2026-10-06", cash: 10000, qris: 40000, kredit: 0, total: 50000, count: 2 },
    ]);
  });

  test("a day with a sale gets a Sales row even before Laporan Harian is sent", () => {
    const rows = buildCashflowRows({
      sales: [{ date: "2026-10-06", cash: 0, qris: 40000, kredit: 0, total: 40000, count: 1 }],
      opening,
    });

    const sales = rows.find((row) => row.rowType === "sales");
    expect(sales).toMatchObject({ rawDate: "2026-10-06", transactionCount: 1, report: null });
    expect(sales.amounts).toEqual({ cash: 0, qris: 40000, kredit: 0 });
    expect(rows.some((row) => row.rowType === "discrepancy")).toBe(false);
    expect(rows[rows.length - 1].balances).toEqual({ cash: 0, qris: 40000, kredit: 0 });
  });

  test("adds a Discrepancy row when the Laporan Harian count does not match", () => {
    const rows = buildCashflowRows({
      sales: [{ date: "2026-10-06", cash: 100000, qris: 40000, kredit: 0, total: 140000, count: 5 }],
      reports: [{
        date: "2026-10-06",
        submittedBy: "kasir@unipdu.ac.id",
        systemSalesCash: 100000, systemSalesQris: 40000, systemSalesKredit: 0,
        discrepancyCash: -5000, discrepancyQris: 0, discrepancyKredit: 0,
      }],
      opening,
    });

    expect(rows.map((row) => row.rowType)).toEqual(["opening", "sales", "discrepancy", "closing"]);
    expect(rows[1].report.submittedBy).toBe("kasir@unipdu.ac.id");
    expect(rows[2].amounts).toEqual({ cash: -5000, qris: 0, kredit: 0 });
    expect(rows[3].balances.cash).toBe(95000);
  });

  test("no Discrepancy row when the count matches", () => {
    const rows = buildCashflowRows({
      sales: [{ date: "2026-10-06", cash: 100000, qris: 0, kredit: 0, total: 100000, count: 3 }],
      reports: [{ date: "2026-10-06", submittedBy: "kasir", systemSalesCash: 100000, discrepancyCash: 0 }],
      opening,
    });
    expect(rows.map((row) => row.rowType)).toEqual(["opening", "sales", "closing"]);
  });

  test("a sale made after the count adds to Sales without showing as missing money", () => {
    // Counted at 100.000 with no difference, then a 20.000 cash sale came in.
    const rows = buildCashflowRows({
      sales: [{ date: "2026-10-06", cash: 120000, qris: 0, kredit: 0, total: 120000, count: 4 }],
      reports: [{ date: "2026-10-06", submittedBy: "kasir", systemSalesCash: 100000, discrepancyCash: 0 }],
      opening,
    });
    expect(rows.map((row) => row.rowType)).toEqual(["opening", "sales", "closing"]);
    expect(rows[2].balances.cash).toBe(120000);
  });

  test("a day document that only holds an anchor is not a Laporan Harian", () => {
    const anchorOnly = { date: "2026-10-06", anchorCash: 50000, discrepancyCash: -999 };
    expect(isReportSubmitted(anchorOnly)).toBe(false);

    const rows = buildCashflowRows({
      sales: [{ date: "2026-10-06", cash: 60000, qris: 0, kredit: 0, total: 60000, count: 2 }],
      reports: [anchorOnly],
      opening,
    });
    expect(rows.map((row) => row.rowType)).toEqual(["opening", "sales", "adjustment", "closing"]);
    expect(rows[1].report).toBeNull();
    expect(rows[2].amounts.cash).toBe(-10000);
    expect(rows[3].balances.cash).toBe(50000);
  });

  test("legacy Tutup Buku days keep their imported sales", () => {
    const rows = buildCashflowRows({
      sales: [{ date: "2025-03-01", cash: 999999, qris: 0, kredit: 0, total: 999999, count: 40 }],
      reports: [{
        date: "2025-03-01", migratedFromLegacy: true, submittedBy: "lama",
        systemSalesCash: 500000, discrepancyCash: 2000,
      }],
      opening,
    });
    expect(rows[1].amounts.cash).toBe(500000);
    expect(rows[2].amounts.cash).toBe(2000);
  });

  test("lists days in date order across sales, reports and expenses", () => {
    const rows = buildCashflowRows({
      sales: [
        { date: "2026-10-03", cash: 1000, qris: 0, kredit: 0, total: 1000, count: 1 },
        { date: "2026-10-01", cash: 2000, qris: 0, kredit: 0, total: 2000, count: 1 },
      ],
      expenses: [{ id: "e", date: "2026-10-02", amount: 500, sourceAccount: "cash", category: "Es" }],
      opening,
    });
    expect(rows.filter((row) => row.rawDate).map((row) => `${row.rawDate}:${row.rowType}`)).toEqual([
      "2026-10-01:sales",
      "2026-10-02:expense",
      "2026-10-03:sales",
    ]);
  });

  test("date helpers", () => {
    expect(getPreviousMonthKey("2026-10")).toBe("2026-09");
    expect(getPreviousMonthKey("2026-01")).toBe("2025-12");
    expect(toLocalDateKey(ts("2026-10-06T23:59:00"))).toBe("2026-10-06");
    expect(toLocalDateKey(null)).toBeNull();
    expect(toLocalDateKey("not a date")).toBeNull();
  });
});

describe("Pembelian Grosir expenses paid from any account", () => {
  const opening = { cash: 1000000, qris: 200000, kredit: 90000 };
  const purchase = (id, sourceAccount, amount) => ({
    id,
    date: "2026-10-03",
    category: "Pembelian Grosir - Toko Maju",
    amount,
    sourceAccount,
    addedFrom: "bulkPurchase",
  });
  const rows = buildCashflowRows({
    expenses: [purchase("b1", "cash", 100000), purchase("b2", "qris", 30000), purchase("b3", "kredit", 40000)],
    opening,
  });

  test("takes each purchase out of the account it was paid from", () => {
    const closing = rows[rows.length - 1].balances;
    expect(closing).toEqual({ cash: 900000, qris: 170000, kredit: 50000 });
  });

  test("shows a Kredit purchase under the Kredit filter only", () => {
    const kreditRows = filterRowsByAccount(rows, "kredit").filter((row) => row.rowType === "expense");
    expect(kreditRows.map((row) => row.expense.id)).toEqual(["b3"]);
    expect(kreditRows[0].amounts).toEqual({ cash: 0, qris: 0, kredit: -40000 });
  });

  test("labels the row with the purchase description", () => {
    const expenseRow = rows.find((row) => row.rowType === "expense");
    expect(expenseRow.description).toBe("Pembelian Grosir - Toko Maju");
  });
});

describe("formatting helpers", () => {
  test("masks all digits after the first", () => {
    expect(censorAmount(1250000)).toBe("Rp 1.***.***");
    expect(censorAmount(0)).toBe("Rp 0");
  });

  test("returns the first and last day of a month", () => {
    expect(getMonthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  test("lists months across a year boundary", () => {
    expect(getMonthKeysBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(getMonthKeysBetween("2026-10", "2026-10")).toEqual(["2026-10"]);
  });
});
