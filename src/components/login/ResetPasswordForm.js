import React from "react";

export const ResetPasswordForm = ({
  resetEmail,
  setResetEmail,
  handleResetPassword,
  setShowResetPasswordModal,
  loading,
  error,
  success,
  setError,
  setSuccess
}) => {
  return (
    <div className="reset-password-container">
      <div className="card-header">
        <h2 className="card-title">Reset Password</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleResetPassword} className="reset-password-form">
        <div className="form-group">
          <label htmlFor="reset-email" className="form-label">
            Email
          </label>
          <input
            type="email"
            id="reset-email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
            placeholder="Masukkan email akun Anda"
            className="brutal-input"
          />
        </div>

        <div className="form-description">
          <p>
            Kami akan mengirimkan link untuk reset password ke email Anda.
            Silakan periksa kotak masuk atau folder spam setelah mengirimkan permintaan.
          </p>
        </div>

        <div className="form-buttons">
          <button
            type="button"
            onClick={() => {
              setShowResetPasswordModal(false);
              setResetEmail("");
              setError("");
              setSuccess("");
            }}
            className="brutal-button secondary-button"
          >
            Kembali
          </button>
          <button
            type="submit"
            className={`brutal-button primary-button ${loading ? "button-loading" : ""}`}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Kirim Link Reset"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Using named exports