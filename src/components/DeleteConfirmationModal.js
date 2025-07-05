import React from "react";

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedMembers,
  actionLoading
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container delete-modal">
        <div className="modal-content">
          <h3>Hapus Anggota</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          <p className="delete-warning">
            Anda akan menghapus <strong>{selectedMembers.length}</strong> anggota.
            Tindakan ini tidak dapat dibatalkan.
          </p>
          
          <p>
            Anggota yang dihapus akan kehilangan akses ke sistem.
            Data transaksi terkait tidak akan dihapus dari database.
          </p>
          
          <div className="modal-actions">
            <button className="cancel-button" onClick={onClose}>
              Batal
            </button>

            <button
              className="delete-button"
              onClick={onConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? "Menghapus..." : `Hapus ${selectedMembers.length} Anggota`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;