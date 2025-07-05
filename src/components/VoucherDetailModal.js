import React, { useState, useEffect } from "react";
import { 
  FaTimes, 
  FaPlus, 
  FaSave, 
  FaTrash, 
  FaUserPlus,
  FaEdit 
} from "react-icons/fa";
import "../styles/VoucherDetailModal.css";
import { db, getEnvironmentDoc } from "../firebase";
import { 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  setDoc 
} from "firebase/firestore";

const VoucherDetailModal = ({
  voucherGroup,
  onClose,
  fetchVouchersByGroupId,
  fetchMembers,
  fetchFilterOptions,
  formatCurrency,
  parseCurrency
}) => {
  // State
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [filters, setFilters] = useState({
    kantor: [],
    satuanKerja: []
  });
  const [filterOptions, setFilterOptions] = useState({
    kantorOptions: [],
    satuanKerjaOptions: []
  });
  const [editedGroup, setEditedGroup] = useState({
    voucherName: voucherGroup.voucherName,
    value: formatCurrency(voucherGroup.value),
    activeDate: "",
    expireDate: "",
    isActive: true
  });
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });

  // Load vouchers on mount
  useEffect(() => {
    const loadVouchers = async () => {
      setLoading(true);
      try {
        const voucherData = await fetchVouchersByGroupId(voucherGroup.voucherGroupId);
        setVouchers(voucherData);
        
        // Set dates for editing
        if (voucherGroup.activeDate) {
          const activeDate = voucherGroup.activeDate.toDate ? 
            voucherGroup.activeDate.toDate() : 
            new Date(voucherGroup.activeDate);
          
          setEditedGroup(prev => ({
            ...prev,
            activeDate: formatDateForInput(activeDate)
          }));
        }
        
        if (voucherGroup.expireDate) {
          const expireDate = voucherGroup.expireDate.toDate ? 
            voucherGroup.expireDate.toDate() : 
            new Date(voucherGroup.expireDate);
          
          setEditedGroup(prev => ({
            ...prev,
            expireDate: formatDateForInput(expireDate)
          }));
        }
      } catch (err) {
        console.error("Error loading vouchers:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadVouchers();
  }, [voucherGroup, fetchVouchersByGroupId]);

  // Load available members and filter options when add member modal is shown
  useEffect(() => {
    if (showAddMemberModal) {
      const loadMembersData = async () => {
        try {
          const options = await fetchFilterOptions();
          setFilterOptions(options);
          
          // Get all members
          const allMembers = await fetchMembers();
          
          // Filter out members who already have this voucher
          const existingUserIds = vouchers.map(voucher => voucher.userId);
          const filteredMembers = allMembers.filter(
            member => !existingUserIds.includes(member.id)
          );
          
          setAvailableMembers(filteredMembers);
        } catch (err) {
          console.error("Error loading members data:", err);
          setError(err.message);
        }
      };
      
      loadMembersData();
    }
  }, [showAddMemberModal, fetchFilterOptions, fetchMembers, vouchers]);

  // Format date for datetime-local input
  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  // Handle input change for editing group details
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === "value") {
      // Handle currency formatting
      const numericValue = value.replace(/\D/g, "");
      if (numericValue === "") {
        setEditedGroup({ ...editedGroup, [name]: "" });
      } else {
        setEditedGroup({ ...editedGroup, [name]: formatCurrency(numericValue) });
      }
    } else if (type === "checkbox") {
      setEditedGroup({ ...editedGroup, [name]: checked });
    } else {
      setEditedGroup({ ...editedGroup, [name]: value });
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  // Save edited group
  const saveEditedGroup = async () => {
    try {
      // Validate form
      if (!editedGroup.voucherName.trim()) {
        setError("Nama voucher harus diisi");
        return;
      }
      
      if (!editedGroup.value) {
        setError("Nilai voucher harus diisi");
        return;
      }
      
      if (!editedGroup.activeDate) {
        setError("Tanggal aktif harus diisi");
        return;
      }
      
      if (!editedGroup.expireDate) {
        setError("Tanggal kadaluarsa harus diisi");
        return;
      }
      
      if (new Date(editedGroup.expireDate) <= new Date(editedGroup.activeDate)) {
        setError("Tanggal kadaluarsa harus setelah tanggal aktif");
        return;
      }
      
      // Prepare data for update
      const updatedData = {
        voucherName: editedGroup.voucherName,
        value: parseCurrency(editedGroup.value),
        activeDate: new Date(editedGroup.activeDate),
        expireDate: new Date(editedGroup.expireDate),
        isActive: editedGroup.isActive,
        updatedAt: serverTimestamp()
      };
      
      // Update voucher group and all related vouchers
      const groupRef = doc(db, "voucherGroup", voucherGroup.id);
      await updateDoc(groupRef, updatedData);
      
      // Update all vouchers in this group
      const updatePromises = vouchers.map(voucher => {
        const voucherRef = doc(db, "vouchers", voucher.id);
        return updateDoc(voucherRef, {
          voucherName: updatedData.voucherName,
          value: updatedData.value,
          activeDate: updatedData.activeDate,
          expireDate: updatedData.expireDate,
          isActive: updatedData.isActive,
          updatedAt: serverTimestamp()
        });
      });
      
      await Promise.all(updatePromises);
      
      // Refresh vouchers
      const updatedVouchers = await fetchVouchersByGroupId(voucherGroup.voucherGroupId);
      setVouchers(updatedVouchers);
      
      // Exit edit mode
      setEditMode(false);
      setError(null);
    } catch (err) {
      console.error("Error updating voucher group:", err);
      setError(err.message);
    }
  };

  // Delete voucher
  const deleteVoucher = async (voucherId) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus voucher ini?")) {
      return;
    }
    
    try {
      const voucherRef = doc(db, "vouchers", voucherId);
      await deleteDoc(voucherRef);
      
      // Update vouchers list
      setVouchers(vouchers.filter(v => v.id !== voucherId));
      
      // Update total count in voucher group
      const groupRef = doc(db, "voucherGroup", voucherGroup.id);
      await updateDoc(groupRef, {
        totalVouchers: (voucherGroup.totalVouchers || vouchers.length) - 1,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error deleting voucher:", err);
      setError(err.message);
    }
  };

  // Toggle add member modal
  const toggleAddMemberModal = () => {
    setShowAddMemberModal(!showAddMemberModal);
    setSelectedMembers([]);
    setFilters({
      kantor: [],
      satuanKerja: []
    });
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    const updatedFilters = { ...filters };
    
    // Toggle the value in the filter array
    if (updatedFilters[filterType].includes(value)) {
      updatedFilters[filterType] = updatedFilters[filterType].filter(item => item !== value);
    } else {
      updatedFilters[filterType] = [...updatedFilters[filterType], value];
    }
    
    setFilters(updatedFilters);
    applyFilters(updatedFilters);
  };

  // Apply filters to available members
  const applyFilters = (currentFilters) => {
    // Get all members who don't already have this voucher
    const existingUserIds = vouchers.map(voucher => voucher.userId);
    
    fetchMembers(currentFilters).then(allMembers => {
      const filteredMembers = allMembers.filter(
        member => !existingUserIds.includes(member.id)
      );
      setAvailableMembers(filteredMembers);
    });
  };

  // Handle member selection
  const handleMemberSelection = (member) => {
    const isSelected = selectedMembers.some(selected => selected.id === member.id);
    
    if (isSelected) {
      setSelectedMembers(selectedMembers.filter(selected => selected.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  // Add selected members to voucher group
  const addMembersToVoucherGroup = async () => {
    if (selectedMembers.length === 0) {
      setError("Pilih minimal satu anggota");
      return;
    }
    
    try {
      setProgress({ current: 0, total: selectedMembers.length, percentage: 0 });
      
      // Create voucher documents for each selected member
      for (let i = 0; i < selectedMembers.length; i++) {
        const member = selectedMembers[i];
        
        // Create voucher document
        const voucherData = {
          voucherName: voucherGroup.voucherName,
          activeDate: voucherGroup.activeDate,
          expireDate: voucherGroup.expireDate,
          voucherGroupId: voucherGroup.voucherGroupId,
          value: voucherGroup.value,
          userId: member.id,
          nama: member.nama,
          kantor: member.kantor,
          satuanKerja: member.satuanKerja,
          isClaimed: false,
          isActive: true,
          createdAt: serverTimestamp()
        };
        
        // Add to vouchers collection
        const voucherRef = doc(db, "vouchers", `${voucherGroup.voucherGroupId}_${member.id}`);
        await setDoc(voucherRef, voucherData);
        
        // Update progress
        setProgress(prev => ({
          current: prev.current + 1,
          total: prev.total,
          percentage: Math.round(((prev.current + 1) / prev.total) * 100)
        }));
      }
      
      // Update total count in voucher group
      const groupRef = doc(db, "voucherGroup", voucherGroup.id);
      await updateDoc(groupRef, {
        totalVouchers: (voucherGroup.totalVouchers || vouchers.length) + selectedMembers.length,
        updatedAt: serverTimestamp()
      });
      
      // Refresh vouchers
      const updatedVouchers = await fetchVouchersByGroupId(voucherGroup.voucherGroupId);
      setVouchers(updatedVouchers);
      
      // Close add member modal
      setShowAddMemberModal(false);
      setSelectedMembers([]);
    } catch (err) {
      console.error("Error adding members to voucher group:", err);
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {editMode ? "Edit Voucher" : voucherGroup.voucherName}
          </h2>
          <div className="modal-actions">
            {!editMode && (
              <button className="edit-button" onClick={toggleEditMode}>
                <FaEdit /> Edit
              </button>
            )}
            <button className="close-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Memuat data voucher...</p>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <>
              {/* Voucher Group Details */}
              <div className="voucher-group-details">
                {editMode ? (
                  // Edit Form
                  <div className="edit-form">
                    <div className="form-group">
                      <label htmlFor="voucherName">Nama Voucher</label>
                      <input
                        type="text"
                        id="voucherName"
                        name="voucherName"
                        value={editedGroup.voucherName}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="value">Nilai Voucher (Rp)</label>
                      <input
                        type="text"
                        id="value"
                        name="value"
                        value={editedGroup.value}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="activeDate">Tanggal Aktif</label>
                      <input
                        type="datetime-local"
                        id="activeDate"
                        name="activeDate"
                        value={editedGroup.activeDate}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="expireDate">Tanggal Kadaluarsa</label>
                      <input
                        type="datetime-local"
                        id="expireDate"
                        name="expireDate"
                        value={editedGroup.expireDate}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group checkbox-group">
                      <input
                        type="checkbox"
                        id="isActive"
                        name="isActive"
                        checked={editedGroup.isActive}
                        onChange={handleInputChange}
                      />
                      <label htmlFor="isActive">Aktif</label>
                    </div>
                    
                    <div className="edit-actions">
                      <button 
                        className="button-secondary" 
                        onClick={toggleEditMode}
                      >
                        Batal
                      </button>
                      <button 
                        className="button-primary" 
                        onClick={saveEditedGroup}
                      >
                        <FaSave /> Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Details
                  <div className="details-view">
                    <div className="detail-row">
                      <span className="detail-label">Nama Voucher:</span>
                      <span className="detail-value">{voucherGroup.voucherName}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Nilai:</span>
                      <span className="detail-value">Rp {formatCurrency(voucherGroup.value)}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Tanggal Aktif:</span>
                      <span className="detail-value">{formatDate(voucherGroup.activeDate)}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Tanggal Kadaluarsa:</span>
                      <span className="detail-value">{formatDate(voucherGroup.expireDate)}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge ${voucherGroup.isActive ? 'active' : 'inactive'}`}>
                        {voucherGroup.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Total Voucher:</span>
                      <span className="detail-value">{vouchers.length}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Vouchers List */}
              <div className="vouchers-section">
                <div className="section-header">
                  <h3>Daftar Voucher</h3>
                  <button 
                    className="add-member-button"
                    onClick={toggleAddMemberModal}
                  >
                    <FaUserPlus /> Tambah Anggota
                  </button>
                </div>
                
                <div className="table-container">
                  <table className="vouchers-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Kantor</th>
                        <th>Satuan Kerja</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.length > 0 ? (
                        vouchers.map((voucher) => (
                          <tr key={voucher.id}>
                            <td>{voucher.nama}</td>
                            <td>{voucher.kantor}</td>
                            <td>{voucher.satuanKerja}</td>
                            <td>
                              <span className={`claim-status ${voucher.isClaimed ? 'claimed' : 'unclaimed'}`}>
                                {voucher.isClaimed ? 'Digunakan' : 'Belum Digunakan'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="delete-button"
                                onClick={() => deleteVoucher(voucher.id)}
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="no-data">
                            Tidak ada voucher yang ditemukan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="inner-modal-overlay" onClick={toggleAddMemberModal}>
          <div className="inner-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="inner-modal-header">
              <h3>Tambah Anggota</h3>
              <button className="close-button" onClick={toggleAddMemberModal}>
                <FaTimes />
              </button>
            </div>
            
            <div className="inner-modal-body">
              <div className="filters">
                <div className="filter-group">
                  <label>Kantor:</label>
                  <div className="dropdown">
                    <button className="dropdown-toggle">
                      {filters.kantor.length > 0 
                        ? `${filters.kantor.length} dipilih` 
                        : "Semua Kantor"}
                    </button>
                    <div className="dropdown-menu">
                      {filterOptions.kantorOptions.map((kantor) => (
                        <div key={kantor} className="dropdown-item">
                          <input
                            type="checkbox"
                            id={`kantor-${kantor}`}
                            checked={filters.kantor.includes(kantor)}
                            onChange={() => handleFilterChange("kantor", kantor)}
                          />
                          <label htmlFor={`kantor-${kantor}`}>{kantor}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="filter-group">
                  <label>Satuan Kerja:</label>
                  <div className="dropdown">
                    <button className="dropdown-toggle">
                      {filters.satuanKerja.length > 0 
                        ? `${filters.satuanKerja.length} dipilih` 
                        : "Semua Satuan Kerja"}
                    </button>
                    <div className="dropdown-menu">
                      {filterOptions.satuanKerjaOptions.map((satuanKerja) => (
                        <div key={satuanKerja} className="dropdown-item">
                          <input
                            type="checkbox"
                            id={`satuanKerja-${satuanKerja}`}
                            checked={filters.satuanKerja.includes(satuanKerja)}
                            onChange={() => handleFilterChange("satuanKerja", satuanKerja)}
                          />
                          <label htmlFor={`satuanKerja-${satuanKerja}`}>{satuanKerja}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="table-container">
                <table className="members-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Nama</th>
                      <th>Kantor</th>
                      <th>Satuan Kerja</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableMembers.length > 0 ? (
                      availableMembers.map((member) => (
                        <tr 
                          key={member.id}
                          className={selectedMembers.some(selected => selected.id === member.id) ? "selected" : ""}
                          onClick={() => handleMemberSelection(member)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedMembers.some(selected => selected.id === member.id)}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>{member.nama}</td>
                          <td>{member.kantor}</td>
                          <td>{member.satuanKerja}</td>
                          <td>{member.membershipStatus}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="no-data">
                          Tidak ada anggota yang ditemukan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="selection-info">
                {selectedMembers.length} dari {availableMembers.length} anggota dipilih
              </div>
            </div>
            
            <div className="inner-modal-footer">
              <button 
                className="button-secondary" 
                onClick={toggleAddMemberModal}
              >
                Batal
              </button>
              <button 
                className="button-primary" 
                onClick={addMembersToVoucherGroup}
                disabled={selectedMembers.length === 0}
              >
                <FaPlus /> Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherDetailModal;
