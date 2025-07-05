import React from "react";

const RegistrationModal = ({
  showRegistrationModal,
  onClose,
  termsAgreed,
  setTermsAgreed,
  handleUpdateToActiveStatus,
}) => {
  if (!showRegistrationModal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Syarat dan Ketentuan</h3>
        <div className="terms-box">
          <p>
            Dengan mengaktifkan keanggotaan, Anda menyetujui untuk
            membayar:
          </p>
          <ul>
            <li>Simpanan Pokok: Rp 250.000 (sekali bayar)</li>
            <li>Simpanan Wajib: Rp 25.000 per bulan</li>
          </ul>
          <p>
            Pembayaran akan dipotong langsung dari gaji untuk karyawan
            Unipdu atau dapat dibayarkan secara tunai di kantor koperasi.
          </p>
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
            />
            Saya menyetujui syarat dan ketentuan di atas
          </label>
        </div>
        <div className="form-actions">
          <button
            className="brutal-button secondary-button"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className="brutal-button primary-button"
            onClick={handleUpdateToActiveStatus}
            disabled={!termsAgreed}
          >
            Setuju & Aktifkan
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;