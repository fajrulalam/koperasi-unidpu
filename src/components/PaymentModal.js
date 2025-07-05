// src/components/PaymentModal.js
import React, { useState, useRef, useEffect } from "react";
import Modal from "react-modal";
import { formatCurrency, validateVoucher } from "../utils/transaksiUtils";
import "../styles/PaymentModal.css";

// Set app element for accessibility
if (typeof document !== 'undefined') {
  Modal.setAppElement(document.getElementById('root') || document.body);
}

const customStyles = {
  content: {
    border: "1px solid #ccc",
    borderRadius: "5px",
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    padding: "20px",
    backgroundColor: "#fff",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
};

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  total, 
  onPaymentComplete,
  isProcessing = false,
  onVoucherCheck,
  firestore 
}) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [change, setChange] = useState(0);
  const [error, setError] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState("");
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const amountPaidRef = useRef(null);
  const voucherIdRef = useRef(null);
  const checkVoucherRef = useRef(null);

  console.log("PaymentModal render - isOpen:", isOpen, "total:", total);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setAmountPaid("");
      setChange(0);
      setError("");
      setVoucherId("");
      setAppliedVoucher(null);
      setVoucherError("");
      setIsCheckingVoucher(false);
    }
  }, [isOpen]);

  const calculateDiscountedTotal = () => {
    let discountedTotal = total;
    if (appliedVoucher) {
      discountedTotal = Math.max(0, total - appliedVoucher.value);
    }
    return discountedTotal;
  };

  const handleAmountPaidChange = (e) => {
    // Remove all non-digit characters including existing thousand separators
    const raw = e.target.value.replace(/\D/g, "");

    // Parse to number
    const numeric = parseInt(raw, 10) || 0;

    // Format with dots for display
    const formatted = numeric.toLocaleString("id-ID");
    setAmountPaid(formatted);

    // Calculate with discount if voucher is applied
    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    // Compare the numeric values
    if (numeric >= totalNumeric) {
      setChange(numeric - totalNumeric);
      setError("");
    } else {
      setChange(0);
      setError("Uang yang diterima kurang dari harga pembelian");
    }
  };

  const handleVoucherIdChange = (e) => {
    setVoucherId(e.target.value);
    setVoucherError("");
  };

  const handleVoucherKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (checkVoucherRef.current) {
        checkVoucherRef.current.focus();
      }
    }
  };

  const handleCheckVoucher = async () => {
    if (!voucherId.trim()) {
      setVoucherError("Masukkan ID voucher");
      return;
    }

    setIsCheckingVoucher(true);
    setVoucherError("");

    try {
      // Query voucher by document ID
      const voucherDoc = await firestore.readDoc("vouchers", voucherId.trim())
      console.log("voucherid " + voucherId.trim())
      if (!voucherDoc) {
        setVoucherError("Voucher tidak ditemukan nihh");
        setIsCheckingVoucher(false);
        return;
      }

      // Validate voucher using utility function
      const validation = validateVoucher(voucherDoc);

      if (!validation.isValid) {
        setVoucherError(validation.message);
        setIsCheckingVoucher(false);
        return;
      }

      // Apply voucher
      setAppliedVoucher({
        id: voucherId.trim(),
        name: voucherDoc.voucherName,
        value: voucherDoc.value,
        memberName: voucherDoc.nama
      });

      // Recalculate payment amount if needed
      const discountedTotal = Math.max(0, total - voucherDoc.value);
      const currentPaidNumeric = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;

      if (currentPaidNumeric >= discountedTotal) {
        setChange(currentPaidNumeric - discountedTotal);
        setError("");
      } else if (currentPaidNumeric > 0) {
        setChange(0);
        setError("Uang yang diterima kurang dari harga pembelian");
      }

      setIsCheckingVoucher(false);
    } catch (error) {
      console.error("Error checking voucher:", error);
      setVoucherError("Terjadi kesalahan saat memeriksa voucher");
      setIsCheckingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherId("");
    setVoucherError("");
    
    // Recalculate payment without voucher
    const currentPaidNumeric = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
    const totalNumeric = typeof total === "string" ? parseInt(total.replace(/\D/g, ""), 10) : total;
    
    if (currentPaidNumeric >= totalNumeric) {
      setChange(currentPaidNumeric - totalNumeric);
      setError("");
    } else if (currentPaidNumeric > 0) {
      setChange(0);
      setError("Uang yang diterima kurang dari harga pembelian");
    }
  };

  const handleComplete = () => {
    const numericAmountPaid = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    if (numericAmountPaid < totalNumeric) {
      setError("Uang yang diterima kurang dari harga pembelian");
      return;
    }

    onPaymentComplete({
      amountPaid,
      change,
      numericAmountPaid,
      totalNumeric,
      appliedVoucher,
      originalTotal: total
    });
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      contentLabel="Pembayaran"
      className="payment-modal"
      overlayClassName="payment-modal-overlay"
      style={customStyles}
      onAfterOpen={() => {
        // Focus on the payment input when modal opens
        if (amountPaidRef.current) {
          amountPaidRef.current.focus();
        }
      }}
    >
      <h2>Pembayaran</h2>
      <div className="payment-modal-content">
        <div className="modal-row">
          <label>Total:</label>
          <span className="modal-value">{formatCurrency(total)}</span>
        </div>

        {/* Voucher Section */}
        <div className="voucher-section">
          <div className="modal-row">
            <label>ID Voucher:</label>
            <div className="voucher-input-group">
              <input
                ref={voucherIdRef}
                type="text"
                className="modal-input voucher-input"
                value={voucherId}
                onChange={handleVoucherIdChange}
                onKeyDown={handleVoucherKeyDown}
                disabled={isProcessing || appliedVoucher}
                placeholder="Scan atau masukkan ID voucher"
              />
              <button
                ref={checkVoucherRef}
                type="button"
                className="check-voucher-btn"
                onClick={handleCheckVoucher}
                disabled={isProcessing || isCheckingVoucher || appliedVoucher}
              >
                {isCheckingVoucher ? "Checking..." : "Check Voucher"}
              </button>
            </div>
          </div>

          {voucherError && (
            <div className="voucher-error">{voucherError}</div>
          )}

          {appliedVoucher && (
            <div className="applied-voucher">
              <div className="voucher-info">
                <span className="voucher-name">{appliedVoucher.name}</span>
                <span className="voucher-member">({appliedVoucher.memberName})</span>
                <span className="voucher-discount">-{formatCurrency(appliedVoucher.value)}</span>
              </div>
              <button
                type="button"
                className="remove-voucher-btn"
                onClick={removeVoucher}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>
          )}

          {appliedVoucher && (
            <div className="modal-row">
              <label>Diskon:</label>
              <span className="modal-value discount-value">-{formatCurrency(appliedVoucher.value)}</span>
            </div>
          )}

          <div className="modal-row">
            <label>Total Setelah Diskon:</label>
            <span className="modal-value">{formatCurrency(calculateDiscountedTotal())}</span>
          </div>
        </div>

        <div className="modal-row">
          <label>Jumlah Bayar:</label>
          <input
            ref={amountPaidRef}
            type="text"
            className="modal-input"
            value={amountPaid}
            onChange={handleAmountPaidChange}
            disabled={isProcessing}
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-row">
          <label>Kembalian:</label>
          <span className="modal-value">{formatCurrency(change)}</span>
        </div>
        
        {isProcessing && (
          <div className="processing-message">
            Transaksi sedang diproses, harap tunggu...
          </div>
        )}

        <div className="modal-buttons">
          <button 
            className="cancel-button" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Batal
          </button>
          <button 
            onClick={handleComplete}
            className="complete-button"
            disabled={isProcessing || error}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner"></span>
                Proses...
              </>
            ) : (
              "Selesai"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentModal;