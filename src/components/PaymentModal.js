// src/components/PaymentModal.js
import React, { useState, useRef, useEffect } from "react";
import { formatCurrency, validateVoucher } from "../utils/transaksiUtils";
import { formatDigitsInput, parseDigits } from "../utils/cashflowUtils";
import { voucherService } from "../services/voucherService";
import "../styles/PaymentModal.css";

// How the part not covered by a voucher is paid. The voucher part itself is
// recorded in the Kredit account.
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "split", label: "Cash + QRIS" },
];

const ACCOUNT_ROWS = [
  { key: "cash", label: "Cash", hint: "Uang tunai" },
  { key: "qris", label: "QRIS", hint: "Online / e-money" },
  { key: "kredit", label: "Kredit", hint: "Voucher, dibayar nanti" },
];

// Splits the payable amount into Cash and QRIS and validates the tender.
const computePayment = ({ method, payable, amountPaid, qrisAmount, cashAmountPaid }) => {
  if (method === "kredit") {
    return { cash: 0, qris: 0, cashTender: 0, change: 0, error: "", isValid: true };
  }
  if (method === "qris") {
    return { cash: 0, qris: payable, cashTender: 0, change: 0, error: "", isValid: true };
  }
  if (method === "cash") {
    const cashTender = parseDigits(amountPaid);
    const isValid = cashTender >= payable;
    return {
      cash: payable,
      qris: 0,
      cashTender,
      change: isValid ? cashTender - payable : 0,
      error:
        amountPaid && !isValid ? "Uang yang diterima kurang dari harga pembelian" : "",
      isValid,
    };
  }

  const qris = parseDigits(qrisAmount);
  const cashTender = parseDigits(cashAmountPaid);
  const cash = Math.max(0, payable - qris);
  let error = "";
  if (qris > payable) {
    error = "Nominal QRIS tidak boleh melebihi total bayar";
  } else if (qrisAmount !== "" && qris <= 0) {
    error = "Nominal QRIS harus lebih dari 0";
  } else if (cashAmountPaid !== "" && qris <= 0) {
    error = "Masukkan nominal QRIS terlebih dahulu";
  } else if (cashAmountPaid !== "" && cashTender < cash) {
    error = `Jumlah cash kurang ${formatCurrency(cash - cashTender)}`;
  }
  const isValid = qris > 0 && qris <= payable && cashTender >= cash;
  return {
    cash,
    qris,
    cashTender,
    change: isValid ? cashTender - cash : 0,
    error,
    isValid,
  };
};

const PaymentModal = ({
  isOpen,
  onClose,
  total,
  onPaymentComplete,
  isProcessing = false,
  onVoucherCheck,
  activeCampaigns = [],
  isProduction = true,
}) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [qrisAmount, setQrisAmount] = useState("");
  const [cashAmountPaid, setCashAmountPaid] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState("");
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const amountPaidRef = useRef(null);
  const voucherIdRef = useRef(null);
  const checkVoucherRef = useRef(null);
  const submissionInFlightRef = useRef(false);

  // Member lookup & live search states
  const [nomorAnggota, setNomorAnggota] = useState("");
  const [memberData, setMemberData] = useState(null);
  const [memberError, setMemberError] = useState("");
  const [memberRequiredError, setMemberRequiredError] = useState("");
  const [memberSearchText, setMemberSearchText] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const memberSearchTimeoutRef = useRef(null);

  // Pre-fetch approved members cache on modal open for 0ms instant searching
  useEffect(() => {
    if (isOpen) {
      voucherService.getAllApprovedMembers(isProduction).catch((err) => {
        console.error("Error prefetching members cache:", err);
      });
      setHighlightedIndex(-1);
    }
  }, [isOpen, isProduction]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setAmountPaid("");
      setQrisAmount("");
      setCashAmountPaid("");
      setVoucherId("");
      setAppliedVoucher(null);
      setVoucherError("");
      setIsCheckingVoucher(false);
      setNomorAnggota("");
      setMemberData(null);
      setMemberError("");
      setMemberRequiredError("");
      setMemberSearchText("");
      setMemberSearchResults([]);
      setIsSearchingMembers(false);
      setHighlightedIndex(-1);
      setPaymentMethod("cash");
      submissionInFlightRef.current = false;

      // Focus on the payment input after a short delay
      setTimeout(() => {
        if (amountPaidRef.current) {
          amountPaidRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Handle member search by name, nomor anggota, NIK, NIY, unit kerja
  const handleMemberSearchChange = (e) => {
    const value = e.target.value;
    setMemberSearchText(value);
    setMemberRequiredError("");
    setMemberError("");
    setHighlightedIndex(-1);

    if (memberSearchTimeoutRef.current) {
      clearTimeout(memberSearchTimeoutRef.current);
    }

    if (!value || !value.trim()) {
      setMemberSearchResults([]);
      setIsSearchingMembers(false);
      return;
    }

    setIsSearchingMembers(true);

    memberSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await voucherService.searchMembersByNameOrNumber(
          value,
          isProduction
        );
        setMemberSearchResults(results || []);
        if (results && results.length > 0) {
          setHighlightedIndex(0); // Auto-highlight top match
        }
      } catch (err) {
        console.error("Error searching members:", err);
        setMemberSearchResults([]);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 150); // Fast 150ms debounce with instant in-memory cache
  };

  const handleMemberSearchKeyDown = (e) => {
    if (memberSearchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < memberSearchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : memberSearchResults.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
      if (memberSearchResults[indexToSelect]) {
        selectMember(memberSearchResults[indexToSelect]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMemberSearchResults([]);
      setHighlightedIndex(-1);
    }
  };

  const selectMember = (member) => {
    setMemberData(member);
    setNomorAnggota(member.nomorAnggota || "");
    setMemberSearchText("");
    setMemberSearchResults([]);
    setHighlightedIndex(-1);
    setMemberError("");
    setMemberRequiredError("");
  };

  const clearMemberData = () => {
    setNomorAnggota("");
    setMemberData(null);
    setMemberError("");
    setMemberRequiredError("");
    setMemberSearchText("");
    setMemberSearchResults([]);
    setHighlightedIndex(-1);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (memberSearchTimeoutRef.current) {
        clearTimeout(memberSearchTimeoutRef.current);
      }
    };
  }, []);

  const kreditAmount = appliedVoucher ? Math.min(appliedVoucher.value, total) : 0;
  const payable = Math.max(0, total - kreditAmount);
  // A voucher covering the whole purchase leaves nothing to pay now.
  const effectiveMethod = payable === 0 ? "kredit" : paymentMethod;
  const payment = computePayment({
    method: effectiveMethod,
    payable,
    amountPaid,
    qrisAmount,
    cashAmountPaid,
  });
  const accountAmounts = {
    cash: payment.cash,
    qris: payment.qris,
    kredit: kreditAmount,
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === "split") {
      setQrisAmount("");
      setCashAmountPaid("");
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
      const voucherDoc = await voucherService.getVoucherForPayment(
        voucherId.trim(),
        isProduction
      );
      if (!voucherDoc) {
        setVoucherError("Voucher tidak ditemukan");
        setIsCheckingVoucher(false);
        return;
      }

      // Check if voucher has been used (for single use vouchers)
      if (voucherDoc.isClaimed && voucherDoc.isOneTimeUse !== false) {
        setVoucherError("Voucher ini sudah pernah digunakan");
        setIsCheckingVoucher(false);
        return;
      }

      // Validate voucher format & properties
      const validationResult = validateVoucher(voucherDoc);
      const isValid = validationResult.isValid ?? validationResult.valid;
      if (!isValid) {
        setVoucherError(
          validationResult.message ||
            validationResult.reason ||
            "Voucher tidak valid"
        );
        setIsCheckingVoucher(false);
        return;
      }

      // Validate member data requirements
      let memberInfo = null;

      if (voucherDoc.type === "cashbackCampaign") {
        if (!nomorAnggota || !memberData) {
          setVoucherError(
            "Wajib memasukkan nomor anggota yang valid untuk redeem voucher cashback ini"
          );
          setIsCheckingVoucher(false);
          return;
        }
        memberInfo = memberData;
      } else if (voucherDoc.nomorAnggota) {
        if (nomorAnggota && nomorAnggota !== voucherDoc.nomorAnggota) {
          setVoucherError(
            `Voucher ini khusus untuk anggota dengan nomor ${voucherDoc.nomorAnggota}`
          );
          setIsCheckingVoucher(false);
          return;
        }

        if (!memberData) {
          try {
            const fetchedMember = await voucherService.getMemberByNomorAnggota(
              voucherDoc.nomorAnggota,
              isProduction
            );
            if (fetchedMember) {
              setMemberData(fetchedMember);
              setNomorAnggota(voucherDoc.nomorAnggota);
              memberInfo = fetchedMember;
            }
          } catch (err) {
            console.error("Error auto-fetching voucher member:", err);
          }
        } else {
          memberInfo = memberData;
        }
      }

      const originalValue = voucherDoc.nominal || voucherDoc.value || 0;
      const voucherValue =
        voucherDoc.isOneTimeUse === false
          ? validationResult.remaining
          : originalValue;

      if (voucherValue <= 0) {
        setVoucherError("Saldo voucher ini sudah habis");
        setIsCheckingVoucher(false);
        return;
      }

      setAppliedVoucher({
        id: voucherId.trim(),
        name:
          voucherDoc.namaVoucher ||
          voucherDoc.voucherName ||
          "Voucher Diskon",
        value: voucherValue,
        originalValue,
        memberName:
          memberInfo?.nama ||
          voucherDoc.nama ||
          voucherDoc.namaAnggota ||
          "Anggota Koperasi",
        nomorAnggota:
          memberInfo?.nomorAnggota ||
          voucherDoc.nomorAnggota ||
          "",
        isOneTimeUse: voucherDoc.isOneTimeUse !== false,
        isCampaignVoucher:
          validationResult.isCampaignVoucher ||
          voucherDoc.type === "cashbackCampaign",
        amountSpent: validationResult.amountSpent || 0,
        type: voucherDoc.type || "regular",
        voucherGroupId: voucherDoc.voucherGroupId || null,
        voucherMemberData: memberInfo,
      });

      if (paymentMethod === "split") {
        // Existing split amounts were entered against a different payable
        // total, so require an explicit fresh allocation after applying it.
        setQrisAmount("");
        setCashAmountPaid("");
      }

      setVoucherError("");
    } catch (err) {
      console.error("Error checking voucher:", err);
      setVoucherError("Gagal memeriksa voucher. Coba lagi.");
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherId("");
    setVoucherError("");

    if (paymentMethod === "split") {
      setQrisAmount("");
      setCashAmountPaid("");
    }
  };

  const handleComplete = async () => {
    if (submissionInFlightRef.current || isProcessing) return;

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

    if (!payment.isValid) return;

    // Cash tendered plus QRIS; the receipt and transaction keep this figure.
    const numericAmountPaid =
      effectiveMethod === "qris" ? payable : payment.qris + payment.cashTender;

    // Use manually entered member data, or fall back to voucher member data
    const effectiveMemberData =
      memberData || (appliedVoucher?.voucherMemberData ?? null);

    submissionInFlightRef.current = true;
    try {
      await onPaymentComplete({
        amountPaid: numericAmountPaid.toLocaleString("id-ID"),
        change: payment.change,
        numericAmountPaid,
        totalNumeric: payable,
        appliedVoucher,
        originalTotal: total,
        memberData: effectiveMemberData,
        // Campaign points count only what the customer paid now.
        userPoints: payable,
        paymentMethod: effectiveMethod,
        cashAmount: payment.cash,
        qrisAmount: payment.qris,
        kreditAmount,
        cashTender: payment.cashTender,
        isPaidViaQris: effectiveMethod === "qris",
        activeCampaigns,
      });
    } finally {
      submissionInFlightRef.current = false;
    }
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
    isProcessing || !payment.isValid || (memberError && nomorAnggota);

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
          <div className="pm-grid">
            {/* Left Column */}
            <div className="pm-col pm-col-left">
              {/* Total Section */}
              <div className="pm-total-section">
                <div className="pm-total-label">Total Belanja</div>
                <div className="pm-total-value">{formatCurrency(total)}</div>
              </div>

              {/* Member Identification Section */}
              <div className="pm-section pm-member-section">
                <div className="pm-section-header">
                  <span className="pm-section-icon">👤</span>
                  <span className="pm-section-title">
                    {appliedVoucher && appliedVoucher.type === "cashbackCampaign"
                      ? "Data Anggota (Wajib untuk Voucher Cashback)"
                      : "Cari Anggota (Pembeli)"}
                  </span>
                  <span className="pm-section-badge">Opsional</span>
                </div>

                {!memberData ? (
                  <div className="pm-member-search-wrap">
                    <div className="pm-field">
                      <label>Nama atau Nomor Anggota</label>
                      <div className="pm-input-group">
                        <input
                          type="text"
                          className={`pm-input ${
                            memberError || memberRequiredError ? "pm-input-error" : ""
                          }`}
                          value={memberSearchText}
                          onChange={handleMemberSearchChange}
                          onKeyDown={handleMemberSearchKeyDown}
                          disabled={isProcessing}
                          placeholder="Ketik Nama, No. Anggota, NIK, atau Unit..."
                        />
                        {(memberSearchText || memberError) && (
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

                    {isSearchingMembers && (
                      <div className="pm-member-status pm-member-checking">
                        <span className="pm-status-icon">⏳</span>
                        Mencari anggota...
                      </div>
                    )}

                    {!isSearchingMembers && memberSearchResults.length > 0 && (
                      <div className="pm-member-dropdown">
                        {memberSearchResults.map((m, index) => {
                          const subInfo =
                            m.satuanKerja ||
                            m.kantor ||
                            m.unitKerja ||
                            m.instansi ||
                            m.nomorAnggota ||
                            "";

                          return (
                            <div
                              key={m.id}
                              className={`pm-member-dropdown-item ${
                                index === highlightedIndex ? "pm-dropdown-active" : ""
                              }`}
                              onClick={() => selectMember(m)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                            >
                              <div className="pm-dropdown-main">
                                <span className="pm-dropdown-name">{m.nama}</span>
                              </div>
                              {subInfo && <span className="pm-dropdown-sub">{subInfo}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {memberError && !isSearchingMembers && (
                      <div className="pm-member-status pm-member-error">
                        <span className="pm-status-icon">⚠️</span>
                        {memberError}
                      </div>
                    )}

                    {memberRequiredError && !isSearchingMembers && !memberError && (
                      <div className="pm-member-status pm-member-error">
                        <span className="pm-status-icon">⚠️</span>
                        {memberRequiredError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pm-member-status pm-member-success">
                    <div className="pm-member-info">
                      <span className="pm-member-check">✓</span>
                      <div className="pm-member-details-text">
                        <span className="pm-member-name">{memberData.nama}</span>
                        {(memberData.satuanKerja || memberData.kantor || memberData.unitKerja || memberData.instansi || memberData.nomorAnggota) && (
                          <span className="pm-member-no-sub">
                            {memberData.satuanKerja || memberData.kantor || memberData.unitKerja || memberData.instansi || memberData.nomorAnggota}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pm-clear-btn"
                      onClick={clearMemberData}
                      disabled={isProcessing}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

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
                    <div className="pm-voucher-success-header">
                      <span className="pm-voucher-success-badge">
                        ✓ Voucher Valid Terdeteksi
                      </span>
                    </div>
                    <div className="pm-applied-voucher-content">
                      <div className="pm-voucher-details">
                        <div className="pm-voucher-name">{appliedVoucher.name}</div>
                        <div className="pm-voucher-member">
                          👤 Pemilik: <strong>{appliedVoucher.memberName}</strong>
                          {appliedVoucher.nomorAnggota && (
                            <span className="pm-voucher-member-no">
                              {" "}(No: {appliedVoucher.nomorAnggota})
                            </span>
                          )}
                        </div>
                        {!appliedVoucher.isOneTimeUse && (
                          <div className="pm-voucher-balance">
                            Sisa saldo: {formatCurrency(appliedVoucher.value)} /{" "}
                            {formatCurrency(appliedVoucher.originalValue)}
                          </div>
                        )}
                      </div>
                      <div className="pm-voucher-value">
                        {formatCurrency(kreditAmount)}
                        <span className="pm-voucher-value-caption">ke Kredit</span>
                      </div>
                      <button
                        type="button"
                        className="pm-remove-voucher"
                        onClick={removeVoucher}
                        disabled={isProcessing}
                        title="Batalkan / Ganti Voucher"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="pm-col pm-col-right">
              {/* Payment Section */}
              <div className="pm-section pm-payment-section">
                <div className="pm-summary-row">
                  <span>Total Belanja</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {appliedVoucher && (
                  <div className="pm-summary-row pm-summary-kredit">
                    <span>Kredit (Voucher)</span>
                    <span>-{formatCurrency(kreditAmount)}</span>
                  </div>
                )}

                <div className="pm-summary-row pm-summary-final">
                  <span>Total Bayar</span>
                  <span className="pm-final-total">{formatCurrency(payable)}</span>
                </div>

                {effectiveMethod === "kredit" ? (
                  <div className="pm-kredit-note">
                    Total belanja tertutup penuh oleh voucher. Tidak ada uang yang
                    diterima sekarang, seluruhnya dicatat sebagai Kredit.
                  </div>
                ) : (
                  <>
                    <div className="pm-payment-method" role="radiogroup" aria-label="Metode Pembayaran">
                      {PAYMENT_METHODS.map(({ value, label }) => (
                        <label
                          key={value}
                          className={`pm-radio${paymentMethod === value ? " pm-radio-active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === value}
                            onChange={() => handlePaymentMethodChange(value)}
                            disabled={isProcessing}
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {paymentMethod === "split" ? (
                      <div className="pm-split-container">
                        <div className="pm-field">
                          <label>1. Nominal QRIS</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="pm-input pm-input-payment"
                            value={qrisAmount}
                            onChange={(e) => setQrisAmount(formatDigitsInput(e.target.value))}
                            disabled={isProcessing}
                            placeholder="Scan / Ketik Nominal QRIS"
                          />
                        </div>

                        <div className="pm-split-info">
                          <span>Sisa Harus Cash:</span>
                          <strong>{formatCurrency(payment.cash)}</strong>
                        </div>

                        <div className="pm-field">
                          <label>2. Cash Diterima</label>
                          <input
                            ref={amountPaidRef}
                            type="text"
                            inputMode="numeric"
                            className="pm-input pm-input-payment"
                            value={cashAmountPaid}
                            onChange={(e) => setCashAmountPaid(formatDigitsInput(e.target.value))}
                            disabled={isProcessing}
                            placeholder="Masukkan Uang Cash"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pm-field">
                        <label>Jumlah Diterima</label>
                        <input
                          ref={amountPaidRef}
                          type="text"
                          inputMode="numeric"
                          className="pm-input pm-input-payment"
                          value={
                            paymentMethod === "qris"
                              ? payable.toLocaleString("id-ID")
                              : amountPaid
                          }
                          onChange={(e) => setAmountPaid(formatDigitsInput(e.target.value))}
                          disabled={isProcessing || paymentMethod !== "cash"}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </>
                )}

                {payment.error && <div className="pm-payment-error">{payment.error}</div>}

                <div className="pm-change-display">
                  <span className="pm-change-label">Kembalian Cash</span>
                  <span className="pm-change-value">{formatCurrency(payment.change)}</span>
                </div>

                <div className="pm-accounts" aria-label="Masuk ke Akun">
                  <div className="pm-accounts-title">Masuk ke Akun</div>
                  {ACCOUNT_ROWS.map(({ key, label, hint }) => (
                    <div
                      key={key}
                      className={`pm-account-row pm-account-${key}${
                        accountAmounts[key] > 0 ? "" : " pm-account-empty"
                      }`}
                    >
                      <span className="pm-account-dot" />
                      <span className="pm-account-label">
                        {label}
                        <small>{hint}</small>
                      </span>
                      <span className="pm-account-amount">
                        {formatCurrency(accountAmounts[key])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isProcessing && (
                <div className="pm-processing">
                  <span className="pm-spinner"></span>
                  Transaksi sedang diproses...
                </div>
              )}
            </div>
          </div>
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
