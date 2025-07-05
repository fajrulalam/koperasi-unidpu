import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../context/EnvironmentContext';
import { voucherService } from '../services/voucherService';
import VoucherModalNew from '../components/VoucherModalNew';
import VoucherDetailModalNew from '../components/VoucherDetailModalNew';
import '../styles/VoucherKoperasiPageNew.css';

const VoucherKoperasiPageNew = () => {
  const { isProduction } = useEnvironment();
  const [voucherGroups, setVoucherGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVoucherGroup, setSelectedVoucherGroup] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVoucherGroups();
  }, [isProduction]);

  const fetchVoucherGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const groups = await voucherService.getVoucherGroups(isProduction);
      setVoucherGroups(groups);
    } catch (error) {
      console.error('Error fetching voucher groups:', error);
      setError('Gagal memuat data voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = () => {
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleVoucherCreated = () => {
    setShowCreateModal(false);
    fetchVoucherGroups();
  };

  const handleViewVoucherGroup = (voucherGroup) => {
    setSelectedVoucherGroup(voucherGroup);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedVoucherGroup(null);
  };

  const handleVoucherGroupUpdated = () => {
    setShowDetailModal(false);
    setSelectedVoucherGroup(null);
    fetchVoucherGroups();
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

  const getStatusBadge = (group) => {
    const now = new Date();
    const activeDate = group.activeDate?.toDate ? group.activeDate.toDate() : new Date(group.activeDate);
    const expireDate = group.expireDate?.toDate ? group.expireDate.toDate() : new Date(group.expireDate);
    
    if (!group.isActive) {
      return <span className="status-badge inactive">Tidak Aktif</span>;
    } else if (now < activeDate) {
      return <span className="status-badge pending">Belum Aktif</span>;
    } else if (now > expireDate) {
      return <span className="status-badge expired">Kedaluwarsa</span>;
    } else {
      return <span className="status-badge active">Aktif</span>;
    }
  };

  if (loading) {
    return (
      <div className="voucher-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Memuat data voucher...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voucher-page">
      <div className="voucher-header">
        <h1>Voucher Koperasi</h1>
        <button 
          className="btn-create-voucher" 
          onClick={handleCreateVoucher}
        >
          Buat Voucher
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchVoucherGroups} className="retry-button">
            Coba Lagi
          </button>
        </div>
      )}

      <div className="voucher-content">
        {voucherGroups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>Belum ada voucher</h3>
            <p>Klik tombol "Buat Voucher" untuk membuat voucher pertama</p>
          </div>
        ) : (
          <div className="voucher-grid">
            {voucherGroups.map((group) => (
              <div 
                key={group.id} 
                className="voucher-card"
                onClick={() => handleViewVoucherGroup(group)}
              >
                <div className="voucher-card-header">
                  <h3>{group.voucherName}</h3>
                  {getStatusBadge(group)}
                </div>
                
                <div className="voucher-card-content">
                  <div className="voucher-info">
                    <div className="voucher-info-item">
                      <span className="voucher-info-label">Nilai:</span>
                      <span className="voucher-info-value">{voucherService.formatCurrency(group.value)}</span>
                    </div>
                    <div className="voucher-info-item">
                      <span className="voucher-info-label">Total Voucher:</span>
                      <span className="voucher-info-value">{group.totalVouchers}</span>
                    </div>
                    <div className="voucher-info-item">
                      <span className="voucher-info-label">Aktif:</span>
                      <span className="voucher-info-value">{formatDate(group.activeDate)}</span>
                    </div>
                    <div className="voucher-info-item">
                      <span className="voucher-info-label">Berakhir:</span>
                      <span className="voucher-info-value">{formatDate(group.expireDate)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="voucher-card-footer">
                  <small>Dibuat: {formatDate(group.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <VoucherModalNew
          onClose={handleCloseCreateModal}
          onVoucherCreated={handleVoucherCreated}
        />
      )}

      {showDetailModal && selectedVoucherGroup && (
        <VoucherDetailModalNew
          voucherGroup={selectedVoucherGroup}
          onClose={handleCloseDetailModal}
          onVoucherGroupUpdated={handleVoucherGroupUpdated}
        />
      )}
    </div>
  );
};

export default VoucherKoperasiPageNew;