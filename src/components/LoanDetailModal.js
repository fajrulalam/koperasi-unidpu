import React, { useState } from "react";
import "../styles/LoanDetailModal.css";
import {
  FaWhatsapp,
  FaRegClock,
  FaUserCheck,
  FaUserTimes,
  FaExchangeAlt,
  FaPaperPlane,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaLandmark,
  FaFileSignature,
  FaCopy,
  FaFileExport,
  FaPencilAlt,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import { useLoanHistoryExtract } from "../hooks/useLoanHistoryExtract";

const LoanDetailModal = ({
  loan,
  onClose,
  onApprove,
  onRevise,
  onReject,
  onUploadProof,
  onMarkComplete,
  onMakePayment,
  onUpdateBankDetails,
  onUpdateUserData,
  actionLoading,
  userRole,
}) => {
  // Use the loan history extract hook
  const { extracting, downloadCSV } = useLoanHistoryExtract();
  // Define useState hook at the top level of the component
  const [showSnackbar, setShowSnackbar] = useState(false);

  // State for editable fields
  const [editing, setEditing] = useState({
    bank: false,
    nomorRekening: false,
    kantor: false,
    satuanKerja: false,
    nomorAnggota: false,
  });

  const [editValues, setEditValues] = useState({
    bank: "",
    nomorRekening: "",
    kantor: "",
    satuanKerja: "",
    nomorAnggota: "",
  });

  if (!loan) return null;

  // Handle start editing for a field
  const startEditing = (field) => {
    // For bank and nomorRekening, only allow editing if they're empty or N/A
    if (
      (field === "bank" || field === "nomorRekening") &&
      loan.bankDetails?.[field] &&
      loan.bankDetails[field] !== "N/A"
    ) {
      return;
    }

    setEditValues((prev) => ({
      ...prev,
      [field]:
        field === "bank" || field === "nomorRekening"
          ? loan.bankDetails?.[field] || ""
          : loan.userData?.[field] || "",
    }));

    setEditing((prev) => ({ ...prev, [field]: true }));
  };

  // Handle saving edits
  const saveEdit = (field) => {
    // Update data in database based on field type
    if (field === "bank" || field === "nomorRekening") {
      if (onUpdateBankDetails) {
        // Create a new bankDetails object with updated field
        const updatedBankDetails = {
          ...(loan.bankDetails || {}),
          [field]: editValues[field],
        };

        onUpdateBankDetails(loan.id, updatedBankDetails);
      }
    } else {
      if (onUpdateUserData) {
        // Create an object with just the updated field
        const updatedData = {
          [field]: editValues[field],
        };

        // Use loan.id to update userData within the loan document
        onUpdateUserData(loan.id, updatedData);
      }
    }

    // Close the edit mode
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  // Handle cancel editing
  const cancelEdit = (field) => {
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
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
      default:
        colorClass = "status-default";
    }
    return (
      <span className={`status-badge-loanDetailModal ${colorClass}`}>
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
    if (status.includes("Cicilan")) return <FaFileInvoiceDollar />;
    if (status.includes("Lunas")) return <FaCheckCircle />;
    if (status.includes("Aktif")) return <FaLandmark />;
    if (status.includes("Pengajuan")) return <FaFileSignature />;
    return <FaRegClock />;
  };

  const getHistoryStatusClass = (status) => {
    // More specific statuses first to avoid incorrect matching
    if (status.includes("Menunggu Transfer BAK")) return "waiting";
    if (status.includes("Menunggu Persetujuan")) return "pending";
    if (status.includes("Direvisi")) return "revision";

    // General statuses
    if (
      status.includes("Disetujui dan Aktif") ||
      status.includes("Disetujui") ||
      status.includes("Persetujuan")
    )
      return "approved";
    if (status.includes("Ditolak")) return "rejected";
    if (status.includes("Lunas")) return "completed";
    if (status.includes("Cicilan")) return "payment";

    return "default"; // Fallback for any other status
  };

  const isActive = loan.status === "Disetujui dan Aktif";
  const totalPayments = loan.tenor || 0;
  const currentPayment = loan.jumlahMenyicil || 0;

  const canApprove =
    (userRole === "bak" && loan.status === "Menunggu Persetujuan BAK") ||
    (userRole === "wakil_rektor_1" &&
      loan.status === "Menunggu Persetujuan Wakil Rektor 1") ||
    userRole === "direktur";

  const canReviseOrReject =
    (userRole === "bak" && loan.status === "Menunggu Persetujuan BAK") ||
    (userRole === "wakil_rektor_1" &&
      loan.status === "Menunggu Persetujuan Wakil Rektor 1") ||
    userRole === "direktur";

  const canUpload =
    (userRole === "bak" || userRole === "direktur") &&
    loan.status === "Menunggu Transfer BAK";

  const canMakePayment = isActive && currentPayment < totalPayments;
  const canMarkComplete =
    isActive && currentPayment >= totalPayments && totalPayments > 0;

  return (
    <div className="modal-overlay-loanDetailModal" onClick={onClose}>
      <div
        className="modal-content-loanDetailModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-loanDetailModal">
          <h3>Detail Pinjaman #{loan.id.substring(0, 8)}</h3>
          <button className="modal-close-loanDetailModal" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body-loanDetailModal">
          <div className="detail-section-loanDetailModal">
            <h4>Informasi Peminjam</h4>
            <div className="detail-grid-loanDetailModal">
              <div className="detail-item-loanDetailModal">
                <span>Nama</span>
                <strong>{loan.userData?.namaLengkap || "N/A"}</strong>
              </div>
              <div className="detail-item-loanDetailModal">
                <span>Kontak</span>
                <strong>
                  <a
                    href={`https://wa.me/${loan.userData?.nomorWhatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link-loanDetailModal"
                  >
                    {loan.userData?.nomorWhatsapp || "N/A"} <FaWhatsapp />
                  </a>
                </strong>
              </div>
              <div className="detail-item-loanDetailModal">
                <span>Bank</span>
                {editing.bank ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editValues.bank}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          bank: e.target.value,
                        }))
                      }
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button onClick={() => saveEdit("bank")} title="Simpan">
                        <FaSave />
                      </button>
                      <button onClick={() => cancelEdit("bank")} title="Batal">
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-with-edit">
                    <strong>{loan.bankDetails?.bank || "N/A"}</strong>
                    {(!loan.bankDetails?.bank ||
                      loan.bankDetails?.bank === "N/A") && (
                      <button
                        className="edit-button"
                        onClick={() => startEditing("bank")}
                        title="Edit bank"
                      >
                        <FaPencilAlt />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="detail-item-loanDetailModal">
                <span>Nomor Rekening</span>
                {editing.nomorRekening ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editValues.nomorRekening}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          nomorRekening: e.target.value,
                        }))
                      }
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button
                        onClick={() => saveEdit("nomorRekening")}
                        title="Simpan"
                      >
                        <FaSave />
                      </button>
                      <button
                        onClick={() => cancelEdit("nomorRekening")}
                        title="Batal"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-number-container">
                    <div className="account-number-wrapper">
                      <strong>
                        {loan.bankDetails?.nomorRekening || "N/A"}
                      </strong>
                      {showSnackbar && <div className="tooltip">Disalin!</div>}
                    </div>
                    <div className="account-actions">
                      {loan.bankDetails?.nomorRekening && (
                        <button
                          className="copy-button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              loan.bankDetails.nomorRekening
                            );
                            setShowSnackbar(true);
                            setTimeout(() => setShowSnackbar(false), 2000);
                          }}
                          title="Salin nomor rekening"
                        >
                          <FaCopy />
                        </button>
                      )}
                      {(!loan.bankDetails?.nomorRekening ||
                        loan.bankDetails?.nomorRekening === "N/A") && (
                        <button
                          className="edit-button"
                          onClick={() => startEditing("nomorRekening")}
                          title="Edit nomor rekening"
                        >
                          <FaPencilAlt />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-item-loanDetailModal">
                <span>Kantor</span>
                {editing.kantor ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editValues.kantor}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          kantor: e.target.value,
                        }))
                      }
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button onClick={() => saveEdit("kantor")} title="Simpan">
                        <FaSave />
                      </button>
                      <button
                        onClick={() => cancelEdit("kantor")}
                        title="Batal"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-with-edit">
                    <strong>{loan.userData?.kantor || "N/A"}</strong>
                    <button
                      className="edit-button"
                      onClick={() => startEditing("kantor")}
                      title="Edit kantor"
                    >
                      <FaPencilAlt />
                    </button>
                  </div>
                )}
              </div>

              <div className="detail-item-loanDetailModal">
                <span>Satuan Kerja</span>
                {editing.satuanKerja ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editValues.satuanKerja}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          satuanKerja: e.target.value,
                        }))
                      }
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button
                        onClick={() => saveEdit("satuanKerja")}
                        title="Simpan"
                      >
                        <FaSave />
                      </button>
                      <button
                        onClick={() => cancelEdit("satuanKerja")}
                        title="Batal"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-with-edit">
                    <strong>{loan.userData?.satuanKerja || "N/A"}</strong>
                    <button
                      className="edit-button"
                      onClick={() => startEditing("satuanKerja")}
                      title="Edit satuan kerja"
                    >
                      <FaPencilAlt />
                    </button>
                  </div>
                )}
              </div>

              <div className="detail-item-loanDetailModal">
                <span>Nomor Anggota</span>
                {editing.nomorAnggota ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      value={editValues.nomorAnggota}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          nomorAnggota: e.target.value,
                        }))
                      }
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <button
                        onClick={() => saveEdit("nomorAnggota")}
                        title="Simpan"
                      >
                        <FaSave />
                      </button>
                      <button
                        onClick={() => cancelEdit("nomorAnggota")}
                        title="Batal"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="field-with-edit">
                    <strong>{loan.userData?.nomorAnggota || "N/A"}</strong>
                    <button
                      className="edit-button"
                      onClick={() => startEditing("nomorAnggota")}
                      title="Edit nomor anggota"
                    >
                      <FaPencilAlt />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="detail-section-loanDetailModal">
            <h4>Detail Pinjaman</h4>
            <div className="detail-grid-loanDetailModal">
              <div className="detail-item-loanDetailModal">
                <span>Status</span>
                <strong>{getStatusBadge(loan.status)}</strong>
              </div>
              <div className="detail-item-loanDetailModal">
                <span>Jumlah Pinjaman</span>
                <strong>
                  Rp {loan.jumlahPinjaman?.toLocaleString("id-ID") || "0"}
                </strong>
              </div>
              <div className="detail-item-loanDetailModal">
                <span>Tenor</span>
                <strong>{loan.tenor || "0"} Bulan</strong>
              </div>
              <div className="detail-item-loanDetailModal">
                <span>Tanggal Pengajuan</span>
                <strong>{formatDate(loan.tanggalPengajuan)}</strong>
              </div>
              <div
                className="detail-item-loanDetailModal"
                style={{ gridColumn: "span 2" }}
              >
                <span>Tujuan</span>
                <strong>{loan.tujuanPinjaman || "-"}</strong>
              </div>
              {loan.catatanTambahan && (
                <div
                  className="detail-item-loanDetailModal"
                  style={{ gridColumn: "span 2" }}
                >
                  <span>Catatan Tambahan</span>
                  <strong>{loan.catatanTambahan}</strong>
                </div>
              )}
              {loan.alasanPenolakan && (
                <div
                  className="detail-item-loanDetailModal rejected-reason"
                  style={{ gridColumn: "span 2" }}
                >
                  <span>Alasan Penolakan</span>
                  <strong>{loan.alasanPenolakan}</strong>
                </div>
              )}
            </div>
          </div>

          {(isActive || loan.status === "Lunas") && (
            <div className="detail-section-loanDetailModal">
              <h4>Riwayat Pembayaran</h4>
              <div className="detail-grid-loanDetailModal">
                <div className="detail-item-loanDetailModal">
                  <span>Angsuran Terbayar</span>
                  <strong>
                    {currentPayment} / {totalPayments}
                  </strong>
                </div>
                {loan.buktiTransfer && (
                  <div className="detail-item-loanDetailModal">
                    <span>Bukti Transfer</span>
                    <strong>
                      <a
                        href={loan.buktiTransfer}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lihat Bukti
                      </a>
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {loan.history && loan.history.length > 0 && (
            <div className="detail-section-loanDetailModal">
              <h4>Histori Pinjaman</h4>
              <div className="history-timeline-loanDetailModal">
                {loan.history.map((entry, index) => (
                  <div
                    key={index}
                    className={`history-item-loanDetailModal history-status-${getHistoryStatusClass(
                      entry.status
                    )}`}
                  >
                    <div className="history-marker-loanDetailModal">
                      {getHistoryIcon(entry.status)}
                    </div>
                    <div className="history-content-loanDetailModal">
                      <p className="status-loanDetailModal">{entry.status}</p>
                      <p className="meta-loanDetailModal">
                        {formatDate(entry.timestamp)} - oleh {entry.updatedBy}
                      </p>
                      {entry.notes && (
                        <p className="notes-loanDetailModal">
                          Catatan: {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions-loanDetailModal">
          <button
            className="button-secondary-loanDetailModal"
            onClick={onClose}
          >
            Tutup
          </button>
          <div className="action-buttons-loanDetailModal">
            {canApprove && (
              <button
                className="button-primary-loanDetailModal"
                onClick={() => onApprove(loan.id)}
                disabled={actionLoading}
              >
                Setujui
              </button>
            )}
            {canReviseOrReject && (
              <button
                className="button-secondary-loanDetailModal"
                onClick={() => onRevise(loan)}
                disabled={actionLoading}
              >
                Revisi
              </button>
            )}
            {canReviseOrReject && (
              <button
                className="button-danger-loanDetailModal"
                onClick={() => onReject(loan)}
                disabled={actionLoading}
              >
                Tolak
              </button>
            )}
            {canUpload && (
              <button
                className="button-primary-loanDetailModal"
                onClick={() => onUploadProof(loan)}
                disabled={actionLoading}
              >
                Upload Bukti
              </button>
            )}
            {canMakePayment && (
              <button
                className="button-success-loanDetailModal"
                onClick={() => onMakePayment(loan.id)}
                disabled={actionLoading}
              >
                Bayar Cicilan
              </button>
            )}
            {canMarkComplete && (
              <button
                className="button-success-loanDetailModal"
                onClick={() => onMarkComplete(loan.id)}
                disabled={actionLoading}
              >
                Tandai Lunas
              </button>
            )}
            {loan.status === "Disetujui dan Aktif" && (
              <button
                className="button-info-loanDetailModal"
                onClick={() => downloadCSV(loan)}
                disabled={extracting || actionLoading}
              >
                <FaFileExport />{" "}
                {extracting ? "Mengekstrak..." : "Ekstrak Excel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailModal;
