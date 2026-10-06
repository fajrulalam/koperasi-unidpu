// src/utils/cashflowUtils.js
//
// Cashflow ledger helpers, replicated from the 375 POS cashflow statement.
// Unimart money lives in three accounts:
//   - cash:   physical money received at the counter
//   - qris:   online / e-money payments
//   - kredit: voucher redemptions, revenue whose money arrives later

export const ACCOUNTS = ["cash", "qris", "kredit"];

export const ACCOUNT_LABELS = { cash: "Cash", qris: "QRIS", kredit: "Kredit" };

// Firestore field suffix per account, e.g. systemSalesCash / closingQris.
const FIELD_SUFFIX = { cash: "Cash", qris: "Qris", kredit: "Kredit" };

// Expenses are paid from money on hand, and cashiers count only those two
// accounts at day end. Kredit holds no money until the voucher is settled.
export const MONEY_ACCOUNTS = ["cash", "qris"];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Token Listrik",
  "Bayar Hutang",
  "Belanja SPI",
];

// Cash balance before the first legacy "Tutup Buku" closing.
export const LEGACY_INITIAL_BALANCE = 5400500;

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const accountField = (prefix, account) =>
  `${prefix}${FIELD_SUFFIX[account]}`;

export const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const emptyAmounts = () => ({ cash: 0, qris: 0, kredit: 0 });

export const normalizeAccount = (value) => {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return ACCOUNTS.includes(key) ? key : "cash";
};

// { cash, qris, kredit } from fields such as closingCash / closingQris.
export const pickAccountFields = (data, prefix) =>
  ACCOUNTS.reduce((amounts, account) => {
    amounts[account] = toNumber(data?.[accountField(prefix, account)]);
    return amounts;
  }, {});

export const toAccountFields = (prefix, amounts) =>
  ACCOUNTS.reduce((fields, account) => {
    fields[accountField(prefix, account)] = toNumber(amounts?.[account]);
    return fields;
  }, {});

// ---------------------------------------------------------------------------
// Dates (local time, keyed as YYYY-MM-DD / YYYY-MM)
// ---------------------------------------------------------------------------

const pad = (value) => String(value).padStart(2, "0");

export const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getMonthKey = (dateKey) => dateKey.slice(0, 7);

export const getMonthRange = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${pad(lastDay)}` };
};

// Every month key from startMonth through endMonth, inclusive.
export const getMonthKeysBetween = (startMonth, endMonth) => {
  const keys = [];
  let [year, month] = startMonth.split("-").map(Number);
  while (`${year}-${pad(month)}` <= endMonth) {
    keys.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
};

export const formatDayLabel = (dateKey) => {
  const [year, month, day] = dateKey.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
};

export const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

export const fmtAmount = (value) =>
  new Intl.NumberFormat("id-ID").format(Math.round(toNumber(value)));

export const formatRupiah = (value) => {
  const number = toNumber(value);
  return `${number < 0 ? "-" : ""}Rp ${fmtAmount(Math.abs(number))}`;
};

// Masks every digit after the first so cashiers cannot copy the expected
// amount into their own count.
export const censorAmount = (value) => {
  const number = Math.round(toNumber(value));
  if (number === 0) return "Rp 0";
  const formatted = fmtAmount(Math.abs(number));
  const prefix = number < 0 ? "-" : "";
  return `${prefix}Rp ${formatted.charAt(0)}${formatted
    .slice(1)
    .replace(/\d/g, "*")}`;
};

export const parseDigits = (text) =>
  parseInt(String(text ?? "").replace(/\D/g, ""), 10) || 0;

export const formatDigitsInput = (text) => {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10).toLocaleString("id-ID") : "";
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

// Splits one transactionDetail document across the three accounts. Documents
// written before kreditAmount existed fall back to voucherDiscount, and those
// written before split payments fall back to the isPaidViaQris flag.
export const getPaymentBreakdown = (transaction = {}) => {
  const kredit = toNumber(
    transaction.kreditAmount ?? transaction.voucherDiscount
  );
  const payable =
    transaction.discountedTotal != null
      ? toNumber(transaction.discountedTotal)
      : Math.max(0, toNumber(transaction.total) - kredit);
  const qris =
    transaction.qrisAmount != null
      ? toNumber(transaction.qrisAmount)
      : transaction.isPaidViaQris
      ? payable
      : 0;
  const cash =
    transaction.cashAmount != null
      ? toNumber(transaction.cashAmount)
      : Math.max(0, payable - qris);
  return { cash, qris, kredit };
};

export const summarizeSales = (transactions = []) => {
  const sums = emptyAmounts();
  for (const transaction of transactions) {
    const breakdown = getPaymentBreakdown(transaction);
    for (const account of ACCOUNTS) sums[account] += breakdown[account];
  }
  const sales = {
    cash: Math.round(sums.cash),
    qris: Math.round(sums.qris),
    kredit: Math.round(sums.kredit),
  };
  return {
    ...sales,
    total: sales.cash + sales.qris + sales.kredit,
    count: transactions.length,
  };
};

export const sumExpensesByAccount = (expenses = []) => {
  const sums = emptyAmounts();
  for (const expense of expenses) {
    sums[normalizeAccount(expense.sourceAccount)] += toNumber(expense.amount);
  }
  return sums;
};

// End-of-day reconciliation: what the cashier should hold per account is that
// day's sales minus the expenses paid out of it. Kredit is not counted, so its
// actual value is whatever the system recorded.
export const reconcileDay = ({ sales, expenses, actual }) => {
  const expected = emptyAmounts();
  const actuals = emptyAmounts();
  const discrepancy = emptyAmounts();
  for (const account of ACCOUNTS) {
    expected[account] =
      toNumber(sales?.[account]) - toNumber(expenses?.[account]);
    actuals[account] = MONEY_ACCOUNTS.includes(account)
      ? toNumber(actual?.[account])
      : expected[account];
    discrepancy[account] = actuals[account] - expected[account];
  }
  return { expected, actual: actuals, discrepancy };
};

// ---------------------------------------------------------------------------
// Ledger rows
// ---------------------------------------------------------------------------

const groupByDate = (items) => {
  const groups = new Map();
  for (const item of items) {
    if (!item.date) continue;
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
  }
  return groups;
};

const isSet = (value) => value !== undefined && value !== null;

// Builds the monthly statement. Per day: sales, discrepancy, each expense,
// each transfer, and finally the anchor adjustment, so an anchor always pins
// the balance the account holds at the end of that day.
export const buildCashflowRows = ({
  reports = [],
  expenses = [],
  transfers = [],
  opening,
}) => {
  const balances = emptyAmounts();
  for (const account of ACCOUNTS) balances[account] = toNumber(opening?.[account]);

  const rows = [];
  const pushRow = (row, amounts = emptyAmounts()) => {
    for (const account of ACCOUNTS) balances[account] += amounts[account];
    rows.push({ ...row, amounts, balances: { ...balances } });
  };

  pushRow({
    key: "opening",
    rowType: "opening",
    rawDate: "",
    description: "Saldo Awal",
  });

  const reportsByDate = new Map(reports.map((report) => [report.date, report]));
  const expensesByDate = groupByDate(expenses);
  const transfersByDate = groupByDate(transfers);
  const dates = [
    ...new Set([
      ...reportsByDate.keys(),
      ...expensesByDate.keys(),
      ...transfersByDate.keys(),
    ]),
  ].sort();

  for (const date of dates) {
    const report = reportsByDate.get(date);

    if (report) {
      pushRow(
        {
          key: `${date}-sales`,
          rowType: "sales",
          rawDate: date,
          description: "Penjualan",
        },
        pickAccountFields(report, "systemSales")
      );

      const discrepancy = pickAccountFields(report, "discrepancy");
      if (ACCOUNTS.some((account) => discrepancy[account] !== 0)) {
        pushRow(
          {
            key: `${date}-discrepancy`,
            rowType: "discrepancy",
            rawDate: date,
            description: "Selisih",
            isDiscrepancyConfirmed: report.isDiscrepancyConfirmed === true,
          },
          discrepancy
        );
      }
    }

    for (const expense of expensesByDate.get(date) ?? []) {
      const amounts = emptyAmounts();
      amounts[normalizeAccount(expense.sourceAccount)] = -toNumber(
        expense.amount
      );
      pushRow(
        {
          key: `${date}-expense-${expense.id}`,
          rowType: "expense",
          rawDate: date,
          description: expense.category || "Pengeluaran",
          expense,
        },
        amounts
      );
    }

    for (const transfer of transfersByDate.get(date) ?? []) {
      const from = normalizeAccount(transfer.fromAccount);
      const to = normalizeAccount(transfer.toAccount);
      const amounts = emptyAmounts();
      amounts[from] -= toNumber(transfer.amount);
      amounts[to] += toNumber(transfer.amount);
      pushRow(
        {
          key: `${date}-transfer-${transfer.id}`,
          rowType: "transfer",
          rawDate: date,
          description:
            transfer.description ||
            `Mutasi ${ACCOUNT_LABELS[from]} → ${ACCOUNT_LABELS[to]}`,
          transfer,
        },
        amounts
      );
    }

    const anchoredAccounts = report
      ? ACCOUNTS.filter((account) =>
          isSet(report[accountField("anchor", account)])
        )
      : [];
    if (anchoredAccounts.length > 0) {
      const amounts = emptyAmounts();
      for (const account of anchoredAccounts) {
        amounts[account] =
          toNumber(report[accountField("anchor", account)]) - balances[account];
      }
      pushRow(
        {
          key: `${date}-adjustment`,
          rowType: "adjustment",
          rawDate: date,
          description: "Penyesuaian",
          anchoredAccounts,
        },
        amounts
      );
    }
  }

  pushRow({
    key: "closing",
    rowType: "closing",
    rawDate: "",
    description: "Saldo Akhir",
  });

  return rows;
};

// End-of-day balance per date, as stored on each report's closing* fields.
export const getClosingsByDate = (rows) => {
  const closings = {};
  for (const row of rows) {
    if (row.rawDate) closings[row.rawDate] = row.balances;
  }
  return closings;
};

export const filterRowsByAccount = (rows, account) =>
  rows.filter((row) => {
    switch (row.rowType) {
      case "discrepancy":
      case "expense":
      case "transfer":
        return row.amounts[account] !== 0;
      case "adjustment":
        return row.anchoredAccounts.includes(account);
      default:
        return true;
    }
  });
