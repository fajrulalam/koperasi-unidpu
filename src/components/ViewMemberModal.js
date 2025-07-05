import React from "react";
import "../styles/ViewMemberModal.css";

const ViewMemberModal = ({
  isOpen,
  selectedMember,
  onClose,
  onApproveReject,
  actionLoading,
  formatCurrency,
  formatDate,
  getWhatsAppUrl
}) => {
  if (!isOpen || !selectedMember) return null;

  return (
    <div className="modal-backdrop-viewMemberModal">
      <div className="member-modal-viewMemberModal">
        <div className="modal-header-viewMemberModal">
          <h3>Detail Anggota</h3>
          <button className="modal-close-viewMemberModal" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content-viewMemberModal">
          <div className="member-detail-grid-viewMemberModal">
            <div className="detail-item-viewMemberModal full-width-item-viewMemberModal">
              <strong>Nama:</strong>
              <span>{selectedMember.nama || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>NIK:</strong>
              <span>{selectedMember.nik || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Kantor:</strong>
              <span>{selectedMember.kantor || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Satuan Kerja:</strong>
              <span>{selectedMember.satuanKerja || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Email:</strong>
              <span>{selectedMember.email || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>WhatsApp:</strong>
              <span>{selectedMember.nomorWhatsapp || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Tanggal Registrasi:</strong>
              <span>{formatDate(selectedMember.registrationDate)}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Status Pembayaran:</strong>
              <span>{selectedMember.paymentStatus || "-"}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Iuran Pokok:</strong>
              <span>{formatCurrency(selectedMember.iuranPokok)}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Iuran Wajib:</strong>
              <span>{formatCurrency(selectedMember.iuranWajib)}</span>
            </div>

            <div className="detail-item-viewMemberModal">
              <strong>Status Keanggotaan:</strong>
              <span
                className={`status-badge-viewMemberModal ${selectedMember.membershipStatus?.toLowerCase()}`}
              >
                {selectedMember.membershipStatus || "-"}
              </span>
            </div>
          </div>

          {selectedMember.paymentProof && (
            <div className="payment-proof-section-viewMemberModal">
              <h4>Bukti Pembayaran</h4>
              <a
                href={selectedMember.paymentProof}
                target="_blank"
                rel="noopener noreferrer"
                className="payment-link-viewMemberModal"
              >
                Lihat Bukti Pembayaran
              </a>
            </div>
          )}

          {selectedMember.membershipStatus === "Pending" && (
            <div className="modal-actions-viewMemberModal">
              <button
                className="reject-button-viewMemberModal"
                onClick={() => onApproveReject("reject")}
                disabled={actionLoading}
              >
                {actionLoading ? "Memproses..." : "Tolak"}
              </button>

              <button
                className="approve-button-viewMemberModal"
                onClick={() => onApproveReject("approve")}
                disabled={actionLoading}
              >
                {actionLoading ? "Memproses..." : "Setujui"}
              </button>
            </div>
          )}

          {(selectedMember.membershipStatus === "approved" ||
            selectedMember.membershipStatus === "rejected") && (
            <div className="whatsapp-section-viewMemberModal">
              <a
                href={getWhatsAppUrl(
                  selectedMember.nomorWhatsapp,
                  selectedMember.membershipStatus === "approved"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-button-viewMemberModal"
              >
                Hubungi via WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewMemberModal;