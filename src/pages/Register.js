import React, { useState } from "react";
import { registerWithEmailAndPassword } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Register.css";

const Register = () => {
  const navigate = useNavigate();
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

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
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
      setIsSubmitted(true);
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

  if (isSubmitted) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="register-success">
            <h2>Pendaftaran Berhasil!</h2>
            <p>Menunggu verifikasi dari Admin Unimart</p>
            <Link to="/login" className="back-to-login">
              Kembali ke halaman login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <img
            src="/logo-koperasi-unipdu-removebg-preview.png"
            alt="Koperasi Unipdu Logo"
            className="register-logo"
          />
          <h2>Pendaftaran Anggota Baru</h2>
        </div>

        {error && <div className="register-error">{error}</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="nama">Nama Lengkap</label>
            <input
              type="text"
              id="nama"
              name="nama"
              value={formData.nama}
              onChange={handleChange}
              required
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div className="form-group">
            <label htmlFor="nik">NIKss</label>
            <input
              type="text"
              id="nik"
              name="nik"
              value={formData.nik}
              onChange={handleChange}
              required
              maxLength={16}
              placeholder="Masukkan 16 digit NIK"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tempatLahir">Tempat Lahir</label>
              <input
                type="text"
                id="tempatLahir"
                name="tempatLahir"
                value={formData.tempatLahir}
                onChange={handleChange}
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
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="kantor">Kantor</label>
            <select
              id="kantor"
              name="kantor"
              value={formData.kantor}
              onChange={handleChange}
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
              onChange={handleChange}
              required
              placeholder="Masukkan satuan kerja"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              onChange={handleChange}
              required
              placeholder="contoh: 081234567890"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
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
              onChange={handleChange}
              required
              placeholder="Ulangi password"
            />
          </div>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <div className="login-link">
          <p>Sudah memiliki akun?</p>
          <Link to="/login">Login di sini</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
