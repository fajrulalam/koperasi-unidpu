// src/components/cashflow/CatatPengeluaranModal.js
//
// Quick expense entry for the cashier (replicated from 375 POS
// QuickExpenseBottomSheet). Lists the POS expenses of the chosen day so a
// mistaken entry can be removed before the end-of-day report.
import React, { useCallback, useEffect, useState } from "react";
import { FaMoneyBillWave, FaQrcode, FaReceipt, FaTrash } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useEnvironment } from "../../context/EnvironmentContext";
import { cashflowService } from "../../services/cashflowService";
import {
  ACCOUNT_LABELS,
  MONEY_ACCOUNTS,
  fmtAmount,
  formatDayLabel,
  getLocalDateKey,
  parseDigits,
} from "../../utils/cashflowUtils";
import {
  AccountPills,
  ExpenseCategoryInput,
  ModalShell,
  MoneyInput,
} from "./CashflowModals";

const SOURCE_ICON = { cash: FaMoneyBillWave, qris: FaQrcode };

const CatatPengeluaranModal = ({ isOpen, onClose, onChanged, dateKey, elevated }) => {
  const { currentUser } = useAuth();
  const { isProduction } = useEnvironment();
  const targetDate = dateKey || getLocalDateKey();
  const isToday = targetDate === getLocalDateKey();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceAccount, setSourceAccount] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [categories, setCategories] = useState([]);

  const fetchExpenses = useCallback(async () => {
    setLoadingList(true);
    try {
      const all = await cashflowService.fetchExpensesForDate(targetDate, isProduction);
      setExpenses(all.filter((expense) => expense.addedFrom === "pos"));
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoadingList(false);
    }
  }, [targetDate, isProduction]);

  useEffect(() => {
    if (!isOpen) return;
    setCategory("");
    setAmount("");
    setSourceAccount("cash");
    setError("");
    fetchExpenses();
    cashflowService
      .fetchExpenseCategories()
      .then(setCategories)
      .catch((err) => console.error("Error fetching expense categories:", err));
  }, [isOpen, fetchExpenses]);

  if (!isOpen) return null;

  const numericAmount = parseDigits(amount);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleSave = async () => {
    const trimmed = category.trim();
    if (!trimmed || numericAmount <= 0) {
      setError("Isi kategori dan jumlah terlebih dahulu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await cashflowService.addExpense(
        {
          amount: numericAmount,
          category: trimmed,
          sourceAccount,
          dateKey: targetDate,
          addedFrom: "pos",
          createdBy: currentUser?.email || "unknown",
        },
        isProduction
      );
      if (!categories.includes(trimmed)) {
        setCategories((prev) => [...prev, trimmed]);
        cashflowService
          .saveExpenseCategory(trimmed)
          .catch((err) => console.error("Error saving expense category:", err));
      }
      setCategory("");
      setAmount("");
      setSourceAccount("cash");
      await fetchExpenses();
      onChanged?.();
    } catch (err) {
      console.error("Error saving expense:", err);
      setError("Gagal menyimpan pengeluaran. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Hapus pengeluaran "${expense.category}"? Data tidak bisa dikembalikan.`)) {
      return;
    }
    try {
      await cashflowService.deleteExpense(expense, isProduction);
      await fetchExpenses();
      onChanged?.();
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Gagal menghapus pengeluaran. Silakan coba lagi.");
    }
  };

  return (
    <ModalShell
      title="Catat Pengeluaran"
      subtitle={isToday ? "Hari ini" : formatDayLabel(targetDate)}
      onClose={onClose}
      elevated={elevated}
      wide
    >
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-orange-800">Tambah Pengeluaran Baru</p>
        <ExpenseCategoryInput
          value={category}
          onChange={setCategory}
          categories={categories}
          listId="pos-expense-categories"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MoneyInput value={amount} onChange={setAmount} aria-label="Jumlah (Rp)" />
          <AccountPills accounts={MONEY_ACCOUNTS} value={sourceAccount} onChange={setSourceAccount} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Pengeluaran"}
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold text-gray-900">
            Pengeluaran {isToday ? "Hari Ini" : formatDayLabel(targetDate)}
          </p>
          {expenses.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-xs font-semibold text-orange-800">
              Total: Rp {fmtAmount(total)}
            </span>
          )}
        </div>
        {loadingList ? (
          <p className="text-sm text-gray-400 py-4 text-center">Memuat...</p>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-6 text-sm text-gray-500">
            <FaReceipt className="w-6 h-6 text-gray-300" />
            Belum ada pengeluaran
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => {
              const Icon = SOURCE_ICON[expense.sourceAccount] || FaMoneyBillWave;
              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500">
                    <Icon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{expense.category}</p>
                    <p className="text-[11px] text-gray-500">
                      {ACCOUNT_LABELS[expense.sourceAccount] || expense.sourceAccount}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-orange-800">
                    Rp {fmtAmount(expense.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(expense)}
                    aria-label={`Hapus ${expense.category}`}
                    className="p-2 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <FaTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default CatatPengeluaranModal;
