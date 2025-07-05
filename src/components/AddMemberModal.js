import React from "react";

const AddMemberModal = ({
  isOpen,
  onClose,
  newMemberData,
  onInputChange,
  onCreateMember,
  actionLoading,
  satuanKerjaOptions,
  formatCurrencyInput
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-content">
          <h3>Tambah Anggota Baru</h3>
          <div className="form-container">
            <div className="form-group">
              <label>
                Nama <span className="required">*</span>
              </label>
              <input
                type="text"
                name="nama"
                value={newMemberData.nama}
                onChange={onInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={newMemberData.email}
                onChange={onInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={newMemberData.password}
                onChange={onInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>NIK (Maks. 16 digit)</label>
              <input
                type="text"
                name="nik"
                value={newMemberData.nik}
                onChange={onInputChange}
                className="form-input"
                maxLength={16}
                pattern="[0-9]*"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>WhatsApp</label>
              <input
                type="text"
                name="nomorWhatsapp"
                value={newMemberData.nomorWhatsapp}
                onChange={onInputChange}
                className="form-input"
                placeholder="e.g. 08123456789 or +628123456789"
              />
            </div>

            <div className="form-group">
              <label>Kantor</label>
              <select
                name="kantor"
                value={newMemberData.kantor}
                onChange={onInputChange}
                className="form-input"
              >
                <option value="Unipdu">Unipdu</option>
                <option value="SD Plus">SD Plus</option>
                <option value="RS Unipdu Medika">RS Unipdu Medika</option>
              </select>
            </div>

            {newMemberData.kantor === "Unipdu" && (
              <div className="form-group">
                <label>Satuan Kerja</label>
                <select
                  name="satuanKerja"
                  value={newMemberData.satuanKerja}
                  onChange={onInputChange}
                  className="form-input"
                >
                  <option value="">Pilih Satuan Kerja</option>
                  {satuanKerjaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Iuran Pokok</label>
              <input
                type="text"
                name="iuranPokok"
                value={newMemberData.iuranPokokFormatted || formatCurrencyInput(newMemberData.iuranPokok)}
                onChange={onInputChange}
                className="form-input"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Iuran Wajib</label>
              <input
                type="text"
                name="iuranWajib"
                value={newMemberData.iuranWajibFormatted || formatCurrencyInput(newMemberData.iuranWajib)}
                onChange={onInputChange}
                className="form-input"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Metode Pembayaran</label>
              <select
                name="paymentStatus"
                value={newMemberData.paymentStatus}
                onChange={onInputChange}
                className="form-input"
              >
                <option value="Payroll Deduction">Payroll Deduction</option>
                <option value="Yayasan Subsidy">Yayasan Subsidy</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={onClose}>
              Batal
            </button>

            <button
              className="save-button"
              onClick={onCreateMember}
              disabled={actionLoading}
            >
              {actionLoading ? "Menyimpan..." : "Tambah Anggota"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;