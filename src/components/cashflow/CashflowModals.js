// src/components/cashflow/CashflowModals.js
import React, { useState } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import {
  ACCOUNTS,
  ACCOUNT_LABELS,
  MONEY_ACCOUNTS,
  fmtAmount,
  formatDayLabel,
  formatDigitsInput,
  parseDigits,
  reconcileDay,
} from "../../utils/cashflowUtils";

export const INPUT_CLASS =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e66a6a]/25 focus:border-[#e66a6a] transition-all";
const LABEL_CLASS = "block text-sm font-medium text-gray-500 mb-1.5";
const CANCEL_CLASS =
  "flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40";
const PRIMARY_CLASS =
  "flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl shadow-xs transition-all duration-200 disabled:opacity-40";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

export const ModalShell = ({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  elevated = false,
}) => (
  <div
    className={`fixed inset-0 flex items-center justify-center ${
      elevated ? "z-[1010]" : "z-[1000]"
    }`}
  >
    <div
      className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    />
    <div
      className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full mx-4 p-7 max-h-[90vh] overflow-y-auto ${
        wide ? "max-w-2xl" : "max-w-md"
      }`}
    >
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <FaTimes />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const MoneyInput = ({ value, onChange, ...props }) => (
  <input
    type="text"
    inputMode="numeric"
    placeholder="0"
    value={value}
    onChange={(e) => onChange(formatDigitsInput(e.target.value))}
    className={INPUT_CLASS}
    {...props}
  />
);

export const AccountPills = ({ accounts, value, onChange, disabled, vertical }) => (
  <div className={`flex gap-2${vertical ? " flex-col" : ""}`}>
    {accounts.map((account) => (
      <button
        key={account}
        type="button"
        disabled={disabled}
        onClick={() => onChange(account)}
        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
          value === account
            ? "bg-gradient-to-r from-[#e66a6a] to-[#d35454] text-white shadow-xs"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {ACCOUNT_LABELS[account]}
      </button>
    ))}
  </div>
);

export const DeltaText = ({ value }) => {
  if (value === 0) return <span className="font-mono text-gray-400">0</span>;
  const positive = value > 0;
  return (
    <span
      className={`font-mono font-semibold ${
        positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {positive ? "+" : ""}
      {fmtAmount(value)}
    </span>
  );
};

const ModalActions = ({ onClose, onSubmit, submitLabel, loading, disabled, tone }) => (
  <div className="flex gap-3 mt-6">
    <button type="button" onClick={onClose} disabled={loading} className={CANCEL_CLASS}>
      Batal
    </button>
    <button
      type="button"
      onClick={onSubmit}
      disabled={loading || disabled}
      className={`${PRIMARY_CLASS} ${tone || "bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]"}`}
    >
      {loading ? "Menyimpan..." : submitLabel}
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Opening balance
// ---------------------------------------------------------------------------

export const OpeningBalanceModal = ({ balance, onSave, onClose, loading }) => {
  const [values, setValues] = useState(() =>
    ACCOUNTS.reduce((acc, account) => {
      acc[account] = fmtAmount(balance[account]);
      return acc;
    }, {})
  );

  return (
    <ModalShell title="Ubah Saldo Awal" onClose={onClose}>
      <div className="space-y-4">
        {ACCOUNTS.map((account) => (
          <div key={account}>
            <label className={LABEL_CLASS}>{ACCOUNT_LABELS[account]}</label>
            <MoneyInput
              value={values[account]}
              onChange={(v) => setValues((prev) => ({ ...prev, [account]: v }))}
            />
          </div>
        ))}
      </div>
      <ModalActions
        onClose={onClose}
        loading={loading}
        submitLabel="Simpan"
        onSubmit={() =>
          onSave(
            ACCOUNTS.reduce((acc, account) => {
              acc[account] = parseDigits(values[account]);
              return acc;
            }, {})
          )
        }
      />
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Expense (add / edit)
// ---------------------------------------------------------------------------

export const ExpenseCategoryInput = ({ value, onChange, categories, listId }) => (
  <>
    <input
      type="text"
      list={listId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="mis. Token Listrik"
      className={INPUT_CLASS}
    />
    <datalist id={listId}>
      {categories.map((category) => (
        <option key={category} value={category} />
      ))}
    </datalist>
  </>
);

export const ExpenseModal = ({
  expense,
  defaultDate,
  minDate,
  maxDate,
  categories,
  onSave,
  onDelete,
  onClose,
  loading,
}) => {
  const isEdit = !!expense;
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amount, setAmount] = useState(
    expense ? fmtAmount(expense.amount) : ""
  );
  const [dateKey, setDateKey] = useState(expense?.date ?? defaultDate);
  const [sourceAccount, setSourceAccount] = useState(
    expense?.sourceAccount ?? "cash"
  );
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const numericAmount = parseDigits(amount);
  const isValid = category.trim() && numericAmount > 0 && dateKey;
  const isChanged =
    !isEdit ||
    category.trim() !== expense.category ||
    numericAmount !== expense.amount ||
    dateKey !== expense.date ||
    sourceAccount !== expense.sourceAccount;

  // Pembelian Grosir can be paid from Kredit too, so keep it selectable.
  const isBulkPurchase = expense?.addedFrom === "bulkPurchase";

  const subtitle = isEdit
    ? expense.addedFrom === "pos"
      ? `Dicatat dari POS oleh ${expense.createdBy || "-"}`
      : isBulkPurchase
      ? `Dari Pembelian Grosir oleh ${expense.createdBy || "-"}`
      : `Dicatat dari Finance oleh ${expense.createdBy || "-"}`
    : undefined;

  if (isConfirmingDelete) {
    return (
      <ModalShell title="Hapus Pengeluaran?" onClose={onClose}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-gray-600">
          Hapus <span className="font-semibold text-gray-900">"{expense.category}"</span>{" "}
          (Rp {fmtAmount(expense.amount)})? Data dihapus permanen dan semua
          saldo akan dihitung ulang.
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(false)}
            disabled={loading}
            className={CANCEL_CLASS}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            className={`${PRIMARY_CLASS} bg-red-600 hover:bg-red-700`}
          >
            {loading ? "Menghapus..." : "Hapus Permanen"}
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={isEdit ? "Ubah Pengeluaran" : "Tambah Pengeluaran"}
      subtitle={subtitle}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Keterangan</label>
          <ExpenseCategoryInput
            value={category}
            onChange={setCategory}
            categories={categories}
            listId="cashflow-expense-categories"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Jumlah (Rp)</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Tanggal</label>
          <input
            type="date"
            value={dateKey}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDateKey(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Sumber Dana</label>
          <AccountPills
            accounts={isBulkPurchase ? ACCOUNTS : MONEY_ACCOUNTS}
            value={sourceAccount}
            onChange={setSourceAccount}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        {isEdit && (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            disabled={loading}
            className="px-3 py-3 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <FaTrash /> Hapus
          </button>
        )}
        <button type="button" onClick={onClose} disabled={loading} className={CANCEL_CLASS}>
          Batal
        </button>
        <button
          type="button"
          disabled={loading || !isValid || !isChanged}
          onClick={() =>
            onSave({
              category: category.trim(),
              amount: numericAmount,
              dateKey,
              sourceAccount,
            })
          }
          className={`${PRIMARY_CLASS} bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]`}
        >
          {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah"}
        </button>
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Transfer between accounts (e.g. settling Kredit into Cash)
// ---------------------------------------------------------------------------

export const TransferModal = ({ defaultDate, minDate, maxDate, onSave, onClose, loading }) => {
  const [fromAccount, setFromAccount] = useState("kredit");
  const [toAccount, setToAccount] = useState("cash");
  const [amount, setAmount] = useState("");
  const [dateKey, setDateKey] = useState(defaultDate);
  const [description, setDescription] = useState("Pelunasan Kredit");

  const numericAmount = parseDigits(amount);
  const isValid = numericAmount > 0 && dateKey && fromAccount !== toAccount;

  return (
    <ModalShell
      title="Mutasi Saldo"
      subtitle="Pindahkan saldo antar akun, mis. saat voucher (Kredit) sudah dibayar"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Dari akun</label>
          <AccountPills accounts={ACCOUNTS} value={fromAccount} onChange={setFromAccount} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Ke akun</label>
          <AccountPills accounts={ACCOUNTS} value={toAccount} onChange={setToAccount} />
          {fromAccount === toAccount && (
            <p className="text-xs text-red-500 mt-1.5">Akun asal dan tujuan harus berbeda.</p>
          )}
        </div>
        <div>
          <label className={LABEL_CLASS}>Jumlah (Rp)</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Tanggal</label>
          <input
            type="date"
            value={dateKey}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDateKey(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Keterangan</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        loading={loading}
        disabled={!isValid}
        submitLabel="Simpan Mutasi"
        onSubmit={() =>
          onSave({
            fromAccount,
            toAccount,
            amount: numericAmount,
            dateKey,
            description: description.trim(),
          })
        }
      />
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Discrepancy confirm / override
// ---------------------------------------------------------------------------

const SummaryBox = ({ title, amounts, totalLabel, accounts = ACCOUNTS }) => (
  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
    {title && (
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </p>
    )}
    {accounts.map((account) => (
      <div key={account} className="flex justify-between text-sm">
        <span className="text-gray-500">{ACCOUNT_LABELS[account]}</span>
        <DeltaText value={amounts[account]} />
      </div>
    ))}
    <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
      <span className="text-gray-700">{totalLabel}</span>
      <DeltaText value={accounts.reduce((sum, account) => sum + amounts[account], 0)} />
    </div>
  </div>
);

export const ConfirmDiscrepancyModal = ({ info, onConfirm, onClose, loading }) => (
  <ModalShell title="Konfirmasi Selisih" onClose={onClose}>
    <p className="text-sm text-gray-500 mb-5">
      Terima selisih hitungan kasir tanggal{" "}
      <span className="font-semibold text-gray-700">{formatDayLabel(info.dateKey)}</span>{" "}
      apa adanya?
    </p>
    <SummaryBox amounts={info.discrepancy} totalLabel="Total Selisih" accounts={MONEY_ACCOUNTS} />
    <ModalActions
      onClose={onClose}
      onSubmit={onConfirm}
      loading={loading}
      submitLabel="Konfirmasi"
      tone="bg-emerald-600 hover:bg-emerald-700"
    />
  </ModalShell>
);

export const OverrideDiscrepancyModal = ({ info, onSave, onClose, loading }) => {
  const [values, setValues] = useState(() =>
    MONEY_ACCOUNTS.reduce((acc, account) => {
      acc[account] = fmtAmount(info.actual[account]);
      return acc;
    }, {})
  );
  const actual = MONEY_ACCOUNTS.reduce((acc, account) => {
    acc[account] = parseDigits(values[account]);
    return acc;
  }, {});
  const { discrepancy } = reconcileDay({
    sales: info.sales,
    expenses: info.expenses,
    actual,
  });

  return (
    <ModalShell title="Koreksi Hitungan Kasir" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-5">
        Ganti hitungan kasir tanggal{" "}
        <span className="font-semibold text-gray-700">{formatDayLabel(info.dateKey)}</span>.
        Nilai baru dipakai untuk menghitung ulang selisih.
      </p>
      <div className="space-y-4 mb-5">
        {MONEY_ACCOUNTS.map((account) => (
          <div key={account}>
            <label className={LABEL_CLASS}>{ACCOUNT_LABELS[account]} diterima</label>
            <MoneyInput
              value={values[account]}
              onChange={(v) => setValues((prev) => ({ ...prev, [account]: v }))}
            />
          </div>
        ))}
      </div>
      <SummaryBox
        title="Selisih Baru"
        amounts={discrepancy}
        totalLabel="Total Selisih"
        accounts={MONEY_ACCOUNTS}
      />
      <ModalActions
        onClose={onClose}
        onSubmit={() => onSave(actual)}
        loading={loading}
        submitLabel="Simpan Koreksi"
        tone="bg-amber-600 hover:bg-amber-700"
      />
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Anchor balance
// ---------------------------------------------------------------------------

// getBalancesForDate(dateKey) returns the calculated end-of-day balances
// before any anchor on that date.
export const AnchorBalanceModal = ({ dates, getBalancesForDate, onSave, onClose, loading }) => {
  const [dateKey, setDateKey] = useState(dates[dates.length - 1] ?? "");
  const [enabled, setEnabled] = useState({ cash: true, qris: false, kredit: false });
  const current = getBalancesForDate(dateKey);
  const [values, setValues] = useState(() =>
    ACCOUNTS.reduce((acc, account) => {
      acc[account] = fmtAmount(current[account]);
      return acc;
    }, {})
  );

  const handleDateChange = (nextDate) => {
    setDateKey(nextDate);
    const balances = getBalancesForDate(nextDate);
    setValues(
      ACCOUNTS.reduce((acc, account) => {
        acc[account] = fmtAmount(balances[account]);
        return acc;
      }, {})
    );
  };

  const activeAccounts = ACCOUNTS.filter((account) => enabled[account]);
  const adjustments = ACCOUNTS.reduce((acc, account) => {
    acc[account] = enabled[account] ? parseDigits(values[account]) - current[account] : 0;
    return acc;
  }, {});

  return (
    <ModalShell
      title="Anchor Saldo"
      subtitle="Samakan saldo dengan jumlah riil di akhir hari. Selisihnya dicatat sebagai penyesuaian."
      onClose={onClose}
    >
      <div className="mb-5">
        <label className={LABEL_CLASS}>Tanggal</label>
        <select
          value={dateKey}
          onChange={(e) => handleDateChange(e.target.value)}
          className={INPUT_CLASS}
        >
          {dates.map((date) => (
            <option key={date} value={date}>
              {formatDayLabel(date)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 mb-5">
        {ACCOUNTS.map((account) => (
          <div
            key={account}
            className={`rounded-xl border p-4 transition-all ${
              enabled[account]
                ? "border-rose-200 bg-rose-50/30"
                : "border-gray-100 bg-gray-50/50 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled[account]}
                  onChange={(e) =>
                    setEnabled((prev) => ({ ...prev, [account]: e.target.checked }))
                  }
                  className="accent-[#e66a6a]"
                />
                {ACCOUNT_LABELS[account]}
              </label>
              <span className="text-[11px] font-mono text-gray-400">
                Saat ini: {fmtAmount(current[account])}
              </span>
            </div>
            {enabled[account] && (
              <MoneyInput
                value={values[account]}
                onChange={(v) => setValues((prev) => ({ ...prev, [account]: v }))}
              />
            )}
          </div>
        ))}
      </div>

      {activeAccounts.length > 0 && (
        <SummaryBox
          title="Penyesuaian"
          amounts={adjustments}
          totalLabel="Total Penyesuaian"
          accounts={activeAccounts}
        />
      )}

      <ModalActions
        onClose={onClose}
        loading={loading}
        disabled={!dateKey || activeAccounts.length === 0}
        submitLabel="Anchor Saldo"
        tone="bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]"
        onSubmit={() =>
          onSave(
            dateKey,
            activeAccounts.reduce((acc, account) => {
              acc[account] = parseDigits(values[account]);
              return acc;
            }, {})
          )
        }
      />
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Generic confirmation
// ---------------------------------------------------------------------------

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  tone = "bg-red-600 hover:bg-red-700",
  onConfirm,
  onClose,
  loading,
}) => (
  <ModalShell title={title} onClose={onClose}>
    <p className="text-sm text-gray-500">{message}</p>
    <ModalActions
      onClose={onClose}
      onSubmit={onConfirm}
      loading={loading}
      submitLabel={confirmLabel}
      tone={tone}
    />
  </ModalShell>
);
