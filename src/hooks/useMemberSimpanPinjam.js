import { useState, useEffect } from "react";
import { auth, db, getEnvironmentCollectionPath } from "../firebase";
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
import { useEnvironment } from "../context/EnvironmentContext";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

export const useMemberSimpanPinjam = () => {
  const { isProduction } = useEnvironment();
  const spPath = getEnvironmentCollectionPath("simpanPinjam", isProduction);
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
    bank: "",
    nomorRekening: "",
  });
  const [showPinjamanModal, setShowPinjamanModal] = useState(false);

  // Custom setter for showPinjamanModal that prefills bank details
  const handleTogglePinjamanModal = (isOpen) => {
    // If isOpen is undefined or true, open the modal
    if (isOpen === undefined || isOpen === true) {
      // Prefill bank details from user data if available
      if (userData?.bankDetails) {
        setPinjamanForm((prev) => ({
          ...prev,
          bank: userData.bankDetails.bank || "",
          nomorRekening: userData.bankDetails.nomorRekening || "",
        }));
      }
      setShowPinjamanModal(true);
    } else {
      // If isOpen is false, close the modal
      setShowPinjamanModal(false);
    }
  };
  const [currentLoan] = useState(null);
  const [loans, setLoans] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showLoanHistoryModal, setShowLoanHistoryModal] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);
  const [showRestrukturisasiModal, setShowRestrukturisasiModal] = useState(false);
  const [selectedLoanForRestruktur, setSelectedLoanForRestruktur] = useState(null);

  // Define loan status categories
  const activeLoanStatuses = [
    "Menunggu Persetujuan BAK",
    "Menunggu Persetujuan Wakil Rektor 2",
    "Direvisi BAK",
    "Disetujui dan Aktif",
    "Menunggu Transfer BAK",
    "Menunggu Persetujuan Restrukturisasi",
  ];

  const pastLoanStatuses = [
    "Lunas",
    "Ditolak BAK",
    "Ditolak Wakil Rektor 2",
    "Dibatalkan",
    "Revisi Ditolak Anggota",
    "Direstrukturisasi",
  ];

  const sortByPengajuanDesc = (a, b) => {
    const aTime = a.tanggalPengajuan?.toDate
      ? a.tanggalPengajuan.toDate()
      : new Date(a.tanggalPengajuan || 0);
    const bTime = b.tanggalPengajuan?.toDate
      ? b.tanggalPengajuan.toDate()
      : new Date(b.tanggalPengajuan || 0);
    return bTime - aTime;
  };

  const activeLoans = loans
    .filter((loan) => activeLoanStatuses.includes(loan.status))
    .sort(sortByPengajuanDesc);
  const pastLoans = loans
    .filter((loan) => pastLoanStatuses.includes(loan.status))
    .sort(sortByPengajuanDesc);

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
      collection(db, spPath),
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
  }, [userData, spPath]);

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

      const wibDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);

      const dateStr = date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const timeStr = wibDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
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
      case "Menunggu Persetujuan Restrukturisasi":
        return "status-badge restructuring-pending";
      case "Direstrukturisasi":
        return "status-badge restructured";
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
      if (tenor < 3 || tenor > 12) {
        throw new Error("Pilih tenor antara 3 - 12 bulan");
      }
      // Validate bank details
      if (!pinjamanForm.bank) {
        throw new Error("Silakan pilih bank untuk transfer");
      }
      if (!pinjamanForm.nomorRekening) {
        throw new Error("Nomor rekening harus diisi");
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
        biayaAdmin: calculateFee(jumlah),
        sisaHutang: jumlah,
        bankDetails: {
          bank: pinjamanForm.bank,
          nomorRekening: pinjamanForm.nomorRekening,
        },
        userData: {
          email: userData.email || "",
          namaLengkap: userData.nama || "",
          nik: userData.nik || "",
          nomorWhatsapp: userData.nomorWhatsapp || "",
          kantor: userData.kantor || "",
          satuanKerja: userData.satuanKerja || "",
          nomorAnggota: userData.nomorAnggota || "",
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

      await addDoc(collection(db, spPath), loanData);

      setPinjamanForm({
        jumlah: "",
        tenor: "3",
        tujuan: "",
        catatan: "",
        bank: "",
        nomorRekening: "",
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
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      const updateData = {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        jumlahPinjaman: loanData.revisiJumlah || loanData.jumlahPinjaman,
        updatedAt: serverTimestamp(),
      };

      const historyNotes = ["Anggota menerima revisi dari BAK"];

      // For restructured loans, re-fetch the old loan's latest sisaHutang
      if (loanData.restructuredFromLoanId) {
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);

        if (oldLoanSnap.exists()) {
          const oldLoanData = oldLoanSnap.data();
          const latestSisaHutang = oldLoanData.sisaHutang ?? (() => {
            const j = oldLoanData.jumlahPinjaman || 0;
            const m = oldLoanData.jumlahMenyicil || 0;
            const t = oldLoanData.tenor || 1;
            return Math.max(0, j - m * Math.round(j / t));
          })();

          const previousSisa = loanData.sisaPinjamanSebelumnya || 0;

          if (latestSisaHutang !== previousSisa) {
            const jumlahPinjaman = updateData.jumlahPinjaman;
            const newPinjamanBaru = jumlahPinjaman - latestSisaHutang;

            // Recalculate with fresh sisaHutang but keep the revised total
            // If the old loan's debt decreased, the "pinjaman tambahan" portion increases
            updateData.sisaPinjamanSebelumnya = latestSisaHutang;
            updateData.pinjamanBaru = newPinjamanBaru;
            updateData.biayaAdmin = calculateFee(jumlahPinjaman);
            updateData.sisaHutang = jumlahPinjaman;

            // Recalculate remaining tenor from old loan
            const oldRemainingTenor = (oldLoanData.tenor || 0) - (oldLoanData.jumlahMenyicil || 0);
            const currentTenor = loanData.tenor || 0;
            const currentAdditionalTenor = loanData.additionalTenor || 0;
            const previousRemainingTenor = currentTenor - currentAdditionalTenor;

            if (oldRemainingTenor !== previousRemainingTenor) {
              const newTenor = oldRemainingTenor + currentAdditionalTenor;
              updateData.tenor = newTenor;
            }

            updateData.catatanTambahan = [
              `Restrukturisasi dari pinjaman #${loanData.restructuredFromLoanId.substring(0, 8)}. Sisa hutang saat pengajuan: Rp ${latestSisaHutang.toLocaleString("id-ID")}, Pinjaman tambahan: Rp ${newPinjamanBaru.toLocaleString("id-ID")}`,
            ];

            historyNotes.push(
              `Sisa hutang lama diperbarui dari Rp ${previousSisa.toLocaleString("id-ID")} menjadi Rp ${latestSisaHutang.toLocaleString("id-ID")} (ada cicilan terbayar selama proses revisi)`
            );
          }
        }
      }

      const newHistoryEntry = {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: historyNotes.join(". "),
      };

      updateData.history = [...currentHistory, newHistoryEntry];

      await updateDoc(loanRef, updateData);

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
      const loanRef = doc(db, spPath, loanId);
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

      // If this was a restructured loan, revert the old loan back to active
      if (loanData.restructuredFromLoanId) {
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);

        if (oldLoanSnap.exists()) {
          const oldLoanData = oldLoanSnap.data();
          if (oldLoanData.status === "Menunggu Persetujuan Restrukturisasi") {
            await updateDoc(oldLoanRef, {
              status: "Disetujui dan Aktif",
              restructuredToLoanId: null,
              updatedAt: serverTimestamp(),
              history: [
                ...(oldLoanData.history || []),
                {
                  status: "Disetujui dan Aktif",
                  timestamp: new Date(),
                  updatedBy: userData.uid,
                  notes: `Pengajuan restrukturisasi #${loanId.substring(0, 8)} ditolak anggota. Pinjaman dikembalikan ke status aktif.`,
                },
              ],
            });
          }
        }
      }

      alert("Revisi berhasil ditolak. Pengajuan pinjaman telah ditolak.");
    } catch (error) {
      console.error("Error declining revision:", error);
      alert("Gagal menolak revisi. Silakan coba lagi.");
    }
  };

  const hasPendingRestrukturisasi = (loan) => {
    return loan.status === "Menunggu Persetujuan Restrukturisasi";
  };

  // Handle restructuring submission
  const handleRestrukturisasi = async (data) => {
    setIsSubmitting(true);
    setError("");
    try {
      const {
        oldLoanId,
        sisaPinjamanSebelumnya,
        pinjamanBaru,
        jumlahPinjaman,
        tenor,
        additionalTenor,
        biayaAdmin,
        bank,
        nomorRekening,
      } = data;

      const loanData = {
        userId: userData.uid,
        jumlahPinjaman,
        tenor,
        additionalTenor,
        tujuanPinjaman: "Restrukturisasi pinjaman",
        catatanTambahan: [
          `Restrukturisasi dari pinjaman #${oldLoanId.substring(0, 8)}. Sisa hutang saat pengajuan: Rp ${sisaPinjamanSebelumnya.toLocaleString("id-ID")}, Pinjaman tambahan: Rp ${pinjamanBaru.toLocaleString("id-ID")}`,
        ],
        status: "Menunggu Persetujuan BAK",
        tanggalPengajuan: serverTimestamp(),
        updatedAt: serverTimestamp(),
        biayaAdmin,
        sisaHutang: jumlahPinjaman,
        restructuredFromLoanId: oldLoanId,
        sisaPinjamanSebelumnya,
        pinjamanBaru,
        bankDetails: { bank, nomorRekening },
        userData: {
          email: userData.email || "",
          namaLengkap: userData.nama || "",
          nik: userData.nik || "",
          nomorWhatsapp: userData.nomorWhatsapp || "",
          kantor: userData.kantor || "",
          satuanKerja: userData.satuanKerja || "",
          nomorAnggota: userData.nomorAnggota || "",
        },
        history: [
          {
            status: "Menunggu Persetujuan BAK",
            timestamp: new Date(),
            updatedBy: userData.uid,
            notes: `Pengajuan restrukturisasi dari pinjaman #${oldLoanId.substring(0, 8)}`,
          },
        ],
      };

      const newLoanRef = await addDoc(collection(db, spPath), loanData);

      // Update old loan status to indicate pending restructuring
      const oldLoanRef = doc(db, spPath, oldLoanId);
      const oldLoanSnap = await getDoc(oldLoanRef);
      if (oldLoanSnap.exists()) {
        const oldLoanData = oldLoanSnap.data();
        const oldHistory = oldLoanData.history || [];

        await updateDoc(oldLoanRef, {
          status: "Menunggu Persetujuan Restrukturisasi",
          restructuredToLoanId: newLoanRef.id,
          updatedAt: serverTimestamp(),
          history: [
            ...oldHistory,
            {
              status: "Menunggu Persetujuan Restrukturisasi",
              timestamp: new Date(),
              updatedBy: userData.uid,
              notes: `Pengajuan restrukturisasi ke pinjaman baru #${newLoanRef.id.substring(0, 8)}. Sisa hutang saat pengajuan: Rp ${sisaPinjamanSebelumnya.toLocaleString("id-ID")}`,
            },
          ],
        });
      }

    } catch (error) {
      console.error("Error submitting restructuring:", error);
      setError("Gagal mengajukan restrukturisasi. Silakan coba lagi.");
      throw error;
    } finally {
      setIsSubmitting(false);
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
      const loanRef = doc(db, spPath, loanId);
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

      // If this was a restructuring request, revert the old loan back to active
      if (loanData.restructuredFromLoanId) {
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);

        if (oldLoanSnap.exists()) {
          const oldLoanData = oldLoanSnap.data();
          if (oldLoanData.status === "Menunggu Persetujuan Restrukturisasi") {
            const oldHistory = oldLoanData.history || [];
            await updateDoc(oldLoanRef, {
              status: "Disetujui dan Aktif",
              restructuredToLoanId: null,
              updatedAt: serverTimestamp(),
              history: [
                ...oldHistory,
                {
                  status: "Disetujui dan Aktif",
                  timestamp: new Date(),
                  updatedBy: userData.uid,
                  notes: `Pengajuan restrukturisasi #${loanId.substring(0, 8)} dibatalkan oleh anggota. Pinjaman dikembalikan ke status aktif.`,
                },
              ],
            });
          }
        }
      }

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
    userDocRef,
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
    showRestrukturisasiModal,
    selectedLoanForRestruktur,

    // Setters
    setActiveTab,
    setShowPastLoans,
    setShowRegistrationModal,
    setTermsAgreed,
    setShowPinjamanModal: handleTogglePinjamanModal,
    setShowLoanHistoryModal,
    setSelectedLoanForHistory,
    setPinjamanForm,
    setShowRestrukturisasiModal,
    setSelectedLoanForRestruktur,

    // Handlers
    handleSimpananChange,
    handlePinjamanChange,
    handleSimpananSubmit,
    handleUpdateToActiveStatus,
    handlePinjamanSubmit,
    handleTerimaRevisi,
    handleTolakRevisi,
    handleCancelLoan,
    handleRestrukturisasi,

    // Utilities
    formatCurrency,
    formatDate,
    formatDetailedDate,
    getStatusBadgeClass,
    canApplyForLoan,
    hasPendingRestrukturisasi,
  };
};
