import React from "react";

export const RegisterStepTwo = ({ formData, handleRegisterChange, handleNextStep, handlePrevStep }) => {
  return (
    <>
      <h3 className="form-title">Data Akun</h3>

      <div className="form-group">
        <label htmlFor="registerEmail" className="form-label">
          Email
        </label>
        <input
          type="email"
          id="registerEmail"
          name="email"
          value={formData.email}
          onChange={handleRegisterChange}
          required
          placeholder="Masukkan email aktif"
          className="brutal-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="nomorWhatsapp" className="form-label">
          Nomor WhatsApp
        </label>
        <div className="whatsapp-input-container">
          <div className="whatsapp-prefix">+62</div>
          <input
            type="tel"
            id="nomorWhatsapp"
            name="nomorWhatsapp"
            value={
              formData.nomorWhatsapp.startsWith("+62")
                ? formData.nomorWhatsapp.substring(3)
                : formData.nomorWhatsapp
            }
            onChange={handleRegisterChange}
            required
            placeholder="81234567890"
            className="brutal-input whatsapp-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="registerPassword" className="form-label">
          Password
        </label>
        <input
          type="password"
          id="registerPassword"
          name="password"
          value={formData.password}
          onChange={handleRegisterChange}
          required
          placeholder="Minimal 6 karakter"
          minLength={6}
          className="brutal-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword" className="form-label">
          Ulangi Password
        </label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleRegisterChange}
          required
          placeholder="Ulangi password"
          className="brutal-input"
        />
      </div>

      <div className="step-navigation">
        <button
          type="button"
          onClick={handlePrevStep}
          className="brutal-button back-button"
        >
          Kembali
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