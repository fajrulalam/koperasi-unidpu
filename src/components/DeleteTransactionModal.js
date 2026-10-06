// src/components/DeleteTransactionModal.js
import React, { useState } from "react";
import "../styles/DeleteTransactionModal.css";
import { formatCurrency } from "../services/transactionHistoryService";
import { deleteAndRevertTransaction } from "../services/transactionRevertService";

const DeleteTransactionModal = ({
  isOpen,
  onClose,
  transaction,
  onSuccess,
  currentUser,
  userRole,
  isProduction = true,
}) => {
  const [reason, setReason] = useState("Transaksi duplikat / salah input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !transaction) return null;

  const txDate = transaction.timestamp?.toDate
    ? transaction.timestamp.toDate()
    : new Date(transaction.timestamp || transaction.createdAt);

  const formattedTime = txDate.toLocaleString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getPaymentBadge = () => {
    if (transaction.paymentMethod === "split") {
      return <span className="dtm-badge-voucher">💳 Split</span>;
    }
    if (transaction.isPaidViaQris || transaction.paymentMethod === "qris") {
      return <span className="dtm-badge-qris">📱 QRIS</span>;
    }
    if (transaction.paymentMethod === "kredit") {
      return <span className="dtm-badge-voucher">🎫 Kredit</span>;
    }
    return <span className="dtm-badge-cash">💵 Cash</span>;
  };

  const handleDelete = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await deleteAndRevertTransaction({
        transactionId: transaction.id,
        currentUser,
        userRole,
        isProduction,
        reason: reason.trim() || "Pembatalan transaksi duplikat",
      });

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error("Gagal menghapus transaksi:", err);
      setError(
        err.message ||
          "Terjadi kesalahan saat menghapus transaksi. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dtm-overlay" onClick={() => !loading && onClose()}>
      <div className="dtm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dtm-header">
          <div className="dtm-header-left">
            <div className="dtm-icon-wrap">🗑️</div>
            <div>
              <h3 className="dtm-title">Hapus & Batalkan Transaksi</h3>
              <p className="dtm-subtitle">
                Revert seluruh data seperti transaksi tidak pernah terjadi
              </p>
            </div>
          </div>
          <button
            className="dtm-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="dtm-body">
          {error && <div className="dtm-error-alert">{error}</div>}

          {/* Transaction Summary Box */}
          <div className="dtm-info-box">
            <div className="dtm-info-row">
              <span className="dtm-info-label">ID Transaksi</span>
              <span className="dtm-info-value" style={{ fontFamily: "monospace" }}>
                {transaction.id}
              </span>
            </div>
            <div className="dtm-info-row">
              <span className="dtm-info-label">Waktu</span>
              <span className="dtm-info-value">{formattedTime}</span>
            </div>
            <div className="dtm-info-row">
              <span className="dtm-info-label">Pembeli</span>
              <span className="dtm-info-value">
                {transaction.memberName || "Non-Anggota"}
                {transaction.isMember && ` (${transaction.nomorAnggota})`}
              </span>
            </div>
            <div className="dtm-info-row">
              <span className="dtm-info-label">Metode Pembayaran</span>
              <span className="dtm-info-value">{getPaymentBadge()}</span>
            </div>
            {transaction.voucherId && (
              <div className="dtm-info-row">
                <span className="dtm-info-label">Voucher Digunakan</span>
                <span className="dtm-info-value" style={{ color: "#d97706" }}>
                  {transaction.voucherName} (-
                  {formatCurrency(transaction.voucherDiscount)})
                </span>
              </div>
            )}
            <div className="dtm-info-row" style={{ paddingTop: 6, borderTop: "1px dashed #cbd5e1" }}>
              <span className="dtm-info-label" style={{ fontWeight: 700 }}>
                Total Transaksi
              </span>
              <span className="dtm-info-value" style={{ fontSize: "1.05rem", color: "#dc2626" }}>
                {formatCurrency(transaction.total)}
              </span>
            </div>
          </div>

          {/* Restored items */}
          {transaction.items && transaction.items.length > 0 && (
            <div>
              <div className="dtm-section-title">
                📦 Stok yang akan dikembalikan:
              </div>
              <div className="dtm-items-list">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="dtm-item-row">
                    <span className="dtm-item-name">{item.itemName}</span>
                    <span className="dtm-item-revert-badge">
                      +{item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning notice */}
          <div className="dtm-warning-card">
            <strong>⚠️ Tindakan ini otomatis memulihkan:</strong>
            <ul>
              <li>Stok inventaris seluruh produk akan ditambahkan kembali.</li>
              {transaction.voucherId ? (
                <li>
                  Voucher <strong>{transaction.voucherName}</strong> akan dipulihkan
                  (saldo bertambah kembali / status belum dipakai).
                </li>
              ) : null}
              {transaction.userPoints ? (
                <li>Poin kampanye belanja anggota akan dikurangi kembali.</li>
              ) : null}
              <li>
                Data transaksi dihapus dari riwayat dan laporan keuangan harian.
              </li>
            </ul>
          </div>

          {/* Reason input */}
          <div className="dtm-input-group">
            <label className="dtm-input-label" htmlFor="dtm-reason">
              Alasan Penghapusan:
            </label>
            <input
              id="dtm-reason"
              className="dtm-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="Contoh: Transaksi duplikat / salah input kasir"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="dtm-footer">
          <button
            className="dtm-btn dtm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            className="dtm-btn dtm-btn-danger"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="dtm-spinner" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>Hapus & Revert Transaksi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTransactionModal;
