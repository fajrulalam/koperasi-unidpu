import React from "react";

export const RegisterStepOne = ({ 
  formData, 
  handleRegisterChange, 
  handleNextStep,
  setShowRegisterModal
}) => {
  return (
    <>
      <h3 className="form-title">Data Pribadi</h3>

      <div className="form-group">
        <label htmlFor="nama" className="form-label">
          Nama Lengkap
        </label>
        <input
          type="text"
          id="nama"
          name="nama"
          value={formData.nama}
          onChange={handleRegisterChange}
          required
          placeholder="Masukkan nama lengkap"
          className="brutal-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="nik" className="form-label">
          NIK
        </label>
        <input
          type="text"
          id="nik"
          name="nik"
          value={formData.nik}
          onChange={handleRegisterChange}
          required
          maxLength={16}
          placeholder="Masukkan 16 digit NIK"
          className="brutal-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="kantor" className="form-label">
          Kantor
        </label>
        <select
          id="kantor"
          name="kantor"
          value={formData.kantor}
          onChange={handleRegisterChange}
          required
          className="brutal-input select-input"
        >
          <option value="">Pilih Kantor</option>
          <option value="Unipdu">Unipdu</option>
          <option value="SD Plus">SD Plus</option>
          <option value="RS Unipdu Medika">RS Unipdu Medika</option>
        </select>
      </div>

      {formData.kantor === "Unipdu" && (
        <div className="form-group">
          <label htmlFor="satuanKerja" className="form-label">
            Satuan Kerja
          </label>
          <select
            id="satuanKerja"
            name="satuanKerja"
            value={formData.satuanKerja}
            onChange={handleRegisterChange}
            required
            className="brutal-input select-input"
          >
            <option value="">Pilih Satuan Kerja</option>
            <option value="BAA">BAA</option>
            <option value="BAK">BAK</option>
            <option value="BAKM">BAKM</option>
            <option value="BU">BU</option>
            <option value="FAI">FAI</option>
            <option value="FBBP">FBBP</option>
            <option value="FIK">FIK</option>
            <option value="HUMAS">HUMAS</option>
            <option value="LPPM">LPPM</option>
            <option value="PASCA">PASCA</option>
            <option value="PERPUS">PERPUS</option>
            <option value="PJM">PJM</option>
            <option value="PMB">PMB</option>
            <option value="PSA">PSA</option>
            <option value="PSB">PSB</option>
            <option value="PSQ">PSQ</option>
            <option value="PSW">PSW</option>
            <option value="PUSKOMNET">PUSKOMNET</option>
            <option value="REKTORAT">REKTORAT</option>
            <option value="SAINTEK">SAINTEK</option>
            <option value="SDM">SDM</option>
          </select>
        </div>
      )}

      <div className="step-navigation">
        <button
          type="button"
          onClick={() => setShowRegisterModal(false)}
          className="brutal-button back-button"
        >
          Kembali ke login
        </button>
        <button
          type="button"
          onClick={handleNextStep}
          className="brutal-button primary-button"
        >
          Lanjutkan
        </button>
      </div>
    </>
  );
};

// Using named exports