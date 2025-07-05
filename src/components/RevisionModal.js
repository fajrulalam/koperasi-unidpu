import React, { useEffect } from "react";
import "../styles/RevisionModal.css";

const RevisionModal = ({
  loan,
  onClose,
  onRevise,
  revisionAmount,
  setRevisionAmount,
  revisionTenor,
  setRevisionTenor,
}) => {
  useEffect(() => {
    if (loan) {
      setRevisionTenor(loan.tenor);
    }
  }, [loan, setRevisionTenor]);

  if (!loan) return null;

  return (
    <div className="modal-overlay-revisionModal" onClick={onClose}>
      <div
        className="modal-content-revisionModal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Revisi Jumlah Pinjaman</h3>
        <div className="loan-summary-revisionModal">
          <p>
            <strong>ID:</strong> {loan.id.substring(0, 8)}
          </p>
          <p>
            <strong>Nama:</strong> {loan.userData?.namaLengkap || "N/A"}
          </p>
        </div>
        <div className="form-body-revisionModal">
          <div className="form-group-revisionModal">
            <label>Jumlah Saat Ini</label>
            <input
              type="text"
              value={`Rp ${loan.jumlahPinjaman?.toLocaleString("id-ID") || "0"}`}
              disabled
            />
          </div>
          <div className="form-group-revisionModal">
            <label>Jumlah Revisi (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 1000000"
              value={revisionAmount ? revisionAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                setRevisionAmount(rawValue ? parseInt(rawValue, 10) : '');
              }}
            />
          </div>
          <div className="form-group-revisionModal">
            <label>Tenor Saat Ini</label>
            <input
              type="text"
              value={`${loan.tenor?.toLocaleString("id-ID") || "0"} Bulan`}
              disabled
            />
          </div>
          <div className="form-group-revisionModal">
            <label>Tenor Revisi (Bulan)</label>
            <div className="tenor-chips-container-revisionModal">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`tenor-chip-revisionModal ${revisionTenor == num ? "selected" : ""}`}
                  onClick={() => setRevisionTenor(num)}
                >
                  {num} Bulan
                </button>
              ))}
            </div>
          </div>
          <div className="form-group-revisionModal">
            <label>Catatan</label>
            <textarea
              placeholder="Tambahkan catatan revisi (opsional)"
              rows="3"
            />
          </div>
        </div>
        <div className="modal-actions-revisionModal">
          <button className="button-secondary-revisionModal" onClick={onClose}>
            Batal
          </button>
          <button
            className="button-primary-revisionModal"
            onClick={() => onRevise(loan.id)}
            disabled={!revisionAmount && !revisionTenor}
          >
            Ajukan Revisi
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevisionModal;