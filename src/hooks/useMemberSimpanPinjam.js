import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

export const useMemberSimpanPinjam = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDocRef, setUserDocRef] = useState(null);
  const [activeTab, setActiveTab] = useState("pinjaman");
  const [showPastLoans, setShowPastLoans] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [simpananForm, setSimpananForm] = useState({
    jumlah: "",
    jenis: "sukarela",
    catatan: "",
  });
  const [pinjamanForm, setPinjamanForm] = useState({
    jumlah: "",
    tenor: "3",
    tujuan: "",
    catatan: "",
  });
  const [showPinjamanModal, setShowPinjamanModal] = useState(false);
  const [currentLoan, setCurrentLoan] = useState(null);
  const [loans, setLoans] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showLoanHistoryModal, setShowLoanHistoryModal] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);

  // Define loan status categories
  const activeLoanStatuses = [
    "Menunggu Persetujuan BAK",
    "Menunggu Persetujuan Wakil Rektor 2",
    "Direvisi BAK",
    "Disetujui dan Aktif",
    "Menunggu Transfer BAK",
  ];

  const pastLoanStatuses = [
    "Lunas",
    "Ditolak BAK",
    "Ditolak Wakil Rektor 2",
    "Dibatalkan",
    "Revisi Ditolak Anggota",
  ];

  // Filter loans
  const activeLoans = loans.filter((loan) =>
    activeLoanStatuses.includes(loan.status)
  );
  const pastLoans = loans
    .filter((loan) => pastLoanStatuses.includes(loan.status))
    .sort((a, b) => {
      const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt);
      const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
      return bTime - aTime;
    });

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setUserDocRef(docRef);
        } else {
          const q = query(
            collection(db, "users"),
            where("uid", "==", user.uid)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            setUserData(querySnapshot.docs[0].data());
            setUserDocRef(doc(db, "users", querySnapshot.docs[0].id));
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Fetch user's loans
  useEffect(() => {
    if (!userData?.uid) return;

    const q = query(
      collection(db, "simpanPinjam"),
      where("userId", "==", userData.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const loansData = [];
      querySnapshot.forEach((doc) => {
        loansData.push({ id: doc.id, ...doc.data() });
      });
      setLoans(loansData);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleSimpananChange = (e) => {
    const { name, value } = e.target;
    setSimpananForm({
      ...simpananForm,
      [name]: value,
    });
  };

  const handlePinjamanChange = (e) => {
    const { name, value } = e.target;
    setPinjamanForm({
      ...pinjamanForm,
      [name]: value,
    });
  };

  const handleSimpananSubmit = (e) => {
    e.preventDefault();
    console.log("Simpanan form submitted:", simpananForm);
    alert("Pengajuan simpanan berhasil dikirim!");
    setSimpananForm({
      jumlah: "",
      jenis: "sukarela",
      catatan: "",
    });
  };

  const handleUpdateToActiveStatus = async () => {
    if (!termsAgreed || !userDocRef) return;

    try {
      await updateDoc(userDocRef, {
        membershipStatus: "Pending",
        iuranPokok: 250000,
        iuranWajib: 25000,
        paymentStatus:
          userData.kantor === "Unipdu"
            ? "Payroll Deduction"
            : "Pending Verification",
      });

      setUserData({
        ...userData,
        membershipStatus: "Pending",
        iuranPokok: 250000,
        iuranWajib: 25000,
        paymentStatus:
          userData.kantor === "Unipdu"
            ? "Payroll Deduction"
            : "Pending Verification",
      });

      setShowRegistrationModal(false);
      alert(
        "Pendaftaran berhasil! Status keanggotaan Anda telah diubah menjadi Pending."
      );
    } catch (error) {
      console.error("Error updating membership status:", error);
      alert(
        "Terjadi kesalahan saat memperbarui status keanggotaan. Silakan coba lagi."
      );
    }
  };

  // Format currency input
  const formatCurrency = (value) => {
    if (!value) return "";
    return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Format date with time in WIB (UTC+7)
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    try {
      const date =
        typeof timestamp === "object" && timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);

      const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));

      const dateStr = date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const timeStr = wibDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC"
      });

      return `${dateStr}, ${timeStr} WIB`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return String(timestamp);
    }
  };

  // Format detailed date with time
  const formatDetailedDate = (timestamp) => {
    if (!timestamp) return "-";
    try {
      const date =
        typeof timestamp === "object" && timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return String(timestamp);
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Disetujui dan Aktif":
      case "Lunas":
      case "Pembayaran Cicilan":
        return "status-badge success";
      case "Ditolak BAK":
      case "Ditolak Wakil Rektor 2":
      case "Dibatalkan":
      case "Revisi Ditolak Anggota":
        return "status-badge error";
      case "Direvisi BAK":
      case "Menunggu Transfer BAK":
        return "status-badge warning";
      default:
        return "status-badge info";
    }
  };

  // Check if user can apply for a new loan
  const canApplyForLoan = () => {
    return activeLoans.length === 0;
  };

  // Handle loan submission
  const handlePinjamanSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const jumlah = parseInt(pinjamanForm.jumlah.replace(/\./g, ""));
      const tenor = parseInt(pinjamanForm.tenor);

      if (!pinjamanForm.tujuan) {
        throw new Error("Tujuan pinjaman harus diisi");
      }
      if (isNaN(jumlah) || jumlah < 1000000 || jumlah > 10000000) {
        throw new Error(
          "Jumlah pinjaman harus antara Rp 1.000.000 - Rp 10.000.000"
        );
      }
      if (![3, 6, 12].includes(tenor)) {
        throw new Error("Pilih tenor yang valid (3, 6, atau 12 bulan)");
      }

      const loanData = {
        userId: userData.uid,
        jumlahPinjaman: jumlah,
        tenor: tenor,
        tujuanPinjaman: pinjamanForm.tujuan,
        catatanTambahan: pinjamanForm.catatan ? [pinjamanForm.catatan] : [],
        status: "Menunggu Persetujuan BAK",
        tanggalPengajuan: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userData: {
          email: userData.email || "",
          namaLengkap: userData.nama || "",
          nik: userData.nik || "",
          nomorWhatsapp: userData.nomorWhatsapp || "",
        },
        history: [
          {
            status: "Menunggu Persetujuan BAK",
            timestamp: new Date(),
            updatedBy: userData.uid,
            notes: "Pengajuan pinjaman baru",
          },
        ],
      };

      await addDoc(collection(db, "simpanPinjam"), loanData);

      setPinjamanForm({
        jumlah: "",
        tenor: "3",
        tujuan: "",
        catatan: "",
      });
      setShowPinjamanModal(false);
      alert("Pengajuan pinjaman berhasil dikirim!");
    } catch (error) {
      console.error("Error submitting loan:", error);
      setError(error.message || "Terjadi kesalahan saat mengajukan pinjaman");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle accept revision
  const handleTerimaRevisi = async (loanId) => {
    try {
      const loanRef = doc(db, "simpanPinjam", loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      const newHistoryEntry = {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: "Anggota menerima revisi dari BAK",
      };

      await updateDoc(loanRef, {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        jumlahPinjaman: loanData.revisiJumlah || loanData.jumlahPinjaman,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(loanRef, {
        history: [...currentHistory, newHistoryEntry],
      });

      alert(
        "Revisi berhasil diterima. Pengajuan pinjaman menunggu persetujuan Wakil Rektor 2."
      );
    } catch (error) {
      console.error("Error accepting revision:", error);
      alert("Gagal menerima revisi. Silakan coba lagi.");
    }
  };

  // Handle decline revision
  const handleTolakRevisi = async (loanId) => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menolak revisi dari BAK? Pengajuan pinjaman akan ditolak."
      )
    ) {
      return;
    }

    try {
      const loanRef = doc(db, "simpanPinjam", loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      const newHistoryEntry = {
        status: "Revisi Ditolak Anggota",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: "Anggota menolak revisi dari BAK",
      };

      await updateDoc(loanRef, {
        status: "Revisi Ditolak Anggota",
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      });

      alert("Revisi berhasil ditolak. Pengajuan pinjaman telah ditolak.");
    } catch (error) {
      console.error("Error declining revision:", error);
      alert("Gagal menolak revisi. Silakan coba lagi.");
    }
  };

  // Handle cancel loan
  const handleCancelLoan = async (loanId) => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin membatalkan pengajuan pinjaman ini?"
      )
    ) {
      return;
    }

    try {
      const loanRef = doc(db, "simpanPinjam", loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      const newHistoryEntry = {
        status: "Dibatalkan",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: "Pengajuan pinjaman dibatalkan oleh anggota",
      };

      await updateDoc(loanRef, {
        status: "Dibatalkan",
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      });

      alert("Pengajuan pinjaman berhasil dibatalkan");
    } catch (error) {
      console.error("Error cancelling loan:", error);
      alert("Gagal membatalkan pengajuan pinjaman");
    }
  };

  return {
    // State
    userData,
    loading,
    activeTab,
    showPastLoans,
    showRegistrationModal,
    termsAgreed,
    simpananForm,
    pinjamanForm,
    showPinjamanModal,
    currentLoan,
    loans,
    isSubmitting,
    error,
    showLoanHistoryModal,
    selectedLoanForHistory,
    activeLoans,
    pastLoans,
    
    // Setters
    setActiveTab,
    setShowPastLoans,
    setShowRegistrationModal,
    setTermsAgreed,
    setShowPinjamanModal,
    setShowLoanHistoryModal,
    setSelectedLoanForHistory,
    setPinjamanForm,
    
    // Handlers
    handleSimpananChange,
    handlePinjamanChange,
    handleSimpananSubmit,
    handleUpdateToActiveStatus,
    handlePinjamanSubmit,
    handleTerimaRevisi,
    handleTolakRevisi,
    handleCancelLoan,
    
    // Utilities
    formatCurrency,
    formatDate,
    formatDetailedDate,
    getStatusBadgeClass,
    canApplyForLoan,
  };
};