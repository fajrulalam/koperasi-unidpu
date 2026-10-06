// src/components/cashflow/LaporanHarianModal.js
//
// End-of-day report (replicated from 375 POS FinancialReportBottomSheet).
// The cashier enters the Cash and QRIS received; the system compares them with
// that day's sales minus POS expenses and stores the result in the cashflow
// ledger. Kredit (voucher) is recorded by the system and needs no count.
import React, { useCallback, useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaPlus,
  FaQrcode,
  FaTicketAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useEnvironment } from "../../context/EnvironmentContext";
import { cashflowService } from "../../services/cashflowService";
import {
  ACCOUNT_LABELS,
  MONEY_ACCOUNTS,
  censorAmount,
  emptyAmounts,
  fmtAmount,
  formatDayLabel,
  getLocalDateKey,
  parseDigits,
  reconcileDay,
  sumExpensesByAccount,
  summarizeSales,
} from "../../utils/cashflowUtils";
import { INPUT_CLASS, ModalShell, MoneyInput } from "./CashflowModals";
import CatatPengeluaranModal from "./CatatPengeluaranModal";

const EMPTY_SALES = { ...emptyAmounts(), total: 0, count: 0 };

const INCOME_FIELDS = {
  cash: {
    Icon: FaMoneyBillWave,
    color: "text-emerald-600",
    label: "Uang Cash (Rp)",
    hint: "Uang tunai hasil penjualan yang ada di laci, tanpa modal awal",
  },
  qris: {
    Icon: FaQrcode,
    color: "text-blue-600",
    label: "Uang QRIS (Rp)",
    hint: "Total dana QRIS / e-money yang masuk (cek di aplikasi merchant)",
  },
};

const LaporanHarianModal = ({ isOpen, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { isProduction } = useEnvironment();
  const today = getLocalDateKey();

  const [dateKey, setDateKey] = useState(today);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState(EMPTY_SALES);
  const [posExpenses, setPosExpenses] = useState([]);
  const [existingReport, setExistingReport] = useState(null);
  const [inputs, setInputs] = useState({ cash: "", qris: "" });
  const [step, setStep] = useState("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const fetchExpenses = useCallback(async () => {
    const all = await cashflowService.fetchExpensesForDate(dateKey, isProduction);
    // Expenses entered from the Finance page are back-office spending, not
    // money taken from the drawer, so they stay out of the reconciliation.
    setPosExpenses(all.filter((expense) => expense.addedFrom === "pos"));
  }, [dateKey, isProduction]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setStep("form");

    Promise.all([
      cashflowService.fetchTransactionsForDate(dateKey, isProduction),
      cashflowService.fetchReport(dateKey, isProduction),
      fetchExpenses(),
    ])
      .then(([transactions, report]) => {
        if (cancelled) return;
        setSales(summarizeSales(transactions));
        setExistingReport(report);
        setInputs({
          cash: report ? fmtAmount(report.actualCash) : "",
          qris: report ? fmtAmount(report.actualQris) : "",
        });
      })
      .catch((err) => {
        console.error("Error loading daily report:", err);
        if (!cancelled) setError("Gagal memuat data transaksi. Silakan coba lagi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, dateKey, isProduction, fetchExpenses]);

  useEffect(() => {
    if (!isOpen) setDateKey(getLocalDateKey());
  }, [isOpen]);

  if (!isOpen) return null;

  const expenses = sumExpensesByAccount(posExpenses);
  const actual = { cash: parseDigits(inputs.cash), qris: parseDigits(inputs.qris) };
  const { expected, discrepancy } = reconcileDay({ sales, expenses, actual });
  const allMatch = MONEY_ACCOUNTS.every((account) => discrepancy[account] === 0);
  const isToday = dateKey === today;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await cashflowService.submitDailyReport(
        {
          dateKey,
          sales,
          expenses,
          actual,
          submittedBy: currentUser?.email || "unknown",
        },
        isProduction
      );
      onSaved?.(dateKey);
      onClose();
    } catch (err) {
      console.error("Error saving daily report:", err);
      setError("Gagal menyimpan laporan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => (
    <>
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-500 mb-1.5">Tanggal</label>
        <input
          type="date"
          value={dateKey}
          max={today}
          onChange={(e) => e.target.value && setDateKey(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {existingReport && (
        <div className="mb-5 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-xs text-blue-800">
          Laporan tanggal ini sudah pernah disimpan oleh {existingReport.submittedBy || "-"}.
          Menyimpan lagi akan memperbarui laporan.
        </div>
      )}

      {/* System revenue (masked) */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-6">
        <p className="text-sm font-medium text-gray-500">Perhitungan Sistem</p>
        <p className="text-3xl font-bold text-gray-900 tracking-tight mt-1">
          {loading ? "…" : censorAmount(sales.total)}
        </p>
        {!loading && <p className="text-xs text-gray-400 mt-1">{sales.count} transaksi</p>}
      </div>

      {/* Income input */}
      <p className="text-base font-semibold text-gray-900">
        Pemasukan {isToday ? "Hari Ini" : formatDayLabel(dateKey)}
      </p>
      <p className="text-xs text-gray-500 mb-4">
        Masukkan jumlah uang yang diterima berdasarkan metode pembayaran
      </p>
      <div className="space-y-4 mb-6">
        {MONEY_ACCOUNTS.map((account) => {
          const { Icon, color, label, hint } = INCOME_FIELDS[account];
          return (
            <div key={account}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Icon className={color} /> {label}
              </label>
              <MoneyInput
                value={inputs[account]}
                onChange={(value) => setInputs((prev) => ({ ...prev, [account]: value }))}
                disabled={loading}
                aria-label={label}
              />
              <p className="text-[11px] text-gray-400 mt-1">{hint}</p>
            </div>
          );
        })}
      </div>

      {/* Kredit info */}
      {!loading && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3.5 mb-6">
          <FaTicketAlt className="w-5 h-5 text-purple-700 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-800">Kredit (Voucher)</p>
            <p className="text-[11px] text-purple-500">
              Nilai voucher dicatat otomatis dan belum menjadi uang yang diterima.
            </p>
          </div>
          <span className="text-base font-bold text-purple-800">Rp {fmtAmount(sales.kredit)}</span>
        </div>
      )}

      {/* Expenses */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-base font-semibold text-gray-900">Pengeluaran dari Laci</p>
        <button
          type="button"
          onClick={() => setShowExpenseModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-orange-700 hover:bg-orange-50 transition-colors"
        >
          <FaPlus className="w-3 h-3" /> Tambah
        </button>
      </div>
      {posExpenses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 py-5 text-center text-sm text-gray-500 mb-6">
          Belum ada pengeluaran
        </div>
      ) : (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-6 space-y-1.5">
          {posExpenses.map((expense) => (
            <div key={expense.id} className="flex justify-between text-sm text-gray-700">
              <span>
                {expense.category}{" "}
                <span className="text-[11px] text-gray-400">
                  ({ACCOUNT_LABELS[expense.sourceAccount]})
                </span>
              </span>
              <span className="font-medium">Rp {fmtAmount(expense.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-orange-200 pt-2 text-sm font-semibold text-orange-800">
            <span>Total Pengeluaran</span>
            <span>Rp {fmtAmount(expenses.cash + expenses.qris)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        type="button"
        onClick={() => setStep("confirm")}
        disabled={loading || inputs.cash === ""}
        className="w-full py-3.5 rounded-xl bg-amber-600 text-white text-base font-semibold hover:bg-amber-700 transition-colors disabled:opacity-40"
      >
        Rekap Harian
      </button>
    </>
  );

  const renderConfirm = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        {allMatch ? (
          <FaCheckCircle className="w-7 h-7 text-emerald-500" />
        ) : (
          <FaExclamationTriangle className="w-7 h-7 text-amber-500" />
        )}
        <p className="text-sm text-gray-600">
          {allMatch
            ? "Semua nilai sesuai dengan perhitungan sistem (penjualan dikurangi pengeluaran)."
            : "Ada selisih antara hitungan Anda dan perhitungan sistem. Periksa lagi sebelum menyimpan."}
        </p>
      </div>

      <div className="space-y-2.5">
        {MONEY_ACCOUNTS.map((account) => {
          const match = discrepancy[account] === 0;
          return (
            <div
              key={account}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                match ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              {match ? (
                <FaCheckCircle className="text-emerald-500 shrink-0" />
              ) : (
                <FaExclamationTriangle className="text-amber-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{ACCOUNT_LABELS[account]}</p>
                <p className={`text-xs ${match ? "text-emerald-700" : "text-amber-800"}`}>
                  {match
                    ? `Rp ${fmtAmount(actual[account])} — Sesuai`
                    : `Input: Rp ${fmtAmount(actual[account])}  vs  Sistem: ${censorAmount(
                        expected[account]
                      )}`}
                </p>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
          <FaTicketAlt className="text-purple-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Kredit (Voucher)</p>
            <p className="text-xs text-purple-700">
              Rp {fmtAmount(sales.kredit)} — tercatat otomatis, tidak masuk kas
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={() => setStep("form")}
          disabled={saving}
          className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40"
        >
          Ubah
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40 ${
            allMatch ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <ModalShell
        title={step === "form" ? "Laporan Keuangan Harian" : "Konfirmasi Laporan"}
        subtitle={formatDayLabel(dateKey)}
        onClose={onClose}
        wide
      >
        {step === "form" ? renderForm() : renderConfirm()}
      </ModalShell>
      <CatatPengeluaranModal
        isOpen={showExpenseModal}
        dateKey={dateKey}
        elevated
        onChanged={() =>
          fetchExpenses().catch((err) => console.error("Error refreshing expenses:", err))
        }
        onClose={() => setShowExpenseModal(false)}
      />
    </>
  );
};

export default LaporanHarianModal;
