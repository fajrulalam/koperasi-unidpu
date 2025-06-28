// src/components/DaftarAnggotaBaru.js
import React, { useState } from "react";
import "../styles/DaftarAnggotaBaru.css";
import useDaftarAnggota from "./hooks/useDaftarAnggota";
import ImportMembersModal from "./ImportMembersModal";
import ViewMemberModal from "./ViewMemberModal";
import AddMemberModal from "./AddMemberModal";
import EditMemberModal from "./EditMemberModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { updateAllUsersWithMemberNumbers } from "../utils/memberNumberUtils";

const DaftarAnggotaBaru = ({ isProduction = true }) => {
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Function to handle batch member number update
  const handleGenerateMemberNumbers = async () => {
    const confirmUpdate = window.confirm(
      "Apakah Anda yakin ingin membuat nomor anggota untuk semua anggota yang belum memiliki nomor? Proses ini mungkin membutuhkan waktu beberapa saat."
    );

    if (!confirmUpdate) return;

    setIsBatchUpdating(true);
    try {
      const result = await updateAllUsersWithMemberNumbers();
      alert(
        `Berhasil! ${result.updatedCount} anggota telah diberi nomor anggota.`
      );
      // Refresh the member list to show the new member numbers
      window.location.reload();
    } catch (error) {
      console.error("Error updating member numbers:", error);
      alert(`Gagal mengupdate nomor anggota: ${error.message}`);
    } finally {
      setIsBatchUpdating(false);
    }
  };
  const {
    // State
    members,
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
              opacity: isBatchUpdating ? 0.7 : 1
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
                {/* <th>Iuran Pokok</th> */}
                {/* <th>Iuran Wajib</th> */}
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
                  {/* <td>{formatCurrency(member.iuranPokok)}</td> */}
                  {/* <td>{formatCurrency(member.iuranWajib)}</td> */}
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
    </div>
  );
};

export default DaftarAnggotaBaru;
