import React from "react";

export const RegisterStepThree = ({ 
  formData,
  termsAgreed,
  setTermsAgreed,
  membershipChoice,
  setMembershipChoice,
  handlePrevStep,
  handleRegisterSubmit,
  handleFileChange,
  fileInputRef,
  paymentProof,
  loading,
  formatCurrency,
  IURAN_POKOK,
  IURAN_WAJIB
}) => {
  const isUnipdu = formData.kantor === "Unipdu";

  return (
    <>
      <h3 className="form-title">
        {isUnipdu ? "Persetujuan Iuran" : "Bukti Pembayaran"}
      </h3>

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

// Using named exports