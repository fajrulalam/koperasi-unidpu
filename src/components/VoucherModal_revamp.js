import React, { useState, useEffect, useMemo } from "react";
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
  formatCurrency,
  parseCurrency,
  progress,
}) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filters, setFilters] = useState({ kantor: [], satuanKerja: [] });
  const [formData, setFormData] = useState({
    voucherName: "",
    value: "",
    activeDate: "",
    expireDate: "",
    startNow: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadMembers = async () => {
      setLoading(true);
      try {
        const data = await fetchMembers();
        if (mounted) {
          setMembers(data);
        }
      } catch (error) {
        console.error("Failed to load members:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMembers();
    return () => {
      mounted = false;
    };
  }, [fetchMembers]);

  const filterOptions = useMemo(() => {
    const kantorSet = new Set();
    const satuanKerjaSet = new Set();

    members.forEach((member) => {
      if (member.kantor) kantorSet.add(member.kantor);
      if (member.satuanKerja) satuanKerjaSet.add(member.satuanKerja);
    });

    return {
      kantor: Array.from(kantorSet),
      satuanKerja: Array.from(satuanKerjaSet),
    };
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const kantorMatch =
        filters.kantor.length === 0 || filters.kantor.includes(member.kantor);
      const satuanKerjaMatch =
        filters.satuanKerja.length === 0 ||
        filters.satuanKerja.includes(member.satuanKerja);
      return kantorMatch && satuanKerjaMatch;
    });
  }, [members, filters]);

  const selectedMembers = useMemo(() => {
    return members.filter((member) => selectedIds.has(member.id));
  }, [members, selectedIds]);

  const allFilteredSelected = useMemo(() => {
    return (
      filteredMembers.length > 0 &&
      filteredMembers.every((member) => selectedIds.has(member.id))
    );
  }, [filteredMembers, selectedIds]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "value") {
      const numericValue = value.replace(/\D/g, "");
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue ? formatCurrency(numericValue) : "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFilterChange = (type, value) => {
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter((item) => item !== value)
        : [...prev[type], value],
    }));
  };

  const handleMemberToggle = (memberId) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        filteredMembers.forEach((member) => newSet.delete(member.id));
        return newSet;
      });
    } else {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        filteredMembers.forEach((member) => newSet.add(member.id));
        return newSet;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.voucherName.trim()) {
      newErrors.voucherName = "Nama voucher harus diisi";
    }

    if (!formData.value) {
      newErrors.value = "Nilai voucher harus diisi";
    }

    if (!formData.startNow && !formData.activeDate) {
      newErrors.activeDate = "Tanggal aktif harus diisi";
    }

    if (!formData.expireDate) {
      newErrors.expireDate = "Tanggal kadaluarsa harus diisi";
    } else if (
      formData.activeDate &&
      new Date(formData.expireDate) <= new Date(formData.activeDate)
    ) {
      newErrors.expireDate = "Tanggal kadaluarsa harus setelah tanggal aktif";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 0) {
      if (validateForm()) {
        setStep(1);
      }
    } else if (step === 1) {
      if (selectedMembers.length > 0) {
        setStep(2);
        createVouchers();
      } else {
        setErrors({ members: "Pilih minimal satu anggota" });
      }
    }
  };

  const createVouchers = async () => {
    try {
      const voucherData = {
        ...formData,
        value: parseCurrency(formData.value),
      };

      await onCreateVouchers(voucherData, selectedMembers);
    } catch (error) {
      console.error("Error creating vouchers:", error);
      setStep(1);
    }
  };

  const renderStep0 = () => (
    <div className="detail-section-voucherModal">
      <h4>Informasi Voucher</h4>
      <div className="voucher-form">
        <div className="form-group">
          <label htmlFor="voucherName">Nama Voucher</label>
          <input
            type="text"
            id="voucherName"
            name="voucherName"
            value={formData.voucherName}
            onChange={handleInputChange}
            className={errors.voucherName ? "error" : ""}
          />
          {errors.voucherName && (
            <span className="error-message">{errors.voucherName}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="value">Nilai Voucher (Rp)</label>
          <input
            type="text"
            id="value"
            name="value"
            value={formData.value}
            onChange={handleInputChange}
            className={errors.value ? "error" : ""}
          />
          {errors.value && (
            <span className="error-message">{errors.value}</span>
          )}
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="startNow"
            name="startNow"
            checked={formData.startNow}
            onChange={handleInputChange}
          />
          <label htmlFor="startNow">
            Aktifkan voucher segera setelah dibuat
          </label>
        </div>

        {!formData.startNow && (
          <div className="form-group">
            <label htmlFor="activeDate">Tanggal Aktif</label>
            <input
              type="datetime-local"
              id="activeDate"
              name="activeDate"
              value={formData.activeDate}
              onChange={handleInputChange}
              className={errors.activeDate ? "error" : ""}
            />
            {errors.activeDate && (
              <span className="error-message">{errors.activeDate}</span>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="expireDate">Tanggal Kadaluarsa</label>
          <input
            type="datetime-local"
            id="expireDate"
            name="expireDate"
            value={formData.expireDate}
            onChange={handleInputChange}
            className={errors.expireDate ? "error" : ""}
          />
          {errors.expireDate && (
            <span className="error-message">{errors.expireDate}</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="detail-section-voucherModal">
      <h4>Pilih Penerima Voucher</h4>
      <div className="member-selection">
        {loading ? (
          <div className="loading">
            <p>Memuat data anggota...</p>
          </div>
        ) : (
          <>
            <div className="filters">
              <div className="filter-group">
                <label>Filter Kantor:</label>
                <div className="dropdown">
                  <button className="dropdown-toggle">Pilih Kantor</button>
                  <div className="dropdown-menu">
                    {filterOptions.kantor.map((kantor) => (
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
                    {filterOptions.satuanKerja.map((satuanKerja) => (
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
              <table className="members-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
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
                    filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        className={selectedIds.has(member.id) ? "selected" : ""}
                        onClick={() => handleMemberToggle(member.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(member.id)}
                            onChange={() => {}}
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
              {selectedMembers.length} dari {filteredMembers.length} anggota
              dipilih
              {errors.members && (
                <span className="error-message">{errors.members}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="detail-section-voucherModal">
      <h4>Proses Pembuatan Voucher</h4>
      <div className="processing">
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${progress.percentage}%` }}
          />
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

  const getStepContent = () => {
    switch (step) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 0:
        return "Buat Voucher Baru";
      case 1:
        return "Pilih Penerima Voucher";
      case 2:
        return "Proses Pembuatan Voucher";
      default:
        return "";
    }
  };

  return (
    <div className="modal-overlay-voucherModal" onClick={onClose}>
      <div
        className="modal-content-voucherModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-voucherModal">
          <h3>{getTitle()}</h3>
          <button className="modal-close-voucherModal" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body-voucherModal">{getStepContent()}</div>

        {step < 2 && (
          <div className="modal-actions-voucherModal">
            {step > 0 && (
              <button
                className="button-secondary-voucherModal"
                onClick={() => setStep(step - 1)}
              >
                <FaChevronLeft /> Kembali
              </button>
            )}

            <div className="action-buttons-voucherModal">
              <button
                className="button-primary-voucherModal"
                onClick={handleNext}
              >
                {step === 1 ? (
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
        )}
      </div>
    </div>
  );
};

export default VoucherModal;
