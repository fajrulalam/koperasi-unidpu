import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaSearch, FaCalendarAlt } from "react-icons/fa";
import "../styles/VoucherKoperasiPage.css";
import VoucherModal from "../components/VoucherModal";
import VoucherDetailModal from "../components/VoucherDetailModal";
import useVoucherKoperasi from "../components/hooks/useVoucherKoperasi";

const VoucherKoperasiPage = () => {
  // State
  const [showModal, setShowModal] = useState(false);
  const [selectedVoucherGroup, setSelectedVoucherGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });

  // Custom hook for voucher operations
  const {
    voucherGroups,
    loading,
    error,
    progress,
    fetchVoucherGroups,
    fetchVouchersByGroupId,
    fetchMembers,
    fetchFilterOptions,
    createVouchers,
    formatCurrency,
    parseCurrency
  } = useVoucherKoperasi();

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle date filter change
  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDateFilter({
      ...dateFilter,
      [name]: value
    });
  };

  // Open create voucher modal
  const handleOpenCreateModal = () => {
    setShowModal(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedVoucherGroup(null);
  };

  // Handle create vouchers
  const handleCreateVouchers = async (voucherData, selectedMembers) => {
    const success = await createVouchers(voucherData, selectedMembers);
    if (success && progress.percentage === 100) {
      setTimeout(() => {
        handleCloseModal();
      }, 1500); // Close modal after showing 100% completion for 1.5 seconds
    }
    return success;
  };

  // Open voucher group detail
  const handleOpenVoucherDetail = async (voucherGroup) => {
    setSelectedVoucherGroup(voucherGroup);
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Filter voucher groups based on search and date filters
  const filteredVoucherGroups = voucherGroups.filter(group => {
    // Search filter
    const matchesSearch = group.voucherName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date filter
    let matchesDate = true;
    if (dateFilter.startDate && group.activeDate) {
      const activeDate = group.activeDate.toDate ? group.activeDate.toDate() : new Date(group.activeDate);
      const startDate = new Date(dateFilter.startDate);
      matchesDate = matchesDate && activeDate >= startDate;
    }
    
    if (dateFilter.endDate && group.expireDate) {
      const expireDate = group.expireDate.toDate ? group.expireDate.toDate() : new Date(group.expireDate);
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59); // Set to end of day
      matchesDate = matchesDate && expireDate <= endDate;
    }
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="voucher-koperasi-page">
      <div className="page-header">
        <h1>Voucher Koperasi</h1>
        <button 
          className="create-button"
          onClick={handleOpenCreateModal}
        >
          <FaPlus /> Buat Voucher
        </button>
      </div>
      
      <div className="filters-container">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Cari voucher..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="date-filters">
          <div className="date-filter">
            <label><FaCalendarAlt /> Mulai:</label>
            <input
              type="date"
              name="startDate"
              value={dateFilter.startDate}
              onChange={handleDateFilterChange}
            />
          </div>
          
          <div className="date-filter">
            <label><FaCalendarAlt /> Sampai:</label>
            <input
              type="date"
              name="endDate"
              value={dateFilter.endDate}
              onChange={handleDateFilterChange}
            />
          </div>
        </div>
      </div>
      
      {loading && !showModal ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Memuat data voucher...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p>Terjadi kesalahan: {error}</p>
          <button onClick={fetchVoucherGroups}>Coba Lagi</button>
        </div>
      ) : (
        <div className="voucher-groups-container">
          {filteredVoucherGroups.length > 0 ? (
            <div className="voucher-groups-grid">
              {filteredVoucherGroups.map((group) => (
                <div 
                  key={group.id} 
                  className="voucher-group-card"
                  onClick={() => handleOpenVoucherDetail(group)}
                >
                  <div className="voucher-group-header">
                    <h3>{group.voucherName}</h3>
                    <span className="voucher-value">
                      Rp {formatCurrency(group.value)}
                    </span>
                  </div>
                  
                  <div className="voucher-group-details">
                    <div className="detail-item">
                      <span className="label">Aktif:</span>
                      <span className="value">{formatDate(group.activeDate)}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="label">Kadaluarsa:</span>
                      <span className="value">{formatDate(group.expireDate)}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="label">Total Voucher:</span>
                      <span className="value">{group.totalVouchers || 0}</span>
                    </div>
                  </div>
                  
                  <div className="voucher-group-footer">
                    <button className="edit-button">
                      <FaEdit /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>Tidak ada voucher yang ditemukan</p>
              {searchTerm || dateFilter.startDate || dateFilter.endDate ? (
                <p>Coba ubah filter pencarian</p>
              ) : (
                <button 
                  className="create-button"
                  onClick={handleOpenCreateModal}
                >
                  <FaPlus /> Buat Voucher Baru
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Create Voucher Modal */}
      {showModal && (
        <VoucherModal
          onClose={handleCloseModal}
          onCreateVouchers={handleCreateVouchers}
          fetchMembers={fetchMembers}
          fetchFilterOptions={fetchFilterOptions}
          formatCurrency={formatCurrency}
          parseCurrency={parseCurrency}
          progress={progress}
        />
      )}
      
      {/* Voucher Detail Modal */}
      {selectedVoucherGroup && (
        <VoucherDetailModal
          voucherGroup={selectedVoucherGroup}
          onClose={() => setSelectedVoucherGroup(null)}
          fetchVouchersByGroupId={fetchVouchersByGroupId}
          fetchMembers={fetchMembers}
          fetchFilterOptions={fetchFilterOptions}
          formatCurrency={formatCurrency}
          parseCurrency={parseCurrency}
        />
      )}
    </div>
  );
};

export default VoucherKoperasiPage;
