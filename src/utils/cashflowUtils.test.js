import {
  buildCashflowRows,
  censorAmount,
  filterRowsByAccount,
  getClosingsByDate,
  getMonthKeysBetween,
  getMonthRange,
  getPaymentBreakdown,
  reconcileDay,
  summarizeSales,
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
