import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import "../styles/Member.css";
import "../styles/MemberLoanStyles.css";

const MemberBeranda = ({ setActivePage }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [activeLoans, setActiveLoans] = useState([]);
  const [showLoanHistoryModal, setShowLoanHistoryModal] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [userDocRef, setUserDocRef] = useState(null);
  const [currentDate] = useState(
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
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

  // Fetch active loans
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchActiveLoans = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Query loans collection for this user with active status
        const loansQuery = query(
          collection(db, "simpanPinjam"),
          where("userId", "==", user.uid),
          where("status", "==", "Disetujui dan Aktif")
        );

        // Use onSnapshot for real-time updates
        const unsubscribe = onSnapshot(
          loansQuery,
          (snapshot) => {
            const loansData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setActiveLoans(loansData);
            setLoadingLoans(false);
          },
          (error) => {
            console.error("Error fetching loans:", error);
            setLoadingLoans(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up loans listener:", error);
        setLoadingLoans(false);
      }
    };

    const unsubscribe = fetchActiveLoans();
    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Format currency to IDR
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace("Rp", "Rp ")
      .trim();
  };

  // Format date from Firestore timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";

    // Convert Firebase timestamp to JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    // Format the date
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Disetujui dan Aktif":
      case "Lunas":
        return "status-badge success";
      case "Menunggu Transfer BAK":
      case "Menunggu Persetujuan BAK":
      case "Menunggu Persetujuan Wakil Rektor 2":
        return "status-badge info";
      case "Direvisi BAK":
        return "status-badge warning";
      case "Ditolak BAK":
      case "Ditolak Wakil Rektor 2":
      case "Dibatalkan":
        return "status-badge error";
      default:
        return "status-badge";
    }
  };

  // Format detailed date with time
  const formatDetailedDate = (timestamp) => {
    if (!timestamp) return "-";

    // Convert Firebase timestamp or date object to JS Date
    const date = timestamp.toDate
      ? timestamp.toDate()
      : timestamp instanceof Date
      ? timestamp
      : new Date(timestamp);

    // Format the date with time
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  // Format date from ISO string
  const formatDateIso = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  };

  // Generate a mock transaction history
  const generateTransactionHistory = () => {
    return [
      {
        date: "15 April 2025",
        type: "Simpanan Wajib",
        amount: 25000,
        status: "Sukses",
      },
      {
        date: "15 Maret 2025",
        type: "Simpanan Wajib",
        amount: 25000,
        status: "Sukses",
      },
      {
        date: "15 Februari 2025",
        type: "Simpanan Wajib",
        amount: 25000,
        status: "Sukses",
      },
    ];
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

      // Show success message
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

  if (loading) {
    return (
      <div className="member-content">
        <h2 className="page-title">Beranda</h2>
        <div className="loading-message">Memuat data...</div>
      </div>
    );
  }

  const isInactive = userData?.membershipStatus === "inactive";
  const isApproved = userData?.membershipStatus === "approved";
  const transactions = generateTransactionHistory();
  console.log(isInactive);

  return (
    <div className="member-content">
      <h2 className="page-title">Beranda</h2>

      <div className={`welcome-banner ${isInactive ? "inactive" : ""}`}>
        <div className="welcome-message">
          <span>Selamat datang,</span>
          <h3>{userData?.nama || "Anggota"}</h3>
          {isInactive ? (
            <>
              <p>Aktif sejak: -</p>
              <button
                className="brutal-button primary-button activate-button"
                style={{ backgroundColor: "#ffd166" }}
                onClick={() => setShowRegistrationModal(true)}
              >
                Daftar Anggota Aktif
              </button>
            </>
          ) : (
            <p>Aktif sejak: {formatDate(userData?.registrationDate)}</p>
          )}
        </div>

        <div className="right-section">
          {isInactive && <div className="inactive-stamp">NON AKTIF</div>}

          <div className="balance-card">
            <span className="balance-label">Saldo Simpanan</span>
            <span className="balance-amount">
              {isInactive ? formatCurrency(0) : formatCurrency(275000)}
            </span>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3 className="section-title">Informasi Anggota</h3>

        {userData && (
          <div className="member-info-section">
            <div className="info-item">
              <span className="info-label">Nama:</span>
              <span className="info-value">{userData.nama}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Kantor:</span>
              <span className="info-value">{userData.kantor}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Satuan Kerja:</span>
              <span className="info-value">{userData.satuanKerja || "-"}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Status:</span>
              <span
                className={`status-indicator ${
                  isApproved
                    ? "status-approved"
                    : isInactive
                    ? "status-inactive"
                    : "status-inactive"
                }`}
              >
                {isApproved ? "Approved" : isInactive ? "Non Aktif" : "Pending"}
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">Iuran Pokok:</span>
              <span className="info-value">
                {formatCurrency(userData.iuranPokok || 0)}
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">Iuran Wajib:</span>
              <span className="info-value">
                {formatCurrency(userData.iuranWajib || 0)}/bulan
              </span>
            </div>

            <div className="info-item">
              <span className="info-label">Nomor WhatsApp:</span>
              <span className="info-value">
                {userData.nomorWhatsapp || "-"}
              </span>
            </div>
          </div>
        )}
      </div>

      {isApproved && (
        <>
          <div className="card-container">
            <div className="section-header">
              <h3 className="section-title">Pinjaman Aktif</h3>
              <button
                className="brutal-button primary-button apply-loan-btn"
                onClick={() => setActivePage("simpanpinjam")}
              >
                Ajukan Pinjaman Baru
              </button>
            </div>

            {loadingLoans ? (
              <div className="loading-state">
                <div className="loading-text">Memuat pinjaman...</div>
              </div>
            ) : activeLoans && activeLoans.length > 0 ? (
              <div className="active-loans-list">
                {activeLoans.map((loan) => (
                  <div key={loan.id} className="loan-item">
                    <div className="loan-header">
                      <div className="loan-amount">
                        {formatCurrency(loan.jumlahPinjaman)}
                      </div>
                      <div className="status-badge success">
                        Disetujui dan Aktif
                      </div>
                    </div>
                    <div className="loan-info-grid">
                      <div className="loan-info-item">
                        <div className="loan-info-label">Tenor:</div>
                        <div className="loan-info-value">
                          {loan.tenor} bulan
                        </div>
                      </div>
                      <div className="loan-info-item">
                        <div className="loan-info-label">Tujuan:</div>
                        <div className="loan-info-value">
                          {loan.tujuanPinjaman}
                        </div>
                      </div>
                      <div className="loan-info-item">
                        <div className="loan-info-label">
                          Progres Pembayaran:
                        </div>
                        <div className="loan-info-value">
                          {loan.jumlahMenyicil || 0}/{loan.tenor} cicilan
                        </div>
                      </div>
                      <div className="loan-info-item">
                        <div className="loan-info-label">
                          Tanggal Pengajuan:
                        </div>
                        <div className="loan-info-value">
                          {formatDate(loan.tanggalPengajuan)}
                        </div>
                      </div>
                    </div>
                    <div className="payment-progress-container">
                      <div className="payment-progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${
                              ((loan.jumlahMenyicil || 0) / loan.tenor) * 100
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="loan-actions">
                      <button
                        className="brutal-button secondary-button"
                        onClick={() => {
                          const loanMember = activeLoans.find(
                            (l) => l.id === loan.id
                          );
                          setSelectedLoanForHistory(loanMember);
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
              <div className="empty-state">
                <div className="empty-state-text">
                  Anda belum memiliki pinjaman aktif
                </div>
              </div>
            )}

            <button
              className="btn-link"
              onClick={() => setActivePage("simpanpinjam")}
            >
              Ajukan Pinjaman Baru
            </button>
          </div>
        </>
      )}

      {/* All Transactions Modal/Bottom Sheet */}
      {showAllTransactions && (
        <div
          className="modal-overlay"
          onClick={() => setShowAllTransactions(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Riwayat Transaksi</h3>
              <button
                className="modal-close"
                onClick={() => setShowAllTransactions(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="transaction-history">
                {transactions.map((transaction, index) => (
                  <div key={index} className="transaction-item">
                    <div className="transaction-details">
                      <div className="transaction-date">{transaction.date}</div>
                      <div className="transaction-type">{transaction.type}</div>
                      <div className="transaction-status">
                        {transaction.status}
                      </div>
                    </div>
                    <div className="transaction-amount">
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal/Bottom Sheet */}
      {showRegistrationModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowRegistrationModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Daftar Keanggotaan Aktif</h3>
              <button
                className="modal-close"
                onClick={() => setShowRegistrationModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="registration-info">
                Dengan mendaftar sebagai anggota aktif, Anda akan mendapatkan
                hak dan kewajiban sebagai anggota koperasi.
              </p>

              <div className="terms-agreement">
                <div className="radio-container">
                  <input
                    type="checkbox"
                    id="termsAgreement"
                    checked={termsAgreed}
                    onChange={() => setTermsAgreed(!termsAgreed)}
                    className="brutal-checkbox"
                  />
                  <label htmlFor="termsAgreement" className="checkbox-label">
                    Saya bersedia menjadi anggota Koperasi dan menyetujui
                    persyaratan keanggotaan koperasi termasuk kesediaan dipotong
                    gaji untuk pembayaran iuran koperasi
                  </label>
                </div>
              </div>

              <div className="fee-info">
                <div className="fee-item">
                  <span>Iuran Pokok:</span>
                  <span className="fee-amount">Rp 250.000 (satu kali)</span>
                </div>
                <div className="fee-item">
                  <span>Iuran Wajib:</span>
                  <span className="fee-amount">Rp 25.000 / bulan</span>
                </div>
              </div>

              <button
                className={`brutal-button primary-button ${
                  !termsAgreed ? "button-disabled" : ""
                }`}
                onClick={handleUpdateToActiveStatus}
                disabled={!termsAgreed}
              >
                Daftar
              </button>
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
                      {formatCurrency(selectedLoanForHistory.jumlahPinjaman)}
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
                    <div className="detail-value">
                      <span
                        className={getStatusBadgeClass(
                          selectedLoanForHistory.status
                        )}
                      >
                        {selectedLoanForHistory.status}
                      </span>
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
                        <a
                          href={selectedLoanForHistory.buktiTransfer}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Lihat Dokumen PDF
                        </a>
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

export default MemberBeranda;
