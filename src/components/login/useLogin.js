import { useState, useRef } from "react";
import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  uploadFile,
  sendPasswordResetEmail
} from "../../firebase";

export const useLogin = () => {
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Registration state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [membershipChoice, setMembershipChoice] = useState("active"); // 'active' or 'inactive'
  const [paymentProof, setPaymentProof] = useState(null);
  const fileInputRef = useRef(null);
  
  // Reset password state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Constants for membership fees
  const IURAN_POKOK = 250000; // Rp 250.000
  const IURAN_WAJIB = 25000; // Rp 25.000

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

  // Format currency to IDR
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!resetEmail || !resetEmail.includes("@")) {
      setError("Silakan masukkan email yang valid");
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(resetEmail);
      setSuccess("Link reset password telah dikirim ke email Anda");
    } catch (error) {
      console.error("Reset password error:", error);
      setError("Gagal mengirim link reset password. Silakan coba lagi.");
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
    return name
      .split(/\s+/)
      .map((word) => {
        if (word.length === 0) return word;
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

  return {
    // Login states and handlers
    email,
    setEmail,
    password,
    setPassword,
    handleLogin,
    
    // Registration states and handlers
    showRegisterModal,
    setShowRegisterModal,
    registerSuccess,
    setRegisterSuccess,
    registrationStep,
    formData,
    termsAgreed, 
    setTermsAgreed,
    membershipChoice,
    setMembershipChoice,
    paymentProof,
    fileInputRef,
    
    // Reset password states and handlers
    showResetPasswordModal,
    setShowResetPasswordModal,
    resetEmail,
    setResetEmail,
    handleResetPassword,
    
    // Shared states
    error,
    setError,
    success,
    setSuccess,
    loading,
    
    // Functions
    handleRegisterChange,
    handleNextStep,
    handlePrevStep,
    handleFileChange,
    handleRegisterSubmit,
    resetForm,
    formatCurrency,
    
    // Constants
    IURAN_POKOK,
    IURAN_WAJIB
  };
};

// No default export needed since we're using named exports