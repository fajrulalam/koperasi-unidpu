import React, { useState } from "react";
import "../styles/RestrukturisasiReviewModal.css";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

const formatRupiah = (n) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

const RestrukturisasiReviewModal = ({
  loan,
  onClose,
  onApprove,
  onReject,
  onRevise,
  userRole,
}) => {
  const [mode, setMode] = useState("review"); // "review" | "reject" | "revise"
  const [rejectionReason, setRejectionReason] = useState("");
  const [revisionAmount, setRevisionAmount] = useState("");
  const [revisionTenor, setRevisionTenor] = useState(loan?.tenor || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loan) return null;

  const isDirector = userRole === "Direktur" || userRole === "Director";
  const canAct =
    (loan.status === "Menunggu Persetujuan BAK" && (userRole === "BAK" || isDirector)) ||
    (loan.status === "Menunggu Persetujuan Wakil Rektor 2" && (userRole === "Wakil Rektor 2" || isDirector));

  const sisaHutangLama = loan.sisaPinjamanSebelumnya || 0;
  const pinjamanBaru = loan.pinjamanBaru || 0;
  const jumlahPinjaman = loan.jumlahPinjaman || 0;
  const tenor = loan.tenor || 0;
  const additionalTenor = loan.additionalTenor || 0;
  const sisaTenorLama = tenor - additionalTenor;
  const biayaAdmin = loan.biayaAdmin ?? calculateFee(jumlahPinjaman);
  const cicilanPerBulan = tenor > 0 ? Math.round(jumlahPinjaman / tenor) : 0;
  const jumlahTransfer = pinjamanBaru - biayaAdmin;
  const oldLoanIdShort = loan.restructuredFromLoanId
    ? `#${loan.restructuredFromLoanId.substring(0, 8)}`
    : "";

  // Revision calculations
  const parsedRevisionAmount = revisionAmount
    ? parseInt(String(revisionAmount).replace(/[^0-9]/g, ""), 10) || 0
    : 0;
  const revPinjamanBaru = Math.max(0, parsedRevisionAmount - sisaHutangLama);
  const revFee = parsedRevisionAmount ? calculateFee(parsedRevisionAmount) : 0;
  const revAdditionalTenor = revisionTenor - sisaTenorLama;
  const revCicilan =
    parsedRevisionAmount && revisionTenor > 0
      ? Math.round(parsedRevisionAmount / revisionTenor)
      : 0;
  const revTransfer = revPinjamanBaru - revFee;

  const amountTooLow = parsedRevisionAmount > 0 && parsedRevisionAmount < sisaHutangLama;
  const tenorTooLow = revisionTenor > 0 && revisionTenor < sisaTenorLama;
  const revisionValid =
    parsedRevisionAmount >= sisaHutangLama &&
    revisionTenor >= sisaTenorLama &&
    (parsedRevisionAmount !== jumlahPinjaman || revisionTenor !== tenor);

  const handleApprove = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onApprove(loan.id, loan.status);
      onClose();
    } catch (err) {
      setError("Gagal menyetujui: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Harap masukkan alasan penolakan");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onReject(loan.id, rejectionReason);
      onClose();
    } catch (err) {
      setError("Gagal menolak: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevise = async () => {
    if (!revisionValid) return;
    setSubmitting(true);
    setError("");
    try {
      await onRevise(loan.id, parsedRevisionAmount, revisionTenor);
      onClose();
    } catch (err) {
      setError("Gagal merevisi: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const renderCalculationTable = (
    sisaLama,
    tambahan,
    total,
    tenorLama,
    tenorTambahan,
    tenorTotal,
    cicilan,
    fee,
    transfer
  ) => (
    <div className="rrm-calc-table">
      <div className="rrm-calc-row">
        <span>Sisa hutang lama ({oldLoanIdShort})</span>
        <span>{formatRupiah(sisaLama)}</span>
      </div>
      <div className="rrm-calc-row">
        <span>Pinjaman tambahan</span>
        <span>+ {formatRupiah(tambahan)}</span>
      </div>
      <div className="rrm-calc-row rrm-calc-total">
        <span>Total pinjaman baru</span>
        <span>{formatRupiah(total)}</span>
      </div>
      <div className="rrm-calc-divider" />
      <div className="rrm-calc-row">
        <span>Tenor baru</span>
        <span>
          {tenorLama} + {tenorTambahan} = {tenorTotal} bulan
        </span>
      </div>
      <div className="rrm-calc-row">
        <span>Cicilan per bulan</span>
        <span>{formatRupiah(cicilan)}</span>
      </div>
      <div className="rrm-calc-row">
        <span>Biaya administrasi</span>
        <span>{formatRupiah(fee)}</span>
      </div>
      <div className="rrm-calc-divider" />
      <div className="rrm-calc-row" style={{ fontSize: "0.82rem", color: "#6b7280" }}>
        <span>Pinjaman tambahan</span>
        <span>{formatRupiah(tambahan)}</span>
      </div>
      <div className="rrm-calc-row" style={{ fontSize: "0.82rem", color: "#6b7280" }}>
        <span>Biaya administrasi</span>
        <span>- {formatRupiah(fee)}</span>
      </div>
      <div className="rrm-calc-row rrm-calc-transfer">
        <span>Jumlah transfer ke anggota</span>
        <span>{formatRupiah(transfer)}</span>
      </div>
    </div>
  );

  return (
    <div className="rrm-overlay" onClick={onClose}>
      <div className="rrm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rrm-header">
          <h3>Tinjau Restrukturisasi</h3>
          <button className="rrm-close" onClick={onClose} disabled={submitting}>
            &times;
          </button>
        </div>

        <div className="rrm-body">
          {error && <div className="rrm-error">{error}</div>}

          {/* Borrower info */}
          <div className="rrm-info-row">
            <span className="rrm-info-label">Peminjam</span>
            <span className="rrm-info-value">
              {loan.userData?.namaLengkap || "N/A"}
            </span>
          </div>
          <div className="rrm-info-row">
            <span className="rrm-info-label">Pinjaman lama</span>
            <span className="rrm-info-value">{oldLoanIdShort}</span>
          </div>
          <div className="rrm-info-row">
            <span className="rrm-info-label">Rekening</span>
            <span className="rrm-info-value">
              {loan.bankDetails?.bank || "-"} — {loan.bankDetails?.nomorRekening || "-"}
            </span>
          </div>
          <div className="rrm-info-row">
            <span className="rrm-info-label">Status</span>
            <span className="rrm-info-value rrm-status-badge">{loan.status}</span>
          </div>

          {/* Current proposal calculation */}
          {mode === "review" && (
            <>
              <h4 className="rrm-section-title">Pinjaman Baru (Hasil Restrukturisasi)</h4>
              {renderCalculationTable(
                sisaHutangLama,
                pinjamanBaru,
                jumlahPinjaman,
                sisaTenorLama,
                additionalTenor,
                tenor,
                cicilanPerBulan,
                biayaAdmin,
                jumlahTransfer
              )}
            </>
          )}

          {/* Rejection form */}
          {mode === "reject" && (
            <>
              <h4 className="rrm-section-title">Pinjaman Baru (Hasil Restrukturisasi)</h4>
              {renderCalculationTable(
                sisaHutangLama,
                pinjamanBaru,
                jumlahPinjaman,
                sisaTenorLama,
                additionalTenor,
                tenor,
                cicilanPerBulan,
                biayaAdmin,
                jumlahTransfer
              )}
              <div className="rrm-reject-form">
                <label>Alasan Penolakan</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Jelaskan alasan penolakan..."
                  rows={3}
                  disabled={submitting}
                />
              </div>
            </>
          )}

          {/* Revision form */}
          {mode === "revise" && (
            <>
              <h4 className="rrm-section-title">Pengajuan Saat Ini</h4>
              {renderCalculationTable(
                sisaHutangLama,
                pinjamanBaru,
                jumlahPinjaman,
                sisaTenorLama,
                additionalTenor,
                tenor,
                cicilanPerBulan,
                biayaAdmin,
                jumlahTransfer
              )}

              <h4 className="rrm-section-title rrm-revision-title">Revisi Jumlah</h4>
              <p className="rrm-revision-hint">
                Jumlah minimal {formatRupiah(sisaHutangLama)} (sisa hutang lama), tenor minimal {sisaTenorLama} bulan.
              </p>

              <div className="rrm-revision-form">
                <div className="rrm-form-group">
                  <label>Total Pinjaman Baru (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={`Min ${formatRupiah(sisaHutangLama)}`}
                    value={
                      parsedRevisionAmount
                        ? parsedRevisionAmount.toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setRevisionAmount(raw ? parseInt(raw, 10) : "");
                      setError("");
                    }}
                    className={amountTooLow ? "rrm-input-error" : ""}
                    disabled={submitting}
                  />
                  {amountTooLow && (
                    <small className="rrm-field-error">
                      Tidak boleh kurang dari {formatRupiah(sisaHutangLama)}
                    </small>
                  )}
                </div>

                <div className="rrm-form-group">
                  <label>Tenor (Bulan)</label>
                  <div className="rrm-tenor-chips">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                      const disabled = n < sisaTenorLama;
                      return (
                        <button
                          key={n}
                          type="button"
                          className={`rrm-tenor-chip ${revisionTenor === n ? "active" : ""}`}
                          onClick={() => {
                            if (!disabled) setRevisionTenor(n);
                          }}
                          disabled={disabled}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  {tenorTooLow && (
                    <small className="rrm-field-error">
                      Minimal {sisaTenorLama} bulan
                    </small>
                  )}
                </div>
              </div>

              {parsedRevisionAmount >= sisaHutangLama &&
                revisionTenor >= sisaTenorLama && (
                  <>
                    <h4 className="rrm-section-title" style={{ color: "#059669" }}>
                      Hasil Revisi
                    </h4>
                    {renderCalculationTable(
                      sisaHutangLama,
                      revPinjamanBaru,
                      parsedRevisionAmount,
                      sisaTenorLama,
                      revAdditionalTenor,
                      revisionTenor,
                      revCicilan,
                      revFee,
                      revTransfer
                    )}
                  </>
                )}
            </>
          )}
        </div>

        <div className="rrm-footer">
          {!canAct && (
            <button className="rrm-btn rrm-btn-secondary" onClick={onClose}>
              Tutup
            </button>
          )}

          {canAct && mode === "review" && (
            <>
              <button
                className="rrm-btn rrm-btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Tutup
              </button>
              {loan.status === "Menunggu Persetujuan BAK" && (
                <button
                  className="rrm-btn rrm-btn-revise"
                  onClick={() => {
                    setMode("revise");
                    setRevisionAmount(jumlahPinjaman);
                    setRevisionTenor(tenor);
                  }}
                  disabled={submitting}
                >
                  ⚙ Revisi
                </button>
              )}
              <button
                className="rrm-btn rrm-btn-reject"
                onClick={() => setMode("reject")}
                disabled={submitting}
              >
                ✕ Tolak
              </button>
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting ? "..." : "✓ Setujui"}
              </button>
            </>
          )}

          {canAct && mode === "reject" && (
            <>
              <button
                className="rrm-btn rrm-btn-secondary"
                onClick={() => {
                  setMode("review");
                  setError("");
                }}
                disabled={submitting}
              >
                ← Kembali
              </button>
              <button
                className="rrm-btn rrm-btn-reject"
                onClick={handleReject}
                disabled={submitting || !rejectionReason.trim()}
              >
                {submitting ? "Menolak..." : "Konfirmasi Tolak"}
              </button>
            </>
          )}

          {canAct && mode === "revise" && (
            <>
              <button
                className="rrm-btn rrm-btn-secondary"
                onClick={() => {
                  setMode("review");
                  setError("");
                }}
                disabled={submitting}
              >
                ← Kembali
              </button>
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={handleRevise}
                disabled={submitting || !revisionValid}
              >
                {submitting ? "Merevisi..." : "Ajukan Revisi"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestrukturisasiReviewModal;
