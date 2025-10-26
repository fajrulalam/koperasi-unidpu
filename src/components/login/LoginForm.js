import React, { useState } from "react";

export const LoginForm = ({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  handleLogin, 
  loading,
  setShowRegisterModal,
  setShowResetPasswordModal,
  setError,
  setSuccess
}) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      <div className="card-header">
        <h2 className="card-title">Koperasi Unipdu</h2>
      </div>

      <form onSubmit={handleLogin} className="login-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Masukkan email anda"
            className="brutal-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <div className="password-input-container" style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Masukkan password anda"
              className="brutal-input"
              style={{ width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle-button"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px',
              }}
            >
              {showPassword ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </div>

        <div className="forgot-password">
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              setShowResetPasswordModal(true);
              setError("");
              setSuccess("");
            }}
            className="forgot-password-link"
          >
            Lupa Password?
          </a>
        </div>

        <button
          type="submit"
          className={`brutal-button primary-button ${
            loading ? "button-loading" : ""
          }`}
          disabled={loading}
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <div className="form-footer">
        <p className="footer-text">Belum punya akun?</p>
        <button
          onClick={() => {
            setShowRegisterModal(true);
            setError("");
          }}
          className="brutal-button secondary-button"
        >
          Daftar Anggota Baru
        </button>
      </div>
    </>
  );
};

// Using named exports