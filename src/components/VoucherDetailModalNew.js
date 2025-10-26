import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../context/EnvironmentContext';
import { voucherService } from '../services/voucherService';
import '../styles/VoucherDetailModalNew.css';

const VoucherDetailModalNew = ({ voucherGroup, onClose, onVoucherGroupUpdated }) => {
  const { isProduction } = useEnvironment();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('vouchers');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Edit form state
  const [editData, setEditData] = useState({
    voucherName: voucherGroup.voucherName,
    value: voucherService.formatNumber(voucherGroup.value),
    activeDate: '',
    expireDate: '',
    isActive: voucherGroup.isActive
  });

  // Add members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [memberFilters, setMemberFilters] = useState({
    kantor: [],
    satuanKerja: []
  });

  useEffect(() => {
    fetchVouchers();
    
    // Format dates for datetime-local input
    if (voucherGroup.activeDate) {
      const activeDate = voucherGroup.activeDate.toDate ? 
        voucherGroup.activeDate.toDate() : 
        new Date(voucherGroup.activeDate);
      setEditData(prev => ({
        ...prev,
        activeDate: activeDate.toISOString().slice(0, 16)
      }));
    }
    
    if (voucherGroup.expireDate) {
      const expireDate = voucherGroup.expireDate.toDate ? 
        voucherGroup.expireDate.toDate() : 
        new Date(voucherGroup.expireDate);
      setEditData(prev => ({
        ...prev,
        expireDate: expireDate.toISOString().slice(0, 16)
      }));
    }
  }, [voucherGroup, isProduction]);

  const handleDeleteVoucherGroup = async () => {
    try {
      setDeleting(true);
      setError(null);
      await voucherService.deleteVoucherGroup(voucherGroup.id, isProduction);
      
      // Close modal and refresh the parent component
      setShowDeleteConfirmation(false);
      onVoucherGroupUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting voucher group:', error);
      setError('Gagal menghapus grup voucher');
      setShowDeleteConfirmation(false);
      setDeleting(false);
    }
  };

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setError(null);
      const vouchersData = await voucherService.getVouchersByGroupId(voucherGroup.id, isProduction);
      setVouchers(vouchersData);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      setError('Gagal memuat data voucher');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMembers = async () => {
    try {
      const members = await voucherService.getMembers(isProduction);
      setAllMembers(members);
      
      // Filter out members who already have vouchers in this group
      const existingUserIds = vouchers.map(v => v.userId);
      const available = members.filter(member => !existingUserIds.includes(member.id));
      setAvailableMembers(available);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Gagal memuat data anggota');
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError(null);
  };

  const handleEditDataChange = (field, value) => {
    if (field === 'value') {
      const numericValue = value.replace(/[^\d]/g, '');
      const formattedValue = voucherService.formatNumber(numericValue);
      setEditData(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    } else {
      setEditData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const updateData = {
        voucherName: editData.voucherName,
        value: voucherService.parseCurrency(editData.value),
        activeDate: new Date(editData.activeDate),
        expireDate: new Date(editData.expireDate),
        isActive: editData.isActive
      };

      await voucherService.updateVoucherGroup(voucherGroup.id, updateData, isProduction);
      
      setIsEditing(false);
      onVoucherGroupUpdated();
    } catch (error) {
      console.error('Error updating voucher group:', error);
      setError('Gagal memperbarui voucher group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus voucher ini?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await voucherService.deleteVoucherFromGroup(voucherId, isProduction);
      await fetchVouchers();
      
      // Update voucher group total count
      const updatedVouchers = vouchers.filter(v => v.id !== voucherId);
      await voucherService.updateVoucherGroup(voucherGroup.id, {
        totalVouchers: updatedVouchers.length
      }, isProduction);
      
    } catch (error) {
      console.error('Error deleting voucher:', error);
      setError('Gagal menghapus voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembersToggle = () => {
    setShowAddMembers(!showAddMembers);
    if (!showAddMembers) {
      fetchAvailableMembers();
    }
  };

  const handleAddSelectedMembers = async () => {
    if (selectedNewMembers.length === 0) {
      setError('Pilih minimal satu anggota untuk ditambahkan');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await voucherService.addMembersToVoucherGroup(
        voucherGroup.id,
        selectedNewMembers,
        isProduction
      );
      
      setSelectedNewMembers([]);
      setShowAddMembers(false);
      await fetchVouchers();
      
    } catch (error) {
      console.error('Error adding members:', error);
      setError('Gagal menambahkan anggota');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = (member) => {
    const isSelected = selectedNewMembers.find(m => m.id === member.id);
    if (isSelected) {
      setSelectedNewMembers(selectedNewMembers.filter(m => m.id !== member.id));
    } else {
      setSelectedNewMembers([...selectedNewMembers, member]);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (voucher) => {
    const now = new Date();
    const activeDate = voucher.activeDate?.toDate ? voucher.activeDate.toDate() : new Date(voucher.activeDate);
    const expireDate = voucher.expireDate?.toDate ? voucher.expireDate.toDate() : new Date(voucher.expireDate);
    
    if (voucher.isClaimed) {
      return <span className="status-badge claimed">CLAIMED</span>;
    } else if (!voucher.isActive) {
      return <span className="status-badge inactive">TIDAK AKTIF</span>;
    } else if (now < activeDate) {
      return <span className="status-badge pending">BELUM AKTIF</span>;
    } else if (now > expireDate) {
      return <span className="status-badge expired">KEDALUWARSA</span>;
    } else {
      return <span className="status-badge active">AKTIF</span>;
    }
  };

  const renderVouchersTab = () => (
    <div>
      <div className="detail-section-voucherDetailModal">
        <div className="vouchers-actions-voucherDetailModal">
          <h4>Kelola Anggota</h4>
          <button 
            className="button-primary-voucherDetailModal"
            onClick={handleAddMembersToggle}
            disabled={loading}
          >
            {showAddMembers ? 'Batal' : 'Tambah Anggota'}
          </button>
        </div>

        {showAddMembers && (
          <div className="add-members-section-voucherDetailModal">
            <div className="detail-grid-voucherDetailModal">
              <div className="detail-item-voucherDetailModal" style={{ gridColumn: "span 2" }}>
                <span>Anggota Tersedia: {availableMembers.length} | Dipilih: {selectedNewMembers.length}</span>
              </div>
            </div>
            
            <div className="members-list-voucherDetailModal">
              {availableMembers.map(member => (
                <div key={member.id} className="member-item-voucherDetailModal">
                  <label className="checkbox-label-voucherDetailModal">
                    <input
                      type="checkbox"
                      checked={selectedNewMembers.find(m => m.id === member.id) ? true : false}
                      onChange={() => handleMemberSelect(member)}
                    />
                    <div className="member-info-voucherDetailModal">
                      <strong>{member.nama}</strong>
                      <span>{member.kantor} - {member.satuanKerja}</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
            
            <div className="add-members-actions-voucherDetailModal">
              <button 
                className="button-success-voucherDetailModal"
                onClick={handleAddSelectedMembers}
                disabled={loading || selectedNewMembers.length === 0}
              >
                Tambah {selectedNewMembers.length} Anggota
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="detail-section-voucherDetailModal">
        <h4>Daftar Voucher</h4>
        <div className="vouchers-table-voucherDetailModal">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kantor</th>
                <th>Satuan Kerja</th>
                <th>Nilai</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(voucher => (
                <tr key={voucher.id}>
                  <td>{voucher.nama}</td>
                  <td>{voucher.kantor}</td>
                  <td>{voucher.satuanKerja}</td>
                  <td>{voucherService.formatCurrency(voucher.value)}</td>
                  <td>{getStatusBadge(voucher)}</td>
                  <td>
                    <button 
                      className="button-danger-voucherDetailModal button-small-voucherDetailModal"
                      onClick={() => handleDeleteVoucher(voucher.id)}
                      disabled={loading}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
  <div className="detail-section-voucherDetailModal">
    <div className="settings-actions-voucherDetailModal">
      <h4>Pengaturan Voucher</h4>
      <div className="action-buttons-voucherDetailModal">
        <button 
          className={`button-${isEditing ? 'secondary' : 'primary'}-voucherDetailModal`}
          onClick={handleEditToggle}
          disabled={loading || deleting}
        >
          {isEditing ? 'Batal' : 'Edit'}
        </button>
        
        {isEditing && (
          <button 
            className="button-success-voucherDetailModal"
            onClick={handleSaveEdit}
            disabled={loading || deleting}
          >
            Simpan
          </button>
        )}
      </div>
    </div>

    <div className="detail-grid-voucherDetailModal">
      <div className="detail-item-voucherDetailModal">
        <span>Nama Voucher</span>
        {isEditing ? (
          <input
            type="text"
            value={editData.voucherName}
            onChange={(e) => handleEditDataChange('voucherName', e.target.value)}
          />
        ) : (
          <strong>{voucherGroup.voucherName}</strong>
        )}
      </div>

      <div className="detail-item-voucherDetailModal">
        <span>Nilai Voucher</span>
        {isEditing ? (
          <input
            type="text"
            value={editData.value}
            onChange={(e) => handleEditDataChange('value', e.target.value)}
          />
        ) : (
          <strong>{voucherService.formatCurrency(voucherGroup.value)}</strong>
        )}
      </div>

      <div className="detail-item-voucherDetailModal">
        <span>Tanggal Aktif</span>
        {isEditing ? (
          <input
            type="datetime-local"
            value={editData.activeDate}
            onChange={(e) => handleEditDataChange('activeDate', e.target.value)}
          />
        ) : (
          <strong>{formatDate(voucherGroup.activeDate)}</strong>
        )}
      </div>

      <div className="detail-item-voucherDetailModal">
        <span>Tanggal Berakhir</span>
        {isEditing ? (
          <input
            type="datetime-local"
            value={editData.expireDate}
            onChange={(e) => handleEditDataChange('expireDate', e.target.value)}
          />
        ) : (
          <strong>{formatDate(voucherGroup.expireDate)}</strong>
        )}
      </div>

      <div className="detail-item-voucherDetailModal">
        <span>Status</span>
        {isEditing ? (
          <select
            value={editData.isActive}
            onChange={(e) => handleEditDataChange('isActive', e.target.value === 'true')}
          >
            <option value="true">Aktif</option>
            <option value="false">Tidak Aktif</option>
          </select>
        ) : (
          <strong>{voucherGroup.isActive ? 'Aktif' : 'Tidak Aktif'}</strong>
        )}
      </div>
    </div>
    
    {/* Danger Zone Section */}
    <div className="danger-zone-section">
      <h4>Zona Berbahaya</h4>
      <div className="danger-zone-warning">
        <p>Tindakan di bawah ini tidak dapat dibatalkan. Harap berhati-hati!</p>
      </div>
      <div className="danger-zone-actions">
        <button 
          className="button-danger-voucherDetailModal"
          onClick={() => setShowDeleteConfirmation(true)}
          disabled={loading || deleting || isEditing}
        >
          Hapus Grup Voucher
        </button>
      </div>
    </div>
  </div>
);  

  return (
    <div className="modal-overlay-voucherDetailModal" onClick={onClose}>
      <div 
        className="modal-content-voucherDetailModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-voucherDetailModal">
          <h3>{voucherGroup.voucherName}</h3>
          <button className="modal-close-voucherDetailModal" onClick={onClose}>×</button>
        </div>

        <div className="modal-body-voucherDetailModal">
          <div className="detail-section-voucherDetailModal">
            <h4>Ringkasan Voucher</h4>
            <div className="detail-grid-voucherDetailModal">
              <div className="detail-item-voucherDetailModal">
                <span>Total Voucher</span>
                <strong>{vouchers.length}</strong>
              </div>
              <div className="detail-item-voucherDetailModal">
                <span>Terklaim</span>
                <strong>{vouchers.filter(v => v.isClaimed).length}</strong>
              </div>
              <div className="detail-item-voucherDetailModal">
                <span>Aktif/Kadaluarsa</span>
                <strong>
                  {vouchers.filter(v => !v.isClaimed && v.expireDate.toDate() > new Date()).length} / 
                  {vouchers.filter(v => !v.isClaimed && v.expireDate.toDate() <= new Date()).length}
                </strong>
              </div>
              <div className="detail-item-voucherDetailModal">
                <span>Nilai</span>
                <strong>{voucherService.formatCurrency(voucherGroup.value)}</strong>
              </div>
              <div className="detail-item-voucherDetailModal">
                <span>Dibuat</span>
                <strong>{formatDate(voucherGroup.createdAt)}</strong>
              </div>
            </div>
          </div>

          <div className="tab-navigation-voucherDetailModal">
            <button 
              className={`tab-button-voucherDetailModal ${activeTab === 'vouchers' ? 'active' : ''}`}
              onClick={() => setActiveTab('vouchers')}
            >
              Daftar Voucher
            </button>
            <button 
              className={`tab-button-voucherDetailModal ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Pengaturan
            </button>
          </div>

          {error && (
            <div className="error-message-voucherDetailModal">{error}</div>
          )}

          {loading && (
            <div className="loading-spinner-voucherDetailModal">Loading...</div>
          )}

          <div className="tab-content-voucherDetailModal">
            {activeTab === 'vouchers' && renderVouchersTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="confirmation-modal-overlay">
          <div className="confirmation-modal">
            <div className="confirmation-modal-header">
              <h4>Konfirmasi Hapus</h4>
            </div>
            <div className="confirmation-modal-body">
              <p>Anda yakin ingin menghapus grup voucher <strong>{voucherGroup.voucherName}</strong>?</p>
              <p>Semua voucher yang terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="confirmation-modal-footer">
              <button 
                className="button-secondary-voucherDetailModal"
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={deleting}
              >
                Batal
              </button>
              <button 
                className="button-danger-voucherDetailModal"
                onClick={handleDeleteVoucherGroup}
                disabled={deleting}
              >
                {deleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default VoucherDetailModalNew;