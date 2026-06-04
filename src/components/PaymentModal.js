// src/components/PaymentModal.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { formatCurrency, validateVoucher } from "../utils/transaksiUtils";
import { voucherService } from "../services/voucherService";
import "../styles/PaymentModal.css";

const PaymentModal = ({
  isOpen,
  onClose,
  total,
  onPaymentComplete,
  isProcessing = false,
  onVoucherCheck,
  firestore,
  activeCampaigns = [],
  isProduction = true,
}) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [change, setChange] = useState(0);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [voucherId, setVoucherId] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState("");
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const amountPaidRef = useRef(null);
  const voucherIdRef = useRef(null);
  const checkVoucherRef = useRef(null);

  // Member lookup states
  const [nomorAnggota, setNomorAnggota] = useState("");
  const [memberData, setMemberData] = useState(null);
  const [memberError, setMemberError] = useState("");
  const [isCheckingMember, setIsCheckingMember] = useState(false);
  const [memberRequiredError, setMemberRequiredError] = useState("");
  const memberLookupTimeoutRef = useRef(null);

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
      setNomorAnggota("");
      setMemberData(null);
      setMemberError("");
      setIsCheckingMember(false);
      setMemberRequiredError("");
      setPaymentMethod(null);

      // Focus on the payment input after a short delay
      setTimeout(() => {
        if (amountPaidRef.current) {
          amountPaidRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Debounced member lookup
  const lookupMember = useCallback(
    async (nomorAnggotaValue) => {
      if (!nomorAnggotaValue || nomorAnggotaValue.length < 5) {
        setMemberData(null);
        setMemberError("");
        return;
      }

      setIsCheckingMember(true);
      setMemberError("");

      try {
        const member = await voucherService.getMemberByNomorAnggota(
          nomorAnggotaValue,
          isProduction
        );

        if (member) {
          setMemberData(member);
          setMemberError("");
        } else {
          setMemberData(null);
          setMemberError("Nomor anggota ini tidak ditemukan");
        }
      } catch (error) {
        console.error("Error looking up member:", error);
        setMemberData(null);
        setMemberError("Gagal memeriksa nomor anggota");
      } finally {
        setIsCheckingMember(false);
      }
    },
    [isProduction]
  );

  // Handle nomor anggota input change with debounce
  const handleNomorAnggotaChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 5); // Only digits, max 5
    setNomorAnggota(value);
    setMemberData(null);
    setMemberError("");
    setMemberRequiredError("");

    // Clear previous timeout
    if (memberLookupTimeoutRef.current) {
      clearTimeout(memberLookupTimeoutRef.current);
    }

    // Debounce lookup - trigger when 5 digits or after 500ms of no typing
    if (value.length === 5) {
      lookupMember(value);
    } else if (value.length > 0) {
      memberLookupTimeoutRef.current = setTimeout(() => {
        if (value.length >= 3) {
          lookupMember(value);
        }
      }, 500);
    }
  };

  // Clear member data
  const clearMemberData = () => {
    setNomorAnggota("");
    setMemberData(null);
    setMemberError("");
    setMemberRequiredError("");
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (memberLookupTimeoutRef.current) {
        clearTimeout(memberLookupTimeoutRef.current);
      }
    };
  }, []);

  const calculateDiscountedTotal = () => {
    let discountedTotal = total;
    if (appliedVoucher) {
      discountedTotal = Math.max(0, total - appliedVoucher.value);
    }
    return discountedTotal;
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === "qris") {
      const discountedTotal = calculateDiscountedTotal();
      const totalNumeric =
        typeof discountedTotal === "string"
          ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
          : discountedTotal;
      setAmountPaid(totalNumeric.toLocaleString("id-ID"));
      setChange(0);
      setError("");
    } else {
      setAmountPaid("");
      setChange(0);
      setError("");
    }
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
      handleCheckVoucher();
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
      const voucherDoc = await firestore.readDoc("vouchers", voucherId.trim());
      if (!voucherDoc) {
        setVoucherError("Voucher tidak ditemukan");
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

      // Determine effective discount value for multi-use vouchers
      const isMultiUse = voucherDoc.isOneTimeUse === false;
      const remainingValue = isMultiUse
        ? voucherDoc.value - (voucherDoc.amountSpent || 0)
        : voucherDoc.value;

      // Apply voucher - include type info for proper redemption handling
      const voucherData = {
        id: voucherId.trim(),
        name: voucherDoc.voucherName,
        value: remainingValue,
        originalValue: voucherDoc.value,
        memberName: voucherDoc.nama,
        isCampaignVoucher: validation.isCampaignVoucher || false,
        type: voucherDoc.type,
        isOneTimeUse: voucherDoc.isOneTimeUse !== false,
        amountSpent: voucherDoc.amountSpent || 0,
      };

      // For member-only vouchers, extract member data for the transaction
      if (
        voucherDoc.isVoucherForMemberOnly === true &&
        voucherDoc.type === "memberVoucher"
      ) {
        voucherData.voucherMemberData = {
          id: voucherDoc.userId || null,
          nama: voucherDoc.nama || null,
          nomorAnggota: voucherDoc.nomorAnggota || null,
        };
      }

      setAppliedVoucher(voucherData);

      const discountedTotal = Math.max(0, total - remainingValue);

      if (paymentMethod === "qris") {
        setAmountPaid(discountedTotal.toLocaleString("id-ID"));
        setChange(0);
        setError("");
      } else {
        const currentPaidNumeric =
          parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
        if (currentPaidNumeric >= discountedTotal) {
          setChange(currentPaidNumeric - discountedTotal);
          setError("");
        } else if (currentPaidNumeric > 0) {
          setChange(0);
          setError("Uang yang diterima kurang dari harga pembelian");
        }
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

    const totalNumeric =
      typeof total === "string"
        ? parseInt(total.replace(/\D/g, ""), 10)
        : total;

    if (paymentMethod === "qris") {
      setAmountPaid(totalNumeric.toLocaleString("id-ID"));
      setChange(0);
      setError("");
    } else {
      const currentPaidNumeric = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
      if (currentPaidNumeric >= totalNumeric) {
        setChange(currentPaidNumeric - totalNumeric);
        setError("");
      } else if (currentPaidNumeric > 0) {
        setChange(0);
        setError("Uang yang diterima kurang dari harga pembelian");
      }
    }
  };

  const handleComplete = async () => {
    // Validate member number for cashback campaign voucher
    if (
      appliedVoucher &&
      appliedVoucher.type === "cashbackCampaign" &&
      !memberData
    ) {
      setMemberRequiredError(
        "Wajib memasukkan nomor anggota bila mau redeem voucher cashback"
      );
      return;
    }

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

    // Mark voucher as used if one was applied
    if (appliedVoucher) {
      try {
        if (appliedVoucher.isCampaignVoucher) {
          await voucherService.redeemCampaignVoucher(
            appliedVoucher.id,
            isProduction
          );
        } else if (!appliedVoucher.isOneTimeUse) {
          // Multi-use: increment amountSpent
          const actualDiscount = Math.min(appliedVoucher.value, total);
          const newAmountSpent = appliedVoucher.amountSpent + actualDiscount;
          const isFullySpent = newAmountSpent >= appliedVoucher.originalValue;

          await firestore.updateDoc("vouchers", appliedVoucher.id, {
            amountSpent: newAmountSpent,
            ...(isFullySpent ? { isClaimed: true } : {}),
          });
        } else {
          await firestore.updateDoc("vouchers", appliedVoucher.id, {
            isClaimed: true,
          });
        }
      } catch (error) {
        console.error("Error updating voucher claim status:", error);
        setError("Gagal mengupdate status voucher");
        return;
      }
    }

    // Calculate userPoints - the amount that counts toward campaign points
    // This is the discounted total (excludes voucher discount amount)
    const userPoints = totalNumeric; // This is already the discounted total

    // Process campaign points if member is identified and there are active campaigns
    if (memberData && activeCampaigns && activeCampaigns.length > 0) {
      // Use discounted total for points (excludes voucher discount)
      const transactionAmount = userPoints;

      // Process campaigns in order (sorted by expireDate, closest first)
      for (const campaign of activeCampaigns) {
        try {
          const result = await voucherService.updateUserCampaignPoints(
            campaign.voucherGroupId,
            memberData.id,
            memberData,
            campaign,
            transactionAmount,
            isProduction
          );

          if (result.created || result.updated) {
            console.log(
              `Campaign points updated for ${campaign.voucherName}:`,
              result
            );
            // Only update one campaign per transaction
            break;
          } else if (result.skipped) {
            console.log(
              `Campaign ${campaign.voucherName} skipped: ${result.reason}`
            );
            // Continue to next campaign
          }
        } catch (error) {
          console.error(
            `Error updating campaign points for ${campaign.voucherName}:`,
            error
          );
          // Continue processing other campaigns
        }
      }
    }

    // Use manually entered member data, or fall back to voucher member data
    const effectiveMemberData =
      memberData || (appliedVoucher?.voucherMemberData ?? null);

    onPaymentComplete({
      amountPaid,
      change,
      numericAmountPaid,
      totalNumeric,
      appliedVoucher,
      originalTotal: total,
      memberData: effectiveMemberData,
      userPoints: userPoints,
      isPaidViaQris: paymentMethod === "qris",
    });
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isProcessing) {
      onClose();
    }
  };

  const isCompleteDisabled =
    isProcessing || error || !paymentMethod || (memberError && nomorAnggota);

  if (!isOpen) return null;

  return (
    <div className="pm-overlay" onClick={handleOverlayClick}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-header">
          <h2>Pembayaran</h2>
          <button
            className="pm-close"
            onClick={handleClose}
            disabled={isProcessing}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="pm-body">
          {/* Total Section */}
          <div className="pm-total-section">
            <div className="pm-total-label">Total Belanja</div>
            <div className="pm-total-value">{formatCurrency(total)}</div>
          </div>

          {/* Member Points Section */}
          {(activeCampaigns && activeCampaigns.length > 0) ||
          (appliedVoucher && appliedVoucher.type === "cashbackCampaign") ? (
            <div className="pm-section pm-member-section">
              <div className="pm-section-header">
                <span className="pm-section-icon">🎯</span>
                <span className="pm-section-title">
                  {appliedVoucher && appliedVoucher.type === "cashbackCampaign"
                    ? "Data Anggota (Wajib untuk Voucher Cashback)"
                    : "Kumpulkan Poin Kampanye"}
                </span>
              </div>

              <div className="pm-field">
                <label>Nomor Anggota</label>
                <div className="pm-input-group">
                  <input
                    type="text"
                    className={`pm-input pm-input-member ${
                      memberError || memberRequiredError ? "pm-input-error" : ""
                    } ${memberData ? "pm-input-success" : ""}`}
                    value={nomorAnggota}
                    onChange={handleNomorAnggotaChange}
                    disabled={isProcessing}
                    placeholder="5 digit"
                    maxLength={5}
                  />
                  {(nomorAnggota || memberData || memberError) && (
                    <button
                      type="button"
                      className="pm-clear-btn"
                      onClick={clearMemberData}
                      disabled={isProcessing}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {isCheckingMember && (
                <div className="pm-member-status pm-member-checking">
                  <span className="pm-status-icon">⏳</span>
                  Memeriksa nomor anggota...
                </div>
              )}

              {memberError && !isCheckingMember && (
                <div className="pm-member-status pm-member-error">
                  <span className="pm-status-icon">⚠️</span>
                  {memberError}
                </div>
              )}

              {memberRequiredError && !isCheckingMember && !memberError && (
                <div className="pm-member-status pm-member-error">
                  <span className="pm-status-icon">⚠️</span>
                  {memberRequiredError}
                </div>
              )}

              {memberData && !isCheckingMember && (
                <div className="pm-member-status pm-member-success">
                  <div className="pm-member-info">
                    <span className="pm-member-check">✓</span>
                    <span className="pm-member-name">{memberData.nama}</span>
                  </div>
                  <span className="pm-points-badge">
                    +{formatCurrency(calculateDiscountedTotal())} poin
                  </span>
                </div>
              )}

              {!nomorAnggota &&
                !memberData &&
                !memberError &&
                !memberRequiredError && (
                  <div className="pm-member-hint">
                    {appliedVoucher &&
                    appliedVoucher.type === "cashbackCampaign"
                      ? "Wajib memasukkan nomor anggota untuk redeem voucher cashback"
                      : "Masukkan nomor anggota untuk mengumpulkan poin kampanye"}
                  </div>
                )}
            </div>
          ) : null}

          {/* Voucher Section */}
          <div className="pm-section pm-voucher-section">
            <div className="pm-section-header">
              <span className="pm-section-icon">🎫</span>
              <span className="pm-section-title">Gunakan Voucher</span>
              <span className="pm-section-badge">Opsional</span>
            </div>

            {!appliedVoucher ? (
              <>
                <div className="pm-field">
                  <label>ID Voucher</label>
                  <div className="pm-voucher-input-row">
                    <input
                      ref={voucherIdRef}
                      type="text"
                      className="pm-input pm-input-voucher"
                      value={voucherId}
                      onChange={handleVoucherIdChange}
                      onKeyDown={handleVoucherKeyDown}
                      disabled={isProcessing || appliedVoucher}
                      placeholder="Scan atau ketik ID voucher"
                    />
                    <button
                      ref={checkVoucherRef}
                      type="button"
                      className="pm-check-btn"
                      onClick={handleCheckVoucher}
                      disabled={
                        isProcessing ||
                        isCheckingVoucher ||
                        appliedVoucher ||
                        !voucherId.trim()
                      }
                    >
                      {isCheckingVoucher ? "..." : "Cek"}
                    </button>
                  </div>
                </div>

                {voucherError && (
                  <div className="pm-voucher-error">{voucherError}</div>
                )}
              </>
            ) : (
              <div className="pm-applied-voucher">
                <div className="pm-voucher-details">
                  <div className="pm-voucher-name">{appliedVoucher.name}</div>
                  <div className="pm-voucher-member">
                    {appliedVoucher.memberName}
                  </div>
                  {!appliedVoucher.isOneTimeUse && (
                    <div className="pm-voucher-balance">
                      Sisa saldo: {formatCurrency(appliedVoucher.value)} /{" "}
                      {formatCurrency(appliedVoucher.originalValue)}
                    </div>
                  )}
                </div>
                <div className="pm-voucher-value">
                  -{formatCurrency(Math.min(appliedVoucher.value, total))}
                </div>
                <button
                  type="button"
                  className="pm-remove-voucher"
                  onClick={removeVoucher}
                  disabled={isProcessing}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Payment Section */}
          <div className="pm-section pm-payment-section">
            {appliedVoucher && (
              <div className="pm-summary-row pm-summary-discount">
                <span>Diskon Voucher</span>
                <span>
                  -{formatCurrency(Math.min(appliedVoucher.value, total))}
                </span>
              </div>
            )}

            <div className="pm-summary-row pm-summary-final">
              <span>Total Bayar</span>
              <span className="pm-final-total">
                {formatCurrency(calculateDiscountedTotal())}
              </span>
            </div>

            <div className="pm-payment-method">
              <label className={`pm-radio${paymentMethod === "qris" ? " pm-radio-active" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "qris"}
                  onChange={() => handlePaymentMethodChange("qris")}
                  disabled={isProcessing}
                />
                QRIS
              </label>
              <label className={`pm-radio${paymentMethod === "cash" ? " pm-radio-active" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "cash"}
                  onChange={() => handlePaymentMethodChange("cash")}
                  disabled={isProcessing}
                />
                Cash
              </label>
            </div>

            <div className="pm-field">
              <label>Jumlah Diterima</label>
              <input
                ref={amountPaidRef}
                type="text"
                className="pm-input pm-input-payment"
                value={amountPaid}
                onChange={handleAmountPaidChange}
                disabled={isProcessing || paymentMethod !== "cash"}
                placeholder="0"
              />
            </div>

            {error && <div className="pm-payment-error">{error}</div>}

            <div className="pm-change-display">
              <span className="pm-change-label">Kembalian</span>
              <span className="pm-change-value">{formatCurrency(change)}</span>
            </div>
          </div>

          {isProcessing && (
            <div className="pm-processing">
              <span className="pm-spinner"></span>
              Transaksi sedang diproses...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pm-footer">
          <button
            className="pm-btn pm-btn-secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Batal
          </button>
          <button
            onClick={handleComplete}
            className="pm-btn pm-btn-primary"
            disabled={isCompleteDisabled}
          >
            {isProcessing ? (
              <>
                <span className="pm-btn-spinner"></span>
                Proses...
              </>
            ) : (
              "Selesai"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
