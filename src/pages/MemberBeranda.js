import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import LoanHistoryModal from "../components/LoanHistoryModal";
import MemberVoucherList from "../components/MemberVoucherList";
import BarcodeExpandedView from "../components/BarcodeExpandedView";
import {
  setupUserDataListener,
  setupActiveLoansListener,
  handleUpdateToActiveStatus,
  formatCurrency,
  formatDate,
  generateTransactionHistory,
  // getCurrentDate,
  getMembershipStatus,
  getBalanceDisplay,
  getLoanButtonText,
  getStatusBadgeClass,
} from "../utils/memberBerandaUtils";
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
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showBarcodeExpanded, setShowBarcodeExpanded] = useState(false);

  // Setup user data listener
  useEffect(() => {
    const unsubscribe = setupUserDataListener(
      setUserData,
      setUserDocRef,
      setLoading
    );
    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Setup active loans listener
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = setupActiveLoansListener(
      setActiveLoans,
      setLoadingLoans
    );
    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Handle membership status update
  const handleMembershipUpdate = () => {
    handleUpdateToActiveStatus(
      termsAgreed,
      userDocRef,
      userData,
      setUserData,
      setShowRegistrationModal
    );
  };

  // Handle loan history modal
  const handleShowLoanHistory = (loan) => {
    const loanMember = activeLoans.find((l) => l.id === loan.id);
    setSelectedLoanForHistory(loanMember);
    setShowLoanHistoryModal(true);
  };
  
  // Handle voucher click for expanded barcode view
  const handleVoucherClick = (voucher) => {
    setSelectedVoucher(voucher);
    setShowBarcodeExpanded(true);
  };

  if (loading) {
    return (
      <div className="member-content">
        <h2 className="page-title">Beranda</h2>
        <div className="loading-message">Memuat data...</div>
      </div>
    );
  }

  const { isInactive, isApproved } = getMembershipStatus(userData);
  const transactions = generateTransactionHistory();
  const balanceDisplay = getBalanceDisplay(isInactive, userData);
  const loanButtonText = getLoanButtonText(activeLoans);

  return (
    <div className="member-content">
      <h2 className="page-title">Beranda</h2>

      <div className={`welcome-banner ${isInactive ? "inactive" : ""}`}>
        <div className="welcome-message">
          <span>Selamat datang,</span>
          <h3>{userData?.nama || "Anggota"}</h3>
          {isInactive ? (
            <>
              <p>Nomor Anggota: -</p>
              <button
                className="brutal-button primary-button activate-button"
                style={{ backgroundColor: "#ffd166" }}
                onClick={() => setShowRegistrationModal(true)}
              >
                Daftar Anggota Aktif
              </button>
            </>
          ) : (
            <p>Nomor Anggota: {userData?.nomorAnggota || "-"}</p>
          )}
        </div>

        <div className="right-section">
          {isInactive && <div className="inactive-stamp">NON AKTIF</div>}

          <div className="balance-card">
            <span className="balance-label">Saldo Simpanan</span>
            <span className="balance-amount">{balanceDisplay.currentBalance}</span>
            {balanceDisplay.nextPayment && (
              <div className="next-payment-info">
                <span className="next-payment-text">
                  <span className="next-payment-amount">+{balanceDisplay.nextPayment.amount}</span> pada tanggal {balanceDisplay.nextPayment.date} {balanceDisplay.nextPayment.description}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isApproved && <MemberVoucherList onVoucherClick={handleVoucherClick} />}

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
                {loanButtonText}
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
                      <div className={getStatusBadgeClass(loan.status)}>
                        {loan.status}
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
                      {loan.status === "Disetujui dan Aktif" && (
                        <div className="loan-info-item">
                          <div className="loan-info-label">
                            Progres Pembayaran:
                          </div>
                          <div className="loan-info-value">
                            {loan.jumlahMenyicil || 0}/{loan.tenor} cicilan
                          </div>
                        </div>
                      )}
                      <div className="loan-info-item">
                        <div className="loan-info-label">
                          Tanggal Pengajuan:
                        </div>
                        <div className="loan-info-value">
                          {formatDate(loan.tanggalPengajuan)}
                        </div>
                      </div>
                    </div>
                    {loan.status === "Disetujui dan Aktif" && (
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
                    )}
                    <div className="loan-actions">
                      <button
                        className="brutal-button secondary-button"
                        onClick={() => handleShowLoanHistory(loan)}
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
              {loanButtonText}
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
                onClick={handleMembershipUpdate}
                disabled={!termsAgreed}
              >
                Daftar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan History Modal */}
      <LoanHistoryModal
        isOpen={showLoanHistoryModal}
        onClose={() => setShowLoanHistoryModal(false)}
        selectedLoan={selectedLoanForHistory}
      />
      
      {/* Expanded Barcode View */}
      <BarcodeExpandedView
        isOpen={showBarcodeExpanded}
        onClose={() => setShowBarcodeExpanded(false)}
        voucher={selectedVoucher}
      />
    </div>
  );
};

export default MemberBeranda;
