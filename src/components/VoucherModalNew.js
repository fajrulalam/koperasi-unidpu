import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../context/EnvironmentContext';
import { voucherService } from '../services/voucherService';
import '../styles/VoucherModalNew.css';

const VoucherModalNew = ({ onClose, onVoucherCreated }) => {
  const { isProduction } = useEnvironment();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Step 1: Voucher Settings
  const [voucherSettings, setVoucherSettings] = useState({
    voucherName: '',
    value: '',
    activeDate: '',
    expireDate: '',
    isActive: true,
    startNow: false
  });

  // Step 2: Member Selection
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [filters, setFilters] = useState({
    kantor: [],
    satuanKerja: []
  });
  const [selectAll, setSelectAll] = useState(false);
  const [kantorOptions, setKantorOptions] = useState([]);
  const [satuanKerjaOptions, setSatuanKerjaOptions] = useState([]);

  // Step 3: Progress
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (currentStep === 2) {
      fetchMembers();
    }
  }, [currentStep, isProduction]);

  useEffect(() => {
    if (members.length > 0) {
      const kantorSet = new Set(members.map(m => m.kantor).filter(Boolean));
      const satuanKerjaSet = new Set(members.map(m => m.satuanKerja).filter(Boolean));
      
      setKantorOptions(Array.from(kantorSet));
      setSatuanKerjaOptions(Array.from(satuanKerjaSet));
      
      applyFilters();
    }
  }, [members, filters]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const membersData = await voucherService.getMembers(isProduction);
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Gagal memuat data anggota');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = members;
    
    if (filters.kantor.length > 0) {
      filtered = filtered.filter(member => 
        filters.kantor.includes(member.kantor)
      );
    }
    
    if (filters.satuanKerja.length > 0) {
      filtered = filtered.filter(member => 
        filters.satuanKerja.includes(member.satuanKerja)
      );
    }
    
    setFilteredMembers(filtered);
    
    // Reset selections when filters change
    setSelectedMembers([]);
    setSelectAll(false);
  };

  const handleVoucherSettingsChange = (field, value) => {
    if (field === 'value') {
      // Format as currency
      const numericValue = value.replace(/[^\d]/g, '');
      const formattedValue = voucherService.formatNumber(numericValue);
      setVoucherSettings(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    } else if (field === 'startNow') {
      setVoucherSettings(prev => ({
        ...prev,
        [field]: value,
        activeDate: value ? new Date().toISOString().slice(0, 16) : ''
      }));
    } else {
      setVoucherSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers([...filteredMembers]);
    }
    setSelectAll(!selectAll);
  };

  const handleMemberSelect = (member) => {
    const isSelected = selectedMembers.find(m => m.id === member.id);
    if (isSelected) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const validateStep1 = () => {
    if (!voucherSettings.voucherName.trim()) {
      setError('Nama voucher harus diisi');
      return false;
    }
    if (!voucherSettings.value.trim()) {
      setError('Nilai voucher harus diisi');
      return false;
    }
    if (!voucherSettings.activeDate) {
      setError('Tanggal aktif harus diisi');
      return false;
    }
    if (!voucherSettings.expireDate) {
      setError('Tanggal berakhir harus diisi');
      return false;
    }
    
    const activeDate = new Date(voucherSettings.activeDate);
    const expireDate = new Date(voucherSettings.expireDate);
    
    if (expireDate <= activeDate) {
      setError('Tanggal berakhir harus setelah tanggal aktif');
      return false;
    }
    
    return true;
  };

  const validateStep2 = () => {
    if (selectedMembers.length === 0) {
      setError('Pilih minimal satu anggota');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(3);
        handleCreateVoucher();
      }
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(currentStep - 1);
  };

  const handleCreateVoucher = async () => {
    try {
      setIsCreating(true);
      setProgress({ current: 0, total: selectedMembers.length });
      
      const voucherData = {
        voucherName: voucherSettings.voucherName,
        value: voucherService.parseCurrency(voucherSettings.value),
        activeDate: new Date(voucherSettings.activeDate),
        expireDate: new Date(voucherSettings.expireDate),
        isActive: voucherSettings.isActive
      };

      const voucherGroupId = await voucherService.createVoucherGroup(
        voucherData,
        selectedMembers,
        isProduction,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      setTimeout(() => {
        onVoucherCreated();
      }, 1000);

    } catch (error) {
      console.error('Error creating voucher:', error);
      setError('Gagal membuat voucher');
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <div className="detail-section-voucherModal">
      <h4>Pengaturan Voucher</h4>
      <div className="detail-grid-voucherModal">
        <div className="detail-item-voucherModal">
          <label>Nama Voucher</label>
          <input
            type="text"
            value={voucherSettings.voucherName}
            onChange={(e) => handleVoucherSettingsChange('voucherName', e.target.value)}
            placeholder="Masukkan nama voucher"
          />
        </div>

        <div className="detail-item-voucherModal">
          <label>Nilai Voucher (Rp)</label>
          <input
            type="text"
            value={voucherSettings.value}
            onChange={(e) => handleVoucherSettingsChange('value', e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="detail-item-voucherModal" style={{ gridColumn: "span 2" }}>
          <label className="checkbox-label-voucherModal">
            <input
              type="checkbox"
              checked={voucherSettings.startNow}
              onChange={(e) => handleVoucherSettingsChange('startNow', e.target.checked)}
            />
            Mulai aktif sekarang
          </label>
        </div>

        {!voucherSettings.startNow && (
          <div className="detail-item-voucherModal">
            <label>Tanggal Aktif</label>
            <input
              type="datetime-local"
              value={voucherSettings.activeDate}
              onChange={(e) => handleVoucherSettingsChange('activeDate', e.target.value)}
            />
          </div>
        )}

        <div className="detail-item-voucherModal">
          <label>Tanggal Berakhir</label>
          <input
            type="datetime-local"
            value={voucherSettings.expireDate}
            onChange={(e) => handleVoucherSettingsChange('expireDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div className="detail-section-voucherModal">
        <h4>Filter Anggota</h4>
        <div className="detail-grid-voucherModal">
          <div className="detail-item-voucherModal">
            <label>Kantor</label>
            <select
              multiple
              value={filters.kantor}
              onChange={(e) => handleFilterChange('kantor', Array.from(e.target.selectedOptions, option => option.value))}
              className="filter-select-voucherModal"
            >
              {kantorOptions.map(kantor => (
                <option key={kantor} value={kantor}>{kantor}</option>
              ))}
            </select>
          </div>

          <div className="detail-item-voucherModal">
            <label>Satuan Kerja</label>
            <select
              multiple
              value={filters.satuanKerja}
              onChange={(e) => handleFilterChange('satuanKerja', Array.from(e.target.selectedOptions, option => option.value))}
              className="filter-select-voucherModal"
            >
              {satuanKerjaOptions.map(satuanKerja => (
                <option key={satuanKerja} value={satuanKerja}>{satuanKerja}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="detail-section-voucherModal">
        <div className="members-header-voucherModal">
          <h4>Pilih Anggota</h4>
          <div className="members-stats-voucherModal">
            <label className="checkbox-label-voucherModal">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
              />
              Pilih Semua ({filteredMembers.length} anggota)
            </label>
            <span className="selected-count-voucherModal">
              {selectedMembers.length} dipilih
            </span>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner-voucherModal">Memuat anggota...</div>
        ) : (
          <div className="members-table-voucherModal">
            <table>
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
                {filteredMembers.map(member => (
                  <tr key={member.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedMembers.find(m => m.id === member.id) ? true : false}
                        onChange={() => handleMemberSelect(member)}
                      />
                    </td>
                    <td>{member.nama}</td>
                    <td>{member.kantor}</td>
                    <td>{member.satuanKerja}</td>
                    <td>{member.membershipStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="detail-section-voucherModal">
      <h4>Proses Pembuatan Voucher</h4>
      <div className="progress-section-voucherModal">
        <div className="progress-info-voucherModal">
          <p>Sedang membuat voucher untuk {selectedMembers.length} anggota...</p>
        </div>
        
        <div className="progress-bar-voucherModal">
          <div 
            className="progress-fill-voucherModal"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          ></div>
        </div>
        
        <div className="progress-text-voucherModal">
          {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
        </div>
        
        {progress.current === progress.total && (
          <div className="success-message-voucherModal">
            ✅ Voucher berhasil dibuat!
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay-voucherModal" onClick={onClose}>
      <div 
        className="modal-content-voucherModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-voucherModal">
          <h3>Buat Voucher Baru</h3>
          <button 
            className="modal-close-voucherModal"
            onClick={onClose}
            disabled={isCreating}
          >
            ×
          </button>
        </div>

        <div className="modal-body-voucherModal">
          {/*<div className="step-indicator-voucherModal">*/}
          {/*  <div className={`step-voucherModal ${currentStep >= 1 ? 'active' : ''}`}>*/}
          {/*    <div className="step-number-voucherModal">1</div>*/}
          {/*    <div className="step-title-voucherModal">Pengaturan</div>*/}
          {/*  </div>*/}
          {/*  <div className={`step-voucherModal ${currentStep >= 2 ? 'active' : ''}`}>*/}
          {/*    <div className="step-number-voucherModal">2</div>*/}
          {/*    <div className="step-title-voucherModal">Pilih Anggota</div>*/}
          {/*  </div>*/}
          {/*  <div className={`step-voucherModal ${currentStep >= 3 ? 'active' : ''}`}>*/}
          {/*    <div className="step-number-voucherModal">3</div>*/}
          {/*    <div className="step-title-voucherModal">Buat Voucher</div>*/}
          {/*  </div>*/}
          {/*</div>*/}

          {error && (
            <div className="error-message-voucherModal">
              {error}
            </div>
          )}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <div className="modal-actions-voucherModal">
          {currentStep > 1 && currentStep < 3 && (
            <button 
              className="button-secondary-voucherModal"
              onClick={handleBack}
            >
              Kembali
            </button>
          )}
          
          <div className="action-buttons-voucherModal">
            {currentStep < 3 && (
              <button 
                className="button-primary-voucherModal"
                onClick={handleNext}
                disabled={loading}
              >
                {currentStep === 1 ? 'Lanjut' : 'Kirim Voucher'}
              </button>
            )}
            
            {currentStep === 3 && progress.current === progress.total && (
              <button 
                className="button-primary-voucherModal"
                onClick={onClose}
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherModalNew;