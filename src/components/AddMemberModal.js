import React from "react";
import "../styles/AddMemberModal.css";

const AddMemberModal = ({
  isOpen,
  onClose,
  newMemberData,
  onInputChange,
  onCreateMember,
  actionLoading,
  satuanKerjaOptions,
  formatCurrencyInput,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay-addMemberModal" onClick={onClose}>
      <div 
        className="modal-content-addMemberModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-addMemberModal">
          <h3>Tambah Anggota Baru</h3>
          <button className="modal-close-addMemberModal" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-body-addMemberModal">
          <div className="form-group-addMemberModal">
            <label>
              Nama <span className="required">*</span>
            </label>
            <input
              type="text"
              name="nama"
              value={newMemberData.nama}
              onChange={onInputChange}
              className="form-input-addMemberModal"
              required
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={newMemberData.email}
              onChange={onInputChange}
              className="form-input-addMemberModal"
              required
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>
              Password <span className="required">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={newMemberData.password}
              onChange={onInputChange}
              className="form-input-addMemberModal"
              required
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>NIK (Maks. 16 digit)</label>
            <input
              type="text"
              name="nik"
              value={newMemberData.nik}
              onChange={onInputChange}
              className="form-input-addMemberModal"
              maxLength={16}
              pattern="[0-9]*"
              inputMode="numeric"
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>WhatsApp</label>
            <input
              type="text"
              name="nomorWhatsapp"
              value={newMemberData.nomorWhatsapp}
              onChange={onInputChange}
              className="form-input-addMemberModal"
              placeholder="e.g. 08123456789 or +628123456789"
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>Kantor</label>
            <select
              name="kantor"
              value={newMemberData.kantor}
              onChange={onInputChange}
              className="form-input-addMemberModal"
            >
              <option value="Unipdu">Unipdu</option>
              <option value="SD Plus">SD Plus</option>
              <option value="RS Unipdu Medika">RS Unipdu Medika</option>
            </select>
          </div>

          {newMemberData.kantor === "Unipdu" && (
            <div className="form-group-addMemberModal">
              <label>Satuan Kerja</label>
              <select
                name="satuanKerja"
                value={newMemberData.satuanKerja}
                onChange={onInputChange}
                className="form-input-addMemberModal"
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

          <div className="form-group-addMemberModal">
            <label>Iuran Pokok</label>
            <input
              type="text"
              name="iuranPokok"
              value={
                newMemberData.iuranPokokFormatted ||
                formatCurrencyInput(newMemberData.iuranPokok)
              }
              onChange={onInputChange}
              className="form-input-addMemberModal"
              inputMode="numeric"
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>Iuran Wajib</label>
            <input
              type="text"
              name="iuranWajib"
              value={
                newMemberData.iuranWajibFormatted ||
                formatCurrencyInput(newMemberData.iuranWajib)
              }
              onChange={onInputChange}
              className="form-input-addMemberModal"
              inputMode="numeric"
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>Bank</label>
            <select
              name="bankDetails.bank"
              value={newMemberData.bankDetails?.bank || ""}
              onChange={onInputChange}
              className="form-input-addMemberModal"
            >
              <option value="">Pilih Bank</option>
              <option value="BSI">BSI</option>
              <option value="BCA">BCA</option>
              <option value="BRI">BRI</option>
              <option value="Mandiri">Mandiri</option>
              <option value="BNI">BNI</option>
              <option value="Bank Jatim">Bank Jatim</option>
              <option value="BTN">BTN</option>
            </select>
          </div>

          <div className="form-group-addMemberModal">
            <label>Nomor Rekening</label>
            <input
              type="text"
              inputMode="numeric"
              name="bankDetails.nomorRekening"
              value={newMemberData.bankDetails?.nomorRekening || ""}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/[^0-9]/g, "");
                onInputChange({target: {name: "bankDetails.nomorRekening", value: numericValue}});
              }}
              className="form-input-addMemberModal"
              placeholder="Nomor rekening (angka saja)"
            />
          </div>

          <div className="form-group-addMemberModal">
            <label>Metode Pembayaran</label>
            <select
              name="paymentStatus"
              value={newMemberData.paymentStatus}
              onChange={onInputChange}
              className="form-input-addMemberModal"
            >
              <option value="Payroll Deduction">Payroll Deduction</option>
              <option value="Yayasan Subsidy">Yayasan Subsidy</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
        </div>
        <div className="modal-actions-addMemberModal">
          <button className="button-secondary-addMemberModal" onClick={onClose}>
            Batal
          </button>
          <button
            className="button-primary-addMemberModal"
            onClick={onCreateMember}
            disabled={actionLoading}
          >
            {actionLoading ? "Menyimpan..." : "Tambah Anggota"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
