import React, { useState } from "react";
import "../styles/RestrukturisasiModal.css";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

const formatRupiah = (number) => {
  return `Rp ${(number || 0).toLocaleString("id-ID")}`;
};

const formatCurrencyInput = (value) => {
  if (!value) return "";
  return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const RestrukturisasiModal = ({
  isOpen,
  onClose,
  loan,
  onSubmit,
  isSubmitting,
  error,
}) => {
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [additionalTenor, setAdditionalTenor] = useState(null);
  const [bank, setBank] = useState(loan?.bankDetails?.bank || "");
  const [nomorRekening, setNomorRekening] = useState(
    loan?.bankDetails?.nomorRekening || ""
  );
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen || !loan) return null;

  const sisaHutang = loan.sisaHutang ?? (() => {
    const jumlahPinjaman = loan.jumlahPinjaman || 0;
    const jumlahMenyicil = loan.jumlahMenyicil || 0;
    const tenor = loan.tenor || 1;
    const cicilanPerBulan = Math.round(jumlahPinjaman / tenor);
    return Math.max(0, jumlahPinjaman - jumlahMenyicil * cicilanPerBulan);
  })();

  const remainingMonths = (loan.tenor || 0) - (loan.jumlahMenyicil || 0);
  const parsedAdditional = parseInt((additionalAmount || "0").replace(/\./g, "")) || 0;
  const newTotal = sisaHutang + parsedAdditional;
  const newTenor = additionalTenor ? remainingMonths + additionalTenor : 0;
  const newFee = calculateFee(newTotal);
  const newCicilan = newTenor > 0 ? Math.round(newTotal / newTenor) : 0;
  const maxAdditional = 10000000 - sisaHutang;
  const isTotalValid = newTotal >= 1000000 && newTotal <= 10000000;
  const isFormValid =
    parsedAdditional > 0 && additionalTenor && isTotalValid && bank && nomorRekening;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await onSubmit({
        oldLoanId: loan.id,
        sisaPinjamanSebelumnya: sisaHutang,
        pinjamanBaru: parsedAdditional,
        jumlahPinjaman: newTotal,
        tenor: newTenor,
        additionalTenor,
        biayaAdmin: newFee,
        bank,
        nomorRekening,
      });
      setShowSuccess(true);
    } catch {
      // Error is already handled by parent via the error prop
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    onClose();
  };

  if (showSuccess) {
    return (
      <div className="modal-overlay" onClick={handleCloseSuccess}>
        <div
          className="modal-content restrukturisasi-modal restruktur-success-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="restruktur-success-content">
            <div className="restruktur-success-icon">🎉</div>
            <h3>Pengajuan Berhasil!</h3>
            <p>
              Restrukturisasi pinjaman kamu sedang diproses. Tim BAK akan
              meninjau pengajuanmu segera.
            </p>
            <div className="restruktur-success-summary">
              <div className="restruktur-success-row">
                <span>Total Pinjaman Baru</span>
                <span className="restruktur-success-amount">{formatRupiah(newTotal)}</span>
              </div>
              <div className="restruktur-success-row">
                <span>Tenor</span>
                <span>{newTenor} bulan</span>
              </div>
              <div className="restruktur-success-row">
                <span>Cicilan /bulan</span>
                <span>{formatRupiah(newCicilan)}</span>
              </div>
            </div>
            <button
              className="brutal-button restruktur-success-btn"
              onClick={handleCloseSuccess}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content restrukturisasi-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header restruktur-modal-header">
          <h3>✨ Restrukturisasi Pinjaman</h3>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="restruktur-intro-banner">
            <span className="restruktur-intro-emoji">💰</span>
            <p>Cairkan dana tambahan tanpa harus lunas dulu — mudah dan cepat!</p>
          </div>

          <div className="restruktur-current-summary">
            <h4>Pinjaman Saat Ini</h4>
            <div className="restruktur-summary-grid">
              <div className="restruktur-summary-item">
                <span className="restruktur-label">Jumlah Pinjaman</span>
                <span className="restruktur-value">
                  {formatRupiah(loan.jumlahPinjaman)}
                </span>
              </div>
              <div className="restruktur-summary-item">
                <span className="restruktur-label">Tenor</span>
                <span className="restruktur-value">{loan.tenor} bulan</span>
              </div>
              <div className="restruktur-summary-item">
                <span className="restruktur-label">Cicilan Terbayar</span>
                <span className="restruktur-value">
                  {loan.jumlahMenyicil || 0}/{loan.tenor}
                </span>
              </div>
              <div className="restruktur-summary-item highlight">
                <span className="restruktur-label">Sisa Hutang</span>
                <span className="restruktur-value">{formatRupiah(sisaHutang)}</span>
              </div>
              <div className="restruktur-summary-item">
                <span className="restruktur-label">Sisa Tenor</span>
                <span className="restruktur-value">{remainingMonths} bulan</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="additionalAmount">
                Jumlah Pinjaman Tambahan (Rp)
              </label>
              <div className="input-with-prefix">
                <span className="input-prefix">Rp</span>
                <input
                  id="additionalAmount"
                  type="text"
                  value={additionalAmount}
                  onChange={(e) =>
                    setAdditionalAmount(formatCurrencyInput(e.target.value))
                  }
                  className="form-input"
                  placeholder={`Maks ${formatRupiah(maxAdditional > 0 ? maxAdditional : 0)}`}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {parsedAdditional > 0 && !isTotalValid && (
                <p className="field-error">
                  Total pinjaman harus antara Rp 1.000.000 - Rp 10.000.000
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Tenor Tambahan</label>
              <div className="tenor-chips">
                {Array.from({ length: 10 }, (_, i) => i + 3).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tenor-chip ${additionalTenor === t ? "active" : ""}`}
                    onClick={() => setAdditionalTenor(t)}
                    disabled={isSubmitting}
                  >
                    {t} bulan
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="restruktur-bank">Bank</label>
              <select
                id="restruktur-bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="form-input"
                required
                disabled={isSubmitting}
              >
                <option value="">Pilih Bank</option>
                <option value="BSI">BSI</option>
                <option value="BCA">BCA</option>
                <option value="BRI">BRI</option>
                <option value="Mandiri">Mandiri</option>
                <option value="BNI">BNI</option>
                <option value="Bank Jatim">Bank Jatim</option>
                <option value="BTN">BTN</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="restruktur-rekening">Nomor Rekening</label>
              <input
                id="restruktur-rekening"
                type="text"
                inputMode="numeric"
                value={nomorRekening}
                onChange={(e) =>
                  setNomorRekening(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
                required
                placeholder="Masukkan nomor rekening"
                disabled={isSubmitting}
              />
            </div>

            {parsedAdditional > 0 && additionalTenor && (
              <div className="restruktur-preview">
                <h4>Pinjaman Baru (Hasil Restrukturisasi)</h4>
                <div className="restruktur-preview-grid">
                  <div className="restruktur-preview-item">
                    <span>Sisa hutang lama</span>
                    <span>{formatRupiah(sisaHutang)}</span>
                  </div>
                  <div className="restruktur-preview-item">
                    <span>Pinjaman tambahan</span>
                    <span>+ {formatRupiah(parsedAdditional)}</span>
                  </div>
                  <div className="restruktur-preview-item total">
                    <span>Total pinjaman baru</span>
                    <span>{formatRupiah(newTotal)}</span>
                  </div>
                  <div className="restruktur-preview-divider" />
                  <div className="restruktur-preview-item">
                    <span>Tenor baru</span>
                    <span>
                      {remainingMonths} + {additionalTenor} = {newTenor} bulan
                    </span>
                  </div>
                  <div className="restruktur-preview-item">
                    <span>Cicilan per bulan</span>
                    <span>{formatRupiah(newCicilan)}</span>
                  </div>
                  <div className="restruktur-preview-item">
                    <span>Biaya administrasi</span>
                    <span>{formatRupiah(newFee)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="brutal-button secondary-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="brutal-button restruktur-submit-btn"
                disabled={isSubmitting || !isFormValid}
              >
                {isSubmitting ? "Mengajukan..." : "Ajukan Restrukturisasi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RestrukturisasiModal;
