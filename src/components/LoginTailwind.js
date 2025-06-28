import React from "react";
import "../styles/Login.css";
// Import each component individually to avoid path issues
import { useLogin } from "./login/useLogin";
import { LoginForm } from "./login/LoginForm";
import { RegisterForm } from "./login/RegisterForm";
import { RegisterSuccess } from "./login/RegisterSuccess";
import { ResetPasswordForm } from "./login/ResetPasswordForm";

const LoginTailwind = () => {
  const {
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
  } = useLogin();

  // If registration is successful, show success message
  if (registerSuccess) {
    return <RegisterSuccess resetForm={resetForm} setRegisterSuccess={setRegisterSuccess} />;
  }

  return (
    <div className="brutal-login-container">
      <div className="brutal-card">
        {showResetPasswordModal ? (
          // Reset Password Form
          <ResetPasswordForm
            resetEmail={resetEmail}
            setResetEmail={setResetEmail}
            handleResetPassword={handleResetPassword}
            setShowResetPasswordModal={setShowResetPasswordModal}
            loading={loading}
            error={error}
            success={success}
            setError={setError}
            setSuccess={setSuccess}
          />
        ) : !showRegisterModal ? (
          // Login Form
          <>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <LoginForm 
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              handleLogin={handleLogin}
              loading={loading}
              setShowRegisterModal={setShowRegisterModal}
              setShowResetPasswordModal={setShowResetPasswordModal}
              setError={setError}
              setSuccess={setSuccess}
            />
          </>
        ) : (
          // Registration Form
          <>
            {error && <div className="error-message">{error}</div>}
            
            <RegisterForm
              registrationStep={registrationStep}
              setShowRegisterModal={setShowRegisterModal}
              formData={formData}
              handleRegisterChange={handleRegisterChange}
              handleNextStep={handleNextStep}
              handlePrevStep={handlePrevStep}
              handleRegisterSubmit={handleRegisterSubmit}
              termsAgreed={termsAgreed}
              setTermsAgreed={setTermsAgreed}
              membershipChoice={membershipChoice}
              setMembershipChoice={setMembershipChoice}
              handleFileChange={handleFileChange}
              fileInputRef={fileInputRef}
              paymentProof={paymentProof}
              loading={loading}
              error={error}
              formatCurrency={formatCurrency}
              IURAN_POKOK={IURAN_POKOK}
              IURAN_WAJIB={IURAN_WAJIB}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default LoginTailwind;
