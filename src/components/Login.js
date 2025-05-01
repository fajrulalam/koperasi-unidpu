import React, { useState } from "react";
import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
} from "../firebase";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Registration form state
  const [formData, setFormData] = useState({
    nama: "",
    nik: "",
    tempatLahir: "",
    tanggalLahir: "",
    kantor: "",
    satuanKerja: "",
    email: "",
    nomorWhatsapp: "",
    password: "",
    confirmPassword: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginWithEmailAndPassword(email, password);
      // Auth context will handle the redirect
    } catch (error) {
      console.error("Login error:", error);
      setError("Email atau password tidak valid. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate form
    if (formData.password !== formData.confirmPassword) {
      return setError("Password dan konfirmasi password tidak sama");
    }

    if (formData.password.length < 6) {
      return setError("Password minimal 6 karakter");
    }

    if (formData.nik.length !== 16) {
      return setError("NIK harus 16 digit");
    }

    setLoading(true);

    try {
      // Prepare user data
      const userData = {
        nama: formData.nama,
        nik: formData.nik,
        tempatLahir: formData.tempatLahir,
        tanggalLahir: formData.tanggalLahir,
        kantor: formData.kantor,
        satuanKerja: formData.satuanKerja,
        nomorWhatsapp: formData.nomorWhatsapp,
        role: "Member", // Set role as Member
      };

      await registerWithEmailAndPassword(
        formData.email,
        formData.password,
        userData
      );
      setRegisterSuccess(true);
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message);
      if (error.code === "auth/email-already-in-use") {
        setError("Email telah digunakan. Silakan gunakan email lain.");
      }
    } finally {
      setLoading(false);
    }
  };

  // If registration is successful, show success message
  if (registerSuccess) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="register-success">
            <h2>Pendaftaran Berhasil!</h2>
            <p>Menunggu verifikasi dari Admin Unimart</p>
            <button
              onClick={() => {
                setRegisterSuccess(false);
                setShowRegisterModal(false);
              }}
              className="back-to-login"
            >
              Kembali ke halaman login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/logo-koperasi-unipdu-removebg-preview.png"
            alt="Koperasi Unipdu Logo"
            className="login-logo"
          />
          <h2>Koperasi Unipdu</h2>
        </div>

        {error && <div className="login-error">{error}</div>}

        {!showRegisterModal ? (
          // Login Form
          <>
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Masukkan email anda"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Masukkan password anda"
                />
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <div className="register-section">
              <p>Belum punya akun?</p>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="register-button"
              >
                Daftar Anggota Baru
              </button>
            </div>
          </>
        ) : (
          // Registration Form
          <>
            <button
              onClick={() => setShowRegisterModal(false)}
              className="back-button"
            >
              &larr; Kembali ke login
            </button>

            <h3 className="register-title">Pendaftaran Anggota Baru</h3>
            <p
              style={{
                textAlign: "center",
                marginBottom: "1rem",
                color: "#666",
              }}
            >
              Silakan isi form pendaftaran di bawah iniss
            </p>

            <form onSubmit={handleRegisterSubmit} className="register-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nama">Nama Lengkap</label>
                  <input
                    type="text"
                    id="nama"
                    name="nama"
                    value={formData.nama}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nik">NIK</label>
                  <input
                    type="text"
                    id="nik"
                    name="nik"
                    value={formData.nik}
                    onChange={handleRegisterChange}
                    required
                    maxLength={16}
                    placeholder="Masukkan 16 digit NIK"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tempatLahir">Tempat Lahir</label>
                  <input
                    type="text"
                    id="tempatLahir"
                    name="tempatLahir"
                    value={formData.tempatLahir}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Kota tempat lahir"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tanggalLahir">Tanggal Lahir</label>
                  <input
                    type="date"
                    id="tanggalLahir"
                    name="tanggalLahir"
                    value={formData.tanggalLahir}
                    onChange={handleRegisterChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="kantor">Kantor</label>
                  <select
                    id="kantor"
                    name="kantor"
                    value={formData.kantor}
                    onChange={handleRegisterChange}
                    required
                  >
                    <option value="">Pilih Kantor</option>
                    <option value="Unipdu">Unipdu</option>
                    <option value="SD Plus">SD Plus</option>
                    <option value="RS Unipdu Medika">RS Unipdu Medika</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="satuanKerja">Satuan Kerja</label>
                  <input
                    type="text"
                    id="satuanKerja"
                    name="satuanKerja"
                    value={formData.satuanKerja}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Masukkan satuan kerja"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="registerEmail">Email</label>
                  <input
                    type="email"
                    id="registerEmail"
                    name="email"
                    value={formData.email}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Masukkan email aktif"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nomorWhatsapp">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    id="nomorWhatsapp"
                    name="nomorWhatsapp"
                    value={formData.nomorWhatsapp}
                    onChange={handleRegisterChange}
                    required
                    placeholder="contoh: 081234567890"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="registerPassword">Password</label>
                  <input
                    type="password"
                    id="registerPassword"
                    name="password"
                    value={formData.password}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Ulangi Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleRegisterChange}
                    required
                    placeholder="Ulangi password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="register-submit-button"
                disabled={loading}
              >
                {loading ? "Memproses..." : "Daftar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
