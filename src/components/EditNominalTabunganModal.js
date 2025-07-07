import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/EditNominalTabunganModal.css";

const EditNominalTabunganModal = ({ member, onClose, onSuccess }) => {
  const [nominalTabungan, setNominalTabungan] = useState(
    member?.nominalTabungan?.toString() || "0"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Format currency with thousand separator
  const formatCurrency = (value) => {
    // Remove non-numeric characters
    const numericValue = value.replace(/\D/g, "");
    // Format with thousand separator
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    // Remove non-numeric characters
    const numericValue = value.replace(/\D/g, "");
    // Format with thousand separator
    const formattedValue = formatCurrency(numericValue);
    setNominalTabungan(formattedValue);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Convert formatted string to number
      const numericValue = parseInt(nominalTabungan.replace(/\./g, ""), 10) || 0;
      
      // Update the document in Firestore
      const memberRef = doc(db, "users", member.id);
      await updateDoc(memberRef, {
        nominalTabungan: numericValue,
        updatedAt: new Date()
      });

      // Call success callback
      onSuccess(numericValue);
      onClose();
    } catch (error) {
      console.error("Error updating nominal tabungan:", error);
      setError("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close modal when clicking outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="editNominalTabungan_overlay" onClick={handleOverlayClick}>
      <div className="editNominalTabungan_modal" onClick={(e) => e.stopPropagation()}>
        <div className="editNominalTabungan_header">
          <h2>Edit Nominal Tabungan</h2>
          <button
            type="button"
            className="editNominalTabungan_close-btn"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        
        <div className="editNominalTabungan_content">
          <div className="editNominalTabungan_member-info">
            <p><strong>Nama:</strong> {member?.nama || "-"}</p>
            <p><strong>Nomor Anggota:</strong> {member?.nomorAnggota || "-"}</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="editNominalTabungan_form-group">
              <label htmlFor="nominalTabungan">Nominal Tabungan (Rp)</label>
              <div className="editNominalTabungan_input-group">
                <span className="editNominalTabungan_currency-prefix">Rp</span>
                <input
                  type="text"
                  id="nominalTabungan"
                  value={nominalTabungan}
                  onChange={handleInputChange}
                  className="editNominalTabungan_input"
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            {error && <div className="editNominalTabungan_error">{error}</div>}
            
            <div className="editNominalTabungan_actions">
              <button
                type="button"
                className="editNominalTabungan_cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="editNominalTabungan_save-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditNominalTabunganModal;
