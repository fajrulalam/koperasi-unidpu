import React, { useState } from "react";
import "../styles/AdminPanel.css";
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

const PaymentProofModal = ({ loan, onClose, onUploadProof }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  if (!loan) return null;

  const isRestrukturisasi = !!loan.restructuredFromLoanId;
  const jumlahPinjaman = loan.jumlahPinjaman || 0;
  const biayaAdmin = loan.biayaAdmin ?? calculateFee(jumlahPinjaman);
  const sisaHutangLama = loan.sisaPinjamanSebelumnya || 0;
  const pinjamanBaru = loan.pinjamanBaru || 0;
  const jumlahTransfer = isRestrukturisasi
    ? pinjamanBaru - biayaAdmin
    : jumlahPinjaman - biayaAdmin;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);

      // Create a preview for the selected file
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUploadProof(loan.id, selectedFile);
      onClose();
    } catch (error) {
      console.error("Error uploading proof:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Upload Bukti Transfer</h3>

        <div className="rrm-info-row">
          <span className="rrm-info-label">ID Pinjaman</span>
          <span className="rrm-info-value">#{loan.id.substring(0, 8)}</span>
        </div>
        <div className="rrm-info-row">
          <span className="rrm-info-label">Nama</span>
          <span className="rrm-info-value">{loan.userData?.namaLengkap || "N/A"}</span>
        </div>
        <div className="rrm-info-row">
          <span className="rrm-info-label">Rekening</span>
          <span className="rrm-info-value">
            {loan.bankDetails?.bank || "N/A"} — {loan.bankDetails?.nomorRekening || "N/A"}
          </span>
        </div>

        {isRestrukturisasi ? (
          <div className="rrm-calc-table" style={{ marginTop: 16 }}>
            <div className="rrm-calc-row">
              <span>Sisa hutang lama (#{loan.restructuredFromLoanId?.substring(0, 8)})</span>
              <span>{formatRupiah(sisaHutangLama)}</span>
            </div>
            <div className="rrm-calc-row">
              <span>Pinjaman tambahan</span>
              <span>+ {formatRupiah(pinjamanBaru)}</span>
            </div>
            <div className="rrm-calc-row rrm-calc-total">
              <span>Total pinjaman baru</span>
              <span>{formatRupiah(jumlahPinjaman)}</span>
            </div>
            <div className="rrm-calc-divider" />
            <div className="rrm-calc-row">
              <span>Biaya administrasi</span>
              <span>{formatRupiah(biayaAdmin)}</span>
            </div>
            <div className="rrm-calc-divider" />
            <div className="rrm-calc-row" style={{ fontSize: "0.82rem", color: "#6b7280" }}>
              <span>Pinjaman tambahan</span>
              <span>{formatRupiah(pinjamanBaru)}</span>
            </div>
            <div className="rrm-calc-row" style={{ fontSize: "0.82rem", color: "#6b7280" }}>
              <span>Biaya administrasi</span>
              <span>- {formatRupiah(biayaAdmin)}</span>
            </div>
            <div className="rrm-calc-row rrm-calc-transfer">
              <span>Jumlah transfer ke anggota</span>
              <span>{formatRupiah(jumlahTransfer)}</span>
            </div>
          </div>
        ) : (
          <div className="rrm-calc-table" style={{ marginTop: 16 }}>
            <div className="rrm-calc-row">
              <span>Jumlah Pinjaman</span>
              <span>{formatRupiah(jumlahPinjaman)}</span>
            </div>
            <div className="rrm-calc-row">
              <span>Biaya administrasi</span>
              <span>- {formatRupiah(biayaAdmin)}</span>
            </div>
            <div className="rrm-calc-divider" />
            <div className="rrm-calc-row rrm-calc-transfer">
              <span>Jumlah transfer ke anggota</span>
              <span>{formatRupiah(jumlahTransfer)}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Bukti Transfer</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="file-input"
              required
            />
            <small className="file-help">
              Format yang didukung: JPG, PNG, PDF (Maks. 5MB)
            </small>
          </div>

          {previewUrl && (
            <div className="file-preview">
              {selectedFile.type.startsWith("image/") ? (
                <img src={previewUrl} alt="Preview" />
              ) : (
                <div className="pdf-preview">
                  <i className="file-icon">📄</i>
                  <span>{selectedFile.name}</span>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
              disabled={uploading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="approve-btn"
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Mengupload..." : "Upload dan Aktifkan Pinjaman"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentProofModal;
