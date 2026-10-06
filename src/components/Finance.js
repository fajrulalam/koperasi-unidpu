// src/components/Finance.js
//
// Monthly cashflow statement for Unimart, replicated from the 375 POS
// dashboard. Each account (Cash, QRIS, Kredit) has an amount and a running
// balance column; sales and discrepancies come from the cashier's end-of-day
// report, expenses and transfers are listed individually.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaAnchor,
  FaDownload,
  FaExchangeAlt,
  FaFileImport,
  FaMoneyBillWave,
  FaPen,
  FaPlus,
  FaQrcode,
  FaTicketAlt,
  FaWallet,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnvironment } from "../context/EnvironmentContext";
import { cashflowService } from "../services/cashflowService";
import { generateCashflowPdf } from "../services/cashflowPdfService";
import {
  ACCOUNTS,
  ACCOUNT_LABELS,
  buildCashflowRows,
  emptyAmounts,
  filterRowsByAccount,
  fmtAmount,
  formatDayLabel,
  formatMonthLabel,
  getLocalDateKey,
  getMonthKey,
  getMonthKeysBetween,
  getMonthRange,
  LEDGER_START_MONTH,
  pickAccountFields,
} from "../utils/cashflowUtils";
import {
  AnchorBalanceModal,
  ConfirmDialog,
  ConfirmDiscrepancyModal,
  ExpenseModal,
  OpeningBalanceModal,
  OverrideDiscrepancyModal,
  TransferModal,
} from "./cashflow/CashflowModals";

// Roles allowed to correct the ledger: opening balance, anchors, discrepancy
// review and editing expenses or transfers.
const MANAGER_ROLES = ["Director", "Wakil Rektor 2", "Admin"];

const ACCOUNT_STYLE = {
  cash: {
    Icon: FaMoneyBillWave,
    iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
    activeCard: "border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20",
    hoverBorder: "hover:border-emerald-300",
    activeDot: "bg-emerald-500",
  },
  qris: {
    Icon: FaQrcode,
    iconColor: "text-sky-600",
    badgeBg: "bg-sky-50 text-sky-600 border border-sky-200/80",
    activeCard: "border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/20",
    hoverBorder: "hover:border-sky-300",
    activeDot: "bg-sky-500",
  },
  kredit: {
    Icon: FaTicketAlt,
    iconColor: "text-[#e66a6a]",
    badgeBg: "bg-rose-50 text-[#e66a6a] border border-rose-200/80",
    activeCard: "border-[#e66a6a] bg-rose-50/50 shadow-md ring-2 ring-[#e66a6a]/20",
    hoverBorder: "hover:border-rose-300",
    activeDot: "bg-[#e66a6a]",
  },
};

const ROW_TINT = {
  opening: "bg-slate-50/80",
  closing: "bg-rose-50/35",
  sales: "bg-emerald-50/20",
  discrepancy: "bg-amber-50/25",
  expense: "bg-rose-50/25",
  transfer: "bg-sky-50/25",
  adjustment: "bg-indigo-50/20",
};

const EMPTY_DATA = {
  reports: [],
  expenses: [],
  transfers: [],
  sales: [],
  opening: { ...emptyAmounts(), isOverride: false },
};

const formatTimestamp = (timestamp) =>
  timestamp?.toDate
    ? timestamp.toDate().toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

const AccountCard = ({ account, balance, active, onClick }) => {
  const { Icon, iconColor, badgeBg, activeCard, hoverBorder, activeDot } = ACCOUNT_STYLE[account];
  const negative = balance < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl border-2 transition-all duration-200 min-w-[210px] text-left cursor-pointer ${
        active
          ? `${activeCard}`
          : `bg-white border-gray-200/90 shadow-xs hover:shadow-md ${hoverBorder}`
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${badgeBg}`}>
        <Icon className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {ACCOUNT_LABELS[account]}
          </p>
          {active && (
            <span className={`inline-block w-2 h-2 rounded-full ${activeDot} animate-pulse`} title="Filter aktif" />
          )}
        </div>
        <p
          className={`text-lg font-bold tracking-tight font-mono truncate ${
            negative ? "text-red-500" : "text-gray-900"
          }`}
        >
          Rp {fmtAmount(balance)}
        </p>
      </div>
    </button>
  );
};

const AmountCell = ({ value }) => {
  if (value === 0) return <span className="text-slate-300">—</span>;
  const positive = value > 0;
  return (
    <span
      className={`font-mono font-medium ${
        positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {positive ? "+" : ""}
      {fmtAmount(value)}
    </span>
  );
};

const BalanceCell = ({ value, isClosing }) =>
  isClosing ? (
    <span className={`font-mono font-bold ${value < 0 ? "text-red-600" : "text-gray-900"}`}>
      {fmtAmount(value)}
    </span>
  ) : (
    <span className={`font-mono text-xs ${value < 0 ? "text-red-400" : "text-gray-400"}`}>
      {fmtAmount(value)}
    </span>
  );

// Frosted tooltip shown above a row's description.
const RowTooltip = ({ children }) => (
  <div
    className="absolute bottom-full left-0 pb-1 z-50"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="bg-white/95 backdrop-blur-sm text-gray-700 text-xs rounded-xl shadow-lg border border-gray-200/80 p-3 min-w-[220px] whitespace-nowrap">
      {children}
    </div>
  </div>
);

const TooltipAmounts = ({ amounts, accounts = ACCOUNTS }) => (
  <div className="space-y-1.5">
    {accounts.map((account) => (
      <div key={account} className="flex justify-between gap-6">
        <span className="text-gray-400">{ACCOUNT_LABELS[account]}</span>
        <AmountCell value={amounts[account]} />
      </div>
    ))}
  </div>
);

const Finance = () => {
  const { currentUser, userRole } = useAuth();
  const { isProduction } = useEnvironment();
  const canManage = MANAGER_ROLES.includes(userRole);
  const userEmail = currentUser?.email || "unknown";

  const currentMonth = getMonthKey(getLocalDateKey());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAccount, setActiveAccount] = useState(null);
  const [hoveredRowKey, setHoveredRowKey] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [pendingMigration, setPendingMigration] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await cashflowService.fetchMonthData(selectedMonth, isProduction));
    } catch (err) {
      console.error("Error loading cashflow:", err);
      setError("Gagal memuat data arus kas. Silakan coba lagi.");
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, isProduction]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canManage) return;
    cashflowService
      .hasPendingLegacyMigration(isProduction)
      .then(setPendingMigration)
      .catch((err) => console.error("Error checking legacy closings:", err));
    cashflowService
      .fetchExpenseCategories()
      .then(setCategories)
      .catch((err) => console.error("Error fetching expense categories:", err));
  }, [canManage, isProduction]);

  const rows = useMemo(() => buildCashflowRows(data), [data]);
  const displayRows = activeAccount ? filterRowsByAccount(rows, activeAccount) : rows;
  const closingBalances = rows[rows.length - 1].balances;
  const reportsByDate = useMemo(
    () => new Map(data.reports.map((report) => [report.date, report])),
    [data.reports]
  );
  const visibleAccounts = activeAccount ? [activeAccount] : ACCOUNTS;
  const ledgerDates = useMemo(
    () => [...new Set(rows.map((row) => row.rawDate).filter(Boolean))],
    [rows]
  );
  const expenseCount = displayRows.filter((row) => row.rowType === "expense").length;

  const monthOptions = useMemo(
    () => getMonthKeysBetween(LEDGER_START_MONTH, currentMonth).reverse(),
    [currentMonth]
  );
  const monthRange = getMonthRange(selectedMonth);
  const defaultDate =
    selectedMonth === currentMonth ? getLocalDateKey() : monthRange.end;

  const runAction = async (action) => {
    setSaving(true);
    setError("");
    try {
      await action();
      setModal(null);
      await loadData();
    } catch (err) {
      console.error("Cashflow action failed:", err);
      setError(err.message || "Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const getDiscrepancyInfo = (dateKey) => {
    const report = reportsByDate.get(dateKey);
    return {
      dateKey,
      discrepancy: pickAccountFields(report, "discrepancy"),
      actual: pickAccountFields(report, "actual"),
      sales: pickAccountFields(report, "systemSales"),
      expenses: pickAccountFields(report, "expenses"),
    };
  };

  // End-of-day balances before that day's anchor adjustment.
  const getBalancesForDate = (dateKey) => {
    const dayRows = rows.filter(
      (row) => row.rawDate === dateKey && row.rowType !== "adjustment"
    );
    return dayRows.length > 0 ? dayRows[dayRows.length - 1].balances : emptyAmounts();
  };

  const saveExpenseCategory = (category) => {
    if (categories.includes(category)) return;
    setCategories((prev) => [...prev, category]);
    cashflowService
      .saveExpenseCategory(category)
      .catch((err) => console.error("Error saving expense category:", err));
  };

  const handleRowClick = (row) => {
    if (!canManage) return;
    if (row.rowType === "expense") {
      setHoveredRowKey(null);
      setModal({ type: "editExpense", expense: row.expense });
    } else if (row.rowType === "transfer") {
      setHoveredRowKey(null);
      setModal({ type: "deleteTransfer", transfer: row.transfer });
    }
  };

  const renderTooltip = (row) => {
    if (hoveredRowKey !== row.key) return null;

    if (row.rowType === "discrepancy") {
      const confirmed = row.isDiscrepancyConfirmed;
      const info = () => getDiscrepancyInfo(row.rawDate);
      return (
        <RowTooltip>
          <TooltipAmounts amounts={row.amounts} accounts={["cash", "qris"]} />
          {canManage && !confirmed && (
            <div className="flex gap-1.5 mt-3">
              <button
                type="button"
                onClick={() => setModal({ type: "confirmDiscrepancy", info: info() })}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-500/80 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                Konfirmasi
              </button>
              <button
                type="button"
                onClick={() => setModal({ type: "overrideDiscrepancy", info: info() })}
                className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-amber-500/80 hover:bg-amber-500 rounded-lg transition-colors"
              >
                Koreksi
              </button>
            </div>
          )}
          {confirmed && (
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-emerald-500 font-medium text-[11px]">Terkonfirmasi</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setModal({ type: "undoDiscrepancy", dateKey: row.rawDate })}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Batalkan
                </button>
              )}
            </div>
          )}
        </RowTooltip>
      );
    }

    if (row.rowType === "adjustment") {
      return (
        <RowTooltip>
          <TooltipAmounts amounts={row.amounts} accounts={row.anchoredAccounts} />
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-indigo-500 font-medium text-[11px]">Di-anchor</span>
            {canManage && (
              <button
                type="button"
                onClick={() => setModal({ type: "undoAnchor", dateKey: row.rawDate })}
                className="px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Batalkan
              </button>
            )}
          </div>
        </RowTooltip>
      );
    }

    if (row.rowType === "sales") {
      return (
        <RowTooltip>
          <p>
            {row.transactionCount != null
              ? `${row.transactionCount} transaksi tercatat di POS`
              : "Penjualan dari Tutup Buku lama"}
          </p>
          <p className="text-gray-400 mt-0.5">
            {row.report
              ? `Laporan Harian dikirim oleh ${row.report.submittedBy || "-"}`
              : "Laporan Harian belum dikirim"}
          </p>
        </RowTooltip>
      );
    }

    if (row.rowType === "expense" || row.rowType === "transfer") {
      const item = row.expense || row.transfer;
      const origin =
        row.rowType === "transfer"
          ? "Mutasi saldo"
          : item.addedFrom === "pos"
          ? "Dicatat dari POS"
          : item.addedFrom === "legacy"
          ? "Dari Tutup Buku lama"
          : item.addedFrom === "bulkPurchase"
          ? `Dari Pembelian Grosir${item.bulkPurchaseId ? ` (${item.bulkPurchaseId})` : ""}`
          : "Dicatat dari Finance";
      return (
        <RowTooltip>
          <p>{formatTimestamp(item.createdAt)}</p>
          <p className="text-gray-400 mt-0.5">
            {origin} • {item.createdBy || "-"}
            {canManage &&
              (row.rowType === "expense" ? " • Klik untuk ubah" : " • Klik untuk hapus")}
          </p>
        </RowTooltip>
      );
    }

    return null;
  };

  const renderModal = () => {
    if (!modal) return null;
    const close = () => setModal(null);

    switch (modal.type) {
      case "opening":
        return (
          <OpeningBalanceModal
            balance={data.opening}
            loading={saving}
            onClose={close}
            onSave={(balance) =>
              runAction(() =>
                cashflowService.saveOpeningBalance(selectedMonth, balance, userEmail, isProduction)
              )
            }
          />
        );
      case "addExpense":
      case "editExpense":
        return (
          <ExpenseModal
            expense={modal.expense}
            defaultDate={defaultDate}
            minDate={monthRange.start}
            maxDate={monthRange.end}
            categories={categories}
            loading={saving}
            onClose={close}
            onSave={(values) =>
              runAction(async () => {
                if (modal.expense) {
                  await cashflowService.updateExpense(
                    modal.expense,
                    { ...values, updatedBy: userEmail },
                    isProduction
                  );
                } else {
                  await cashflowService.addExpense(
                    { ...values, addedFrom: "finance", createdBy: userEmail },
                    isProduction
                  );
                }
                saveExpenseCategory(values.category);
              })
            }
            onDelete={() =>
              runAction(() => cashflowService.deleteExpense(modal.expense, isProduction))
            }
          />
        );
      case "transfer":
        return (
          <TransferModal
            defaultDate={defaultDate}
            minDate={monthRange.start}
            maxDate={monthRange.end}
            loading={saving}
            onClose={close}
            onSave={(values) =>
              runAction(() =>
                cashflowService.addTransfer({ ...values, createdBy: userEmail }, isProduction)
              )
            }
          />
        );
      case "deleteTransfer":
        return (
          <ConfirmDialog
            title="Hapus Mutasi?"
            message={`Hapus "${modal.transfer.description}" sebesar Rp ${fmtAmount(
              modal.transfer.amount
            )}? Saldo akan dihitung ulang.`}
            confirmLabel="Hapus"
            loading={saving}
            onClose={close}
            onConfirm={() =>
              runAction(() => cashflowService.deleteTransfer(modal.transfer, isProduction))
            }
          />
        );
      case "anchor":
        return (
          <AnchorBalanceModal
            dates={ledgerDates}
            getBalancesForDate={getBalancesForDate}
            loading={saving}
            onClose={close}
            onSave={(dateKey, anchors) =>
              runAction(() =>
                cashflowService.anchorBalance(dateKey, anchors, userEmail, isProduction)
              )
            }
          />
        );
      case "undoAnchor":
        return (
          <ConfirmDialog
            title="Batalkan Anchor?"
            message={`Hapus anchor saldo tanggal ${formatDayLabel(
              modal.dateKey
            )}? Saldo kembali ke hasil perhitungan sistem.`}
            confirmLabel="Batalkan Anchor"
            loading={saving}
            onClose={close}
            onConfirm={() =>
              runAction(() => cashflowService.undoAnchor(modal.dateKey, isProduction))
            }
          />
        );
      case "confirmDiscrepancy":
        return (
          <ConfirmDiscrepancyModal
            info={modal.info}
            loading={saving}
            onClose={close}
            onConfirm={() =>
              runAction(() =>
                cashflowService.confirmDiscrepancy(modal.info.dateKey, isProduction)
              )
            }
          />
        );
      case "overrideDiscrepancy":
        return (
          <OverrideDiscrepancyModal
            info={modal.info}
            loading={saving}
            onClose={close}
            onSave={(actual) =>
              runAction(() =>
                cashflowService.overrideDiscrepancy(modal.info.dateKey, actual, isProduction)
              )
            }
          />
        );
      case "undoDiscrepancy":
        return (
          <ConfirmDialog
            title="Batalkan Konfirmasi Selisih?"
            message={`Kembalikan selisih tanggal ${formatDayLabel(
              modal.dateKey
            )} ke status belum dikonfirmasi? Koreksi hitungan (jika ada) juga dibatalkan.`}
            confirmLabel="Batalkan"
            loading={saving}
            onClose={close}
            onConfirm={() =>
              runAction(() => cashflowService.undoDiscrepancy(modal.dateKey, isProduction))
            }
          />
        );
      case "migrate":
        return (
          <ConfirmDialog
            title="Impor Data Tutup Buku Lama"
            message="Semua tutup buku harian lama akan dipindahkan ke laporan arus kas (penjualan, pengeluaran tunai dan selisih kas). Proses ini hanya dijalankan sekali."
            confirmLabel="Impor"
            tone="bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]"
            loading={saving}
            onClose={close}
            onConfirm={() =>
              runAction(async () => {
                await cashflowService.migrateLegacyClosings(userEmail, isProduction);
                setPendingMigration(false);
              })
            }
          />
        );
      default:
        return null;
    }
  };

  const headerSecondaryBtnClass =
    "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-700 shadow-xs hover:bg-[#fff8f8] hover:text-[#e66a6a] hover:border-[#e66a6a]/30 transition-all duration-200 disabled:opacity-40";
  const headerPrimaryBtnClass =
    "flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030] text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40";

  return (
    <div className="finance-container bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 sm:p-8 font-sans">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 text-[#e66a6a] border border-rose-200/80 flex items-center justify-center text-xl shadow-xs">
            <FaWallet />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight tracking-tight">
              Laporan Arus Kas
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Arus kas bulanan Unimart • {formatMonthLabel(selectedMonth)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canManage && ledgerDates.length > 0 && (
            <button
              type="button"
              className={headerSecondaryBtnClass}
              onClick={() => setModal({ type: "anchor" })}
            >
              <FaAnchor className="text-indigo-500" /> Anchor saldo
            </button>
          )}
          {canManage && (
            <>
              <button
                type="button"
                className={headerSecondaryBtnClass}
                onClick={() => setModal({ type: "transfer" })}
              >
                <FaExchangeAlt className="text-sky-500" /> Mutasi saldo
              </button>
              <button
                type="button"
                className={headerPrimaryBtnClass}
                onClick={() => setModal({ type: "addExpense" })}
              >
                <FaPlus /> Tambah pengeluaran
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => generateCashflowPdf(rows, formatMonthLabel(selectedMonth))}
            disabled={loading}
            title="Unduh PDF"
            className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 shadow-xs hover:text-[#e66a6a] hover:border-[#e66a6a]/30 hover:bg-[#fff8f8] transition-all duration-200 disabled:opacity-40"
          >
            <FaDownload />
          </button>
        </div>
      </header>

      {canManage && pendingMigration && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-5 py-4 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <span>Data Tutup Buku lama belum dipindahkan ke laporan arus kas.</span>
          <button
            type="button"
            onClick={() => setModal({ type: "migrate" })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
          >
            <FaFileImport /> Impor sekarang
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 px-5 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Month selector & filter bar */}
      <div className="bg-[#fafbfc] border border-gray-200/80 rounded-xl p-3 sm:p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Periode:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="pl-3.5 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#e66a6a]/25 focus:border-[#e66a6a] transition-all cursor-pointer"
          >
            {monthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonthLabel(monthKey)}
                {monthKey === currentMonth ? " (berjalan)" : ""}
              </option>
            ))}
          </select>
        </div>

        {activeAccount && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#e66a6a]">
            <span>Filter Akun: {ACCOUNT_LABELS[activeAccount]}</span>
            <button
              type="button"
              onClick={() => setActiveAccount(null)}
              title="Hapus filter"
              className="hover:text-red-700 ml-1 font-bold"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Account cards */}
      <div className="flex gap-3.5 overflow-x-auto pb-2 mb-8">
        {ACCOUNTS.map((account) => (
          <AccountCard
            key={account}
            account={account}
            balance={closingBalances[account]}
            active={activeAccount === account}
            onClick={() => setActiveAccount((prev) => (prev === account ? null : account))}
          />
        ))}
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="animate-pulse space-y-3 p-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#fafbfc] text-gray-700 border-b border-gray-200">
                  <th rowSpan={2} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider w-28 text-gray-700">
                    Tanggal
                  </th>
                  <th rowSpan={2} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-r border-gray-200 text-gray-700">
                    Keterangan
                  </th>
                  {visibleAccounts.map((account) => {
                    const { Icon } = ACCOUNT_STYLE[account];
                    return (
                      <th
                        key={account}
                        colSpan={2}
                        className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider border-l-2 border-gray-200 text-gray-800"
                      >
                        <Icon className={`inline-block w-3.5 h-3.5 mr-1.5 align-[-2px] ${
                          account === "cash" ? "text-emerald-500" : account === "qris" ? "text-sky-500" : "text-[#e66a6a]"
                        }`} />
                        {ACCOUNT_LABELS[account]}
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-[#f1f5f9] text-gray-600 border-b-2 border-gray-200">
                  {visibleAccounts.map((account) => (
                    <React.Fragment key={account}>
                      <th className="text-right px-5 py-2 text-[11px] font-semibold uppercase tracking-wider border-l-2 border-gray-200 text-gray-600">
                        Jumlah
                      </th>
                      <th className="text-right px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                        Saldo
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const isOpening = row.rowType === "opening";
                  const isClosing = row.rowType === "closing";
                  const isTotalRow = isOpening || isClosing;
                  const isClickable =
                    canManage && (row.rowType === "expense" || row.rowType === "transfer");
                  const hasTooltip = ["sales", "discrepancy", "adjustment", "expense", "transfer"].includes(
                    row.rowType
                  );
                  const showDate =
                    row.rawDate !== "" && row.rawDate !== displayRows[index - 1]?.rawDate;
                  const separator = isClosing
                    ? "border-t-2 border-gray-300 font-bold"
                    : showDate
                    ? "border-t-2 border-gray-200"
                    : "border-t border-gray-100";

                  return (
                    <tr
                      key={row.key}
                      className={`${ROW_TINT[row.rowType]} ${separator} transition-colors hover:bg-[#fff8f8] group`}
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500 font-medium">
                        {showDate ? formatDayLabel(row.rawDate) : ""}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap border-r border-gray-100">
                        <div
                          className="flex items-center relative"
                          onMouseEnter={() => hasTooltip && setHoveredRowKey(row.key)}
                          onMouseLeave={() => setHoveredRowKey(null)}
                        >
                          <span
                            onClick={() => handleRowClick(row)}
                            className={`text-sm ${
                              isTotalRow ? "font-bold text-gray-900" : "font-semibold text-gray-800"
                            } ${isClickable ? "cursor-pointer hover:text-[#e66a6a] transition-colors" : ""}`}
                          >
                            {row.description}
                          </span>
                          {row.rowType === "discrepancy" && !row.isDiscrepancyConfirmed && (
                            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          )}
                          {isOpening && canManage && (
                            <button
                              type="button"
                              onClick={() => setModal({ type: "opening" })}
                              title="Ubah saldo awal"
                              className="ml-2 p-1 rounded-lg text-gray-400 hover:text-[#e66a6a] hover:bg-rose-50 transition-colors"
                            >
                              <FaPen className="w-3 h-3" />
                            </button>
                          )}
                          {isOpening && !data.opening.isOverride && (
                            <span className="ml-2 text-[11px] font-normal text-gray-400">
                              (dari saldo akhir sebelumnya)
                            </span>
                          )}
                          {renderTooltip(row)}
                        </div>
                      </td>
                      {visibleAccounts.map((account) => (
                        <React.Fragment key={account}>
                          <td className="px-5 py-3 text-right whitespace-nowrap border-l-2 border-gray-200">
                            {isTotalRow ? null : <AmountCell value={row.amounts[account]} />}
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <BalanceCell value={row.balances[account]} isClosing={isClosing} />
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
                {displayRows.length === 2 && (
                  <tr>
                    <td
                      colSpan={2 + visibleAccounts.length * 2}
                      className="text-center py-12 text-gray-400 text-sm"
                    >
                      Belum ada penjualan atau pengeluaran untuk bulan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-[#fafbfc] border-t border-gray-200 flex items-center justify-between">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setModal({ type: "addExpense" })}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:text-[#e66a6a] hover:bg-[#fff8f8] hover:border-[#e66a6a]/30 border border-gray-200 shadow-xs transition-all duration-150"
                >
                  <FaPlus className="w-3 h-3 text-[#e66a6a]" /> Tambah pengeluaran
                </button>
              ) : (
                <span />
              )}
              <span className="text-xs font-medium text-gray-500">{expenseCount} pengeluaran</span>
            </div>
          </div>
        )}
      </div>

      {renderModal()}
    </div>
  );
};

export default Finance;
