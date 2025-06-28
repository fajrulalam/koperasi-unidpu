import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import "../styles/Member.css";
import "../styles/MemberLoanStyles.css";
// Navigation handled via window.location

const MemberSimpanPinjam = () => {
  // Using window.location for navigation instead of useNavigate
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
  ];

  const pastLoanStatuses = [
    "Lunas",
    "Ditolak BAK",
    "Ditolak Wakil Rektor 2",
    "Dibatalkan",
  ];

  // Filter loans
  const activeLoans = loans.filter((loan) =>
    activeLoanStatuses.includes(loan.status)
  );
  const pastLoans = loans.filter((loan) =>
    pastLoanStatuses.includes(loan.status)
  );

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Try direct document match first
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setUserDocRef(docRef);
        } else {
          // Try to find by uid field
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
    // Placeholder for API call
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

      // Update local state
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

  // Format date
  const formatDate = (timestamp) => {
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
      });
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

      // Validate form
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

      // Create loan data
      const loanData = {
        userId: userData.uid,
        jumlahPinjaman: jumlah,
        tenor: tenor,
        tujuanPinjaman: pinjamanForm.tujuan,
        catatanTambahan: pinjamanForm.catatan ? [pinjamanForm.catatan] : [], // Convert to array of strings
        status: "Menunggu Persetujuan BAK",
        tanggalPengajuan: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userData: {
          email: userData.email || "",
          namaLengkap: userData.nama || "", // Using nama as namaLengkap
          nik: userData.nik || "",
          noHp: userData.noHp || "",
        },
        history: [
          {
            status: "Menunggu Persetujuan BAK",
            timestamp: new Date(), // Use JavaScript Date instead of serverTimestamp for arrays
            updatedBy: userData.uid,
            notes: "Pengajuan pinjaman baru",
          },
        ],
      };

      // Add to Firestore
      await addDoc(collection(db, "simpanPinjam"), loanData);

      // Reset form
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

      // Create new history entry with client-side timestamp
      const newHistoryEntry = {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: "Anggota menerima revisi dari BAK",
      };

      // First update the document with the new status and updatedAt timestamp
      await updateDoc(loanRef, {
        status: "Menunggu Persetujuan Wakil Rektor 2",
        jumlahPinjaman: loanData.revisiJumlah || loanData.jumlahPinjaman,
        updatedAt: serverTimestamp(),
      });

      // Then update the history array in a separate operation
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

      // Create new history entry with client-side timestamp
      const newHistoryEntry = {
        status: "Dibatalkan",
        timestamp: new Date(),
        updatedBy: userData.uid,
        notes: "Pengajuan pinjaman dibatalkan oleh anggota",
      };

      // Update the loan with the new status and combined history
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

  if (loading) {
    return (
      <div className="member-content">
        <h2 className="page-title">Simpan/Pinjam</h2>
        <p>Memuat data...</p>
      </div>
    );
  }

  // Check if user needs to register first
  if (userData?.membershipStatus !== "approved") {
    return (
      <div className="member-content">
        <h2 className="page-title">Simpan/Pinjam</h2>
        <div className="info-card">
          <h3 className="section-title">Keanggotaan Belum Aktif</h3>
          <p>
            Untuk dapat mengajukan simpanan atau pinjaman, Anda perlu
            mengaktifkan keanggotaan terlebih dahulu.
          </p>
          <button
            className="brutal-button primary-button mt-4"
            onClick={() => setShowRegistrationModal(true)}
          >
            Aktifkan Keanggotaan
          </button>
        </div>

        {/* Registration Modal */}
        {showRegistrationModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowRegistrationModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Syarat dan Ketentuan</h3>
              <div className="terms-box">
                <p>
                  Dengan mengaktifkan keanggotaan, Anda menyetujui untuk
                  membayar:
                </p>
                <ul>
                  <li>Simpanan Pokok: Rp 250.000 (sekali bayar)</li>
                  <li>Simpanan Wajib: Rp 25.000 per bulan</li>
                </ul>
                <p>
                  Pembayaran akan dipotong langsung dari gaji untuk karyawan
                  Unipdu atau dapat dibayarkan secara tunai di kantor koperasi.
                </p>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  Saya menyetujui syarat dan ketentuan di atas
                </label>
              </div>
              <div className="form-actions">
                <button
                  className="brutal-button secondary-button"
                  onClick={() => setShowRegistrationModal(false)}
                >
                  Batal
                </button>
                <button
                  className="brutal-button primary-button"
                  onClick={handleUpdateToActiveStatus}
                  disabled={!termsAgreed}
                >
                  Setuju & Aktifkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal view for active members
  return (
    <div className="member-content">
      <h2 className="page-title">Simpan/Pinjam</h2>

      <div className="tab-container">
        <div
          className={`tab-item ${activeTab === "pinjaman" ? "active" : ""}`}
          onClick={() => setActiveTab("pinjaman")}
        >
          Pinjaman
        </div>
        <div
          className={`tab-item ${activeTab === "simpanan" ? "active" : ""}`}
          onClick={() => setActiveTab("simpanan")}
        >
          Simpanan
        </div>
      </div>

      {activeTab === "pinjaman" && (
        <div className="info-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="section-title">Pinjaman Saya</h3>
            {activeLoans.length > 0 && (
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setShowPastLoans(!showPastLoans)}
              >
                {showPastLoans
                  ? "Sembunyikan Riwayat"
                  : "Lihat Riwayat Pinjaman"}
              </button>
            )}
          </div>

          {!showPastLoans ? (
            activeLoans.length > 0 ? (
              <div className="loan-list">
                {activeLoans.map((loan) => (
                  <div key={loan.id} className="loan-card">
                    <div className="loan-header">
                      <h4>Pinjaman #{loan.id.substring(0, 8)}</h4>
                      <span className={getStatusBadgeClass(loan.status)}>
                        {loan.status}
                      </span>
                    </div>
                    <div className="loan-details">
                      <div className="loan-detail">
                        <span className="detail-label">Jumlah Pinjaman:</span>
                        <span className="detail-value">
                          Rp {loan.jumlahPinjaman?.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="loan-detail">
                        <span className="detail-label">Tenor:</span>
                        <span className="detail-value">{loan.tenor} bulan</span>
                      </div>
                      <div className="loan-detail">
                        <span className="detail-label">Tujuan:</span>
                        <span className="detail-value">
                          {loan.tujuanPinjaman}
                        </span>
                      </div>
                      {loan.status === "Disetujui dan Aktif" && (
                        <>
                          <div className="loan-detail">
                            <span className="detail-label">
                              Progres Pembayaran:
                            </span>
                            <span className="detail-value">
                              {loan.jumlahMenyicil || 0}/{loan.tenor} cicilan
                            </span>
                          </div>
                          <div className="payment-progress-container">
                            <div className="payment-progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${
                                    ((loan.jumlahMenyicil || 0) / loan.tenor) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="loan-detail">
                        <span className="detail-label">Tanggal Pengajuan:</span>
                        <span className="detail-value">
                          {formatDate(loan.tanggalPengajuan)}
                        </span>
                      </div>
                      {loan.catatanTambahan && (
                        <div className="loan-detail">
                          <span className="detail-label">Catatan:</span>
                          <span className="detail-value">
                            {loan.catatanTambahan}
                          </span>
                        </div>
                      )}
                      {loan.alasanPenolakan && (
                        <div className="loan-detail">
                          <span className="detail-label">
                            Alasan Penolakan:
                          </span>
                          <span className="detail-value error-text">
                            {loan.alasanPenolakan}
                          </span>
                        </div>
                      )}
                      {loan.revisiJumlah && (
                        <div className="loan-detail">
                          <span className="detail-label">Revisi Jumlah:</span>
                          <span className="detail-value warning-text">
                            Rp {loan.revisiJumlah.toLocaleString("id-ID")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="loan-actions">
                      {loan.status === "Direvisi BAK" && (
                        <button
                          className="brutal-button primary-button"
                          onClick={() => handleTerimaRevisi(loan.id)}
                        >
                          Terima Revisi
                        </button>
                      )}
                      {loan.status === "Menunggu Persetujuan BAK" && (
                        <button
                          className="brutal-button secondary-button"
                          onClick={() => handleCancelLoan(loan.id)}
                        >
                          Batalkan
                        </button>
                      )}
                      <button
                        className="brutal-button info-button"
                        onClick={() => {
                          setSelectedLoanForHistory(loan);
                          setShowLoanHistoryModal(true);
                        }}
                      >
                        Lihat Riwayat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-loans text-center py-8">
                <p className="text-gray-600 mb-4">
                  Tidak ada pinjaman yang sedang berlangsung
                </p>
                <button
                  className="brutal-button primary-button"
                  onClick={() => setShowPinjamanModal(true)}
                >
                  Ajukan Pinjaman Baru
                </button>

                <div className="loan-terms mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-lg mb-3 text-gray-800">
                    Ketentuan Pinjaman
                  </h4>
                  <ul className="list-disc pl-5 space-y-2 text-gray-700">
                    <li>Lama cicilan maksimum 12 bulan</li>
                    <li>
                      Setiap anggota maksimal boleh meminjam sebesar cicilan per
                      bulannya 40% dari take home pay/Pendapatan rata-rata dalam
                      1 tahun
                    </li>
                    <li>
                      Waktu pencairan pinjaman tiap hari Selasa (kecuali hari
                      libur)
                    </li>
                  </ul>

                  <div className="mt-4">
                    <h5 className="font-semibold mb-2 text-gray-800">
                      Biaya Administrasi:
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-left">
                            <th className="border border-gray-300 p-2 bg-gray-100">
                              No
                            </th>
                            <th className="border border-gray-300 p-2 bg-gray-100">
                              Besaran Pinjaman
                            </th>
                            <th className="border border-gray-300 p-2 bg-gray-100">
                              Biaya Adm*
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 p-2">1</td>
                            <td className="border border-gray-300 p-2">
                              Rp.1 - 2 JT
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rp. 100.000
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-2">2</td>
                            <td className="border border-gray-300 p-2">
                              Rp.3 - 4 JT
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rp. 200.000
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-2">3</td>
                            <td className="border border-gray-300 p-2">
                              Rp.5 - 6 JT
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rp. 300.000
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-2">4</td>
                            <td className="border border-gray-300 p-2">
                              Rp.7 - 8 JT
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rp. 400.000
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-2">5</td>
                            <td className="border border-gray-300 p-2">
                              Rp.9 - 10 JT
                            </td>
                            <td className="border border-gray-300 p-2">
                              Rp. 500.000
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      *sudah termasuk biaya transfer & dipotong pada penerimaan
                      pinjaman
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="loan-list">
              {pastLoans.length > 0 ? (
                pastLoans.map((loan) => (
                  <div key={loan.id} className="loan-card">
                    <div className="loan-header">
                      <h4>Pinjaman #{loan.id.substring(0, 8)}</h4>
                      <span className={getStatusBadgeClass(loan.status)}>
                        {loan.status}
                      </span>
                    </div>
                    <div className="loan-details">
                      <div className="loan-detail">
                        <span className="detail-label">Jumlah Pinjaman:</span>
                        <span className="detail-value">
                          Rp {loan.jumlahPinjaman?.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="loan-detail">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value">{loan.status}</span>
                      </div>
                      <div className="loan-detail">
                        <span className="detail-label">Tanggal Pengajuan:</span>
                        <span className="detail-value">
                          {formatDate(loan.tanggalPengajuan)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-600 py-8">
                  Tidak ada riwayat pinjaman
                </p>
              )}
            </div>
          )}

          {activeLoans.length > 0 && !showPastLoans && (
            <div className="form-actions mt-6">
              <button
                className="brutal-button primary-button"
                onClick={() => setShowPinjamanModal(true)}
                disabled={!canApplyForLoan()}
              >
                Ajukan Pinjaman Baru
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Anda memiliki pinjaman yang sedang berlangsung
              </p>

              <div className="loan-terms mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-lg mb-3 text-gray-800">
                  Ketentuan Pinjaman
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>Lama cicilan maksimum 12 bulan</li>
                  <li>
                    Setiap anggota maksimal boleh meminjam sebesar cicilan per
                    bulannya 40% dari take home pay/Pendapatan rata-rata dalam 1
                    tahun
                  </li>
                  <li>
                    Waktu pencairan pinjaman tiap hari Selasa (kecuali hari
                    libur)
                  </li>
                </ul>

                <div className="mt-4">
                  <h5 className="font-semibold mb-2 text-gray-800">
                    Biaya Administrasi:
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left">
                          <th className="border border-gray-300 p-2 bg-gray-100">
                            No
                          </th>
                          <th className="border border-gray-300 p-2 bg-gray-100">
                            Besaran Pinjaman
                          </th>
                          <th className="border border-gray-300 p-2 bg-gray-100">
                            Biaya Adm*
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-300 p-2">1</td>
                          <td className="border border-gray-300 p-2">
                            Rp.1 - 2 JT
                          </td>
                          <td className="border border-gray-300 p-2">
                            Rp. 100.000
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2">2</td>
                          <td className="border border-gray-300 p-2">
                            Rp.3 - 4 JT
                          </td>
                          <td className="border border-gray-300 p-2">
                            Rp. 200.000
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2">3</td>
                          <td className="border border-gray-300 p-2">
                            Rp.5 - 6 JT
                          </td>
                          <td className="border border-gray-300 p-2">
                            Rp. 300.000
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2">4</td>
                          <td className="border border-gray-300 p-2">
                            Rp.7 - 8 JT
                          </td>
                          <td className="border border-gray-300 p-2">
                            Rp. 400.000
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 p-2">5</td>
                          <td className="border border-gray-300 p-2">
                            Rp.9 - 10 JT
                          </td>
                          <td className="border border-gray-300 p-2">
                            Rp. 500.000
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    *sudah termasuk biaya transfer & dipotong pada penerimaan
                    pinjaman
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "simpanan" && (
        <div className="info-card">
          <h3 className="section-title">Ajukan Simpanan</h3>

          <div className="info-box mt-6">
            <h4>Masih dalam Pengembangan....</h4>
            <ul>
              <li>Fitur ini masih dalam pengembangan</li>
            </ul>
          </div>
        </div>
      )}

      {/* Pinjaman Modal */}
      {showPinjamanModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPinjamanModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ajukan Pinjaman</h3>
              <button
                className="modal-close"
                onClick={() => setShowPinjamanModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handlePinjamanSubmit}>
                <div className="form-group">
                  <label htmlFor="jumlah">Jumlah Pinjaman (Rp)</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">Rp</span>
                    <input
                      id="jumlah"
                      name="jumlah"
                      type="text"
                      value={pinjamanForm.jumlah}
                      onChange={(e) => {
                        setPinjamanForm({
                          ...pinjamanForm,
                          jumlah: formatCurrency(e.target.value),
                        });
                      }}
                      className="form-input"
                      required
                      placeholder="1.000.000 - 10.000.000"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="tenor">Tenor (bulan)</label>
                  <select
                    id="tenor"
                    name="tenor"
                    value={pinjamanForm.tenor}
                    onChange={handlePinjamanChange}
                    className="form-input"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="3">3 bulan</option>
                    <option value="6">6 bulan</option>
                    <option value="12">12 bulan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tujuan">Tujuan Pinjaman</label>
                  <input
                    id="tujuan"
                    name="tujuan"
                    type="text"
                    value={pinjamanForm.tujuan}
                    onChange={handlePinjamanChange}
                    className="form-input"
                    required
                    placeholder="Contoh: Pendidikan, Kesehatan, dll."
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="catatan">
                    Catatan Tambahan (opsional, maks 500 karakter)
                  </label>
                  <textarea
                    id="catatan"
                    name="catatan"
                    value={pinjamanForm.catatan}
                    onChange={handlePinjamanChange}
                    className="form-input"
                    rows="3"
                    placeholder="Tambahkan catatan jika diperlukan"
                    maxLength="500"
                    disabled={isSubmitting}
                  />
                  <div className="character-count">
                    {pinjamanForm.catatan.length}/500 karakter
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="brutal-button secondary-button"
                    onClick={() => setShowPinjamanModal(false)}
                    disabled={isSubmitting}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="brutal-button primary-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Mengajukan..." : "Ajukan Pinjaman"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Loan History Modal */}
      {showLoanHistoryModal && selectedLoanForHistory && (
        <div
          className="modal-overlay"
          onClick={() => setShowLoanHistoryModal(false)}
        >
          <div
            className="modal-content loan-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                Riwayat Pinjaman #{selectedLoanForHistory.id.substring(0, 8)}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowLoanHistoryModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Loan Info */}
              <div className="loan-detail-section">
                <h4>Informasi Pinjaman</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">Jumlah Pinjaman</div>
                    <div className="detail-value">
                      Rp{" "}
                      {selectedLoanForHistory.jumlahPinjaman?.toLocaleString(
                        "id-ID"
                      )}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Tenor</div>
                    <div className="detail-value">
                      {selectedLoanForHistory.tenor} bulan
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Tujuan</div>
                    <div className="detail-value">
                      {selectedLoanForHistory.tujuanPinjaman}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Status</div>
                    <div
                      className={`detail-value status-${getStatusBadgeClass(
                        selectedLoanForHistory.status
                      )}`}
                    >
                      {selectedLoanForHistory.status}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Tanggal Pengajuan</div>
                    <div className="detail-value">
                      {formatDate(selectedLoanForHistory.tanggalPengajuan)}
                    </div>
                  </div>
                  {selectedLoanForHistory.tanggalDisetujui && (
                    <div className="detail-item">
                      <div className="detail-label">Tanggal Disetujui</div>
                      <div className="detail-value">
                        {formatDate(selectedLoanForHistory.tanggalDisetujui)}
                      </div>
                    </div>
                  )}
                  {selectedLoanForHistory.status === "Disetujui dan Aktif" && (
                    <div className="detail-item wide">
                      <div className="detail-label">Progres Pembayaran</div>
                      <div className="detail-value">
                        {selectedLoanForHistory.jumlahMenyicil || 0}/
                        {selectedLoanForHistory.tenor} cicilan
                      </div>
                      <div className="payment-progress-container">
                        <div className="payment-progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${
                                ((selectedLoanForHistory.jumlahMenyicil || 0) /
                                  selectedLoanForHistory.tenor) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Proof Section - only show if available */}
              {selectedLoanForHistory.buktiTransfer && (
                <div className="loan-detail-section">
                  <h4>Bukti Transfer</h4>
                  <div className="payment-proof-container">
                    {selectedLoanForHistory.buktiTransfer
                      .toLowerCase()
                      .includes(".pdf") ? (
                      <div className="payment-proof-link">
                        <i className="file-icon">📄</i>
                        <button
                          className="download-pdf-btn"
                          onClick={() =>
                            window.open(
                              selectedLoanForHistory.buktiTransfer,
                              "_blank"
                            )
                          }
                        >
                          Download Bukti Transfer
                        </button>
                      </div>
                    ) : (
                      <img
                        src={selectedLoanForHistory.buktiTransfer}
                        alt="Bukti Transfer"
                        className="payment-proof-image"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Loan History Timeline */}
              <div className="loan-detail-section">
                <h4>Riwayat Status Pinjaman</h4>
                <div className="history-timeline">
                  {selectedLoanForHistory.history &&
                  selectedLoanForHistory.history.length > 0 ? (
                    selectedLoanForHistory.history.map((entry, index) => (
                      <div key={index} className="history-item">
                        <div className="history-marker"></div>
                        <div className="history-content">
                          <div
                            className={`history-status ${getStatusBadgeClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </div>
                          <div className="history-time">
                            {formatDetailedDate(entry.timestamp)}
                          </div>
                          <div className="history-notes">{entry.notes}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>Tidak ada riwayat</p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="brutal-button secondary-button"
                onClick={() => setShowLoanHistoryModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberSimpanPinjam;
