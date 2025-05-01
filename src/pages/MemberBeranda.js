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
} from "firebase/firestore";
import "../styles/Member.css";

const MemberBeranda = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
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

  // Format currency to IDR
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date from ISO string
  const formatDate = (dateString) => {
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
              {isInactive ? formatCurrency(0) : formatCurrency(350000)}
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
          <div className="info-card">
            <h3 className="section-title">Riwayat Transaksi Terakhir</h3>
            <div className="transaction-history">
              {transactions.slice(0, 1).map((transaction, index) => (
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
            <button
              className="btn-link"
              onClick={() => setShowAllTransactions(true)}
            >
              Lihat Semua Transaksi
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
    </div>
  );
};

export default MemberBeranda;
