import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaBook, FaEdit, FaTrash } from "react-icons/fa";
import { useFirestore } from "../context/FirestoreContext";
import { useAuth } from "../context/AuthContext";
import TutupBukuModal from "./TutupBukuModal";
import "../styles/Finance.css";

const INITIAL_BALANCE = 5400500;

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

const formatCurrency = (value) => {
  if (!value && value !== 0) return "Rp 0";
  const prefix = value < 0 ? "-" : "";
  return prefix + "Rp " + Math.abs(value).toLocaleString("id-ID");
};

const formatDateDisplay = (dateString) => {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${parseInt(day)}/${parseInt(month)}/${year}`;
};

const Finance = () => {
  const { queryCollection, deleteDoc, query, orderBy } = useFirestore();
  const { userRole } = useAuth();

  const isDirector = userRole === "Director";
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTutupBuku, setShowTutupBuku] = useState(false);
  const [editingClosing, setEditingClosing] = useState(null);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let y = 2024; y <= current + 1; y++) arr.push(y);
    return arr;
  }, []);

  const fetchClosings = useCallback(async () => {
    setLoading(true);
    try {
      const allClosings = await queryCollection("dailyClosings", (ref) =>
        query(ref, orderBy("dateString", "asc"))
      );
      setClosings(allClosings);
    } catch (err) {
      console.error("Error fetching daily closings:", err);
    } finally {
      setLoading(false);
    }
  }, [queryCollection, query, orderBy]);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const todayDateString = useMemo(
    () => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    },
    []
  );

  const todayRecord = useMemo(
    () => closings.find((c) => c.dateString === todayDateString) || null,
    [closings, todayDateString]
  );

  const todayStatus = todayRecord?.status || null;

  const balanceSheetData = useMemo(() => {
    const sorted = [...closings].sort((a, b) =>
      a.dateString.localeCompare(b.dateString)
    );

    let openingBalance = INITIAL_BALANCE;
    const monthClosings = [];

    for (const closing of sorted) {
      const cYear = closing.year;
      const cMonth = closing.month;

      if (closing.status !== "closed") continue;

      if (
        cYear < selectedYear ||
        (cYear === selectedYear && cMonth < selectedMonth)
      ) {
        openingBalance += closing.grossRevenue || 0;
        openingBalance -= closing.voucherDiscount || 0;
        openingBalance -= closing.qrisTotal || 0;
        openingBalance -= closing.totalExpenses || 0;
        openingBalance += closing.discrepancy || 0;
      } else if (cYear === selectedYear && cMonth === selectedMonth) {
        monthClosings.push(closing);
      }
    }

    const rows = [];
    let runningBalance = openingBalance;

    for (const closing of monthClosings) {
      let isFirstRow = true;

      runningBalance += closing.grossRevenue || 0;
      rows.push({
        date: closing.dateString,
        description: "Pendapatan Kotor",
        code: "K",
        amount: closing.grossRevenue || 0,
        balance: runningBalance,
        closingId: closing.id,
        closingData: closing,
        isFirstOfGroup: true,
      });
      isFirstRow = false;

      if (closing.voucherDiscount > 0) {
        runningBalance -= closing.voucherDiscount;
        rows.push({
          date: isFirstRow ? closing.dateString : null,
          description: "Potongan Voucher",
          code: "D",
          amount: closing.voucherDiscount,
          balance: runningBalance,
        });
      }

      if (closing.qrisTotal > 0) {
        runningBalance -= closing.qrisTotal;
        rows.push({
          date: null,
          description: "Pembayaran QRIS",
          code: "D",
          amount: closing.qrisTotal,
          balance: runningBalance,
        });
      }

      for (const expense of closing.expenses || []) {
        runningBalance -= expense.amount;
        rows.push({
          date: null,
          description: expense.category,
          code: "D",
          amount: expense.amount,
          balance: runningBalance,
        });
      }

      if (closing.discrepancy && closing.discrepancy !== 0) {
        const isPositive = closing.discrepancy > 0;
        const absDisc = Math.abs(closing.discrepancy);
        if (isPositive) {
          runningBalance += absDisc;
        } else {
          runningBalance -= absDisc;
        }
        rows.push({
          date: null,
          description: isPositive
            ? "Selisih Kas (Lebih)"
            : "Selisih Kas (Kurang)",
          code: isPositive ? "K" : "D",
          amount: absDisc,
          balance: runningBalance,
        });
      }
    }

    return { openingBalance, rows };
  }, [closings, selectedYear, selectedMonth]);

  const handleSaved = () => {
    fetchClosings();
  };

  const handleDelete = async (closing) => {
    const confirmed = window.confirm(
      `Hapus tutup buku tanggal ${formatDateDisplay(closing.dateString)}? Data tidak bisa dikembalikan.`
    );
    if (!confirmed) return;

    try {
      await deleteDoc("dailyClosings", closing.dateString);
      fetchClosings();
    } catch (err) {
      console.error("Error deleting closing:", err);
      alert("Gagal menghapus. Silakan coba lagi.");
    }
  };

  const handleEdit = (closing) => {
    setEditingClosing(closing);
    setShowTutupBuku(true);
  };

  const handleCloseModal = () => {
    setShowTutupBuku(false);
    setEditingClosing(null);
  };

  const colCount = isDirector ? 6 : 5;

  return (
    <div className="fin-container finance-container">
      <div className="fin-header">
        <h1>Centralized Financial Dashboard</h1>
        <div className="fin-header-actions">
          {todayStatus === "closed" && (
            <span className="fin-closed-badge">
              <FaBook /> Buku hari ini sudah ditutup
            </span>
          )}
          {todayStatus === "open" && (
            <button
              className="fin-btn fin-btn-warning"
              onClick={() => {
                setEditingClosing(null);
                setShowTutupBuku(true);
              }}
            >
              <FaBook /> Tutup Buku Harian
            </button>
          )}
          {!todayStatus && (
            <span className="fin-closed-badge" style={{ background: "#fef3c7", color: "#92400e" }}>
              <FaBook /> Buku belum dibuka hari ini
            </span>
          )}
        </div>
      </div>

      <div className="fin-filters">
        <label>Bulan:</label>
        <select
          className="fin-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <label>Tahun:</label>
        <select
          className="fin-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="fin-loading">
          <p>Memuat data...</p>
        </div>
      ) : (
        <div className="fin-table-container">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Keterangan</th>
                <th className="center">D/K</th>
                <th className="right">Jumlah</th>
                <th className="right">Saldo</th>
                {isDirector && <th className="center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              <tr className="fin-opening-row">
                <td>
                  {formatDateDisplay(
                    `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`
                  )}
                </td>
                <td>Saldo Awal</td>
                <td className="center">-</td>
                <td className="right">-</td>
                <td className="right fin-saldo">
                  {formatCurrency(balanceSheetData.openingBalance)}
                </td>
                {isDirector && <td />}
              </tr>
              {balanceSheetData.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      color: "#888",
                    }}
                  >
                    Belum ada data tutup buku untuk bulan ini.
                  </td>
                </tr>
              ) : (
                balanceSheetData.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`${row.code === "K" ? "fin-kredit-row" : "fin-debit-row"}${row.isFirstOfGroup ? " fin-group-first" : ""}`}
                  >
                    <td>{row.date ? formatDateDisplay(row.date) : ""}</td>
                    <td>{row.description}</td>
                    <td className="center">
                      <span
                        className={`fin-badge ${row.code === "K" ? "fin-badge-k" : "fin-badge-d"}`}
                      >
                        {row.code}
                      </span>
                    </td>
                    <td
                      className={`right ${row.code === "K" ? "fin-amount-kredit" : "fin-amount-debit"}`}
                    >
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="right fin-saldo">
                      {formatCurrency(row.balance)}
                    </td>
                    {isDirector && (
                      <td className="center">
                        {row.isFirstOfGroup && (
                          <div className="fin-action-btns">
                            <button
                              className="fin-action-btn fin-action-edit"
                              title="Edit"
                              onClick={() => handleEdit(row.closingData)}
                            >
                              <FaEdit />
                            </button>
                            <button
                              className="fin-action-btn fin-action-delete"
                              title="Hapus"
                              onClick={() => handleDelete(row.closingData)}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <TutupBukuModal
        isOpen={showTutupBuku}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        editData={editingClosing}
        forRecord={todayRecord}
      />
    </div>
  );
};

export default Finance;
