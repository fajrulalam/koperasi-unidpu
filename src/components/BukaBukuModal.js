import React, { useState, useEffect } from "react";
import {
  FaArrowLeft,
  FaTimes,
  FaBookOpen,
  FaInfoCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useFirestore } from "../context/FirestoreContext";
import { useAuth } from "../context/AuthContext";
import "../styles/Finance.css";

const getLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatCurrency = (value) => {
  if (!value && value !== 0) return "Rp 0";
  const prefix = value < 0 ? "-" : "";
  return prefix + "Rp " + Math.abs(value).toLocaleString("id-ID");
};

const BukaBukuModal = ({
  isOpen,
  onClose,
  onOpened,
  staleRecord,
  onRequestCloseStale,
}) => {
  const { queryCollection, createDoc, query, orderBy, limit } = useFirestore();
  const { currentUser } = useAuth();

  const [page, setPage] = useState(staleRecord ? 0 : 1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastClosing, setLastClosing] = useState(null);
  const [openingCashRaw, setOpeningCashRaw] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setPage(staleRecord ? 0 : 1);
      setOpeningCashRaw("");
      setLoading(true);
      return;
    }
    if (staleRecord) {
      setPage(0);
    } else {
      setPage(1);
    }
    fetchLastClosing();
  }, [isOpen, staleRecord]);

  const fetchLastClosing = async () => {
    setLoading(true);
    try {
      const results = await queryCollection("dailyClosings", (ref) =>
        query(ref, orderBy("dateString", "desc"), limit(1)),
      );
      setLastClosing(results.length > 0 ? results[0] : null);
    } catch (err) {
      console.error("Error fetching last closing:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCashChange = (value) => {
    setOpeningCashRaw(value.replace(/\D/g, ""));
  };

  const handleOpen = async () => {
    setSaving(true);
    try {
      const today = new Date();
      const dateString = getLocalDateString(today);

      const openingData = {
        dateString,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        status: "open",
        openingCash: openingCashRaw ? parseInt(openingCashRaw) : 0,
        createdBy: currentUser?.email || "unknown",
      };

      await createDoc("dailyClosings", openingData, dateString);
      onOpened();
      onClose();
    } catch (err) {
      console.error("Error opening book:", err);
      alert("Gagal membuka buku. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const renderStalePage = () => (
    <>
      <div className="fin-modal-header">
        <h2>Pembukaan Buku</h2>
        <button className="fin-modal-close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="fin-modal-body">
        <div className="fin-recon">
          <div className="fin-recon-icon">
            <FaExclamationTriangle style={{ color: "#ef4444" }} />
          </div>
          <div className="fin-recon-message">
            Buku tanggal <strong>{staleRecord.dateString}</strong> belum
            ditutup. Silakan tutup buku terlebih dahulu sebelum membuka buku
            hari ini.
          </div>
          <div className="fin-recon-actions">
            <button
              className="fin-recon-btn fin-recon-btn-yes"
              onClick={() => onRequestCloseStale(staleRecord)}
            >
              Tutup Buku ({staleRecord.dateString})
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderPage1 = () => (
    <>
      <div className="fin-modal-header">
        <h2>Pembukaan Buku</h2>
        <button className="fin-modal-close" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="fin-modal-body">
        <div className="fin-recon">
          <div className="fin-recon-message">
            Hari ini belum ada pembukaan buku sehingga tidak bisa ada transaksi
            yang berlangsung.
          </div>
          <div className="fin-recon-actions">
            <button
              className="fin-recon-btn fin-recon-btn-save"
              onClick={() => setPage(2)}
            >
              Buka Buku
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderPage2 = () => {
    const lastEndCash = lastClosing?.cashierMoneyAtHand;
    const lastDate = lastClosing?.dateString;

    return (
      <>
        <div className="fin-modal-header">
          <button className="fin-modal-back" onClick={() => setPage(1)}>
            <FaArrowLeft />
          </button>
          <h2>Hitung Uang Awal</h2>
          <button className="fin-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="fin-modal-body">
          {loading ? (
            <div className="fin-loading">
              <p>Memuat data...</p>
            </div>
          ) : (
            <>
              {lastClosing && lastClosing.status === "closed" && (
                <div className="fin-summary-card" style={{ marginBottom: 24 }}>
                  <div
                    className="fin-summary-header"
                    style={{ cursor: "default" }}
                  >
                    <div>
                      <div className="fin-summary-label">
                        <FaInfoCircle style={{ marginRight: 6 }} />
                        Uang saat tutup buku terakhir ({lastDate})
                      </div>
                      <div className="fin-summary-value">
                        {formatCurrency(lastEndCash)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="fin-input-group">
                <label className="fin-input-label">
                  Hitung semua uang fisik di kasir saat ini, lalu masukkan
                  jumlahnya di bawah ini
                </label>
                <div className="fin-input-wrapper">
                  <span className="fin-input-prefix">Rp</span>
                  <input
                    className="fin-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={
                      openingCashRaw
                        ? parseInt(openingCashRaw).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => handleCashChange(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="fin-submit-area">
                <button
                  className="fin-submit-btn fin-submit-primary"
                  style={{
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  }}
                  disabled={openingCashRaw === "" || saving}
                  onClick={handleOpen}
                >
                  {saving ? "Menyimpan..." : "Buka Buku & Mulai Transaksi"}
                </button>
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  const renderCurrentPage = () => {
    if (page === 0 && staleRecord) return renderStalePage();
    if (page === 2) return renderPage2();
    return renderPage1();
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
        {renderCurrentPage()}
      </div>
    </div>
  );
};

export default BukaBukuModal;
