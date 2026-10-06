// src/services/cashflowService.js
//
// Firestore access for the cashflow ledger (replicated from 375 POS):
//   dailyFinancialReports/{YYYY-MM-DD}  end-of-day report and closing balances
//   expenses                            money paid out of Cash or QRIS
//   cashflowTransfers                   money moved between accounts
//   cashflowSettings/{YYYY-MM}          opening balance override per month
import {
  addDoc,
  arrayUnion,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  db,
  getEnvironmentCollection,
  getEnvironmentDoc,
} from "../firebase";
import {
  ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  LEGACY_INITIAL_BALANCE,
  accountField,
  buildCashflowRows,
  emptyAmounts,
  getClosingsByDate,
  getLocalDateKey,
  getMonthKey,
  getMonthKeysBetween,
  getMonthRange,
  normalizeAccount,
  pickAccountFields,
  reconcileDay,
  summarizeSales,
  toAccountFields,
  toNumber,
} from "../utils/cashflowUtils";

const REPORTS = "dailyFinancialReports";
const EXPENSES = "expenses";
const TRANSFERS = "cashflowTransfers";
const SETTINGS = "cashflowSettings";
const LEGACY_CLOSINGS = "dailyClosings";
const LEGACY_MIGRATION_DOC = "legacyMigration";
const BATCH_LIMIT = 400;

const toDocs = (snapshot) =>
  snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }));

const createdAtMillis = (item) => item.createdAt?.toMillis?.() ?? 0;

const fetchByDateRange = async (collectionName, start, end, isProduction) => {
  const snapshot = await getDocs(
    query(
      getEnvironmentCollection(collectionName, isProduction),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "asc")
    )
  );
  return toDocs(snapshot).sort(
    (a, b) =>
      a.date.localeCompare(b.date) || createdAtMillis(a) - createdAtMillis(b)
  );
};

const reportRef = (dateKey, isProduction) =>
  getEnvironmentDoc(REPORTS, dateKey, isProduction);

const readReport = async (dateKey, isProduction) => {
  const snap = await getDoc(reportRef(dateKey, isProduction));
  if (!snap.exists()) {
    throw new Error(`Laporan harian ${dateKey} tidak ditemukan`);
  }
  return snap.data();
};

// ---------------------------------------------------------------------------
// Ledger reads
// ---------------------------------------------------------------------------

// The month's override wins; otherwise carry over the latest closing balance
// recorded before the month starts.
const fetchOpeningBalance = async (monthKey, isProduction) => {
  const settings = await getDoc(
    getEnvironmentDoc(SETTINGS, monthKey, isProduction)
  );
  if (settings.exists()) {
    return { ...pickAccountFields(settings.data(), "opening"), isOverride: true };
  }

  const { start } = getMonthRange(monthKey);
  const previous = await getDocs(
    query(
      getEnvironmentCollection(REPORTS, isProduction),
      where("date", "<", start),
      orderBy("date", "desc"),
      limit(1)
    )
  );
  if (!previous.empty) {
    return {
      ...pickAccountFields(previous.docs[0].data(), "closing"),
      isOverride: false,
    };
  }
  return { ...emptyAmounts(), isOverride: false };
};

const fetchMonthData = async (monthKey, isProduction) => {
  const { start, end } = getMonthRange(monthKey);
  const [reports, expenses, transfers, opening] = await Promise.all([
    fetchByDateRange(REPORTS, start, end, isProduction),
    fetchByDateRange(EXPENSES, start, end, isProduction),
    fetchByDateRange(TRANSFERS, start, end, isProduction),
    fetchOpeningBalance(monthKey, isProduction),
  ]);
  return { reports, expenses, transfers, opening };
};

// Rewrites each report's closing* fields so the next month's opening balance
// carries over correctly after any ledger change.
const syncMonthClosings = async (monthKey, isProduction) => {
  const data = await fetchMonthData(monthKey, isProduction);
  if (data.reports.length === 0) return;

  const closings = getClosingsByDate(buildCashflowRows(data));
  const batch = writeBatch(db);
  for (const report of data.reports) {
    batch.update(
      reportRef(report.id, isProduction),
      toAccountFields("closing", closings[report.date])
    );
  }
  await batch.commit();
};

// A month's opening balance carries over from the previous month's closings,
// so a change ripples through every later month up to the current one.
const syncClosingsFrom = async (dateKeys, isProduction) => {
  const firstMonth = dateKeys.map(getMonthKey).sort()[0];
  const currentMonth = getMonthKey(getLocalDateKey());
  const lastMonth = firstMonth > currentMonth ? firstMonth : currentMonth;
  for (const monthKey of getMonthKeysBetween(firstMonth, lastMonth)) {
    await syncMonthClosings(monthKey, isProduction);
  }
};

const saveOpeningBalance = async (monthKey, balance, user, isProduction) => {
  await setDoc(
    getEnvironmentDoc(SETTINGS, monthKey, isProduction),
    {
      ...toAccountFields("opening", balance),
      updatedBy: user,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await syncClosingsFrom([`${monthKey}-01`], isProduction);
};

// ---------------------------------------------------------------------------
// End-of-day report (POS)
// ---------------------------------------------------------------------------

const fetchTransactionsForDate = async (dateKey, isProduction) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const snapshot = await getDocs(
    query(
      getEnvironmentCollection("transactionDetail", isProduction),
      where("createdAt", ">=", new Date(year, month - 1, day)),
      where("createdAt", "<", new Date(year, month - 1, day + 1))
    )
  );
  return toDocs(snapshot);
};

const fetchExpensesForDate = (dateKey, isProduction) =>
  fetchByDateRange(EXPENSES, dateKey, dateKey, isProduction);

const fetchReport = async (dateKey, isProduction) => {
  const snap = await getDoc(reportRef(dateKey, isProduction));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

const submitDailyReport = async (
  { dateKey, sales, expenses, actual, submittedBy },
  isProduction
) => {
  const { actual: actuals, discrepancy } = reconcileDay({
    sales,
    expenses,
    actual,
  });

  await setDoc(
    reportRef(dateKey, isProduction),
    {
      date: dateKey,
      month: getMonthKey(dateKey),
      ...toAccountFields("systemSales", sales),
      systemSalesTotal: sales.total,
      transactionCount: sales.count,
      ...toAccountFields("expenses", expenses),
      ...toAccountFields("actual", actuals),
      ...toAccountFields("discrepancy", discrepancy),
      // A fresh count supersedes any earlier confirmation or override.
      isDiscrepancyConfirmed: false,
      ...ACCOUNTS.reduce((fields, account) => {
        fields[accountField("originalActual", account)] = deleteField();
        fields[accountField("originalDiscrepancy", account)] = deleteField();
        return fields;
      }, {}),
      submittedBy,
      submittedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await syncClosingsFrom([dateKey], isProduction);
};

const updateDailyReportSales = async (dateKey, isProduction) => {
  const report = await fetchReport(dateKey, isProduction);
  if (!report) return null;

  const transactions = await fetchTransactionsForDate(dateKey, isProduction);
  const sales = summarizeSales(transactions);
  const actual = pickAccountFields(report, "actual");
  const expenses = pickAccountFields(report, "expenses");
  const { discrepancy } = reconcileDay({
    sales,
    expenses,
    actual,
  });

  await updateDoc(reportRef(dateKey, isProduction), {
    ...toAccountFields("systemSales", sales),
    systemSalesTotal: sales.total,
    transactionCount: sales.count,
    ...toAccountFields("discrepancy", discrepancy),
    updatedAt: serverTimestamp(),
  });
  await syncClosingsFrom([dateKey], isProduction);
  return { sales, discrepancy };
};

// ---------------------------------------------------------------------------
// Expenses & transfers
// ---------------------------------------------------------------------------

const addExpense = async (
  { amount, category, sourceAccount, dateKey, addedFrom, createdBy, bulkPurchaseId },
  isProduction
) => {
  await addDoc(getEnvironmentCollection(EXPENSES, isProduction), {
    amount,
    category,
    sourceAccount: normalizeAccount(sourceAccount),
    date: dateKey,
    month: getMonthKey(dateKey),
    addedFrom,
    createdBy,
    // Links a Pembelian Grosir expense back to its purchase.
    ...(bulkPurchaseId ? { bulkPurchaseId } : {}),
    createdAt: serverTimestamp(),
  });
  await syncClosingsFrom([dateKey], isProduction);
};

const updateExpense = async (
  expense,
  { amount, category, sourceAccount, dateKey, updatedBy },
  isProduction
) => {
  await updateDoc(getEnvironmentDoc(EXPENSES, expense.id, isProduction), {
    amount,
    category,
    sourceAccount: normalizeAccount(sourceAccount),
    date: dateKey,
    month: getMonthKey(dateKey),
    updatedBy,
    updatedAt: serverTimestamp(),
  });
  await syncClosingsFrom([expense.date, dateKey], isProduction);
};

const deleteExpense = async (expense, isProduction) => {
  await deleteDoc(getEnvironmentDoc(EXPENSES, expense.id, isProduction));
  await syncClosingsFrom([expense.date], isProduction);
};

const addTransfer = async (
  { amount, fromAccount, toAccount, description, dateKey, createdBy },
  isProduction
) => {
  await addDoc(getEnvironmentCollection(TRANSFERS, isProduction), {
    amount,
    fromAccount: normalizeAccount(fromAccount),
    toAccount: normalizeAccount(toAccount),
    description,
    date: dateKey,
    month: getMonthKey(dateKey),
    createdBy,
    createdAt: serverTimestamp(),
  });
  await syncClosingsFrom([dateKey], isProduction);
};

const deleteTransfer = async (transfer, isProduction) => {
  await deleteDoc(getEnvironmentDoc(TRANSFERS, transfer.id, isProduction));
  await syncClosingsFrom([transfer.date], isProduction);
};

const fetchExpenseCategories = async () => {
  // settings is production-only, so both environments share one list.
  const snap = await getDoc(getEnvironmentDoc("settings", "expenseCategories"));
  const saved = snap.exists() ? snap.data().categories || [] : [];
  return [...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...saved])];
};

const saveExpenseCategory = async (name) => {
  if (DEFAULT_EXPENSE_CATEGORIES.includes(name)) return;
  await setDoc(
    getEnvironmentDoc("settings", "expenseCategories"),
    { categories: arrayUnion(name) },
    { merge: true }
  );
};

// ---------------------------------------------------------------------------
// Discrepancy confirm / override / undo
// ---------------------------------------------------------------------------

const confirmDiscrepancy = async (dateKey, isProduction) => {
  await updateDoc(reportRef(dateKey, isProduction), {
    isDiscrepancyConfirmed: true,
  });
};

const overrideDiscrepancy = async (dateKey, actual, isProduction) => {
  const data = await readReport(dateKey, isProduction);
  const { actual: actuals, discrepancy } = reconcileDay({
    sales: pickAccountFields(data, "systemSales"),
    expenses: pickAccountFields(data, "expenses"),
    actual,
  });

  const updates = {
    isDiscrepancyConfirmed: true,
    ...toAccountFields("actual", actuals),
    ...toAccountFields("discrepancy", discrepancy),
  };
  // Keep the cashier's own count so the override can be undone.
  if (data.originalActualCash === undefined) {
    Object.assign(
      updates,
      toAccountFields("originalActual", pickAccountFields(data, "actual")),
      toAccountFields(
        "originalDiscrepancy",
        pickAccountFields(data, "discrepancy")
      )
    );
  }

  await updateDoc(reportRef(dateKey, isProduction), updates);
  await syncClosingsFrom([dateKey], isProduction);
};

const undoDiscrepancy = async (dateKey, isProduction) => {
  const data = await readReport(dateKey, isProduction);
  const updates = { isDiscrepancyConfirmed: false };

  if (data.originalActualCash !== undefined) {
    for (const account of ACCOUNTS) {
      updates[accountField("actual", account)] = toNumber(
        data[accountField("originalActual", account)]
      );
      updates[accountField("discrepancy", account)] = toNumber(
        data[accountField("originalDiscrepancy", account)]
      );
      updates[accountField("originalActual", account)] = deleteField();
      updates[accountField("originalDiscrepancy", account)] = deleteField();
    }
  }

  await updateDoc(reportRef(dateKey, isProduction), updates);
  await syncClosingsFrom([dateKey], isProduction);
};

// ---------------------------------------------------------------------------
// Anchor balance
// ---------------------------------------------------------------------------

// anchors: { cash?, qris?, kredit? } real end-of-day balances to pin.
const anchorBalance = async (dateKey, anchors, user, isProduction) => {
  const updates = { anchoredBy: user, anchoredAt: serverTimestamp() };
  for (const account of ACCOUNTS) {
    if (anchors[account] !== undefined) {
      updates[accountField("anchor", account)] = anchors[account];
    }
  }
  await updateDoc(reportRef(dateKey, isProduction), updates);
  await syncClosingsFrom([dateKey], isProduction);
};

const undoAnchor = async (dateKey, isProduction) => {
  const updates = { anchoredBy: deleteField(), anchoredAt: deleteField() };
  for (const account of ACCOUNTS) {
    updates[accountField("anchor", account)] = deleteField();
  }
  await updateDoc(reportRef(dateKey, isProduction), updates);
  await syncClosingsFrom([dateKey], isProduction);
};

// ---------------------------------------------------------------------------
// One-time import of the legacy Buka/Tutup Buku closings
// ---------------------------------------------------------------------------

const hasPendingLegacyMigration = async (isProduction) => {
  const marker = await getDoc(
    getEnvironmentDoc(SETTINGS, LEGACY_MIGRATION_DOC, isProduction)
  );
  if (marker.exists()) return false;
  const legacy = await getDocs(
    query(getEnvironmentCollection(LEGACY_CLOSINGS, isProduction), limit(1))
  );
  return !legacy.empty;
};

// Legacy closings tracked cash only: QRIS and voucher discounts were deducted
// from gross revenue. They map onto the three accounts without changing the
// old cash balance, and their discrepancies were already accepted.
const migrateLegacyClosings = async (user, isProduction) => {
  const closings = toDocs(
    await getDocs(getEnvironmentCollection(LEGACY_CLOSINGS, isProduction))
  )
    .filter((closing) => closing.status === "closed" && closing.dateString)
    .sort((a, b) => a.dateString.localeCompare(b.dateString));

  const writes = [];
  const migratedDates = [];

  if (closings.length > 0) {
    const firstDate = closings[0].dateString;
    const lastDate = closings[closings.length - 1].dateString;
    const existingDates = new Set(
      (await fetchByDateRange(REPORTS, firstDate, lastDate, isProduction)).map(
        (report) => report.date
      )
    );

    for (const closing of closings) {
      const date = closing.dateString;
      // Reports already submitted through the new flow take precedence.
      if (existingDates.has(date)) continue;

      const kredit = toNumber(closing.voucherDiscount);
      const qris = toNumber(closing.qrisTotal);
      const sales = {
        cash: toNumber(closing.grossRevenue) - kredit - qris,
        qris,
        kredit,
      };
      const legacyExpenses = (closing.expenses || []).filter(
        (expense) => toNumber(expense.amount) > 0
      );
      const expensesCash = legacyExpenses.reduce(
        (sum, expense) => sum + toNumber(expense.amount),
        0
      );

      writes.push([
        reportRef(date, isProduction),
        {
          date,
          month: getMonthKey(date),
          ...toAccountFields("systemSales", sales),
          systemSalesTotal: toNumber(closing.grossRevenue),
          ...toAccountFields("expenses", { cash: expensesCash }),
          ...toAccountFields("actual", {
            cash: toNumber(closing.cashierGrossRevenue),
            qris,
            kredit,
          }),
          ...toAccountFields("discrepancy", {
            cash: toNumber(closing.discrepancy),
          }),
          isDiscrepancyConfirmed: true,
          migratedFromLegacy: true,
          submittedBy: closing.createdBy || "unknown",
          submittedAt: serverTimestamp(),
        },
      ]);
      legacyExpenses.forEach((expense, index) => {
        writes.push([
          getEnvironmentDoc(EXPENSES, `legacy_${date}_${index}`, isProduction),
          {
            amount: toNumber(expense.amount),
            category: expense.category || "Pengeluaran",
            sourceAccount: "cash",
            date,
            month: getMonthKey(date),
            addedFrom: "legacy",
            createdBy: closing.createdBy || "unknown",
            createdAt: serverTimestamp(),
          },
        ]);
      });
      migratedDates.push(date);
    }

    const firstMonth = getMonthKey(firstDate);
    const openingRef = getEnvironmentDoc(SETTINGS, firstMonth, isProduction);
    if (!(await getDoc(openingRef)).exists()) {
      writes.push([
        openingRef,
        {
          ...toAccountFields("opening", { cash: LEGACY_INITIAL_BALANCE }),
          updatedBy: user,
          updatedAt: serverTimestamp(),
        },
      ]);
    }
  }

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const [ref, data] of writes.slice(i, i + BATCH_LIMIT)) {
      batch.set(ref, data);
    }
    await batch.commit();
  }

  if (migratedDates.length > 0) {
    await syncClosingsFrom(migratedDates, isProduction);
  }
  await setDoc(getEnvironmentDoc(SETTINGS, LEGACY_MIGRATION_DOC, isProduction), {
    migratedBy: user,
    migratedAt: serverTimestamp(),
    closingsImported: migratedDates.length,
  });
  return migratedDates.length;
};

export const cashflowService = {
  fetchMonthData,
  fetchOpeningBalance,
  saveOpeningBalance,
  syncMonthClosings,
  fetchTransactionsForDate,
  fetchExpensesForDate,
  fetchReport,
  submitDailyReport,
  addExpense,
  updateExpense,
  deleteExpense,
  addTransfer,
  deleteTransfer,
  fetchExpenseCategories,
  saveExpenseCategory,
  confirmDiscrepancy,
  overrideDiscrepancy,
  undoDiscrepancy,
  anchorBalance,
  undoAnchor,
  hasPendingLegacyMigration,
  migrateLegacyClosings,
  updateDailyReportSales,
  syncClosingsFrom,
};
