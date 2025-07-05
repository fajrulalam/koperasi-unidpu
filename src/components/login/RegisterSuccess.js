import React from "react";

export const RegisterSuccess = ({ resetForm, setRegisterSuccess }) => {
  return (
    <div className="brutal-login-container">
      <div className="brutal-card">
        <div className="success-content">
          <h2 className="success-title">Pendaftaran Berhasil!</h2>
          <p className="success-message">Silakan login untuk melanjutkan</p>
          <button
            onClick={() => {
              setRegisterSuccess(false);
              resetForm();
            }}
            className="brutal-button secondary-button"
          >
            Kembali ke halaman login
          </button>
        </div>
      </div>
    </div>
  );
};

// Using named exports