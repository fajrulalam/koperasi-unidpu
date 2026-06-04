import React, { useEffect, useState } from "react";
import "../styles/RevisionModal.css";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

const formatRupiah = (n) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

const RevisionModal = ({
  loan,
  onClose,
  onRevise,
  revisionAmount,
  setRevisionAmount,
  revisionTenor,
  setRevisionTenor,
}) => {
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (loan) {
      setRevisionTenor(loan.tenor);
    }
  }, [loan, setRevisionTenor]);

  if (!loan) return null;

  const isRestrukturisasi = !!loan.restructuredFromLoanId;
  const sisaHutangLama = loan.sisaPinjamanSebelumnya || 0;
  const oldRemainingTenor = isRestrukturisasi
    ? (loan.tenor || 0) - (loan.additionalTenor || 0)
    : 0;

  const currentAmount = revisionAmount || 0;
  const currentTenor = revisionTenor || 0;

  const pinjamanBaru = isRestrukturisasi
    ? Math.max(0, currentAmount - sisaHutangLama)
    : 0;
  const newFee = currentAmount ? calculateFee(currentAmount) : null;
  const newCicilan =
    currentAmount && currentTenor > 0
      ? Math.round(currentAmount / currentTenor)
      : null;

  const amountTooLow = isRestrukturisasi && currentAmount > 0 && currentAmount < sisaHutangLama;
  const tenorTooLow = isRestrukturisasi && currentTenor > 0 && currentTenor < oldRemainingTenor;

  const handleSubmit = () => {
    if (isRestrukturisasi) {
      if (currentAmount && currentAmount < sisaHutangLama) {
        setValidationError(
          `Jumlah pinjaman tidak boleh kurang dari sisa hutang lama (${formatRupiah(sisaHutangLama)})`
        );
        return;
      }
      if (currentTenor && currentTenor < oldRemainingTenor) {
        setValidationError(
          `Tenor tidak boleh kurang dari sisa tenor pinjaman lama (${oldRemainingTenor} bulan)`
        );
        return;
      }
    }
    setValidationError("");
    onRevise(loan.id);
  };

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
          {isRestrukturisasi && (
            <div className="restruktur-info-revisionModal">
              <p className="restruktur-badge-revisionModal">Pinjaman Restrukturisasi</p>
              <p>
                <strong>Sisa Hutang Lama:</strong> {formatRupiah(sisaHutangLama)}
              </p>
              <p>
                <strong>Sisa Tenor Lama:</strong> {oldRemainingTenor} bulan
              </p>
              <p className="restruktur-hint-revisionModal">
                Jumlah pinjaman minimal {formatRupiah(sisaHutangLama)}, tenor minimal {oldRemainingTenor} bulan
              </p>
            </div>
          )}
        </div>

        {validationError && (
          <div className="validation-error-revisionModal">{validationError}</div>
        )}

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
            <label>
              Jumlah Revisi (Rp)
              {isRestrukturisasi && (
                <span className="label-hint-revisionModal">
                  {" "}min {formatRupiah(sisaHutangLama)}
                </span>
              )}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={isRestrukturisasi ? `Min ${formatRupiah(sisaHutangLama)}` : "Contoh: 1000000"}
              value={revisionAmount ? revisionAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                setRevisionAmount(rawValue ? parseInt(rawValue, 10) : '');
                setValidationError("");
              }}
              className={amountTooLow ? "input-error-revisionModal" : ""}
            />
            {amountTooLow && (
              <small className="field-error-revisionModal">
                Tidak boleh kurang dari sisa hutang lama ({formatRupiah(sisaHutangLama)})
              </small>
            )}
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
            <label>
              Tenor Revisi (Bulan)
              {isRestrukturisasi && (
                <span className="label-hint-revisionModal">
                  {" "}min {oldRemainingTenor} bulan
                </span>
              )}
            </label>
            <div className="tenor-chips-container-revisionModal">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                const disabled = isRestrukturisasi && num < oldRemainingTenor;
                return (
                  <button
                    key={num}
                    type="button"
                    className={`tenor-chip-revisionModal ${revisionTenor === num ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                    onClick={() => {
                      if (!disabled) {
                        setRevisionTenor(num);
                        setValidationError("");
                      }
                    }}
                    disabled={disabled}
                  >
                    {num} Bulan
                  </button>
                );
              })}
            </div>
            {tenorTooLow && (
              <small className="field-error-revisionModal">
                Tidak boleh kurang dari sisa tenor lama ({oldRemainingTenor} bulan)
              </small>
            )}
          </div>

          {isRestrukturisasi && currentAmount > 0 && currentAmount >= sisaHutangLama && (
            <div className="revision-preview-revisionModal">
              <h4>Hasil Revisi Restrukturisasi</h4>
              <div className="preview-row-revisionModal">
                <span>Sisa hutang lama</span>
                <span>{formatRupiah(sisaHutangLama)}</span>
              </div>
              <div className="preview-row-revisionModal">
                <span>Pinjaman tambahan</span>
                <span>+ {formatRupiah(pinjamanBaru)}</span>
              </div>
              <div className="preview-row-revisionModal preview-total-revisionModal">
                <span>Total pinjaman</span>
                <span>{formatRupiah(currentAmount)}</span>
              </div>
              {currentTenor > 0 && (
                <>
                  <div className="preview-row-revisionModal">
                    <span>Tenor</span>
                    <span>{currentTenor} bulan</span>
                  </div>
                  <div className="preview-row-revisionModal">
                    <span>Cicilan /bulan</span>
                    <span>{formatRupiah(newCicilan)}</span>
                  </div>
                </>
              )}
              <div className="preview-row-revisionModal">
                <span>Biaya admin</span>
                <span>{formatRupiah(newFee)}</span>
              </div>
            </div>
          )}

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
            onClick={handleSubmit}
            disabled={(!revisionAmount && !revisionTenor) || amountTooLow || tenorTooLow}
          >
            Ajukan Revisi
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevisionModal;
