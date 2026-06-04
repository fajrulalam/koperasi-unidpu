import React, { useState, useEffect, useMemo } from "react";
import {
  FaArrowLeft,
  FaChevronDown,
  FaTimes,
  FaPlus,
  FaCheck,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";
import { useFirestore } from "../context/FirestoreContext";
import { useAuth } from "../context/AuthContext";
import "../styles/Finance.css";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Token Listrik",
  "Bayar Hutang",
  "Belanja SPI",
];

const formatCurrency = (value) => {
  if (!value && value !== 0) return "Rp 0";
  const prefix = value < 0 ? "-" : "";
  return prefix + "Rp " + Math.abs(value).toLocaleString("id-ID");
};

const getLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const censorAmount = (value) => {
  if (value === 0) return "Rp 0";
  if (!value) return "Rp ***";
  const prefix = value < 0 ? "-" : "";
  const formatted = Math.abs(value).toLocaleString("id-ID");
  if (formatted.length <= 1) return prefix + "Rp " + formatted;
  return (
    prefix +
    "Rp " +
    formatted.charAt(0) +
    formatted.slice(1).replace(/\d/g, "*")
  );
};

const TutupBukuModal = ({ isOpen, onClose, onSaved, editData, forRecord }) => {
  const {
    queryCollection,
    createDoc,
    readDoc,
    updateDoc,
    where,
    query,
  } = useFirestore();
  const { currentUser } = useAuth();

  const isEditMode = !!editData;

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [grossRevenue, setGrossRevenue] = useState(0);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [qrisTotal, setQrisTotal] = useState(0);

  const [openingCash, setOpeningCash] = useState(0);
  const [cashierMoneyRaw, setCashierMoneyRaw] = useState("");
  const [expenses, setExpenses] = useState([]);

  const [customCategories, setCustomCategories] = useState([]);
  const [addingNewCategoryIndex, setAddingNewCategoryIndex] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const allCategories = useMemo(() => {
    const merged = [...DEFAULT_EXPENSE_CATEGORIES];
    customCategories.forEach((c) => {
      if (!merged.includes(c)) merged.push(c);
    });
    return merged;
  }, [customCategories]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const netCashRevenue = grossRevenue - voucherDiscount - qrisTotal;
  const systemMoneyAtHand = netCashRevenue - totalExpenses;
  const cashierMoneyAtHand = cashierMoneyRaw ? parseInt(cashierMoneyRaw) : 0;
  const cashierGrossRevenue = cashierMoneyAtHand - openingCash;
  const discrepancy = cashierGrossRevenue - systemMoneyAtHand;

  useEffect(() => {
    if (!isOpen) {
      setPage(1);
      setExpanded(false);
      setCashierMoneyRaw("");
      setExpenses([]);
      setOpeningCash(0);
      setLoading(true);
      return;
    }

    if (isEditMode) {
      setGrossRevenue(editData.grossRevenue || 0);
      setVoucherDiscount(editData.voucherDiscount || 0);
      setQrisTotal(editData.qrisTotal || 0);
      setOpeningCash(editData.openingCash || 0);
      setCashierMoneyRaw(
        editData.cashierMoneyAtHand
          ? String(editData.cashierMoneyAtHand)
          : ""
      );
      setExpenses(
        (editData.expenses || []).map((e) => ({ ...e }))
      );
      setLoading(false);
    } else {
      if (forRecord) {
        setOpeningCash(forRecord.openingCash || 0);
      }
      fetchTransactionData();
    }

    fetchCategories();
  }, [isOpen, editData]);

  const targetDateString = isEditMode
    ? editData.dateString
    : forRecord?.dateString || getLocalDateString();

  const fetchTransactionData = async () => {
    setLoading(true);
    try {
      const [year, month, day] = targetDateString.split("-").map(Number);
      const startOfDay = new Date(year, month - 1, day);
      const endOfDay = new Date(year, month - 1, day + 1);

      const transactions = await queryCollection(
        "transactionDetail",
        (ref) =>
          query(
            ref,
            where("createdAt", ">=", startOfDay),
            where("createdAt", "<", endOfDay)
          )
      );

      let gross = 0;
      let voucher = 0;
      let qris = 0;

      for (const tx of transactions) {
        gross += tx.total || 0;
        voucher += tx.voucherDiscount || 0;
        if (tx.isPaidViaQris) {
          qris +=
            tx.discountedTotal != null ? tx.discountedTotal : tx.total || 0;
        }
      }

      setGrossRevenue(gross);
      setVoucherDiscount(voucher);
      setQrisTotal(qris);
    } catch (err) {
      console.error("Error fetching today's transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const doc = await readDoc("settings", "expenseCategories");
      if (doc && doc.categories) {
        setCustomCategories(doc.categories);
      }
    } catch (err) {
      console.error("Error fetching expense categories:", err);
    }
  };

  const handleCashierChange = (value) => {
    setCashierMoneyRaw(value.replace(/\D/g, ""));
  };

  const addExpenseRow = () => {
    setExpenses([...expenses, { category: "", amount: 0 }]);
  };

  const removeExpenseRow = (index) => {
    setExpenses(expenses.filter((_, i) => i !== index));
    if (addingNewCategoryIndex === index) {
      setAddingNewCategoryIndex(null);
      setNewCategoryName("");
    }
  };

  const updateExpenseCategory = (index, value) => {
    if (value === "__new__") {
      setAddingNewCategoryIndex(index);
      setNewCategoryName("");
      return;
    }
    const updated = [...expenses];
    updated[index] = { ...updated[index], category: value };
    setExpenses(updated);
  };

  const updateExpenseAmount = (index, value) => {
    const digits = value.replace(/\D/g, "");
    const updated = [...expenses];
    updated[index] = {
      ...updated[index],
      amount: digits ? parseInt(digits) : 0,
    };
    setExpenses(updated);
  };

  const confirmNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      const existingDoc = await readDoc("settings", "expenseCategories");
      const current = existingDoc?.categories || [];
      if (!current.includes(name)) {
        const updated = [...current, name];
        if (existingDoc) {
          await updateDoc("settings", "expenseCategories", {
            categories: updated,
          });
        } else {
          await createDoc(
            "settings",
            { categories: updated },
            "expenseCategories"
          );
        }
        setCustomCategories(updated);
      }
    } catch (err) {
      console.error("Error saving new category:", err);
    }

    if (addingNewCategoryIndex !== null) {
      const updated = [...expenses];
      updated[addingNewCategoryIndex] = {
        ...updated[addingNewCategoryIndex],
        category: name,
      };
      setExpenses(updated);
    }

    setAddingNewCategoryIndex(null);
    setNewCategoryName("");
  };

  const cancelNewCategory = () => {
    setAddingNewCategoryIndex(null);
    setNewCategoryName("");
  };

  const handleTutupBuku = () => {
    setPage(2);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validExpenses = expenses.filter(
        (e) => e.category && e.amount > 0
      );

      const closingData = {
        status: "closed",
        grossRevenue,
        voucherDiscount,
        qrisTotal,
        netCashRevenue,
        expenses: validExpenses,
        totalExpenses: validExpenses.reduce((s, e) => s + e.amount, 0),
        systemMoneyAtHand,
        openingCash,
        cashierMoneyAtHand,
        cashierGrossRevenue,
        discrepancy,
        createdBy: currentUser?.email || "unknown",
      };

      if (isEditMode) {
        await updateDoc("dailyClosings", editData.dateString, closingData);
      } else {
        const dateString = targetDateString;
        const [y, m] = dateString.split("-").map(Number);
        closingData.dateString = dateString;
        closingData.month = m;
        closingData.year = y;
        await updateDoc("dailyClosings", dateString, closingData);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving daily closing:", err);
      alert("Gagal menyimpan tutup buku. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = cashierMoneyRaw !== "";

  if (!isOpen) return null;

  const renderPage1 = () => (
    <>
      <div className="fin-modal-header">
        <h2>
          {isEditMode
            ? "Edit Tutup Buku"
            : forRecord && forRecord.dateString !== getLocalDateString()
            ? `Tutup Buku — ${forRecord.dateString}`
            : "Tutup Buku Harian"}
        </h2>
        <button className="fin-modal-close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="fin-modal-body">
        {loading ? (
          <div className="fin-loading">
            <p>Memuat data transaksi...</p>
          </div>
        ) : (
          <>
            {/* Expenses FIRST */}
            <div className="fin-expenses-section">
              <div className="fin-expenses-title">Pengeluaran Hari Ini</div>
              {expenses.length > 0 && (
                <div className="fin-expense-rows">
                  {expenses.map((expense, index) => (
                    <div className="fin-expense-row" key={index}>
                      {addingNewCategoryIndex === index ? (
                        <div className="fin-category-input-row">
                          <input
                            className="fin-category-text-input"
                            type="text"
                            placeholder="Nama kategori baru..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmNewCategory();
                              if (e.key === "Escape") cancelNewCategory();
                            }}
                            autoFocus
                          />
                          <button
                            className="fin-category-confirm"
                            onClick={confirmNewCategory}
                          >
                            <FaCheck />
                          </button>
                          <button
                            className="fin-category-cancel"
                            onClick={cancelNewCategory}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <select
                          className="fin-expense-select"
                          value={expense.category}
                          onChange={(e) =>
                            updateExpenseCategory(index, e.target.value)
                          }
                        >
                          <option value="">-- Pilih --</option>
                          {allCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="__new__">
                            + Tambah Kategori Baru
                          </option>
                        </select>
                      )}
                      <div className="fin-expense-amount-wrapper">
                        <span className="fin-expense-amount-prefix">Rp</span>
                        <input
                          className="fin-expense-amount-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={
                            expense.amount
                              ? expense.amount.toLocaleString("id-ID")
                              : ""
                          }
                          onChange={(e) =>
                            updateExpenseAmount(index, e.target.value)
                          }
                        />
                      </div>
                      <button
                        className="fin-expense-delete"
                        onClick={() => removeExpenseRow(index)}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="fin-add-expense" onClick={addExpenseRow}>
                <FaPlus /> Tambah Pengeluaran
              </button>
            </div>

            {/* System values (read-only in edit mode) */}
            {isEditMode && (
              <div className="fin-readonly-values">
                <div className="fin-readonly-title">
                  Data Sistem (tidak dapat diubah)
                </div>
                <div className="fin-readonly-row">
                  <span className="fin-readonly-label">Pendapatan Kotor</span>
                  <span className="fin-readonly-value">
                    {formatCurrency(grossRevenue)}
                  </span>
                </div>
                <div className="fin-readonly-row">
                  <span className="fin-readonly-label">Potongan Voucher</span>
                  <span className="fin-readonly-value">
                    {formatCurrency(voucherDiscount)}
                  </span>
                </div>
                <div className="fin-readonly-row">
                  <span className="fin-readonly-label">Pembayaran QRIS</span>
                  <span className="fin-readonly-value">
                    {formatCurrency(qrisTotal)}
                  </span>
                </div>
              </div>
            )}

            {/* Perhitungan Sistem (censored, for new entries only) */}
            {!isEditMode && (
              <div className="fin-summary-card">
                <div
                  className="fin-summary-header"
                  onClick={() => setExpanded(!expanded)}
                >
                  <div>
                    <div className="fin-summary-label">Perhitungan Sistem</div>
                    <div className="fin-summary-value">
                      {censorAmount(systemMoneyAtHand)}
                    </div>
                  </div>
                  <span
                    className={`fin-summary-toggle ${expanded ? "expanded" : ""}`}
                  >
                    <FaChevronDown />
                  </span>
                </div>
                {expanded && (
                  <div className="fin-breakdown">
                    <div className="fin-breakdown-row">
                      <span className="fin-breakdown-label">
                        Pendapatan Kotor
                      </span>
                      <span className="fin-breakdown-value fin-breakdown-positive">
                        {censorAmount(grossRevenue)}
                      </span>
                    </div>
                    <div className="fin-breakdown-row">
                      <span className="fin-breakdown-label">
                        Voucher Discount
                      </span>
                      <span className="fin-breakdown-value fin-breakdown-negative">
                        -{censorAmount(voucherDiscount)}
                      </span>
                    </div>
                    <div className="fin-breakdown-row">
                      <span className="fin-breakdown-label">
                        Pembayaran QRIS
                      </span>
                      <span className="fin-breakdown-value fin-breakdown-negative">
                        -{censorAmount(qrisTotal)}
                      </span>
                    </div>
                    <div className="fin-breakdown-row">
                      <span className="fin-breakdown-label">Pengeluaran</span>
                      <span className="fin-breakdown-value fin-breakdown-negative">
                        -{censorAmount(totalExpenses)}
                      </span>
                    </div>
                    <div className="fin-breakdown-divider" />
                    <div className="fin-breakdown-row fin-breakdown-total">
                      <span className="fin-breakdown-label">Total</span>
                      <span className="fin-breakdown-value">
                        {censorAmount(systemMoneyAtHand)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opening cash display */}
            <div className="fin-summary-card" style={{ marginBottom: 16 }}>
              <div className="fin-summary-header" style={{ cursor: "default" }}>
                <div>
                  <div className="fin-summary-label">
                    Uang awal hari ini (saat buka buku)
                  </div>
                  <div className="fin-summary-value">
                    {formatCurrency(openingCash)}
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Input */}
            <div className="fin-input-group">
              <label className="fin-input-label">
                Hitung semua uang fisik di kasir, lalu masukkan jumlahnya di
                bawah ini
              </label>
              <div className="fin-input-wrapper">
                <span className="fin-input-prefix">Rp</span>
                <input
                  className="fin-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    cashierMoneyRaw
                      ? parseInt(cashierMoneyRaw).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => handleCashierChange(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="fin-submit-area">
              <button
                className="fin-submit-btn fin-submit-primary"
                disabled={!canProceed}
                onClick={handleTutupBuku}
              >
                {isEditMode ? "Simpan Perubahan" : "Tutup Buku"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );

  const renderPage2 = () => {
    const hasDiscrepancy = discrepancy !== 0;

    return (
      <>
        <div className="fin-modal-header">
          <button className="fin-modal-back" onClick={() => setPage(1)}>
            <FaArrowLeft />
          </button>
          <h2>Konfirmasi</h2>
          <button className="fin-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="fin-modal-body">
          <div className="fin-recon">
            <div className="fin-recon-icon">
              {hasDiscrepancy ? (
                <FaExclamationTriangle className="fin-recon-icon-warning" />
              ) : (
                <FaCheckCircle className="fin-recon-icon-success" />
              )}
            </div>

            <div className="fin-recon-message">
              {hasDiscrepancy
                ? `Ada perbedaan ${censorAmount(Math.abs(discrepancy))} antara perhitungan kasir dan perhitungan sistem. Lanjut saja?`
                : "Nominal cash dan Perhitungan sistem sudah bener nih, mantap!"}
            </div>

            <div className="fin-recon-detail">
              <div className="fin-recon-detail-row">
                <span className="fin-recon-detail-label">
                  Selisih cash (akhir - awal)
                </span>
                <span className="fin-recon-detail-value">
                  {formatCurrency(cashierGrossRevenue)}
                </span>
              </div>
              <div className="fin-recon-detail-row">
                <span className="fin-recon-detail-label">
                  Perhitungan Sistem
                </span>
                <span className="fin-recon-detail-value">
                  {censorAmount(systemMoneyAtHand)}
                </span>
              </div>
            </div>

            <div className="fin-recon-actions">
              {hasDiscrepancy ? (
                <>
                  <button
                    className="fin-recon-btn fin-recon-btn-yes"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving
                      ? "Menyimpan..."
                      : "Ya, perhitungan nominal cash sudah benar"}
                  </button>
                  <button
                    className="fin-recon-btn fin-recon-btn-no"
                    onClick={() => setPage(1)}
                    disabled={saving}
                  >
                    Tidak, Saya coba hitung lagi
                  </button>
                </>
              ) : (
                <button
                  className="fin-recon-btn fin-recon-btn-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Lanjut"}
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
        {page === 1 ? renderPage1() : renderPage2()}
      </div>
    </div>
  );
};

export default TutupBukuModal;
