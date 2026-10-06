// Month-to-month carry of the cashflow ledger, against a small in-memory
// Firestore. Sales come straight from transactionDetail, so a month's closing
// must include days that never had a Laporan Harian.
import { cashflowService } from "./cashflowService";

let mockStore = {};

const mockMatches = (data, constraint) => {
  if (constraint.type !== "where") return true;
  const raw = data[constraint.field];
  if (raw === undefined) return false;
  const value = raw?.toDate ? raw.toDate() : raw;
  const target = constraint.value;
  switch (constraint.op) {
    case ">=": return value >= target;
    case "<=": return value <= target;
    case "<": return value < target;
    case "==": return value === target;
    default: throw new Error(`unsupported op ${constraint.op}`);
  }
};

jest.mock("firebase/firestore", () => {
  const docsIn = (collectionPath) =>
    Object.entries(mockStore)
      .filter(([path]) => path.startsWith(`${collectionPath}/`) && path.split("/").length === 2)
      .map(([path, data]) => ({ id: path.split("/")[1], data }));
  const merge = (path, data) => {
    mockStore[path] = { ...(mockStore[path] || {}), ...data };
  };
  return {
    query: (ref, ...constraints) => ({ ref, constraints }),
    where: (field, op, value) => ({ type: "where", field, op, value }),
    orderBy: (field, direction = "asc") => ({ type: "orderBy", field, direction }),
    limit: (n) => ({ type: "limit", n }),
    getDocs: async (q) => {
      const ref = q.ref || q;
      const constraints = q.constraints || [];
      let docs = docsIn(ref.path).filter(({ data }) => constraints.every((c) => mockMatches(data, c)));
      const order = constraints.find((c) => c.type === "orderBy");
      if (order) {
        docs.sort((a, b) => String(a.data[order.field]).localeCompare(String(b.data[order.field])));
        if (order.direction === "desc") docs.reverse();
      }
      const lim = constraints.find((c) => c.type === "limit");
      if (lim) docs = docs.slice(0, lim.n);
      return {
        empty: docs.length === 0,
        docs: docs.map(({ id, data }) => ({ id, data: () => data })),
      };
    },
    getDoc: async (ref) => ({
      exists: () => mockStore[ref.path] !== undefined,
      data: () => mockStore[ref.path],
    }),
    setDoc: async (ref, data, options) => {
      if (options?.merge) merge(ref.path, data);
      else mockStore[ref.path] = { ...data };
    },
    updateDoc: async (ref, data) => {
      if (!mockStore[ref.path]) throw new Error(`no document ${ref.path}`);
      merge(ref.path, data);
    },
    addDoc: async () => {},
    deleteDoc: async (ref) => {
      delete mockStore[ref.path];
    },
    writeBatch: () => {
      const ops = [];
      return {
        update: (ref, data) => ops.push(() => merge(ref.path, data)),
        set: (ref, data, options) =>
          ops.push(() => (options?.merge ? merge(ref.path, data) : (mockStore[ref.path] = { ...data }))),
        commit: async () => ops.forEach((op) => op()),
      };
    },
    serverTimestamp: () => "SERVER_TIMESTAMP",
    deleteField: () => undefined,
    arrayUnion: (...values) => values,
  };
});

jest.mock("../firebase", () => ({
  db: {},
  getEnvironmentCollection: (name) => ({ path: name }),
  getEnvironmentDoc: (name, id) => ({ path: `${name}/${id}` }),
}));

const ts = (iso) => ({ toDate: () => new Date(iso) });
const sale = (iso, { cash = 0, qris = 0, kredit = 0 }) => ({
  createdAt: ts(iso),
  total: cash + qris + kredit,
  cashAmount: cash,
  qrisAmount: qris,
  kreditAmount: kredit,
});

describe("cashflow carry from month to month", () => {
  beforeEach(() => {
    mockStore = {};
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date("2026-10-06T10:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("a month opens with the previous month's final closing", async () => {
    mockStore["cashflowSettings/2026-09"] = {
      closingCash: 700000, closingQris: 80000, closingKredit: 15000, closingFinal: true,
    };

    await expect(cashflowService.fetchOpeningBalance("2026-10", false)).resolves.toEqual({
      cash: 700000, qris: 80000, kredit: 15000, isOverride: false,
    });
  });

  test("a hand-set opening balance wins", async () => {
    mockStore["cashflowSettings/2026-10"] = { openingCash: 5000, openingQris: 0, openingKredit: 0 };
    mockStore["cashflowSettings/2026-09"] = { closingCash: 700000, closingFinal: true };

    await expect(cashflowService.fetchOpeningBalance("2026-10", false)).resolves.toMatchObject({
      cash: 5000, isOverride: true,
    });
  });

  test("a stored closing alone is not mistaken for a hand-set opening", async () => {
    mockStore["cashflowSettings/2026-10"] = { closingCash: 123, closingFinal: false };
    mockStore["cashflowSettings/2026-09"] = { closingCash: 700000, closingQris: 0, closingKredit: 0, closingFinal: true };

    await expect(cashflowService.fetchOpeningBalance("2026-10", false)).resolves.toMatchObject({
      cash: 700000, isOverride: false,
    });
  });

  test("a month stored before it ended is recomputed with all its sales, then kept as final", async () => {
    mockStore["cashflowSettings/2026-08"] = { closingCash: 1000000, closingQris: 0, closingKredit: 0, closingFinal: true };
    // Stored mid-September, before the last sales came in
    mockStore["cashflowSettings/2026-09"] = { closingCash: 1000100, closingQris: 0, closingKredit: 0, closingFinal: false };
    // September sales, none of them with a Laporan Harian
    mockStore["transactionDetail/t1"] = sale("2026-09-10T09:00:00", { cash: 100 });
    mockStore["transactionDetail/t2"] = sale("2026-09-30T21:00:00", { cash: 50000, qris: 40000 });
    mockStore["transactionDetail/t3"] = sale("2026-10-01T08:00:00", { cash: 999 }); // October: not September
    mockStore["expenses/e1"] = { date: "2026-09-15", month: "2026-09", amount: 20000, sourceAccount: "cash" };

    const opening = await cashflowService.fetchOpeningBalance("2026-10", false);

    expect(opening).toEqual({ cash: 1030100, qris: 40000, kredit: 0, isOverride: false });
    expect(mockStore["cashflowSettings/2026-09"]).toMatchObject({
      closingCash: 1030100, closingQris: 40000, closingKredit: 0, closingFinal: true,
    });
  });

  test("the current month's closing is stored but not final", async () => {
    mockStore["cashflowSettings/2026-09"] = { closingCash: 0, closingQris: 0, closingKredit: 0, closingFinal: true };
    mockStore["transactionDetail/t1"] = sale("2026-10-06T22:52:00", { qris: 40000 });

    const closing = await cashflowService.syncMonthClosings("2026-10", false);

    expect(closing).toEqual({ cash: 0, qris: 40000, kredit: 0 });
    expect(mockStore["cashflowSettings/2026-10"]).toMatchObject({ closingQris: 40000, closingFinal: false });
  });

  test("month data includes the POS's sales for every day", async () => {
    mockStore["cashflowSettings/2026-09"] = { closingCash: 0, closingQris: 0, closingKredit: 0, closingFinal: true };
    mockStore["transactionDetail/t1"] = sale("2026-10-06T22:52:00", { qris: 40000 });
    mockStore["transactionDetail/t2"] = sale("2026-10-02T10:00:00", { cash: 15000, kredit: 5000 });

    const data = await cashflowService.fetchMonthData("2026-10", false);

    expect(data.sales).toEqual([
      { date: "2026-10-02", cash: 15000, qris: 0, kredit: 5000, total: 20000, count: 1 },
      { date: "2026-10-06", cash: 0, qris: 40000, kredit: 0, total: 40000, count: 1 },
    ]);
  });

  test("the carry chain stops at the ledger's first month", async () => {
    await expect(cashflowService.fetchOpeningBalance("2024-01", false)).resolves.toEqual({
      cash: 0, qris: 0, kredit: 0, isOverride: false,
    });
  });

  test("deleting a sale on a day without Laporan Harian still updates the balances", async () => {
    mockStore["cashflowSettings/2026-09"] = { closingCash: 0, closingQris: 0, closingKredit: 0, closingFinal: true };
    mockStore["transactionDetail/t1"] = sale("2026-10-06T22:52:00", { qris: 40000 });
    await cashflowService.syncMonthClosings("2026-10", false);
    expect(mockStore["cashflowSettings/2026-10"].closingQris).toBe(40000);

    delete mockStore["transactionDetail/t1"];
    await cashflowService.updateDailyReportSales("2026-10-06", false);

    expect(mockStore["cashflowSettings/2026-10"].closingQris).toBe(0);
    expect(mockStore["dailyFinancialReports/2026-10-06"]).toBeUndefined();
  });

  test("anchoring a day without Laporan Harian creates the day's document", async () => {
    mockStore["cashflowSettings/2026-09"] = { closingCash: 0, closingQris: 0, closingKredit: 0, closingFinal: true };
    mockStore["transactionDetail/t1"] = sale("2026-10-06T22:52:00", { cash: 60000 });

    await cashflowService.anchorBalance("2026-10-06", { cash: 50000 }, "admin@unipdu.ac.id", false);

    expect(mockStore["dailyFinancialReports/2026-10-06"]).toMatchObject({
      date: "2026-10-06", month: "2026-10", anchorCash: 50000, anchoredBy: "admin@unipdu.ac.id",
    });
    expect(mockStore["dailyFinancialReports/2026-10-06"].submittedBy).toBeUndefined();
    expect(mockStore["cashflowSettings/2026-10"].closingCash).toBe(50000);
  });

  test("a submitted Laporan Harian keeps its stored discrepancy and closing", async () => {
    mockStore["cashflowSettings/2026-09"] = { closingCash: 0, closingQris: 0, closingKredit: 0, closingFinal: true };
    mockStore["transactionDetail/t1"] = sale("2026-10-05T10:00:00", { cash: 100000 });
    mockStore["dailyFinancialReports/2026-10-05"] = {
      date: "2026-10-05", month: "2026-10", submittedBy: "kasir",
      systemSalesCash: 100000, actualCash: 95000, discrepancyCash: -5000,
    };

    const closing = await cashflowService.syncMonthClosings("2026-10", false);

    expect(closing.cash).toBe(95000);
    expect(mockStore["dailyFinancialReports/2026-10-05"].closingCash).toBe(95000);
  });
});
