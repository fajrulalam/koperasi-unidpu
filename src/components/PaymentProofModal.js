import React, { useState } from "react";
import "../styles/AdminPanel.css";

const PaymentProofModal = ({ loan, onClose, onUploadProof }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  if (!loan) return null;

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
        <div className="loan-summary">
          <p>
            <strong>ID:</strong> {loan.id.substring(0, 8)}
          </p>
          <p>
            <strong>Nama:</strong> {loan.userData?.namaLengkap || "N/A"}
          </p>
          <p>
            <strong>Jumlah:</strong> Rp{" "}
            {loan.jumlahPinjaman?.toLocaleString("id-ID") || "0"}
          </p>
        </div>

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