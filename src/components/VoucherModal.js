import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaCheck,
} from "react-icons/fa";
import "../styles/VoucherModal.css";

const VoucherModal = ({
  onClose,
  onCreateVouchers,
  fetchMembers,
  fetchFilterOptions,
  formatCurrency,
  parseCurrency,
  progress,
}) => {
  // Modal steps
  const STEPS = {
    SETTINGS: 0,
    MEMBERS: 1,
    PROCESSING: 2,
  };

  // State
  const [currentStep, setCurrentStep] = useState(STEPS.SETTINGS);
  const [voucherData, setVoucherData] = useState({
    voucherName: "",
    value: "",
    activeDate: "",
    expireDate: "",
    startNow: true,
  });
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    kantor: [],
    satuanKerja: [],
  });
  const [filterOptions, setFilterOptions] = useState({
    kantorOptions: [],
    satuanKerjaOptions: [],
  });
  const [formErrors, setFormErrors] = useState({});

  // Load data once on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const membersData = await fetchMembers();
        const kantorOptions = [
          ...new Set(
            membersData.map((member) => member.kantor).filter(Boolean)
          ),
        ];
        const satuanKerjaOptions = [
          ...new Set(
            membersData.map((member) => member.satuanKerja).filter(Boolean)
          ),
        ];

        setMembers(membersData);
        setFilterOptions({ kantorOptions, satuanKerjaOptions });
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchMembers]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "value") {
      const numericValue = value.replace(/\D/g, "");
      if (numericValue === "") {
        setVoucherData((prev) => ({ ...prev, [name]: "" }));
      } else {
        setVoucherData((prev) => ({
          ...prev,
          [name]: formatCurrency(numericValue),
        }));
      }
    } else if (type === "checkbox") {
      setVoucherData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setVoucherData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!voucherData.voucherName.trim()) {
      errors.voucherName = "Nama voucher harus diisi";
    }

    if (!voucherData.value) {
      errors.value = "Nilai voucher harus diisi";
    }

    if (!voucherData.startNow && !voucherData.activeDate) {
      errors.activeDate = "Tanggal aktif harus diisi";
    }

    if (!voucherData.expireDate) {
      errors.expireDate = "Tanggal kadaluarsa harus diisi";
    } else if (
      voucherData.activeDate &&
      new Date(voucherData.expireDate) <= new Date(voucherData.activeDate)
    ) {
      errors.expireDate = "Tanggal kadaluarsa harus setelah tanggal aktif";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle next step
  const handleNextStep = () => {
    if (currentStep === STEPS.SETTINGS) {
      if (validateForm()) {
        setCurrentStep(STEPS.MEMBERS);
      }
    } else if (currentStep === STEPS.MEMBERS) {
      if (selectedMembers.length > 0) {
        setCurrentStep(STEPS.PROCESSING);
        handleCreateVouchers();
      } else {
        setFormErrors({ members: "Pilih minimal satu anggota" });
      }
    }
  };

  // Handle previous step
  const handlePrevStep = () => {
    if (currentStep > STEPS.SETTINGS) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Filter members based on selected filters
  const filteredMembers = useMemo(() => {
    if (!members.length) return [];

    return members.filter((member) => {
      const matchesKantor =
        filters.kantor.length === 0 || filters.kantor.includes(member.kantor);
      const matchesSatuanKerja =
        filters.satuanKerja.length === 0 ||
        filters.satuanKerja.includes(member.satuanKerja);
      return matchesKantor && matchesSatuanKerja;
    });
  }, [members, filters]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => {
      const current = prev[filterType];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      return { ...prev, [filterType]: updated };
    });
  }, []);

  // Handle member selection
  const handleMemberSelection = useCallback((member) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.some((selected) => selected.id === member.id);
      return isSelected
        ? prev.filter((selected) => selected.id !== member.id)
        : [...prev, member];
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      // Deselect all filtered members
      setSelectedMembers((prev) =>
        prev.filter(
          (selected) =>
            !filteredMembers.some((member) => member.id === selected.id)
        )
      );
    } else {
      // Select all filtered members
      setSelectedMembers((prev) => {
        const selectedIds = new Set(prev.map((m) => m.id));
        const newSelections = filteredMembers.filter(
          (member) => !selectedIds.has(member.id)
        );
        return [...prev, ...newSelections];
      });
    }
  }, [selectAll, filteredMembers]);

  // Update selectAll state
  useEffect(() => {
    if (filteredMembers.length === 0) {
      setSelectAll(false);
    } else {
      const selectedIds = new Set(selectedMembers.map((m) => m.id));
      setSelectAll(
        filteredMembers.every((member) => selectedIds.has(member.id))
      );
    }
  }, [filteredMembers, selectedMembers]);

  // Create vouchers
  const handleCreateVouchers = async () => {
    try {
      const parsedVoucherData = {
        ...voucherData,
        value: parseCurrency(voucherData.value),
      };

      await onCreateVouchers(parsedVoucherData, selectedMembers);
    } catch (error) {
      console.error("Error creating vouchers:", error);
      setCurrentStep(STEPS.MEMBERS);
    }
  };

  // Render voucher settings form
  const renderSettingsForm = () => (
    <div className="detail-section-voucherModal">
      <h4>Informasi Voucher</h4>
      <div className="voucher-form">
        <div className="form-group">
          <label htmlFor="voucherName">Nama Voucher</label>
          <input
            type="text"
            id="voucherName"
            name="voucherName"
            value={voucherData.voucherName}
            onChange={handleInputChange}
            className={formErrors.voucherName ? "error" : ""}
          />
          {formErrors.voucherName && (
            <span className="error-message">{formErrors.voucherName}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="value">Nilai Voucher (Rp)</label>
          <input
            type="text"
            id="value"
            name="value"
            value={voucherData.value}
            onChange={handleInputChange}
            className={formErrors.value ? "error" : ""}
          />
          {formErrors.value && (
            <span className="error-message">{formErrors.value}</span>
          )}
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="startNow"
            name="startNow"
            checked={voucherData.startNow}
            onChange={handleInputChange}
          />
          <label htmlFor="startNow">
            Aktifkan voucher segera setelah dibuat
          </label>
        </div>

        {!voucherData.startNow && (
          <div className="form-group">
            <label htmlFor="activeDate">Tanggal Aktif</label>
            <input
              type="datetime-local"
              id="activeDate"
              name="activeDate"
              value={voucherData.activeDate}
              onChange={handleInputChange}
              className={formErrors.activeDate ? "error" : ""}
            />
            {formErrors.activeDate && (
              <span className="error-message">{formErrors.activeDate}</span>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="expireDate">Tanggal Kadaluarsa</label>
          <input
            type="datetime-local"
            id="expireDate"
            name="expireDate"
            value={voucherData.expireDate}
            onChange={handleInputChange}
            className={formErrors.expireDate ? "error" : ""}
          />
          {formErrors.expireDate && (
            <span className="error-message">{formErrors.expireDate}</span>
          )}
        </div>
      </div>
    </div>
  );

  // Render member selection table
  const renderMemberSelection = () => (
    <div className="detail-section-voucherModal">
      <h4>Pilih Penerima Voucher</h4>
      <div className="member-selection">
        {loading ? (
          <div className="loading">
            <p>Loading members data...</p>
          </div>
        ) : (
          <>
            <div className="filters">
              <div className="filter-group">
                <label>Filter Kantor:</label>
                <div className="dropdown">
                  <button className="dropdown-toggle">Pilih Kantor</button>
                  <div className="dropdown-menu">
                    {filterOptions.kantorOptions.map((kantor) => (
                      <div
                        key={kantor}
                        className="dropdown-item"
                        onClick={() => handleFilterChange("kantor", kantor)}
                      >
                        <input
                          type="checkbox"
                          checked={filters.kantor.includes(kantor)}
                          readOnly
                        />
                        {kantor}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="filter-group">
                <label>Filter Satuan Kerja:</label>
                <div className="dropdown">
                  <button className="dropdown-toggle">
                    Pilih Satuan Kerja
                  </button>
                  <div className="dropdown-menu">
                    {filterOptions.satuanKerjaOptions.map((satuanKerja) => (
                      <div
                        key={satuanKerja}
                        className="dropdown-item"
                        onClick={() =>
                          handleFilterChange("satuanKerja", satuanKerja)
                        }
                      >
                        <input
                          type="checkbox"
                          checked={filters.satuanKerja.includes(satuanKerja)}
                          readOnly
                        />
                        {satuanKerja}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="members-table" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Nama</th>
                    <th>Kantor</th>
                    <th>Satuan Kerja</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => {
                      const isSelected = selectedMembers.some(
                        (selected) => selected.id === member.id
                      );
                      return (
                        <tr
                          key={member.id}
                          className={isSelected ? "selected" : ""}
                          onClick={() => handleMemberSelection(member)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.nama}
                          </td>
                          <td
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.kantor}
                          </td>
                          <td
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.satuanKerja}
                          </td>
                          <td
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.membershipStatus}
                          </td>
                        </tr>
                      );
                    })
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
              {selectedMembers.length} dari {filteredMembers.length} anggota
              dipilih
              {formErrors.members && (
                <span className="error-message">{formErrors.members}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render processing screen
  const renderProcessing = () => (
    <div className="detail-section-voucherModal">
      <h4>Proses Pembuatan Voucher</h4>
      <div className="processing">
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>

        <div className="progress-text">
          {progress.current}/{progress.total} ({progress.percentage}%)
        </div>

        <div className="progress-status">
          {progress.percentage < 100
            ? "Sedang membuat voucher..."
            : "Pembuatan voucher selesai!"}
        </div>
      </div>
    </div>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.SETTINGS:
        return renderSettingsForm();
      case STEPS.MEMBERS:
        return renderMemberSelection();
      case STEPS.PROCESSING:
        return renderProcessing();
      default:
        return null;
    }
  };

  // Render navigation buttons
  const renderNavButtons = () => {
    if (currentStep === STEPS.PROCESSING) {
      return null;
    }

    return (
      <div className="modal-actions-voucherModal">
        {currentStep > STEPS.SETTINGS && (
          <button
            className="button-secondary-voucherModal"
            onClick={handlePrevStep}
          >
            <FaChevronLeft /> Kembali
          </button>
        )}

        <div className="action-buttons-voucherModal">
          <button
            className="button-primary-voucherModal"
            onClick={handleNextStep}
          >
            {currentStep === STEPS.MEMBERS ? (
              <>
                Kirim Voucher <FaCheck />
              </>
            ) : (
              <>
                Lanjut <FaChevronRight />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay-voucherModal" onClick={onClose}>
      <div
        className="modal-content-voucherModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-voucherModal">
          <h3>
            {currentStep === STEPS.SETTINGS && "Buat Voucher Barus"}
            {currentStep === STEPS.MEMBERS && "Pilih Penerima Voucher"}
            {currentStep === STEPS.PROCESSING && "Proses Pembuatan Voucher"}
          </h3>
          <button className="modal-close-voucherModal" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body-voucherModal">{renderStepContent()}</div>

        {renderNavButtons()}
      </div>
    </div>
  );
};

export default VoucherModal;
