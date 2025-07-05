import React from "react";
import "../styles/AdminPanel.css";

const RejectionModal = ({ loan, onClose, onReject, rejectionReason, setRejectionReason }) => {
  if (!loan) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Tolak Pengajuan Pinjaman</h3>
        <div className="loan-summary">
          <p>
            <strong>ID:</strong> {loan.id.substring(0, 8)}
          </p>
          <p>
            <strong>Nama:</strong>{" "}
            {loan.userData?.namaLengkap || "N/A"}
          </p>
          <p>
            <strong>Jumlah:</strong> Rp{" "}
            {loan.jumlahPinjaman?.toLocaleString("id-ID") || "0"}
          </p>
        </div>
        <div className="form-group">
          <label>Alasan Penolakan</label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Masukkan alasan penolakan"
            rows="4"
          />
        </div>
        <div className="modal-actions">
          <button
            className="secondary-btn"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className="reject-btn"
            onClick={() => onReject(loan.id, loan.status)}
            disabled={!rejectionReason.trim()}
          >
            Tolak
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectionModal;