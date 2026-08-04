// src/components/PaymentModal.js
import React, { useState, useRef, useEffect } from "react";
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
  activeCampaigns = [],
  isProduction = true,
}) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [change, setChange] = useState(0);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
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
      setChange(0);
      setError("");
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
      setPaymentMethod(null);
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

  const calculateDiscountedTotal = () => {
    let discountedTotal = total;
    if (appliedVoucher) {
      discountedTotal = Math.max(0, total - appliedVoucher.value);
    }
    return discountedTotal;
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    setError("");
    if (method === "qris") {
      const discountedTotal = calculateDiscountedTotal();
      const totalNumeric =
        typeof discountedTotal === "string"
          ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
          : discountedTotal;
      setAmountPaid(totalNumeric.toLocaleString("id-ID"));
      setChange(0);
      setQrisAmount("");
      setCashAmountPaid("");
    } else {
      setAmountPaid("");
      setChange(0);
      setQrisAmount("");
      setCashAmountPaid("");
    }
  };

  const handleAmountPaidChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const numeric = parseInt(raw, 10) || 0;
    const formatted = numeric.toLocaleString("id-ID");
    setAmountPaid(formatted);

    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    if (numeric >= totalNumeric) {
      setChange(numeric - totalNumeric);
      setError("");
    } else {
      setChange(0);
      setError("Uang yang diterima kurang dari harga pembelian");
    }
  };

  const handleQrisAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const numeric = parseInt(raw, 10) || 0;
    const formatted = raw ? numeric.toLocaleString("id-ID") : "";
    setQrisAmount(formatted);

    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    const numericCashPaid = parseInt(cashAmountPaid.replace(/\D/g, ""), 10) || 0;

    if (numeric > totalNumeric) {
      setError("Nominal QRIS tidak boleh melebihi total bayar");
      setChange(0);
    } else if (numeric <= 0 && raw !== "") {
      setError("Nominal QRIS harus lebih dari 0");
      setChange(0);
    } else {
      const cashNeeded = Math.max(0, totalNumeric - numeric);
      if (numericCashPaid < cashNeeded && cashAmountPaid !== "") {
        setError(`Jumlah cash kurang ${formatCurrency(cashNeeded - numericCashPaid)}`);
        setChange(0);
      } else if (numericCashPaid >= cashNeeded && cashAmountPaid !== "") {
        setError("");
        setChange(numericCashPaid - cashNeeded);
      } else {
        setError("");
        setChange(0);
      }
    }
  };

  const handleCashAmountPaidChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const numeric = parseInt(raw, 10) || 0;
    const formatted = raw ? numeric.toLocaleString("id-ID") : "";
    setCashAmountPaid(formatted);

    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    const numericQris = parseInt(qrisAmount.replace(/\D/g, ""), 10) || 0;
    const cashNeeded = Math.max(0, totalNumeric - numericQris);

    if (numericQris <= 0) {
      setError("Masukkan nominal QRIS terlebih dahulu");
      setChange(0);
    } else if (numeric < cashNeeded) {
      setError(`Jumlah cash kurang ${formatCurrency(cashNeeded - numeric)}`);
      setChange(0);
    } else {
      setError("");
      setChange(numeric - cashNeeded);
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

      const newTotal = Math.max(0, total - voucherValue);
      if (paymentMethod === "qris") {
        setAmountPaid(newTotal.toLocaleString("id-ID"));
        setChange(0);
        setError("");
      } else if (paymentMethod === "split") {
        // Existing split amounts were entered against a different payable
        // total, so require an explicit fresh allocation after applying it.
        setQrisAmount("");
        setCashAmountPaid("");
        setChange(0);
        setError("");
      } else if (paymentMethod === "cash") {
        const currentPaid = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
        setChange(currentPaid >= newTotal ? currentPaid - newTotal : 0);
        setError(
          currentPaid > 0 && currentPaid < newTotal
            ? "Uang yang diterima kurang dari harga pembelian"
            : ""
        );
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

    const totalNumeric =
      typeof total === "string"
        ? parseInt(total.replace(/\D/g, ""), 10)
        : total;

    if (paymentMethod === "qris") {
      setAmountPaid(totalNumeric.toLocaleString("id-ID"));
      setChange(0);
      setError("");
    } else if (paymentMethod === "split") {
      setQrisAmount("");
      setCashAmountPaid("");
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

    const discountedTotal = calculateDiscountedTotal();
    const totalNumeric =
      typeof discountedTotal === "string"
        ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
        : discountedTotal;

    const numericCashTender =
      parseInt(
        (paymentMethod === "split" ? cashAmountPaid : amountPaid).replace(
          /\D/g,
          ""
        ),
        10
      ) || 0;
    const numericQris =
      paymentMethod === "qris"
        ? totalNumeric
        : parseInt(qrisAmount.replace(/\D/g, ""), 10) || 0;
    const cashRequired =
      paymentMethod === "split" ? Math.max(0, totalNumeric - numericQris) : 0;

    if (
      !paymentMethod ||
      (paymentMethod === "cash" && numericCashTender < totalNumeric) ||
      (paymentMethod === "split" &&
        (numericQris <= 0 ||
          numericQris > totalNumeric ||
          numericCashTender < cashRequired))
    ) {
      setError("Uang yang diterima kurang dari harga pembelian");
      return;
    }

    const numericAmountPaid =
      paymentMethod === "qris"
        ? totalNumeric
        : paymentMethod === "split"
        ? numericQris + numericCashTender
        : numericCashTender;

    // Calculate userPoints - the amount that counts toward campaign points
    // This is the discounted total (excludes voucher discount amount)
    const userPoints = totalNumeric; // This is already the discounted total

    // Use manually entered member data, or fall back to voucher member data
    const effectiveMemberData =
      memberData || (appliedVoucher?.voucherMemberData ?? null);

    submissionInFlightRef.current = true;
    try {
      await onPaymentComplete({
        amountPaid: numericAmountPaid.toLocaleString("id-ID"),
        change,
        numericAmountPaid,
        totalNumeric,
        appliedVoucher,
        originalTotal: total,
        memberData: effectiveMemberData,
        userPoints,
        paymentMethod,
        qrisAmount: numericQris,
        cashAmount:
          paymentMethod === "cash"
            ? totalNumeric
            : paymentMethod === "split"
            ? cashRequired
            : 0,
        cashTender: numericCashTender,
        isPaidViaQris: paymentMethod === "qris",
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

  const discountedTotal = calculateDiscountedTotal();
  const totalNumeric =
    typeof discountedTotal === "string"
      ? parseInt(discountedTotal.replace(/\D/g, ""), 10)
      : discountedTotal;

  let isPaymentInvalid = false;
  if (paymentMethod === "qris") {
    isPaymentInvalid = false;
  } else if (paymentMethod === "cash") {
    const numericPaid = parseInt(amountPaid.replace(/\D/g, ""), 10) || 0;
    isPaymentInvalid = numericPaid < totalNumeric;
  } else if (paymentMethod === "split") {
    const numericQris = parseInt(qrisAmount.replace(/\D/g, ""), 10) || 0;
    const numericCashPaid = parseInt(cashAmountPaid.replace(/\D/g, ""), 10) || 0;
    const cashNeeded = totalNumeric - numericQris;
    isPaymentInvalid =
      numericQris <= 0 ||
      numericQris > totalNumeric ||
      numericCashPaid < cashNeeded;
  }

  const isCompleteDisabled =
    isProcessing ||
    error ||
    !paymentMethod ||
    isPaymentInvalid ||
    (memberError && nomorAnggota);

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
                        -{formatCurrency(Math.min(appliedVoucher.value, total))}
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
                  <label className={`pm-radio${paymentMethod === "split" ? " pm-radio-active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "split"}
                      onChange={() => handlePaymentMethodChange("split")}
                      disabled={isProcessing}
                    />
                    Split (Cash + QRIS)
                  </label>
                </div>

                {paymentMethod === "split" ? (
                  <div className="pm-split-container">
                    <div className="pm-field">
                      <label>1. Nominal QRIS</label>
                      <input
                        type="text"
                        className="pm-input pm-input-payment"
                        value={qrisAmount}
                        onChange={handleQrisAmountChange}
                        disabled={isProcessing}
                        placeholder="Scan / Ketik Nominal QRIS"
                      />
                    </div>

                    <div className="pm-split-info">
                      <span>Sisa Harus Cash:</span>
                      <strong>
                        {formatCurrency(
                          Math.max(
                            0,
                            totalNumeric - (parseInt(qrisAmount.replace(/\D/g, ""), 10) || 0)
                          )
                        )}
                      </strong>
                    </div>

                    <div className="pm-field">
                      <label>2. Cash Diterima</label>
                      <input
                        ref={amountPaidRef}
                        type="text"
                        className="pm-input pm-input-payment"
                        value={cashAmountPaid}
                        onChange={handleCashAmountPaidChange}
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
                      className="pm-input pm-input-payment"
                      value={amountPaid}
                      onChange={handleAmountPaidChange}
                      disabled={isProcessing || paymentMethod !== "cash"}
                      placeholder="0"
                    />
                  </div>
                )}

                {error && <div className="pm-payment-error">{error}</div>}

                <div className="pm-change-display">
                  <span className="pm-change-label">Kembalian Cash</span>
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
