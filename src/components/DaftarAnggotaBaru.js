// src/components/DaftarAnggotaBaru.js
import React, { useState } from "react";
import "../styles/DaftarAnggotaBaru.css";
import useDaftarAnggota from "./hooks/useDaftarAnggota";
import ImportMembersModal from "./ImportMembersModal";
import ViewMemberModal from "./ViewMemberModal";
import AddMemberModal from "./AddMemberModal";
import EditMemberModal from "./EditMemberModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import NominalTabunganTooltip from "./NominalTabunganTooltip";
import { updateAllUsersWithMemberNumbers } from "../utils/memberNumberUtils";
import { 
  getNext5thOfMonth, 
  getIndonesianMonthName, 
  getNextPaymentInfo 
} from "../utils/memberBerandaUtils";
import { useAuth } from "../context/AuthContext";

const DaftarAnggotaBaru = ({ isProduction = true, setActivePage }) => {
  const [tooltipState, setTooltipState] = useState({
    isVisible: false,
    position: { x: 0, y: 0 },
    member: null
  });
  const { hasAccess } = useAuth();

  // Handle tooltip visibility
  const handleMouseEnter = (event, member) => {
    const rect = event.target.getBoundingClientRect();
    setTooltipState({
      isVisible: true,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      },
      member
    });
  };

  const handleMouseLeave = () => {
    setTooltipState({
      isVisible: false,
      position: { x: 0, y: 0 },
      member: null
    });
  };

  // Get next payment info for tooltip
  const getTooltipPaymentInfo = (member) => {
    // Check if member has Payroll Deduction payment status
    if (member.paymentStatus !== "Payroll Deduction") {
      return {
        amount: "Tidak ada",
        date: "-",
        description: "(bukan potong gaji)"
      };
    }

    if (member.paymentStatus === "Yayasan Subsidy") {
      return {
        amount: "Tidak ada",
        date: "-",
        description: "(subsidi yayasan)"
      };
    }

    const next5th = getNext5thOfMonth();
    const monthName = getIndonesianMonthName(next5th);
    const nextPaymentInfo = getNextPaymentInfo(member);
    
    return {
      amount: formatCurrency(nextPaymentInfo.amount),
      date: `5 ${monthName}`,
      description: nextPaymentInfo.description
    };
  };

  const {
    // State
    loading,
    error,
    selectedMember,
    showViewModal,
    showEditModal,
    showAddModal,
    showImportModal,
    showDeleteModal,
    actionLoading,
    searchTerm,
    statusFilter,
    editMemberData,
    newMemberData,
    filteredMembers,
    statusOptions,
    satuanKerjaOptions,
    importProgress,
    isImporting,
    selectedMembers,
    selectAllChecked,

    // Functions
    setSearchTerm,
    setStatusFilter,
    setShowAddModal,
    setShowViewModal,
    setShowEditModal,
    setShowImportModal,
    setShowDeleteModal,
    handleViewMember,
    handleEditMember,
    handleAddInputChange,
    handleEditInputChange,
    createNewMember,
    saveEditedMember,
    handleApproveReject,
    getWhatsAppUrl,
    formatCurrency,
    formatDate,
    formatCurrencyInput,
    importMembers,
    toggleMemberSelection,
    toggleSelectAll,
    bulkDeleteMembers,
  } = useDaftarAnggota(isProduction);

  if (loading) {
    return <div className="loading">Memuat data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="daftar-anggota-baru">
      <div className="header-with-button">
        <h2>Daftar Anggota</h2>
        <div className="header-buttons">
          <button
            className="import-csv-button"
            onClick={() => setShowImportModal(true)}
          >
            Import CSV
          </button>
          <button
            className="add-member-button"
            onClick={() => setShowAddModal(true)}
          >
            Tambah Anggota Baru
          </button>
          {hasAccess("TabunganLogs") && (
            <button
              className="tabungan-logs-button"
              onClick={() => setActivePage && setActivePage("TabunganLogs")}
            >
              Tabungan Logs
            </button>
          )}
          {/* <button
            className="generate-numbers-button"
            onClick={handleGenerateMemberNumbers}
            disabled={isBatchUpdating}
            style={{
              backgroundColor: "#4a6741",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: isBatchUpdating ? "not-allowed" : "pointer",
              opacity: isBatchUpdating ? 0.7 : 1,
            }}
          >
            {isBatchUpdating ? "Memproses..." : "Generate Nomor Anggota"}
          </button> */}
          {selectedMembers.length > 0 && (
            <button
              className="delete-members-button"
              onClick={() => setShowDeleteModal(true)}
            >
              Hapus ({selectedMembers.length})
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="filter-container">
        <div className="search-box">
          <input
            type="text"
            placeholder="Cari nama, whatsapp, kantor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="empty-state">
          <p>Tidak ada anggota yang ditemukan.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="members-table">
            <thead>
              <tr>
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={selectAllChecked}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Nama</th>
                <th>Kantor</th>
                <th>Satuan Kerja</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Nominal Tabungan</th>
                <th>Status Pembayaran</th>
                <th>Status Keanggotaan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                    />
                  </td>
                  <td>{member.nama || "-"}</td>
                  <td>{member.kantor || "-"}</td>
                  <td>{member.satuanKerja || "-"}</td>
                  <td>{member.nomorWhatsapp || "-"}</td>
                  <td>{member.email || "-"}</td>
                  <td 
                    className="nominal-tabungan-cell"
                    onMouseEnter={(e) => member.membershipStatus === "approved" ? handleMouseEnter(e, member) : null}
                    onMouseLeave={handleMouseLeave}
                  >
                    {member.membershipStatus === "approved" ? (
                      <span className="nominal-tabungan-amount">
                        {formatCurrency(member.nominalTabungan || 0)}
                      </span>
                    ) : (
                      <span className="nominal-tabungan-inactive">-</span>
                    )}
                  </td>
                  <td>{member.paymentStatus || "-"}</td>
                  <td>
                    <span
                      className={`status-badge ${member.membershipStatus?.toLowerCase()}`}
                    >
                      {member.membershipStatus || "-"}
                    </span>
                    {member.membershipStatus === "approved" && (
                      <div className="member-number">
                        No. Anggota:{" "}
                        {member.nomorAnggota ||
                          (member.id ? member.id.split("_").pop() : "-")}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {member.membershipStatus === "Pending" ? (
                        <button
                          className="review-button"
                          onClick={() => handleViewMember(member)}
                        >
                          Tinjau
                        </button>
                      ) : (
                        <button
                          className="edit-button"
                          onClick={() => handleEditMember(member)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Members Modal */}
      <ImportMembersModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={importMembers}
        importProgress={importProgress}
        totalRows={importProgress.total}
        currentRow={importProgress.current}
        isImporting={isImporting}
      />

      <ViewMemberModal
        isOpen={showViewModal}
        selectedMember={selectedMember}
        onClose={() => setShowViewModal(false)}
        onApproveReject={handleApproveReject}
        actionLoading={actionLoading}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        getWhatsAppUrl={getWhatsAppUrl}
      />

      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        newMemberData={newMemberData}
        onInputChange={handleAddInputChange}
        onCreateMember={createNewMember}
        actionLoading={actionLoading}
        satuanKerjaOptions={satuanKerjaOptions}
        formatCurrencyInput={formatCurrencyInput}
      />

      <EditMemberModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editMemberData={editMemberData}
        onInputChange={handleEditInputChange}
        onSave={saveEditedMember}
        actionLoading={actionLoading}
        satuanKerjaOptions={satuanKerjaOptions}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={bulkDeleteMembers}
        selectedMembers={selectedMembers}
        actionLoading={actionLoading}
      />

      {/* Nominal Tabungan Tooltip */}
      {tooltipState.member && (
        <NominalTabunganTooltip
          isVisible={tooltipState.isVisible}
          position={tooltipState.position}
          nextPaymentAmount={getTooltipPaymentInfo(tooltipState.member).amount}
          nextPaymentDate={getTooltipPaymentInfo(tooltipState.member).date}
          nextPaymentDescription={getTooltipPaymentInfo(tooltipState.member).description}
        />
      )}
    </div>
  );
};

export default DaftarAnggotaBaru;
