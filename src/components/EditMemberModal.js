import React from "react";
import "../styles/EditMemberModal.css";

const EditMemberModal = ({
  isOpen,
  onClose,
  editMemberData,
  onInputChange,
  onSave,
  actionLoading,
  satuanKerjaOptions,
}) => {
  if (!isOpen || !editMemberData) return null;

  const handleCurrencyChange = (e) => {
    const { name, value } = e.target;
    const rawValue = value.replace(/[^0-9]/g, "");
    const numericValue = rawValue ? parseInt(rawValue, 10) : "";
    onInputChange({ target: { name, value: numericValue } });
  };

  const handleAccountNumberChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, "");
    // Use custom name handling for nested object properties
    onInputChange({ target: { name, value: numericValue } });
  };

  return (
    <div className="modal-overlay-editMemberModal" onClick={onClose}>
      <div
        className="modal-content-editMemberModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-editMemberModal">
          <h3>Edit Anggota</h3>
          <button className="modal-close-editMemberModal" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-body-editMemberModal">
          <div className="form-group-editMemberModal">
            <label>Nama</label>
            <input
              type="text"
              name="nama"
              value={editMemberData.nama || ""}
              onChange={onInputChange}
              className="form-input-editMemberModal"
            />
          </div>

          <div className="form-group-editMemberModal">
            <label>Kantor</label>
            <select
              name="kantor"
              value={editMemberData.kantor || ""}
              onChange={onInputChange}
              className="form-input-editMemberModal"
            >
              <option value="">Pilih Kantor</option>
              <option value="Unipdu">Unipdu</option>
              <option value="SD Plus">SD Plus</option>
              <option value="RS Unipdu Medika">RS Unipdu Medika</option>
            </select>
          </div>

          {editMemberData.kantor === "Unipdu" && (
            <div className="form-group-editMemberModal">
              <label>Satuan Kerja</label>
              <select
                name="satuanKerja"
                value={editMemberData.satuanKerja || ""}
                onChange={onInputChange}
                className="form-input-editMemberModal"
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

          <div className="form-group-editMemberModal">
            <label>WhatsApp</label>
            <input
              type="text"
              name="nomorWhatsapp"
              value={editMemberData.nomorWhatsapp || ""}
              onChange={onInputChange}
              className="form-input-editMemberModal"
            />
          </div>

          <div className="form-group-editMemberModal">
            <label>Iuran Pokok</label>
            <input
              type="text"
              inputMode="numeric"
              name="iuranPokok"
              value={editMemberData.iuranPokok ? editMemberData.iuranPokok.toLocaleString('id-ID') : ''}
              onChange={handleCurrencyChange}
              className="form-input-editMemberModal"
            />
          </div>

          <div className="form-group-editMemberModal">
            <label>Iuran Wajib</label>
            <input
              type="text"
              inputMode="numeric"
              name="iuranWajib"
              value={editMemberData.iuranWajib ? editMemberData.iuranWajib.toLocaleString('id-ID') : ''}
              onChange={handleCurrencyChange}
              className="form-input-editMemberModal"
            />
          </div>

          <div className="form-group-editMemberModal">
            <label>Status Keanggotaan</label>
            <select
              name="membershipStatus"
              value={editMemberData.membershipStatus || ""}
              onChange={onInputChange}
              className="form-input-editMemberModal"
            >
              <option value="approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="inactive">Non Aktif</option>
              <option value="rejected">Rejected</option>
              <option value="removed">Removed</option>
            </select>
          </div>

          <div className="form-group-editMemberModal">
            <label>Bank</label>
            <select
              name="bankDetails.bank"
              value={editMemberData.bankDetails?.bank || ""}
              onChange={onInputChange}
              className="form-input-editMemberModal"
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

          <div className="form-group-editMemberModal">
            <label>Nomor Rekening</label>
            <input
              type="text"
              inputMode="numeric"
              name="bankDetails.nomorRekening"
              value={editMemberData.bankDetails?.nomorRekening || ""}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/[^0-9]/g, "");
                onInputChange({target: {name: "bankDetails.nomorRekening", value: numericValue}});
              }}
              className="form-input-editMemberModal"
              placeholder="Nomor rekening (angka saja)"
            />
          </div>
        </div>
        <div className="modal-actions-editMemberModal">
          <button className="button-secondary-editMemberModal" onClick={onClose}>
            Batal
          </button>
          <button
            className="button-primary-editMemberModal"
            onClick={onSave}
            disabled={actionLoading}
          >
            {actionLoading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditMemberModal;