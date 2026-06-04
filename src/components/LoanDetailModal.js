import React, { useState } from "react";
import "../styles/LoanDetailModal.css";
import "../styles/RestrukturisasiReviewModal.css";
import {
  FaWhatsapp,
  FaCopy,
  FaFileExport,
  FaSave,
  FaTimes,
  FaChevronDown,
  FaChevronRight,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { useLoanHistoryExtract } from "../hooks/useLoanHistoryExtract";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

const formatRupiah = (n) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  const d = timestamp.seconds
    ? new Date(timestamp.seconds * 1000)
    : new Date(timestamp);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isApprovalStatus = (status) =>
  status.includes("Menunggu Persetujuan") ||
  status.includes("Disetujui") ||
  status.includes("Menunggu Transfer") ||
  status === "Pengajuan Baru";

const isCicilanStatus = (status) => status.includes("Cicilan");

const groupHistory = (history) => {
  if (!history || history.length === 0) return [];

  const groups = [];
  let i = 0;

  while (i < history.length) {
    const entry = history[i];

    if (isApprovalStatus(entry.status)) {
      const entries = [entry];
      let j = i + 1;
      while (j < history.length && isApprovalStatus(history[j].status)) {
        entries.push(history[j]);
        j++;
      }
      if (entries.length > 1) {
        groups.push({
          type: "group",
          groupType: "approval",
          label: "Proses Persetujuan",
          entries,
        });
      } else {
        groups.push({ type: "single", entry: entries[0] });
      }
      i = j;
    } else if (isCicilanStatus(entry.status)) {
      const entries = [entry];
      let j = i + 1;
      while (j < history.length && isCicilanStatus(history[j].status)) {
        entries.push(history[j]);
        j++;
      }
      if (entries.length > 1) {
        const firstNum = entries[0].notes?.split("/")[0] || "?";
        const lastNum = entries[entries.length - 1].notes?.split("/")[0] || "?";
        groups.push({
          type: "group",
          groupType: "cicilan",
          label: `Pembayaran Cicilan ${firstNum} - ${lastNum}`,
          entries,
        });
      } else {
        groups.push({ type: "single", entry: entries[0] });
      }
      i = j;
    } else {
      groups.push({ type: "single", entry });
      i++;
    }
  }

  return groups;
};

const getStatusColor = (status) => {
  if (status.includes("Aktif") || status.includes("Lunas")) return "#059669";
  if (status.includes("Ditolak") || status.includes("Dibatalkan"))
    return "#dc2626";
  if (status.includes("Direvisi")) return "#d97706";
  if (status.includes("Menunggu")) return "#6b7280";
  if (status.includes("Direstrukturisasi")) return "#2563eb";
  if (status.includes("Cicilan")) return "#7c3aed";
  return "#374151";
};

const getStatusBg = (status) => {
  if (status.includes("Aktif")) return "#d1fae5";
  if (status.includes("Lunas")) return "#dbeafe";
  if (status.includes("Ditolak") || status.includes("Dibatalkan"))
    return "#fee2e2";
  if (status.includes("Direvisi")) return "#fef3c7";
  if (status.includes("Menunggu Transfer")) return "#dbeafe";
  if (status.includes("Menunggu")) return "#f3f4f6";
  if (status.includes("Direstrukturisasi")) return "#dbeafe";
  if (status.includes("Cicilan")) return "#f5f3ff";
  return "#f3f4f6";
};

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
  onViewLoan,
  actionLoading,
  userRole,
}) => {
  const { extracting, downloadCSV } = useLoanHistoryExtract();
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

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

  const startEditing = (field) => {
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

  const saveEdit = (field) => {
    if (field === "bank" || field === "nomorRekening") {
      if (onUpdateBankDetails) {
        onUpdateBankDetails(loan.id, {
          ...(loan.bankDetails || {}),
          [field]: editValues[field],
        });
      }
    } else {
      if (onUpdateUserData) {
        onUpdateUserData(loan.id, { [field]: editValues[field] });
      }
    }
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const cancelEdit = (field) => {
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const toggleGroup = (idx) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const renderNotesWithLinks = (notes) => {
    if (!notes || !onViewLoan) return notes;
    const parts = notes.split(/(#[a-zA-Z0-9]{8})/g);
    return parts.map((part, i) => {
      const match = part.match(/^#([a-zA-Z0-9]{8})$/);
      if (match) {
        const shortId = match[1];
        const fullId = loan.restructuredFromLoanId?.startsWith(shortId)
          ? loan.restructuredFromLoanId
          : loan.restructuredToLoanId?.startsWith(shortId)
            ? loan.restructuredToLoanId
            : null;
        if (fullId) {
          return (
            <span
              key={i}
              className="loan-id-link"
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

  const isRestrukturisasi = !!loan.restructuredFromLoanId;
  const jumlahPinjaman = loan.jumlahPinjaman || 0;
  const biayaAdmin = loan.biayaAdmin ?? calculateFee(jumlahPinjaman);
  const sisaHutangLama = loan.sisaPinjamanSebelumnya || 0;
  const pinjamanBaru = loan.pinjamanBaru || 0;
  const tenor = loan.tenor || 0;
  const additionalTenor = loan.additionalTenor || 0;
  const sisaTenorLama = tenor - additionalTenor;
  const cicilanPerBulan = tenor > 0 ? Math.round(jumlahPinjaman / tenor) : 0;
  const jumlahTransfer = isRestrukturisasi
    ? pinjamanBaru - biayaAdmin
    : jumlahPinjaman - biayaAdmin;

  const isActive = loan.status === "Disetujui dan Aktif";
  const isPayableStatus =
    isActive || loan.status === "Menunggu Persetujuan Restrukturisasi";
  const totalPayments = tenor;
  const currentPayment = loan.jumlahMenyicil || 0;
  const isGreyedOut = loan.status === "Direstrukturisasi";

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

  const canMakePayment = isPayableStatus && currentPayment < totalPayments;
  const canMarkComplete =
    isPayableStatus && currentPayment >= totalPayments && totalPayments > 0;

  const historyGroups = groupHistory(loan.history);

  const renderEditableField = (field, label, valueSource, valueKey) => {
    const currentValue = valueSource?.[valueKey] || "N/A";
    const canEdit =
      field === "bank" || field === "nomorRekening"
        ? !valueSource?.[valueKey] || valueSource[valueKey] === "N/A"
        : true;

    if (editing[field]) {
      return (
        <div className="ldm-info-row">
          <span className="ldm-info-label">{label}</span>
          <div className="ldm-edit-inline">
            <input
              type="text"
              value={editValues[field]}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, [field]: e.target.value }))
              }
              className="ldm-edit-input"
            />
            <button className="ldm-edit-save" onClick={() => saveEdit(field)}>
              <FaSave />
            </button>
            <button
              className="ldm-edit-cancel"
              onClick={() => cancelEdit(field)}
            >
              <FaTimes />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="ldm-info-row">
        <span className="ldm-info-label">{label}</span>
        <span className="ldm-info-value">
          {field === "nomorRekening" ? (
            <span className="ldm-rekening-group">
              <span>{currentValue}</span>
              {loan.bankDetails?.nomorRekening &&
                loan.bankDetails.nomorRekening !== "N/A" && (
                  <button
                    className="ldm-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        loan.bankDetails.nomorRekening,
                      );
                      setShowSnackbar(true);
                      setTimeout(() => setShowSnackbar(false), 2000);
                    }}
                    title="Salin"
                  >
                    <FaCopy />
                    {showSnackbar && (
                      <span className="ldm-copied-tip">Disalin!</span>
                    )}
                  </button>
                )}
              {canEdit && (
                <button
                  className="ldm-edit-link"
                  onClick={() => startEditing(field)}
                >
                  Edit
                </button>
              )}
            </span>
          ) : (
            <span className="ldm-value-with-edit">
              {currentValue}
              {canEdit && (
                <button
                  className="ldm-edit-link"
                  onClick={() => startEditing(field)}
                >
                  Edit
                </button>
              )}
            </span>
          )}
        </span>
      </div>
    );
  };

  const renderHistoryEntry = (entry, key) => (
    <div key={key} className="ldm-history-entry">
      <div
        className="ldm-history-dot"
        style={{ backgroundColor: getStatusColor(entry.status) }}
      />
      <div className="ldm-history-content">
        <div className="ldm-history-header">
          <span
            className="ldm-history-status"
            style={{ color: getStatusColor(entry.status) }}
          >
            {entry.status}
          </span>
          <span className="ldm-history-date">
            {formatDate(entry.timestamp)}
          </span>
        </div>
        {entry.notes && (
          <p className="ldm-history-notes">
            {renderNotesWithLinks(entry.notes)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="ldm-overlay" onClick={onClose}>
      <div className="ldm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ldm-header">
          <div className="ldm-header-left">
            <div className="ldm-title-row">
              <h3>Pinjaman #{loan.id.substring(0, 8)}</h3>
              <span
                className="ldm-status-badge"
                style={{
                  backgroundColor: getStatusBg(loan.status),
                  color: getStatusColor(loan.status),
                }}
              >
                {loan.status}
              </span>
            </div>
            {(loan.restructuredFromLoanId || loan.restructuredToLoanId) && (
              <p className="ldm-nav-hint">
                {loan.restructuredFromLoanId && (
                  <span
                    className="ldm-nav-link"
                    onClick={() =>
                      onViewLoan && onViewLoan(loan.restructuredFromLoanId)
                    }
                  >
                    ← Pinjaman Sebelumnya
                  </span>
                )}
                {loan.restructuredFromLoanId && loan.restructuredToLoanId && (
                  <span className="ldm-nav-sep"> · </span>
                )}
                {loan.restructuredToLoanId && (
                  <span
                    className="ldm-nav-link"
                    onClick={() =>
                      onViewLoan && onViewLoan(loan.restructuredToLoanId)
                    }
                  >
                    Pinjaman Baru →
                  </span>
                )}
              </p>
            )}
          </div>
          <button className="rrm-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div className={`ldm-body${isGreyedOut ? " ldm-greyed" : ""}`}>
          {/* Financial Summary */}
          {isRestrukturisasi ? (
            <div className="rrm-calc-table">
              <div className="rrm-calc-row">
                <span>
                  Sisa hutang lama (#
                  {loan.restructuredFromLoanId?.substring(0, 8)})
                </span>
                <span>{formatRupiah(sisaHutangLama)}</span>
              </div>
              <div className="rrm-calc-row">
                <span>Pinjaman tambahan</span>
                <span>+ {formatRupiah(pinjamanBaru)}</span>
              </div>
              <div className="rrm-calc-row rrm-calc-total">
                <span>Total pinjaman</span>
                <span>{formatRupiah(jumlahPinjaman)}</span>
              </div>
              <div className="rrm-calc-divider" />
              <div className="rrm-calc-row">
                <span>Tenor</span>
                <span>
                  {sisaTenorLama} + {additionalTenor} = {tenor} bulan
                </span>
              </div>
              <div className="rrm-calc-row">
                <span>Cicilan per bulan</span>
                <span>{formatRupiah(cicilanPerBulan)}</span>
              </div>
              <div className="rrm-calc-row">
                <span>Biaya administrasi</span>
                <span>{formatRupiah(biayaAdmin)}</span>
              </div>
              {loan.sisaHutang != null && (
                <>
                  <div className="rrm-calc-divider" />
                  <div className="rrm-calc-row" style={{ fontWeight: 600 }}>
                    <span>Sisa hutang</span>
                    <span>{formatRupiah(loan.sisaHutang)}</span>
                  </div>
                </>
              )}
              <div className="rrm-calc-divider" />
              <div
                className="rrm-calc-row"
                style={{ fontSize: "0.82rem", color: "#6b7280" }}
              >
                <span>Pinjaman tambahan</span>
                <span>{formatRupiah(pinjamanBaru)}</span>
              </div>
              <div
                className="rrm-calc-row"
                style={{ fontSize: "0.82rem", color: "#6b7280" }}
              >
                <span>Biaya administrasi</span>
                <span>- {formatRupiah(biayaAdmin)}</span>
              </div>
              <div className="rrm-calc-row rrm-calc-transfer">
                <span>Jumlah transfer ke anggota</span>
                <span>{formatRupiah(jumlahTransfer)}</span>
              </div>
              {loan.buktiTransfer && (
                <div className="ldm-proof-in-calc">
                  <a
                    href={loan.buktiTransfer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ldm-proof-link"
                  >
                    Bukti Transfer{" "}
                    <FaExternalLinkAlt style={{ fontSize: "0.7em" }} />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="rrm-calc-table">
              <div className="rrm-calc-row rrm-calc-total">
                <span>Jumlah Pinjaman</span>
                <span>{formatRupiah(jumlahPinjaman)}</span>
              </div>
              <div className="rrm-calc-row">
                <span>Biaya administrasi</span>
                <span>{formatRupiah(biayaAdmin)}</span>
              </div>
              {loan.sisaHutang != null && (
                <div className="rrm-calc-row" style={{ fontWeight: 600 }}>
                  <span>Sisa hutang</span>
                  <span>{formatRupiah(loan.sisaHutang)}</span>
                </div>
              )}
              <div className="rrm-calc-divider" />
              <div className="rrm-calc-row rrm-calc-transfer">
                <span>Jumlah transfer ke anggota</span>
                <span>{formatRupiah(jumlahTransfer)}</span>
              </div>
              {loan.buktiTransfer && (
                <div className="ldm-proof-in-calc">
                  <a
                    href={loan.buktiTransfer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ldm-proof-link"
                  >
                    Bukti Transfer{" "}
                    <FaExternalLinkAlt style={{ fontSize: "0.7em" }} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Borrower Info */}
          <h4 className="ldm-section-title">Informasi Peminjam</h4>
          <div className="ldm-section-card">
            <div className="ldm-info-row">
              <span className="ldm-info-label">Nama</span>
              <span className="ldm-info-value">
                {loan.userData?.namaLengkap || "N/A"}
              </span>
            </div>
            <div className="ldm-info-row">
              <span className="ldm-info-label">Kontak</span>
              <span className="ldm-info-value">
                <a
                  href={`https://wa.me/${loan.userData?.nomorWhatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ldm-wa-link"
                >
                  {loan.userData?.nomorWhatsapp || "N/A"} <FaWhatsapp />
                </a>
              </span>
            </div>
            {renderEditableField("bank", "Bank", loan.bankDetails, "bank")}
            {renderEditableField(
              "nomorRekening",
              "Nomor Rekening",
              loan.bankDetails,
              "nomorRekening",
            )}
            {renderEditableField("kantor", "Kantor", loan.userData, "kantor")}
            {renderEditableField(
              "satuanKerja",
              "Satuan Kerja",
              loan.userData,
              "satuanKerja",
            )}
            {renderEditableField(
              "nomorAnggota",
              "Nomor Anggota",
              loan.userData,
              "nomorAnggota",
            )}
          </div>

          {/* Loan Details */}
          <h4 className="ldm-section-title">Detail Pinjaman</h4>
          <div className="ldm-section-card">
            <div className="ldm-info-row">
              <span className="ldm-info-label">Tenor</span>
              <span className="ldm-info-value">{tenor} bulan</span>
            </div>
            <div className="ldm-info-row">
              <span className="ldm-info-label">Tanggal Pengajuan</span>
              <span className="ldm-info-value">
                {formatDate(loan.tanggalPengajuan)}
              </span>
            </div>
            <div className="ldm-info-row">
              <span className="ldm-info-label">Tujuan</span>
              <span className="ldm-info-value">
                {loan.tujuanPinjaman || "-"}
              </span>
            </div>
            {(isPayableStatus ||
              loan.status === "Lunas" ||
              loan.status === "Direstrukturisasi") && (
              <div className="ldm-info-row">
                <span className="ldm-info-label">Angsuran Terbayar</span>
                <span className="ldm-info-value">
                  {currentPayment} / {totalPayments}
                </span>
              </div>
            )}
            {loan.catatanTambahan && loan.catatanTambahan.length > 0 && (
              <div className="ldm-info-row ldm-info-row-block">
                <span className="ldm-info-label">Catatan Tambahan</span>
                <span className="ldm-info-value ldm-notes-block">
                  {loan.catatanTambahan.map((note, i) => (
                    <span key={i}>
                      {renderNotesWithLinks(note)}
                      {i < loan.catatanTambahan.length - 1 && <br />}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {loan.alasanPenolakan && (
              <div className="ldm-info-row">
                <span className="ldm-info-label">Alasan Penolakan</span>
                <span className="ldm-info-value" style={{ color: "#dc2626" }}>
                  {loan.alasanPenolakan}
                </span>
              </div>
            )}
          </div>

          {/* History */}
          {loan.history && loan.history.length > 0 && (
            <>
              <h4 className="ldm-section-title">Histori Pinjaman</h4>
              <div className="ldm-history">
                {historyGroups.map((group, idx) => {
                  if (group.type === "single") {
                    return renderHistoryEntry(group.entry, idx);
                  }

                  const isExpanded = expandedGroups.has(idx);
                  const first = group.entries[0];
                  const last = group.entries[group.entries.length - 1];
                  const color =
                    group.groupType === "cicilan" ? "#7c3aed" : "#059669";

                  return (
                    <div key={idx} className="ldm-history-group">
                      <div
                        className="ldm-group-header"
                        onClick={() => toggleGroup(idx)}
                      >
                        <div className="ldm-group-left">
                          <span className="ldm-group-chevron">
                            {isExpanded ? (
                              <FaChevronDown />
                            ) : (
                              <FaChevronRight />
                            )}
                          </span>
                          <span className="ldm-group-label" style={{ color }}>
                            {group.label}
                          </span>
                          <span className="ldm-group-count">
                            {group.entries.length}
                          </span>
                        </div>
                        <span className="ldm-group-dates">
                          {formatDate(first.timestamp)} —{" "}
                          {formatDate(last.timestamp)}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="ldm-group-entries">
                          {group.entries.map((entry, j) =>
                            renderHistoryEntry(entry, `${idx}-${j}`),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ldm-footer">
          <button className="rrm-btn rrm-btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <div className="ldm-actions">
            {canApprove && (
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={() => onApprove(loan.id)}
                disabled={actionLoading}
              >
                Setujui
              </button>
            )}
            {canReviseOrReject && (
              <button
                className="rrm-btn rrm-btn-revise"
                onClick={() => onRevise(loan)}
                disabled={actionLoading}
              >
                Revisi
              </button>
            )}
            {canReviseOrReject && (
              <button
                className="rrm-btn rrm-btn-reject"
                onClick={() => onReject(loan)}
                disabled={actionLoading}
              >
                Tolak
              </button>
            )}
            {canUpload && (
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={() => onUploadProof(loan)}
                disabled={actionLoading}
              >
                Upload Bukti
              </button>
            )}
            {canMakePayment && (
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={() => onMakePayment(loan.id)}
                disabled={actionLoading}
              >
                Bayar Cicilan
              </button>
            )}
            {canMarkComplete && (
              <button
                className="rrm-btn rrm-btn-approve"
                onClick={() => onMarkComplete(loan.id)}
                disabled={actionLoading}
              >
                Tandai Lunas
              </button>
            )}
            {(loan.status === "Disetujui dan Aktif" ||
              loan.status === "Lunas") && (
              <button
                className="rrm-btn rrm-btn-secondary"
                onClick={() => downloadCSV(loan)}
                disabled={extracting || actionLoading}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <FaFileExport />
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
