// src/components/SimpanPinjam.js
import React, { useState, useEffect } from "react";
import LoanDetailModal from "./LoanDetailModal";
import RejectionModal from "./RejectionModal";
import RevisionModal from "./RevisionModal";
import PaymentProofModal from "./PaymentProofModal";
import useSimpanPinjam from "./hooks/useSimpanPinjam";
import "../styles/SimpanPinjamStyles.css";

const SimpanPinjam = () => {
  const {
    filteredLoans,
    loading,
    error,
    success,
    selectedLoan,
    setSelectedLoan,
    revisionAmount,
    setRevisionAmount,
    rejectionReason,
    setRejectionReason,
    revisionTenor,
    setRevisionTenor,
    nameFilter,
    setNameFilter,
    statusFilter,
    setStatusFilter,
    startDateFilter,
    setStartDateFilter,
    endDateFilter,
    setEndDateFilter,
    userRole,
    viewingLoan,
    setViewingLoan,
    handleApprove,
    handleReject,
    handleRevise,
    handleMakePayment,
    handleMarkComplete,
    handleUploadPaymentProof,
    handleExportToExcel,
    formatDate,
    calculateEndDate,
    isLoanOverdue,
    getStatusBadgeClass,
  } = useSimpanPinjam();

  // State for multi-select status filter
  const [selectedStatuses, setSelectedStatuses] = useState([
    "Menunggu Persetujuan BAK",
    "Menunggu Persetujuan Wakil Rektor 2",
    "Direvisi BAK",
    "Menunggu Transfer BAK",
    "Disetujui dan Aktif",
  ]);

  // State for payment proof modal
  const [paymentProofLoan, setPaymentProofLoan] = useState(null);

  // Effect to filter loans based on selected statuses
  useEffect(() => {
    // Convert array of selected statuses to a comma-separated string for the filter
    if (selectedStatuses.length > 0) {
      setStatusFilter(selectedStatuses.join(","));
    } else {
      setStatusFilter("");
    }
  }, [selectedStatuses, setStatusFilter]);

  // Handle checkbox change for status filters
  const handleStatusFilterChange = (status) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  // Select all status filters
  const handleSelectAllStatuses = () => {
    setSelectedStatuses([
      "Menunggu Persetujuan BAK",
      "Menunggu Persetujuan Wakil Rektor 2",
      "Direvisi BAK",
      "Menunggu Transfer BAK",
      "Disetujui dan Aktif",
      "Lunas",
      "Ditolak BAK",
      "Ditolak Wakil Rektor 2",
      "Revisi Ditolak Anggota",
    ]);
  };

  // Clear all status filters
  const handleClearAllStatuses = () => {
    setSelectedStatuses([]);
  };

  if (loading) {
    return (
      <div className="simpan-pinjam-container">
        <h2>Manajemen Pinjaman</h2>
        <div className="loading">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="simpan-pinjam-container">
      <div className="header-with-actions">
        <h2>Manajemen Pinjaman</h2>
        <button
          className="export-excel-btn"
          onClick={handleExportToExcel}
          title="Ekspor ke Excel"
        >
          <span className="export-icon">📊</span> Ekspor Excel
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Cari Nama:</label>
            <input
              type="text"
              placeholder="Cari nama peminjam..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group date-filter-group">
            <label>Tanggal:</label>
            <div className="date-inputs">
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="filter-input date-input"
                placeholder="Dari"
              />
              <span className="date-separator">-</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="filter-input date-input"
                placeholder="Sampai"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Checkboxes */}
        <div className="status-filter-section">
          <div className="status-filter-header">
            <label>Status:</label>
            <div className="status-filter-actions">
              <button
                className="filter-action-btn"
                onClick={handleSelectAllStatuses}
              >
                Pilih Semua
              </button>
              <button
                className="filter-action-btn"
                onClick={handleClearAllStatuses}
              >
                Hapus Semua
              </button>
            </div>
          </div>
          <div className="status-filter-chips">
            <label
              className={`chip ${
                selectedStatuses.includes("Menunggu Persetujuan BAK")
                  ? "active"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Menunggu Persetujuan BAK")}
                onChange={() =>
                  handleStatusFilterChange("Menunggu Persetujuan BAK")
                }
              />
              Menunggu Persetujuan BAK
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Menunggu Persetujuan Wakil Rektor 2")
                  ? "active"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes(
                  "Menunggu Persetujuan Wakil Rektor 2"
                )}
                onChange={() =>
                  handleStatusFilterChange(
                    "Menunggu Persetujuan Wakil Rektor 2"
                  )
                }
              />
              Menunggu Persetujuan Wakil Rektor 2
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Menunggu Transfer BAK")
                  ? "active"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Menunggu Transfer BAK")}
                onChange={() =>
                  handleStatusFilterChange("Menunggu Transfer BAK")
                }
              />
              Menunggu Transfer BAK
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Disetujui dan Aktif") ? "active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Disetujui dan Aktif")}
                onChange={() => handleStatusFilterChange("Disetujui dan Aktif")}
              />
              Disetujui dan Aktif
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Direvisi BAK") ? "active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Direvisi BAK")}
                onChange={() => handleStatusFilterChange("Direvisi BAK")}
              />
              Direvisi BAK
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Lunas") ? "active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Lunas")}
                onChange={() => handleStatusFilterChange("Lunas")}
              />
              Lunas
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Ditolak BAK") ? "active" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Ditolak BAK")}
                onChange={() => handleStatusFilterChange("Ditolak BAK")}
              />
              Ditolak BAK
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Ditolak Wakil Rektor 2")
                  ? "active"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Ditolak Wakil Rektor 2")}
                onChange={() =>
                  handleStatusFilterChange("Ditolak Wakil Rektor 2")
                }
              />
              Ditolak Wakil Rektor 2
            </label>
            <label
              className={`chip ${
                selectedStatuses.includes("Revisi Ditolak Anggota")
                  ? "active"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes("Revisi Ditolak Anggota")}
                onChange={() =>
                  handleStatusFilterChange("Revisi Ditolak Anggota")
                }
              />
              Revisi Ditolak Anggota
            </label>
          </div>
        </div>

        <button
          className="filter-reset-btn"
          onClick={() => {
            setNameFilter("");
            setSelectedStatuses([
              "Menunggu Persetujuan BAK",
              "Menunggu Persetujuan Wakil Rektor 2",
              "Direvisi BAK",
              "Menunggu Transfer BAK",
              "Disetujui dan Aktif",
            ]);
            setStartDateFilter("");
            setEndDateFilter("");
          }}
        >
          Reset Filter
        </button>
      </div>

      {filteredLoans.length === 0 ? (
        <div className="no-data">Tidak ada data pinjaman</div>
      ) : (
        <div className="table-container">
          <table className="loans-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jumlah</th>
                <th>Pembayaran</th>
                <th>Tenor</th>
                <th>Tanggal Pengajuan</th>
                <th>Tanggal Selesai</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan) => {
                const isOverdue =
                  loan.status === "Disetujui dan Aktif" &&
                  isLoanOverdue(loan.tanggalDisetujui, loan.tenor);

                // Determine if the current user can take actions based on role and loan status
                const canApproveBAK =
                  userRole === "BAK" &&
                  loan.status === "Menunggu Persetujuan BAK";

                const canApproveWR1 =
                  userRole === "Wakil Rektor 2" &&
                  loan.status === "Menunggu Persetujuan Wakil Rektor 2";

                const canUploadProof =
                  userRole === "BAK" && loan.status === "Menunggu Transfer BAK";

                const canMakePayment =
                  loan.status === "Disetujui dan Aktif" &&
                  loan.jumlahMenyicil + 1 < loan.tenor;

                const canMarkComplete =
                  loan.status === "Disetujui dan Aktif" &&
                  loan.jumlahMenyicil + 1 >= loan.tenor;

                const isDirector = userRole === "Direktur";

                return (
                  <tr
                    key={loan.id}
                    onClick={() => setViewingLoan(loan)}
                    className={`clickable-row ${
                      isOverdue ? "overdue-row" : ""
                    }`}
                  >
                    <td>{loan.userData?.namaLengkap || "N/A"}</td>
                    <td>
                      Rp {loan.jumlahPinjaman?.toLocaleString("id-ID") || "0"}
                    </td>
                    <td>
                      {loan.status === "Disetujui dan Aktif" ||
                      loan.status === "Lunas"
                        ? `${loan.jumlahMenyicil || 0}/${loan.tenor}`
                        : "-"}
                    </td>
                    <td>{loan.tenor} bulan</td>
                    <td>{formatDate(loan.tanggalPengajuan)}</td>
                    <td className={isOverdue ? "overdue-text" : ""}>
                      {loan.tanggalDisetujui
                        ? calculateEndDate(loan.tanggalDisetujui, loan.tenor)
                        : "-"}
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(loan.status)}>
                        {loan.status}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        {/* BAK Approval Button */}
                        {(canApproveBAK || isDirector) &&
                          loan.status === "Menunggu Persetujuan BAK" && (
                            <button
                              className="approve-btn"
                              onClick={() =>
                                handleApprove(loan.id, loan.status)
                              }
                              title="Setujui"
                            >
                              ✓ Setujui
                            </button>
                          )}

                        {/* WR1 Approval Button */}
                        {(canApproveWR1 || isDirector) &&
                          loan.status ===
                            "Menunggu Persetujuan Wakil Rektor 2" && (
                            <button
                              className="approve-btn"
                              onClick={() =>
                                handleApprove(loan.id, loan.status)
                              }
                              title="Setujui"
                            >
                              ✓ Setujui
                            </button>
                          )}

                        {/* Rejection Button */}
                        {(canApproveBAK || canApproveWR1 || isDirector) &&
                          (loan.status === "Menunggu Persetujuan BAK" ||
                            loan.status ===
                              "Menunggu Persetujuan Wakil Rektor 2") && (
                            <button
                              className="reject-btn"
                              onClick={() =>
                                setSelectedLoan({ ...loan, action: "reject" })
                              }
                              title="Tolak"
                            >
                              ✕ Tolak
                            </button>
                          )}

                        {/* Revision Button */}
                        {(userRole === "BAK" || isDirector) &&
                          loan.status === "Menunggu Persetujuan BAK" && (
                            <button
                              className="revise-btn"
                              onClick={() =>
                                setSelectedLoan({ ...loan, action: "revise" })
                              }
                              title="Revisi Jumlah"
                            >
                              ⚙ Revisi
                            </button>
                          )}

                        {/* Upload Payment Proof Button */}
                        {canUploadProof && (
                          <button
                            className="upload-btn"
                            onClick={() => setPaymentProofLoan(loan)}
                            title="Upload Bukti Transfer"
                          >
                            📤 Upload
                          </button>
                        )}

                        {/* Payment Button */}
                        {canMakePayment && (
                          <button
                            className="payment-btn"
                            onClick={() => handleMakePayment(loan.id)}
                            title="Catat Cicilan"
                          >
                            💰 Cicil
                          </button>
                        )}

                        {/* Mark Complete Button */}
                        {canMarkComplete && (
                          <button
                            className="complete-btn"
                            onClick={() => handleMarkComplete(loan.id)}
                            title="Tandai Lunas"
                          >
                            ✔ Lunas
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection Modal */}
      {selectedLoan && selectedLoan.action === "reject" && (
        <RejectionModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onReject={handleReject}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
        />
      )}

      {/* Revision Modal */}
      {selectedLoan &&
        selectedLoan.action === "revise" &&
        (userRole === "BAK" || userRole === "Direktur") && (
          <RevisionModal
            loan={selectedLoan}
            onClose={() => setSelectedLoan(null)}
            onRevise={handleRevise}
            revisionAmount={revisionAmount}
            setRevisionAmount={setRevisionAmount}
            revisionTenor={revisionTenor}
            setRevisionTenor={setRevisionTenor}
          />
        )}

      {/* Loan Detail Modal */}
      {viewingLoan && (
        <LoanDetailModal
          loan={viewingLoan}
          onClose={() => setViewingLoan(null)}
          onMarkComplete={handleMarkComplete}
          onMakePayment={handleMakePayment}
        />
      )}

      {/* Payment Proof Upload Modal */}
      {paymentProofLoan && (
        <PaymentProofModal
          loan={paymentProofLoan}
          onClose={() => setPaymentProofLoan(null)}
          onUploadProof={handleUploadPaymentProof}
        />
      )}
    </div>
  );
};

export default SimpanPinjam;
