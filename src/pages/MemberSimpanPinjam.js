import React from "react";
import { useMemberSimpanPinjam } from "../hooks/useMemberSimpanPinjam";
import LoanHistoryModal from "../components/LoanHistoryModal";
import PinjamanModal from "../components/PinjamanModal";
import RegistrationModal from "../components/RegistrationModal";
import "../styles/Member.css";
import "../styles/MemberLoanStyles.css";

const MemberSimpanPinjam = () => {
  const {
    // State
    userData,
    loading,
    activeTab,
    showPastLoans,
    showRegistrationModal,
    termsAgreed,
    pinjamanForm,
    showPinjamanModal,
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
    handleUpdateToActiveStatus,
    handlePinjamanSubmit,
    handleTerimaRevisi,
    handleTolakRevisi,
    handleCancelLoan,
    handlePinjamanChange,
    
    // Utilities
    formatCurrency,
    formatDate,
    getStatusBadgeClass,
    canApplyForLoan,
  } = useMemberSimpanPinjam();

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

        <RegistrationModal
          showRegistrationModal={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          termsAgreed={termsAgreed}
          setTermsAgreed={setTermsAgreed}
          handleUpdateToActiveStatus={handleUpdateToActiveStatus}
        />
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
            {(activeLoans.length > 0 || pastLoans.length > 0) && (
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
                        <>
                          <button
                            className="brutal-button primary-button"
                            onClick={() => handleTerimaRevisi(loan.id)}
                          >
                            Terima Revisi
                          </button>
                          <button
                            className="brutal-button error-button"
                            onClick={() => handleTolakRevisi(loan.id)}
                          >
                            Tolak Revisi
                          </button>
                        </>
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
                <div className="flex gap-4 justify-center">
                  <button
                    className="brutal-button primary-button"
                    onClick={() => setShowPinjamanModal(true)}
                  >
                    Ajukan Pinjaman Baru
                  </button>
                  {pastLoans.length > 0 && (
                    <button
                      className="brutal-button secondary-button"
                      onClick={() => setShowPastLoans(true)}
                    >
                      Lihat Riwayat Pinjaman
                    </button>
                  )}
                </div>

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

      <PinjamanModal
        showPinjamanModal={showPinjamanModal}
        onClose={() => setShowPinjamanModal(false)}
        error={error}
        handlePinjamanSubmit={handlePinjamanSubmit}
        pinjamanForm={pinjamanForm}
        setPinjamanForm={setPinjamanForm}
        formatCurrency={formatCurrency}
        handlePinjamanChange={handlePinjamanChange}
        isSubmitting={isSubmitting}
      />

      <LoanHistoryModal
        isOpen={showLoanHistoryModal}
        onClose={() => setShowLoanHistoryModal(false)}
        selectedLoan={selectedLoanForHistory}
      />
    </div>
  );
};

export default MemberSimpanPinjam;