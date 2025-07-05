import React from "react";
import { RegisterStepOne } from "./RegisterStepOne";
import { RegisterStepTwo } from "./RegisterStepTwo";
import { RegisterStepThree } from "./RegisterStepThree";

export const RegisterForm = ({
  registrationStep,
  setShowRegisterModal,
  formData,
  handleRegisterChange,
  handleNextStep,
  handlePrevStep,
  handleRegisterSubmit,
  termsAgreed,
  setTermsAgreed,
  membershipChoice,
  setMembershipChoice,
  handleFileChange,
  fileInputRef,
  paymentProof,
  loading,
  error,
  formatCurrency,
  IURAN_POKOK,
  IURAN_WAJIB
}) => {
  return (
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
        {registrationStep === 1 && (
          <RegisterStepOne
            formData={formData}
            handleRegisterChange={handleRegisterChange}
            handleNextStep={handleNextStep}
            setShowRegisterModal={setShowRegisterModal}
          />
        )}
        
        {registrationStep === 2 && (
          <RegisterStepTwo
            formData={formData}
            handleRegisterChange={handleRegisterChange}
            handleNextStep={handleNextStep}
            handlePrevStep={handlePrevStep}
          />
        )}
        
        {registrationStep === 3 && (
          <RegisterStepThree
            formData={formData}
            termsAgreed={termsAgreed}
            setTermsAgreed={setTermsAgreed}
            membershipChoice={membershipChoice}
            setMembershipChoice={setMembershipChoice}
            handlePrevStep={handlePrevStep}
            handleRegisterSubmit={handleRegisterSubmit}
            handleFileChange={handleFileChange}
            fileInputRef={fileInputRef}
            paymentProof={paymentProof}
            loading={loading}
            formatCurrency={formatCurrency}
            IURAN_POKOK={IURAN_POKOK}
            IURAN_WAJIB={IURAN_WAJIB}
          />
        )}
      </form>
    </div>
  );
};

// Using named exports