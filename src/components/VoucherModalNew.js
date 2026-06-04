import React, { useState, useEffect } from "react";
import { useEnvironment } from "../context/EnvironmentContext";
import { voucherService } from "../services/voucherService";
import "../styles/VoucherModalNew.css";

// Voucher type constants
const VOUCHER_TYPES = {
  MEMBER: "member",
  PRINT: "print",
  CAMPAIGN: "campaign",
};

const VoucherModalNew = ({ onClose, onVoucherCreated }) => {
  const { isProduction } = useEnvironment();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Voucher type - now supports three types
  const [voucherType, setVoucherType] = useState(VOUCHER_TYPES.MEMBER);

  // Form data
  const [formData, setFormData] = useState({
    voucherName: "",
    value: "",
    activeDate: "",
    expireDate: "",
    startNow: false,
    quantity: "",
    threshold: "",
    isOneTimeUse: true,
  });

  // Member selection
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ kantor: "", satuanKerja: "" });
  const [kantorOptions, setKantorOptions] = useState([]);
  const [satuanKerjaOptions, setSatuanKerjaOptions] = useState([]);

  // Progress
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (currentStep === 2) {
      fetchMembers();
    }
  }, [currentStep, isProduction]);

  useEffect(() => {
    if (members.length > 0) {
      const kantorSet = new Set(members.map((m) => m.kantor).filter(Boolean));
      const satuanKerjaSet = new Set(
        members.map((m) => m.satuanKerja).filter(Boolean)
      );
      setKantorOptions(Array.from(kantorSet).sort());
      setSatuanKerjaOptions(Array.from(satuanKerjaSet).sort());
      applyFilters();
    }
  }, [members, filters, searchQuery]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const membersData = await voucherService.getMembers(isProduction);
      setMembers(membersData);
    } catch (err) {
      setError("Gagal memuat data anggota");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = members;

    if (filters.kantor) {
      filtered = filtered.filter((m) => m.kantor === filters.kantor);
    }
    if (filters.satuanKerja) {
      filtered = filtered.filter((m) => m.satuanKerja === filters.satuanKerja);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.nama?.toLowerCase().includes(query));
    }

    setFilteredMembers(filtered);
  };

  const handleInputChange = (field, value) => {
    if (field === "value") {
      const numericValue = value.replace(/[^\d]/g, "");
      setFormData((prev) => ({
        ...prev,
        [field]: numericValue ? voucherService.formatNumber(numericValue) : "",
      }));
    } else if (field === "startNow") {
      setFormData((prev) => ({
        ...prev,
        startNow: value,
        activeDate: value ? new Date().toISOString().slice(0, 16) : "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const toggleMemberSelection = (member) => {
    const isSelected = selectedMembers.some((m) => m.id === member.id);
    if (isSelected) {
      setSelectedMembers(selectedMembers.filter((m) => m.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const selectAllVisible = () => {
    const visibleIds = new Set(filteredMembers.map((m) => m.id));
    const alreadySelected = selectedMembers.filter((m) => visibleIds.has(m.id));

    if (alreadySelected.length === filteredMembers.length) {
      setSelectedMembers(selectedMembers.filter((m) => !visibleIds.has(m.id)));
    } else {
      const newSelections = filteredMembers.filter(
        (m) => !selectedMembers.some((s) => s.id === m.id)
      );
      setSelectedMembers([...selectedMembers, ...newSelections]);
    }
  };

  const validateForm = () => {
    if (!formData.voucherName.trim()) {
      setError("Nama voucher harus diisi");
      return false;
    }
    if (!formData.value.trim()) {
      setError("Nilai voucher harus diisi");
      return false;
    }
    if (!formData.activeDate) {
      setError("Tanggal mulai harus diisi");
      return false;
    }
    if (!formData.expireDate) {
      setError("Tanggal berakhir harus diisi");
      return false;
    }
    if (new Date(formData.expireDate) <= new Date(formData.activeDate)) {
      setError("Tanggal berakhir harus setelah tanggal mulai");
      return false;
    }
    if (voucherType === VOUCHER_TYPES.PRINT) {
      const qty = parseInt(formData.quantity, 10);
      if (!qty || qty <= 0) {
        setError("Jumlah voucher harus lebih dari 0");
        return false;
      }
    }
    if (voucherType === VOUCHER_TYPES.CAMPAIGN) {
      if (!formData.threshold.trim()) {
        setError("Target belanja (threshold) harus diisi");
        return false;
      }
      const thresholdValue = voucherService.parseCurrency(formData.threshold);
      if (thresholdValue <= 0) {
        setError("Target belanja harus lebih dari 0");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && validateForm()) {
      if (voucherType === VOUCHER_TYPES.MEMBER) {
        setCurrentStep(2);
      } else {
        // For PRINT and CAMPAIGN types, skip member selection
        createVouchers();
      }
    } else if (currentStep === 2) {
      if (selectedMembers.length === 0) {
        setError("Pilih minimal satu anggota");
        return;
      }
      createVouchers();
    }
  };

  const createVouchers = async () => {
    setCurrentStep(3);
    setIsCreating(true);

    const voucherData = {
      voucherName: formData.voucherName,
      value: voucherService.parseCurrency(formData.value),
      activeDate: new Date(formData.activeDate),
      expireDate: new Date(formData.expireDate),
      isActive: true,
      isOneTimeUse: formData.isOneTimeUse,
    };

    try {
      if (voucherType === VOUCHER_TYPES.MEMBER) {
        setProgress({ current: 0, total: selectedMembers.length });
        await voucherService.createVoucherGroup(
          voucherData,
          selectedMembers,
          isProduction,
          (current, total) => setProgress({ current, total })
        );
      } else if (voucherType === VOUCHER_TYPES.PRINT) {
        const qty = parseInt(formData.quantity, 10);
        setProgress({ current: 0, total: qty });
        await voucherService.createNonMemberVoucherGroup(
          voucherData,
          qty,
          isProduction,
          (current, total) => setProgress({ current, total })
        );
      } else if (voucherType === VOUCHER_TYPES.CAMPAIGN) {
        // Campaign voucher - only creates the voucherGroup, not individual vouchers
        setProgress({ current: 0, total: 1 });
        const campaignData = {
          ...voucherData,
          threshold: voucherService.parseCurrency(formData.threshold),
        };
        await voucherService.createCashbackCampaign(
          campaignData,
          isProduction,
          (current, total) => setProgress({ current, total })
        );
      }
      setTimeout(onVoucherCreated, 800);
    } catch (err) {
      setError("Gagal membuat voucher");
      setIsCreating(false);
    }
  };

  const getStepLabel = () => {
    if (voucherType !== VOUCHER_TYPES.MEMBER) {
      return currentStep === 1 ? "Detail Voucher" : "Membuat Voucher";
    }
    if (currentStep === 1) return "Detail Voucher";
    if (currentStep === 2) return "Pilih Penerima";
    return "Membuat Voucher";
  };

  const getTotalSteps = () => (voucherType === VOUCHER_TYPES.MEMBER ? 3 : 2);

  const renderStepIndicator = () => (
    <div className="vm-steps">
      <div className="vm-steps-progress">
        <div
          className="vm-steps-fill"
          style={{
            width: `${((currentStep - 1) / (getTotalSteps() - 1)) * 100}%`,
          }}
        />
      </div>
      <div className="vm-steps-info">
        <span className="vm-steps-current">{getStepLabel()}</span>
        <span className="vm-steps-count">
          {currentStep} / {getTotalSteps()}
        </span>
      </div>
    </div>
  );

  const handleThresholdChange = (value) => {
    const numericValue = value.replace(/[^\d]/g, "");
    setFormData((prev) => ({
      ...prev,
      threshold: numericValue ? voucherService.formatNumber(numericValue) : "",
    }));
  };

  const renderVoucherForm = () => (
    <div className="vm-form">
      {/* Voucher Type Selector */}
      <div className="vm-type-selector vm-type-selector-three">
        <button
          type="button"
          className={`vm-type-btn ${
            voucherType === VOUCHER_TYPES.MEMBER ? "active" : ""
          }`}
          onClick={() => setVoucherType(VOUCHER_TYPES.MEMBER)}
        >
          <span className="vm-type-icon">👥</span>
          <span className="vm-type-label">Untuk Anggota</span>
          <span className="vm-type-desc">Kirim ke anggota terpilih</span>
        </button>
        <button
          type="button"
          className={`vm-type-btn ${
            voucherType === VOUCHER_TYPES.PRINT ? "active" : ""
          }`}
          onClick={() => setVoucherType(VOUCHER_TYPES.PRINT)}
        >
          <span className="vm-type-icon">🎫</span>
          <span className="vm-type-label">Voucher Cetak</span>
          <span className="vm-type-desc">Untuk distribusi manual</span>
        </button>
        <button
          type="button"
          className={`vm-type-btn vm-type-btn-campaign ${
            voucherType === VOUCHER_TYPES.CAMPAIGN ? "active" : ""
          }`}
          onClick={() => setVoucherType(VOUCHER_TYPES.CAMPAIGN)}
        >
          <span className="vm-type-icon">🎯</span>
          <span className="vm-type-label">Kampanye Cashback</span>
          <span className="vm-type-desc">Poin dari belanja</span>
        </button>
      </div>

      {/* Campaign Info Banner */}
      {voucherType === VOUCHER_TYPES.CAMPAIGN && (
        <div className="vm-campaign-info">
          <span className="vm-campaign-info-icon">💡</span>
          <div>
            <strong>Kampanye Cashback</strong>
            <p>
              Anggota mengumpulkan poin dari setiap transaksi. Setelah mencapai
              target belanja, mereka dapat klaim voucher.
            </p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="vm-fields">
        <div className="vm-field">
          <label>
            {voucherType === VOUCHER_TYPES.CAMPAIGN
              ? "Nama Kampanye"
              : "Nama Voucher"}
          </label>
          <input
            type="text"
            value={formData.voucherName}
            onChange={(e) => handleInputChange("voucherName", e.target.value)}
            placeholder={
              voucherType === VOUCHER_TYPES.CAMPAIGN
                ? "contoh: Promo Akhir Tahun 2025"
                : "contoh: Voucher Lebaran 2025"
            }
          />
        </div>

        <div className="vm-field-row">
          <div className="vm-field">
            <label>
              {voucherType === VOUCHER_TYPES.CAMPAIGN
                ? "Nilai Voucher Hadiah (Rp)"
                : "Nilai (Rp)"}
            </label>
            <input
              type="text"
              value={formData.value}
              onChange={(e) => handleInputChange("value", e.target.value)}
              placeholder="0"
            />
          </div>
          {voucherType === VOUCHER_TYPES.PRINT && (
            <div className="vm-field">
              <label>Jumlah Voucher</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleInputChange("quantity", e.target.value)}
                placeholder="0"
                min="1"
              />
            </div>
          )}
          {voucherType === VOUCHER_TYPES.CAMPAIGN && (
            <div className="vm-field">
              <label>Target Belanja (Rp)</label>
              <input
                type="text"
                value={formData.threshold}
                onChange={(e) => handleThresholdChange(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="vm-field">
          <label className="vm-checkbox">
            <input
              type="checkbox"
              checked={formData.startNow}
              onChange={(e) => handleInputChange("startNow", e.target.checked)}
            />
            <span>Aktifkan sekarang</span>
          </label>
        </div>

        <div className="vm-field-row">
          {!formData.startNow && (
            <div className="vm-field">
              <label>
                {voucherType === VOUCHER_TYPES.CAMPAIGN
                  ? "Kampanye Mulai"
                  : "Mulai Aktif"}
              </label>
              <input
                type="datetime-local"
                value={formData.activeDate}
                onChange={(e) =>
                  handleInputChange("activeDate", e.target.value)
                }
              />
            </div>
          )}
          <div className="vm-field">
            <label>
              {voucherType === VOUCHER_TYPES.CAMPAIGN
                ? "Kampanye Berakhir"
                : "Berakhir"}
            </label>
            <input
              type="datetime-local"
              value={formData.expireDate}
              onChange={(e) => handleInputChange("expireDate", e.target.value)}
            />
          </div>
        </div>

        {/* One-time use toggle - only for member vouchers */}
        {voucherType === VOUCHER_TYPES.MEMBER && (
          <div className="vm-field vm-toggle-field">
            <label className="vm-toggle">
              <input
                type="checkbox"
                checked={formData.isOneTimeUse}
                onChange={(e) =>
                  handleInputChange("isOneTimeUse", e.target.checked)
                }
              />
              <span className="vm-toggle-slider"></span>
              <span className="vm-toggle-label">Sekali Pakai</span>
            </label>
            <p className="vm-toggle-desc">
              {formData.isOneTimeUse
                ? "Voucher hangus setelah satu kali penggunaan"
                : "Saldo voucher berkurang setiap transaksi hingga habis"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderMemberSelection = () => {
    const allVisibleSelected =
      filteredMembers.length > 0 &&
      filteredMembers.every((m) => selectedMembers.some((s) => s.id === m.id));

    return (
      <div className="vm-members">
        {/* Search and Filters */}
        <div className="vm-members-toolbar">
          <div className="vm-search">
            <input
              type="text"
              placeholder="Cari nama anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="vm-filters">
            <select
              value={filters.kantor}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, kantor: e.target.value }))
              }
            >
              <option value="">Semua Kantor</option>
              {kantorOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              value={filters.satuanKerja}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, satuanKerja: e.target.value }))
              }
            >
              <option value="">Semua Satuan Kerja</option>
              {satuanKerjaOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection Summary */}
        <div className="vm-members-summary">
          <button
            type="button"
            className="vm-select-all"
            onClick={selectAllVisible}
          >
            {allVisibleSelected ? "Batal pilih semua" : "Pilih semua"}
          </button>
          <span className="vm-selected-count">
            <strong>{selectedMembers.length}</strong> anggota dipilih
          </span>
        </div>

        {/* Members List */}
        {loading ? (
          <div className="vm-loading">Memuat data anggota...</div>
        ) : (
          <div className="vm-members-list">
            {filteredMembers.length === 0 ? (
              <div className="vm-empty">Tidak ada anggota ditemukan</div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMembers.some(
                  (m) => m.id === member.id
                );
                return (
                  <div
                    key={member.id}
                    className={`vm-member-item ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleMemberSelection(member)}
                  >
                    <div className="vm-member-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="vm-member-info">
                      <span className="vm-member-name">{member.nama}</span>
                      <span className="vm-member-detail">
                        {member.kantor}
                        {member.satuanKerja && ` • ${member.satuanKerja}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProgress = () => {
    const percent =
      progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;
    const isComplete =
      progress.current === progress.total && progress.total > 0;

    const getProgressTitle = () => {
      if (isComplete) {
        if (voucherType === VOUCHER_TYPES.CAMPAIGN)
          return "Kampanye Berhasil Dibuat";
        return "Voucher Berhasil Dibuat";
      }
      if (voucherType === VOUCHER_TYPES.CAMPAIGN) return "Membuat Kampanye...";
      return "Membuat Voucher...";
    };

    const getProgressDescription = () => {
      if (isComplete) {
        if (voucherType === VOUCHER_TYPES.CAMPAIGN) {
          return "Kampanye cashback telah aktif dan siap digunakan";
        }
        return `${progress.total} voucher telah dibuat`;
      }
      if (voucherType === VOUCHER_TYPES.CAMPAIGN) {
        return "Menyiapkan kampanye cashback...";
      }
      return `Memproses ${progress.current} dari ${progress.total} voucher`;
    };

    return (
      <div className="vm-progress">
        <div className={`vm-progress-icon ${isComplete ? "complete" : ""}`}>
          {isComplete ? "✓" : "⏳"}
        </div>
        <h4>{getProgressTitle()}</h4>
        <p>{getProgressDescription()}</p>
        <div className="vm-progress-bar">
          <div className="vm-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="vm-progress-percent">{percent}%</span>
      </div>
    );
  };

  return (
    <div className="vm-overlay" onClick={onClose}>
      <div className="vm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vm-header">
          <h2>Buat Voucher</h2>
          <button
            className="vm-close"
            onClick={onClose}
            disabled={isCreating && progress.current !== progress.total}
          >
            ×
          </button>
        </div>

        {renderStepIndicator()}

        <div className="vm-body">
          {error && <div className="vm-error">{error}</div>}
          {currentStep === 1 && renderVoucherForm()}
          {currentStep === 2 && renderMemberSelection()}
          {currentStep === 3 && renderProgress()}
        </div>

        <div className="vm-footer">
          {currentStep === 2 && (
            <button
              className="vm-btn vm-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              Kembali
            </button>
          )}
          <div className="vm-footer-right">
            {currentStep < 3 && (
              <button
                className="vm-btn vm-btn-primary"
                onClick={handleNext}
                disabled={loading}
              >
                {currentStep === 1 &&
                  voucherType === VOUCHER_TYPES.MEMBER &&
                  "Pilih Anggota"}
                {currentStep === 1 &&
                  voucherType === VOUCHER_TYPES.PRINT &&
                  "Buat Voucher"}
                {currentStep === 1 &&
                  voucherType === VOUCHER_TYPES.CAMPAIGN &&
                  "Buat Kampanye"}
                {currentStep === 2 && "Buat Voucher"}
              </button>
            )}
            {currentStep === 3 &&
              progress.current === progress.total &&
              progress.total > 0 && (
                <button className="vm-btn vm-btn-primary" onClick={onClose}>
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
