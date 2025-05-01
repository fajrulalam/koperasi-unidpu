import React, { useState, useRef } from "react";
import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  uploadFile,
} from "../firebase";
import "../styles/Login.css";

const LoginTailwind = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [membershipChoice, setMembershipChoice] = useState("active"); // 'active' or 'inactive'
  const [paymentProof, setPaymentProof] = useState(null);
  const fileInputRef = useRef(null);

  // Constants for membership fees
  const IURAN_POKOK = 250000; // Rp 250.000
  const IURAN_WAJIB = 25000; // Rp 25.000

  // Format currency to IDR
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Registration form state
  const [formData, setFormData] = useState({
    nama: "",
    nik: "",
    tempatLahir: "",
    tanggalLahir: "",
    kantor: "",
    satuanKerja: "",
    email: "",
    nomorWhatsapp: "+62",
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

  const resetForm = () => {
    setFormData({
      nama: "",
      nik: "",
      tempatLahir: "",
      tanggalLahir: "",
      kantor: "",
      satuanKerja: "",
      email: "",
      nomorWhatsapp: "+62",
      password: "",
      confirmPassword: "",
    });
    setShowRegisterModal(false);
    setRegistrationStep(1);
    setTermsAgreed(false);
    setMembershipChoice("active");
    setPaymentProof(null);
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;

    if (name === "nomorWhatsapp") {
      // Allow only numbers
      const numbersOnly = value.replace(/[^0-9]/g, "");
      let formattedValue = numbersOnly;

      // If the input doesn't start with +62, add it
      if (!formattedValue.startsWith("62")) {
        // If it starts with 0, remove the leading 0
        if (formattedValue.startsWith("0")) {
          formattedValue = formattedValue.substring(1);
        }
        formattedValue = "+62" + formattedValue;
      } else {
        formattedValue = "+" + formattedValue;
      }

      setFormData({
        ...formData,
        [name]: formattedValue,
      });
    } else if (name === "nik") {
      // Allow only numbers for NIK
      const numbersOnly = value.replace(/[^0-9]/g, "");
      setFormData({
        ...formData,
        [name]: numbersOnly,
      });
    } else if (name === "nama") {
      // Allow only letters, spaces, dots, and dashes
      const validNameChars = value.replace(/[^a-zA-Z\s.\-]/g, "");
      setFormData({
        ...formData,
        [name]: validNameChars,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setError("Ukuran file terlalu besar. Maksimal 5MB.");
        fileInputRef.current.value = null;
        return;
      }

      const fileType = file.type;
      if (!fileType.includes("image") && fileType !== "application/pdf") {
        setError(
          "Format file tidak didukung. Hanya gambar atau PDF yang diperbolehkan."
        );
        fileInputRef.current.value = null;
        return;
      }

      setPaymentProof(file);
      setError("");
    }
  };

  const validateStep1 = () => {
    if (!formData.nama) {
      setError("Silakan masukkan nama lengkap");
      return false;
    }
    if (!formData.nik || formData.nik.length !== 16) {
      setError("NIK harus 16 digit");
      return false;
    }
    if (!formData.kantor) {
      setError("Silakan pilih kantor");
      return false;
    }
    // Only validate Satuan Kerja for Unipdu employees
    if (formData.kantor === "Unipdu" && !formData.satuanKerja) {
      setError("Silakan pilih satuan kerja");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.email || !formData.email.includes("@")) {
      setError("Silakan masukkan email valid");
      return false;
    }
    if (!formData.nomorWhatsapp || formData.nomorWhatsapp.length < 9) {
      setError("Silakan masukkan nomor WhatsApp valid");
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      setError("Password minimal 6 karakter");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Password dan konfirmasi password tidak sama");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const isUnipdu = formData.kantor === "Unipdu";

    // For non-Unipdu employees
    if (!isUnipdu) {
      if (!termsAgreed) {
        setError("Silakan setujui persyaratan keanggotaan");
        return false;
      }

      if (!paymentProof) {
        setError("Silakan unggah bukti pembayaran");
        return false;
      }
    }
    // For Unipdu employees, having selected a membership option is sufficient
    // No need to check termsAgreed since it's automatically set when selecting an option

    return true;
  };

  const handleNextStep = () => {
    setError("");

    if (registrationStep === 1) {
      if (validateStep1()) {
        setRegistrationStep(2);
      }
    } else if (registrationStep === 2) {
      if (validateStep2()) {
        setRegistrationStep(3);
      }
    }
  };

  const handlePrevStep = () => {
    setRegistrationStep(registrationStep - 1);
    setError("");
  };

  // Helper function to properly capitalize names
  const capitalizeWords = (name) => {
    // Split the name by spaces
    return name
      .split(/\s+/)
      .map((word) => {
        // Skip empty words
        if (word.length === 0) return word;
        // Capitalize each word: first letter uppercase, rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateStep3()) {
      return;
    }

    setLoading(true);

    try {
      // Properly capitalize the name
      const formattedName = capitalizeWords(formData.nama);
      const isUnipdu = formData.kantor === "Unipdu";
      const isInactive = isUnipdu && membershipChoice === "inactive";

      // Upload payment proof to Firebase Storage if present
      let paymentProofURL = null;
      if (paymentProof) {
        // Create a unique path for the file: payments/{timestamp}_{filename}
        const timestamp = Date.now();
        const filePath = `payments/${timestamp}_${paymentProof.name}`;

        // Upload the file and get the URL
        paymentProofURL = await uploadFile(paymentProof, filePath);
      }

      const userData = {
        nama: formattedName,
        nik: formData.nik,
        kantor: formData.kantor,
        satuanKerja: formData.satuanKerja || "",
        nomorWhatsapp: formData.nomorWhatsapp,
        role: "Member",
        membershipStatus: isInactive ? "inactive" : "Pending", // Inactive or Pending
        paymentStatus: isInactive
          ? null
          : isUnipdu
          ? "Payroll Deduction"
          : "Pending Verification",
        registrationDate: new Date().toISOString(),
        iuranPokok: isInactive ? 0 : IURAN_POKOK,
        iuranWajib: isInactive ? 0 : IURAN_WAJIB,
        paymentProof: paymentProofURL, // Store the download URL
      };

      await registerWithEmailAndPassword(
        formData.email,
        formData.password,
        userData
      );

      // Show success message
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

  // Registration Form - Step 1 (Personal Data)
  const renderRegistrationStep1 = () => {
    return (
      <>
        <h3 className="form-title">Data Pribadi</h3>
        {/* <p className="form-subtitle">
          Langkah 1 dari 3: Masukkan informasi pribadi Anda
        </p> */}

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

        {/* Only show Satuan Kerja for Unipdu employees */}
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

  // Registration Form - Step 2 (Account Data)
  const renderRegistrationStep2 = () => {
    return (
      <>
        <h3 className="form-title">Data Akun</h3>
        {/* <p className="form-subtitle">
          Langkah 2 dari 3: Masukkan informasi akun Anda
        </p> */}

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

  // Registration Form - Step 3 (Terms and Payment)
  const renderRegistrationStep3 = () => {
    const isUnipdu = formData.kantor === "Unipdu";

    return (
      <>
        <h3 className="form-title">
          {isUnipdu ? "Persetujuan Iuran" : "Bukti Pembayaran"}
        </h3>
        {/* <p className="form-subtitle">
          Langkah 3 dari 3: {isUnipdu
            ? "Konfirmasi persetujuan iuran"
            : "Unggah bukti pembayaran"}
        </p> */}

        <div className="form-terms">
          <h4 className="terms-title">
            {isUnipdu
              ? "Lembar Persetujuan Pembayaran Iuran Pokok dan Wajib"
              : "Informasi Pembayaran Iuran"}
          </h4>

          <div className="terms-content">
            <p>
              Dengan ini saya menyatakan bahwa saya bersedia menjadi anggota
              Koperasi Unipdu dan bersedia membayar:
            </p>
            <ul>
              <li>Iuran Pokok: {formatCurrency(IURAN_POKOK)}</li>
              <li>Iuran Wajib: {formatCurrency(IURAN_WAJIB)} per bulan</li>
            </ul>

            {isUnipdu ? (
              <p>
                Saya menyetujui bahwa pembayaran iuran pokok dan iuran wajib
                akan dipotong dari gaji saya setiap bulan sesuai dengan
                peraturan koperasi yang berlaku. Persetujuan ini berlaku hingga
                saya mengajukan pengunduran diri dari keanggotaan koperasi
                secara tertulis.
              </p>
            ) : (
              <p>
                Silakan transfer pembayaran iuran pokok sebesar{" "}
                {formatCurrency(IURAN_POKOK)} ke:
                <br />
                Bank: BNI
                <br />
                No. Rekening: 123456789
                <br />
                Atas Nama: Koperasi Unipdu
                <br />
                <br />
                Kemudian unggah bukti pembayaran di bawah ini:
              </p>
            )}
          </div>

          {!isUnipdu && (
            <div className="form-group">
              <label htmlFor="paymentProof" className="form-label">
                Bukti Pembayaran (Maks. 5MB - Gambar/PDF)
              </label>
              <input
                type="file"
                id="paymentProof"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="brutal-file-input"
                required
              />
              {paymentProof && (
                <p className="file-selected">
                  File terpilih: {paymentProof.name}
                </p>
              )}
            </div>
          )}

          {isUnipdu ? (
            // Radio options for Unipdu employees
            <div className="membership-options">
              <h4 className="option-title">Pilihan Keanggotaan:</h4>

              <div className="radio-container">
                <input
                  type="radio"
                  id="membershipActive"
                  name="membershipChoice"
                  checked={membershipChoice === "active"}
                  onChange={() => {
                    setMembershipChoice("active");
                    setTermsAgreed(true); // Automatically agree to terms when choosing active
                  }}
                  className="brutal-checkbox" // Using checkbox style but maintaining radio behavior
                />
                <label htmlFor="membershipActive" className="checkbox-label">
                  Saya bersedia menjadi anggota Koperasi dan menyetujui
                  persyaratan keanggotaan koperasi termasuk kesediaan dipotong
                  gaji untuk pembayaran iuran koperasi
                </label>
              </div>

              <div className="radio-container" style={{ marginTop: "15px" }}>
                <input
                  type="radio"
                  id="membershipInactive"
                  name="membershipChoice"
                  checked={membershipChoice === "inactive"}
                  onChange={() => {
                    setMembershipChoice("inactive");
                    setTermsAgreed(false); // Not agreeing to terms when choosing inactive
                  }}
                  className="brutal-checkbox" // Using checkbox style but maintaining radio behavior
                />
                <label htmlFor="membershipInactive" className="radio-label">
                  Saya tidak bersedia menjadi anggota Koperasi
                </label>
              </div>
            </div>
          ) : (
            // Regular checkbox for non-Unipdu employees
            <div className="checkbox-container">
              <input
                type="checkbox"
                id="termsAgreement"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="brutal-checkbox"
              />
              <label htmlFor="termsAgreement" className="checkbox-label">
                Saya menyetujui persyaratan keanggotaan koperasi dan bersedia
                membayar iuran koperasi sesuai ketentuan
              </label>
            </div>
          )}
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
            type="submit"
            className={`brutal-button primary-button ${
              loading || (!isUnipdu && !termsAgreed) ? "button-loading" : ""
            }`}
            disabled={loading || (!isUnipdu && !termsAgreed)}
            onClick={handleRegisterSubmit}
          >
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </div>
      </>
    );
  };

  // If registration is successful, show success message
  if (registerSuccess) {
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
  }

  return (
    <div className="brutal-login-container">
      <div className="brutal-card">
        {!showRegisterModal ? (
          // Login Form
          <>
            <div className="card-header">
              <h2 className="card-title">Koperasi Unipdu</h2>
            </div>

            {error && <div className="error-message">{error}</div>}

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
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Masukkan password anda"
                  className="brutal-input"
                />
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
        ) : (
          // Registration Form
          <div className="registration-container">
            <div className="register-header">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="brutal-button back-button"
              >
                &larr; Kembali ke login
              </button>

              <div className="step-indicator">
                <div
                  className={`step ${registrationStep >= 1 ? "active" : ""}`}
                >
                  1
                </div>
                <div className="step-line"></div>
                <div
                  className={`step ${registrationStep >= 2 ? "active" : ""}`}
                >
                  2
                </div>
                <div className="step-line"></div>
                <div
                  className={`step ${registrationStep >= 3 ? "active" : ""}`}
                >
                  3
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form className="register-form">
              {registrationStep === 1 && renderRegistrationStep1()}
              {registrationStep === 2 && renderRegistrationStep2()}
              {registrationStep === 3 && renderRegistrationStep3()}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginTailwind;
