import React from "react";
import "../styles/LoanHistoryModal.css";
import "../styles/RestrukturisasiReviewModal.css";
import {
  FaRegClock,
  FaUserCheck,
  FaUserTimes,
  FaExchangeAlt,
  FaPaperPlane,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaLandmark,
  FaFileSignature,
  FaLink,
} from "react-icons/fa";
import {
  formatCurrency,
  formatDate,
  formatDetailedDate,
} from "../utils/memberBerandaUtils";

const LoanHistoryModal = ({ isOpen, onClose, selectedLoan, onViewLoan }) => {
  if (!isOpen || !selectedLoan) return null;

  const renderNotesWithLinks = (notes) => {
    if (!notes || !onViewLoan) return notes;
    const parts = notes.split(/(#[a-zA-Z0-9]{8})/g);
    return parts.map((part, i) => {
      const match = part.match(/^#([a-zA-Z0-9]{8})$/);
      if (match) {
        const shortId = match[1];
        const fullId =
          selectedLoan.restructuredFromLoanId?.startsWith(shortId)
            ? selectedLoan.restructuredFromLoanId
            : selectedLoan.restructuredToLoanId?.startsWith(shortId)
              ? selectedLoan.restructuredToLoanId
              : null;
        if (fullId) {
          return (
            <span
              key={i}
              className="loan-id-link-LoanHistoryModal"
              onClick={() => onViewLoan(fullId)}
            >
              #{shortId}
            </span>
          );
        }
      }
      return part;
    });
  };

  const getStatusBadge = (status) => {
    let colorClass = "";
    switch (status) {
      case "Menunggu Persetujuan BAK":
      case "Menunggu Persetujuan Wakil Rektor 1":
        colorClass = "status-pending";
        break;
      case "Menunggu Transfer BAK":
        colorClass = "status-waiting";
        break;
      case "Disetujui dan Aktif":
        colorClass = "status-active";
        break;
      case "Lunas":
        colorClass = "status-completed";
        break;
      case "Direvisi BAK":
        colorClass = "status-revision";
        break;
      case "Ditolak BAK":
      case "Ditolak Wakil Rektor 1":
        colorClass = "status-rejected";
        break;
      case "Menunggu Persetujuan Restrukturisasi":
        colorClass = "status-restructuring-pending";
        break;
      case "Direstrukturisasi":
        colorClass = "status-restructured";
        break;
      default:
        colorClass = "status-default";
    }
    return (
      <span className={`status-badge-LoanHistoryModal ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getHistoryIcon = (status) => {
    if (status.includes("Disetujui") || status.includes("Persetujuan"))
      return <FaUserCheck />;
    if (status.includes("Ditolak")) return <FaUserTimes />;
    if (status.includes("Direvisi")) return <FaExchangeAlt />;
    if (status.includes("Menunggu Transfer")) return <FaPaperPlane />;
    if (status.includes("Transfer")) return <FaLandmark />;
    if (status.includes("Cicilan")) return <FaFileInvoiceDollar />;
    if (status.includes("Lunas")) return <FaCheckCircle />;
    if (status.includes("Pengajuan")) return <FaFileSignature />;
    if (status.includes("Menunggu Persetujuan Restrukturisasi"))
      return <FaLink />;
    if (status.includes("Direstrukturisasi")) return <FaLink />;
    return <FaRegClock />;
  };

  const getHistoryStatusClass = (status) => {
    if (status.includes("Menunggu Transfer BAK")) return "history-status-waiting";
    if (status.includes("Menunggu Persetujuan Restrukturisasi"))
      return "history-status-restructuring-pending";
    if (status.includes("Menunggu Persetujuan")) return "history-status-pending";
    if (status.includes("Direvisi")) return "history-status-revision";
    if (
      status.includes("Disetujui dan Aktif") ||
      status.includes("Disetujui") ||
      status.includes("Persetujuan") ||
      status.includes("Transfer")
    )
      return "history-status-approved";
    if (status.includes("Ditolak")) return "history-status-rejected";
    if (status.includes("Lunas") || status.includes("completed"))
      return "history-status-completed";
    if (status.includes("Cicilan")) return "history-status-payment";
    if (status.includes("Direstrukturisasi")) return "history-status-restructured";
    return "history-status-default";
  };

  const isRestructured = selectedLoan.status === "Direstrukturisasi";

  return (
    <div className="modal-overlay-LoanHistoryModal" onClick={onClose}>
      <div
        className="modal-content-LoanHistoryModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-LoanHistoryModal">
          <div>
            <h3>
              Riwayat Pinjaman #{selectedLoan.id.substring(0, 8)}
              {isRestructured && (
                <span className="restructured-label-LoanHistoryModal">Direstrukturisasi</span>
              )}
            </h3>
            {(selectedLoan.restructuredFromLoanId || selectedLoan.restructuredToLoanId) && (
              <p className="restructure-nav-hint-LoanHistoryModal">
                {selectedLoan.restructuredFromLoanId && (
                  <span
                    className="loan-nav-link-LoanHistoryModal"
                    onClick={() => onViewLoan && onViewLoan(selectedLoan.restructuredFromLoanId)}
                  >
                    ← Pinjaman Sebelumnya
                  </span>
                )}
                {selectedLoan.restructuredFromLoanId && selectedLoan.restructuredToLoanId && (
                  <span className="nav-separator-LoanHistoryModal">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                )}
                {selectedLoan.restructuredToLoanId && (
                  <span
                    className="loan-nav-link-LoanHistoryModal"
                    onClick={() => onViewLoan && onViewLoan(selectedLoan.restructuredToLoanId)}
                  >
                    Pinjaman Baru →
                  </span>
                )}
              </p>
            )}
          </div>
          <button className="modal-close-LoanHistoryModal" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body-LoanHistoryModal">
          <div className={`detail-section-LoanHistoryModal${isRestructured ? " section-greyed-out-LoanHistoryModal" : ""}`}>
            <h4>Informasi Pinjaman</h4>
            <div className="detail-grid-LoanHistoryModal">
              <div className="detail-item-LoanHistoryModal">
                <span>Jumlah Pinjaman</span>
                <strong>{formatCurrency(selectedLoan.jumlahPinjaman)}</strong>
              </div>
              <div className="detail-item-LoanHistoryModal">
                <span>Tenor</span>
                <strong>{selectedLoan.tenor} bulan</strong>
              </div>
              <div className="detail-item-LoanHistoryModal">
                <span>Tujuan</span>
                <strong>{selectedLoan.tujuanPinjaman}</strong>
              </div>
              <div className="detail-item-LoanHistoryModal">
                <span>Status</span>
                <strong>{getStatusBadge(selectedLoan.status)}</strong>
              </div>
              {selectedLoan.restructuredFromLoanId && selectedLoan.sisaPinjamanSebelumnya != null && (
                <div className="detail-item-LoanHistoryModal">
                  <span>Sisa Hutang Sebelum Restrukturisasi</span>
                  <strong>{formatCurrency(selectedLoan.sisaPinjamanSebelumnya)}</strong>
                </div>
              )}
              {selectedLoan.restructuredFromLoanId && selectedLoan.pinjamanBaru != null && (
                <div className="detail-item-LoanHistoryModal">
                  <span>Pinjaman Tambahan</span>
                  <strong>{formatCurrency(selectedLoan.pinjamanBaru)}</strong>
                </div>
              )}
              {selectedLoan.catatanTambahan && selectedLoan.catatanTambahan.length > 0 && (
                <div className="detail-item-LoanHistoryModal" style={{ gridColumn: "1 / -1" }}>
                  <span>Catatan Tambahan</span>
                  <strong>
                    {selectedLoan.catatanTambahan.map((note, i) => (
                      <span key={i}>
                        {renderNotesWithLinks(note)}
                        {i < selectedLoan.catatanTambahan.length - 1 && <br />}
                      </span>
                    ))}
                  </strong>
                </div>
              )}
              {selectedLoan.biayaAdmin != null && (
                <div className="detail-item-LoanHistoryModal">
                  <span>Biaya Admin</span>
                  <strong>{formatCurrency(selectedLoan.biayaAdmin)}</strong>
                </div>
              )}
              {selectedLoan.sisaHutang != null && (
                <div className="detail-item-LoanHistoryModal">
                  <span>Sisa Hutang</span>
                  <strong>{formatCurrency(selectedLoan.sisaHutang)}</strong>
                </div>
              )}
              <div className="detail-item-LoanHistoryModal">
                <span>Tanggal Pengajuan</span>
                <strong>{formatDate(selectedLoan.tanggalPengajuan)}</strong>
              </div>
              {selectedLoan.tanggalDisetujui && (
                <div className="detail-item-LoanHistoryModal">
                  <span>Tanggal Disetujui</span>
                  <strong>{formatDate(selectedLoan.tanggalDisetujui)}</strong>
                </div>
              )}
            </div>
          </div>

          {selectedLoan.buktiTransfer && (
            <div className="detail-section-LoanHistoryModal">
              <h4>Bukti Transfer</h4>
              <div className="payment-proof-container-LoanHistoryModal">
                {selectedLoan.buktiTransfer.toLowerCase().includes(".pdf") ? (
                  <div className="payment-proof-link-LoanHistoryModal">
                    <i className="file-icon">📄</i>
                    <a
                      href={selectedLoan.buktiTransfer}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lihat Dokumen PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={selectedLoan.buktiTransfer}
                    alt="Bukti Transfer"
                    className="payment-proof-image-LoanHistoryModal"
                  />
                )}
              </div>
            </div>
          )}

          <div className="detail-section-LoanHistoryModal">
            <h4>Riwayat Status Pinjaman</h4>
            <div className="history-timeline-LoanHistoryModal">
              {selectedLoan.history && selectedLoan.history.length > 0 ? (
                selectedLoan.history.map((entry, index) => (
                  <div key={index} className={`history-item-LoanHistoryModal ${getHistoryStatusClass(entry.status)}`}>
                    <div className="history-marker-LoanHistoryModal">
                      {getHistoryIcon(entry.status)}
                    </div>
                    <div className="history-content-LoanHistoryModal">
                      <p className="status-LoanHistoryModal">{entry.status}</p>
                      <p className="meta-LoanHistoryModal">
                        {formatDetailedDate(entry.timestamp)}
                      </p>
                      {entry.notes && (
                        <div className="notes-LoanHistoryModal">
                          {renderNotesWithLinks(entry.notes)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p>Tidak ada riwayat</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer-LoanHistoryModal">
          <button className="rrm-btn rrm-btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoanHistoryModal;
