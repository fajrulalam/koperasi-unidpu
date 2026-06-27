import React, { useState, useEffect } from "react";
import { useEnvironment } from "../context/EnvironmentContext";
import { voucherService } from "../services/voucherService";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import "../styles/VoucherDetailModalNew.css";

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const VoucherDetailModalNew = ({
  voucherGroup,
  onClose,
  onVoucherGroupUpdated,
  readOnly = false,
}) => {
  const { isProduction } = useEnvironment();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");

  const isForMemberOnly = voucherGroup.isVoucherForMemberOnly !== false;
  const isCashbackCampaign = voucherGroup.type === "cashbackCampaign";

  const [editData, setEditData] = useState({
    voucherName: voucherGroup.voucherName,
    value: voucherService.formatNumber(voucherGroup.value),
    threshold: isCashbackCampaign
      ? voucherService.formatNumber(voucherGroup.threshold || 0)
      : "",
    activeDate: "",
    expireDate: "",
    isActive: voucherGroup.isActive,
  });

  useEffect(() => {
    fetchVouchers();
    if (voucherGroup.activeDate) {
      const activeDate = voucherGroup.activeDate.toDate
        ? voucherGroup.activeDate.toDate()
        : new Date(voucherGroup.activeDate);
      setEditData((prev) => ({
        ...prev,
        activeDate: activeDate.toISOString().slice(0, 16),
      }));
    }
    if (voucherGroup.expireDate) {
      const expireDate = voucherGroup.expireDate.toDate
        ? voucherGroup.expireDate.toDate()
        : new Date(voucherGroup.expireDate);
      setEditData((prev) => ({
        ...prev,
        expireDate: expireDate.toISOString().slice(0, 16),
      }));
    }
  }, [voucherGroup, isProduction]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const vouchersData = await voucherService.getVouchersByGroupId(
        voucherGroup.id,
        isProduction
      );
      setVouchers(vouchersData);
    } catch (err) {
      setError("Gagal memuat data voucher");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMembers = async () => {
    try {
      const members = await voucherService.getMembers(isProduction);
      const existingUserIds = vouchers.map((v) => v.userId);
      setAvailableMembers(
        members.filter((m) => !existingUserIds.includes(m.id))
      );
    } catch (err) {
      setError("Gagal memuat data anggota");
    }
  };

  const handleEditDataChange = (field, value) => {
    if (field === "value" || field === "threshold") {
      const numericValue = value.replace(/[^\d]/g, "");
      setEditData((prev) => ({
        ...prev,
        [field]: voucherService.formatNumber(numericValue),
      }));
    } else {
      setEditData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      const updateData = {
        voucherName: editData.voucherName,
        value: voucherService.parseCurrency(editData.value),
        activeDate: new Date(editData.activeDate),
        expireDate: new Date(editData.expireDate),
        isActive: editData.isActive,
      };

      // Include threshold for campaign type
      if (isCashbackCampaign) {
        updateData.threshold = voucherService.parseCurrency(editData.threshold);
      }

      await voucherService.updateVoucherGroup(
        voucherGroup.id,
        updateData,
        isProduction
      );
      setIsEditing(false);
      onVoucherGroupUpdated();
    } catch (err) {
      setError("Gagal menyimpan perubahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!window.confirm("Hapus voucher ini?")) return;
    try {
      setLoading(true);
      await voucherService.deleteVoucherFromGroup(voucherId, isProduction);
      await fetchVouchers();
      await voucherService.updateVoucherGroup(
        voucherGroup.id,
        { totalVouchers: vouchers.length - 1 },
        isProduction
      );
    } catch (err) {
      setError("Gagal menghapus voucher");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucherGroup = async () => {
    try {
      setDeleting(true);
      await voucherService.deleteVoucherGroup(voucherGroup.id, isProduction);
      setShowDeleteConfirmation(false);
      onVoucherGroupUpdated();
      onClose();
    } catch (err) {
      setError("Gagal menghapus grup voucher");
      setShowDeleteConfirmation(false);
      setDeleting(false);
    }
  };

  const handleAddMembersToggle = () => {
    setShowAddMembers(!showAddMembers);
    if (!showAddMembers) fetchAvailableMembers();
  };

  const handleMemberSelect = (member) => {
    const isSelected = selectedNewMembers.some((m) => m.id === member.id);
    if (isSelected) {
      setSelectedNewMembers(
        selectedNewMembers.filter((m) => m.id !== member.id)
      );
    } else {
      setSelectedNewMembers([...selectedNewMembers, member]);
    }
  };

  const handleAddSelectedMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    try {
      setLoading(true);
      await voucherService.addMembersToVoucherGroup(
        voucherGroup.id,
        selectedNewMembers,
        isProduction
      );
      setSelectedNewMembers([]);
      setShowAddMembers(false);
      await fetchVouchers();
    } catch (err) {
      setError("Gagal menambahkan anggota");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getVoucherStatus = () => {
    const now = new Date();
    const activeDate = voucherGroup.activeDate?.toDate
      ? voucherGroup.activeDate.toDate()
      : new Date(voucherGroup.activeDate);
    const expireDate = voucherGroup.expireDate?.toDate
      ? voucherGroup.expireDate.toDate()
      : new Date(voucherGroup.expireDate);

    if (!voucherGroup.isActive) return { label: "Nonaktif", type: "inactive" };
    if (now < activeDate) return { label: "Belum Aktif", type: "pending" };
    if (now > expireDate) return { label: "Kedaluwarsa", type: "expired" };
    return { label: "Aktif", type: "active" };
  };

  const generateVouchersPdf = async () => {
    try {
      setGeneratingPdf(true);
      setError(null);

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const columns = 2;
      const rows = 4;
      const cardGap = 10;

      const cardWidth =
        (pageWidth - margin * 2 - (columns - 1) * cardGap) / columns;
      const cardHeight =
        (pageHeight - margin * 2 - (rows - 1) * cardGap) / rows;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let logoDataUrl = null;
      try {
        const logo = await loadImage("/logo-koperasi-favicon.png");
        const canvas = document.createElement("canvas");
        canvas.width = logo.width;
        canvas.height = logo.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(logo, 0, 0);
        logoDataUrl = canvas.toDataURL("image/png");
      } catch (e) {
        console.warn("Could not load logo:", e);
      }

      const vouchersPerPage = columns * rows;
      const totalPages = Math.ceil(vouchers.length / vouchersPerPage);

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();

        const startIndex = pageIndex * vouchersPerPage;
        const endIndex = Math.min(
          startIndex + vouchersPerPage,
          vouchers.length
        );

        for (let i = startIndex; i < endIndex; i++) {
          const voucher = vouchers[i];
          const positionInPage = i - startIndex;
          const col = positionInPage % columns;
          const row = Math.floor(positionInPage / columns);

          const x = margin + col * (cardWidth + cardGap);
          const y = margin + row * (cardHeight + cardGap);

          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.4);
          pdf.rect(x, y, cardWidth, cardHeight);

          if (logoDataUrl) {
            const watermarkSize = Math.min(cardWidth, cardHeight) * 0.5;
            const watermarkX = x + (cardWidth - watermarkSize) / 2;
            const watermarkY = y + (cardHeight - watermarkSize) / 2;
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 0.12 }));
            pdf.addImage(
              logoDataUrl,
              "PNG",
              watermarkX,
              watermarkY,
              watermarkSize,
              watermarkSize
            );
            pdf.restoreGraphicsState();
          }

          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(236, 72, 153);
          pdf.text("UNIMART", x + 5, y + 10);

          pdf.setFontSize(11);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(31, 41, 55);
          const voucherNameLines = pdf.splitTextToSize(
            voucherGroup.voucherName,
            cardWidth - 10
          );
          pdf.text(voucherNameLines, x + 5, y + 18);

          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(59, 130, 246);
          pdf.text(voucherService.formatCurrency(voucher.value), x + 5, y + 28);

          const barcodeCanvas = document.createElement("canvas");
          JsBarcode(barcodeCanvas, voucher.id, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 0,
          });

          const barcodeDataUrl = barcodeCanvas.toDataURL("image/png");
          pdf.addImage(
            barcodeDataUrl,
            "PNG",
            x + 5,
            y + 33,
            cardWidth - 10,
            cardHeight - 38
          );
        }
      }

      pdf.save(
        `vouchers-${voucherGroup.voucherName}-${
          new Date().toISOString().split("T")[0]
        }.pdf`
      );
    } catch (err) {
      setError("Gagal membuat PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const generateReportPdf = async () => {
    try {
      setGeneratingReport(true);
      setError(null);

      const doc = new jsPDF();
      doc.setFont("helvetica");

      // Load logo assets
      let logoYapetidu = null;
      let logoUrg = null;
      try {
        logoYapetidu = await loadImage("/Logo YAPETIDU (Transparent bg).png");
      } catch (e) {
        console.warn("Could not load YAPETIDU logo:", e);
      }
      try {
        logoUrg = await loadImage("/Kop URG Logo (Latest).png");
      } catch (e) {
        console.warn("Could not load Kop URG logo:", e);
      }

      // Draw logos on the left and set dynamic text X coordinate
      let textX = 14;
      if (logoYapetidu || logoUrg) {
        let currentX = 14;
        if (logoYapetidu) {
          doc.addImage(logoYapetidu, "PNG", currentX, 14, 22, 22);
          currentX += 24;
        }
        if (logoUrg) {
          doc.addImage(logoUrg, "PNG", currentX, 14, 22, 22);
          currentX += 24;
        }
        textX = currentX + 2;
      }

      // Title (align on the right of the logos)
      doc.setFontSize(15);
      doc.setFont(undefined, "bold");
      doc.text("Laporan Penerima Voucher", textX, 19);

      // Metadata Info (align on the right of the logos)
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Grup Voucher: ${voucherGroup.voucherName}`, textX, 25);
      doc.text(`Nilai Nominal: ${voucherService.formatCurrency(voucherGroup.value)}`, textX, 30);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`, textX, 35);

      // Table columns: No., Nama Anggota, Kantor/Unit, Satuan Kerja, Nilai, Berakhir
      const headers = [
        ["No.", "Nama Anggota", "Kantor/Unit", "Satuan Kerja", "Nilai", "Berakhir"]
      ];

      const tableData = vouchers.map((v, index) => {
        const name = v.nama || "Voucher Cetak (Non-Member)";
        const office = v.kantor || "-";
        const workUnit = v.satuanKerja || "-";
        const nominal = voucherService.formatCurrency(v.value || voucherGroup.value);
        const expDate = formatShortDate(v.expireDate || voucherGroup.expireDate);
        return [index + 1, name, office, workUnit, nominal, expDate];
      });

      autoTable(doc, {
        theme: "grid",
        head: headers,
        body: tableData,
        startY: 42,
        styles: {
          fontSize: 9,
          cellPadding: 3,
          valign: "middle",
          lineColor: [229, 231, 235], // #e5e7eb (light gray borders)
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [230, 107, 107], // #e66b6b (pastel coral red)
          textColor: [255, 255, 255], // white text for high contrast on coral background
          fontStyle: "bold",
          halign: "center",
          fontSize: 9.5,
          lineColor: [219, 90, 90], // slightly darker coral border outlines for header cells
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { cellWidth: 46 },
          2: { cellWidth: 32 },
          3: { cellWidth: 32 },
          4: { halign: "right", cellWidth: 26 },
          5: { halign: "center", cellWidth: 30 },
        },
      });

      // Save PDF
      doc.save(`Laporan_Penerima_Voucher_${voucherGroup.voucherName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Gagal membuat PDF Laporan:", err);
      setError("Gagal membuat PDF Laporan");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyNames = async () => {
    try {
      const namesList = vouchers
        .map((v) => {
          const name = v.nama || "Voucher Cetak (Non-Member)";
          return `- ${name}`;
        })
        .join("\n");

      await navigator.clipboard.writeText(namesList);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin nama:", err);
      setError("Gagal menyalin nama ke clipboard");
    }
  };

  const status = getVoucherStatus();
  // For campaign vouchers, count different statuses separately
  // For regular vouchers, count those with isClaimed === true
  const claimedCount = isCashbackCampaign
    ? vouchers.filter((v) => v.status === "CLAIMED").length
    : vouchers.filter(
        (v) =>
          v.isClaimed ||
          (v.isOneTimeUse === false &&
            (v.amountSpent || 0) >= v.value)
      ).length;
  const redeemedCount = isCashbackCampaign
    ? vouchers.filter((v) => v.status === "REDEEMED").length
    : 0;
  const inProgressCount = isCashbackCampaign
    ? vouchers.filter((v) => v.status === "IN_PROGRESS").length
    : 0;
  const filteredAvailableMembers = availableMembers.filter((m) =>
    m.nama?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="vd-overlay" onClick={onClose}>
      <div className="vd-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vd-header">
          <div className="vd-header-info">
            <h2>{voucherGroup.voucherName}</h2>
            <div className="vd-header-meta">
              <span className={`vd-status vd-status--${status.type}`}>
                {status.label}
              </span>
              {isCashbackCampaign && (
                <span className="vd-type-badge vd-type-badge--campaign">
                  Kampanye Cashback
                </span>
              )}
              {!isForMemberOnly && !isCashbackCampaign && (
                <span className="vd-type-badge">Voucher Cetak</span>
              )}
            </div>
          </div>
          <button className="vd-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="vd-body">
          {error && <div className="vd-error">{error}</div>}

          {/* Stats Row */}
          <div className="vd-stats">
            <div className="vd-stat">
              <span className="vd-stat-value">
                {voucherService.formatCurrency(voucherGroup.value)}
              </span>
              <span className="vd-stat-label">
                {isCashbackCampaign ? "Hadiah" : "Nilai"}
              </span>
            </div>
            {/* {isCashbackCampaign && (
              <div className="vd-stat">
                <span className="vd-stat-value">
                  {voucherService.formatCurrency(voucherGroup.threshold || 0)}
                </span>
                <span className="vd-stat-label">Target</span>
              </div>
            )} */}
            <div className="vd-stat">
              <span className="vd-stat-value">{vouchers.length}</span>
              <span className="vd-stat-label">
                {isCashbackCampaign ? "Peserta" : "Total"}
              </span>
            </div>
            {isCashbackCampaign ? (
              <>
                {/* <div className="vd-stat">
                  <span className="vd-stat-value">{inProgressCount}</span>
                  <span className="vd-stat-label">Mengumpulkan</span>
                </div> */}
                <div className="vd-stat">
                  <span className="vd-stat-value">{claimedCount}</span>
                  <span className="vd-stat-label">Siap Pakai</span>
                </div>
                <div className="vd-stat">
                  <span className="vd-stat-value">{redeemedCount}</span>
                  <span className="vd-stat-label">Terpakai</span>
                </div>
              </>
            ) : (
              <>
                <div className="vd-stat">
                  <span className="vd-stat-value">{claimedCount}</span>
                  <span className="vd-stat-label">Diklaim</span>
                </div>
                <div className="vd-stat">
                  <span className="vd-stat-value">
                    {vouchers.length - claimedCount}
                  </span>
                  <span className="vd-stat-label">Tersisa</span>
                </div>
              </>
            )}
          </div>

          {/* Date Info */}
          <div className="vd-dates">
            <div className="vd-date-item">
              <span className="vd-date-label">Mulai</span>
              <span className="vd-date-value">
                {formatShortDate(voucherGroup.activeDate)}
              </span>
            </div>
            <div className="vd-date-divider">→</div>
            <div className="vd-date-item">
              <span className="vd-date-label">Berakhir</span>
              <span className="vd-date-value">
                {formatShortDate(voucherGroup.expireDate)}
              </span>
            </div>
          </div>

          {/* PDF Download for Non-Member Vouchers */}
          {!isForMemberOnly && !readOnly && (
            <div className="vd-pdf-section">
              <button
                className="vd-pdf-btn"
                onClick={generateVouchersPdf}
                disabled={generatingPdf || loading || vouchers.length === 0}
              >
                {generatingPdf ? (
                  <>
                    <span className="vd-spinner"></span>
                    Membuat PDF...
                  </>
                ) : (
                  <>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PDF ({vouchers.length} voucher)
                  </>
                )}
              </button>
              <p className="vd-pdf-hint">
                File PDF siap cetak dengan barcode untuk setiap voucher
              </p>
            </div>
          )}

          {/* Member Voucher List - Also show for campaigns but without add member option */}
          {(isForMemberOnly || isCashbackCampaign) && (
            <div className="vd-section">
              <div className="vd-section-header">
                <h3>
                  {isCashbackCampaign ? "Daftar Peserta" : "Daftar Penerima"}
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    className="vd-link-btn"
                    type="button"
                    onClick={handleCopyNames}
                    disabled={loading || vouchers.length === 0}
                    style={{ color: "#2563eb", fontWeight: "600" }}
                  >
                    {copied ? "Tersalin!" : "Salin"}
                  </button>
                  {!isCashbackCampaign && !readOnly && (
                    <button
                      className="vd-link-btn"
                      type="button"
                      onClick={handleAddMembersToggle}
                      disabled={loading}
                    >
                      {showAddMembers ? "Batal" : "+ Tambah"}
                    </button>
                  )}
                </div>
              </div>

              {showAddMembers && !isCashbackCampaign && (
                <div className="vd-add-members">
                  <input
                    type="text"
                    className="vd-search"
                    placeholder="Cari nama anggota..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                  <div className="vd-member-list">
                    {filteredAvailableMembers.length === 0 ? (
                      <div className="vd-empty">Tidak ada anggota tersedia</div>
                    ) : (
                      filteredAvailableMembers.map((member) => (
                        <label key={member.id} className="vd-member-item">
                          <input
                            type="checkbox"
                            checked={selectedNewMembers.some(
                              (m) => m.id === member.id
                            )}
                            onChange={() => handleMemberSelect(member)}
                          />
                          <div className="vd-member-info">
                            <span className="vd-member-name">
                              {member.nama}
                            </span>
                            <span className="vd-member-detail">
                              {member.kantor}
                            </span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedNewMembers.length > 0 && (
                    <button
                      className="vd-add-btn"
                      onClick={handleAddSelectedMembers}
                      disabled={loading}
                    >
                      Tambah {selectedNewMembers.length} Anggota
                    </button>
                  )}
                </div>
              )}

              {(!showAddMembers || isCashbackCampaign) && (
                <div className="vd-voucher-list">
                  {loading ? (
                    <div className="vd-loading">Memuat...</div>
                  ) : vouchers.length === 0 ? (
                    <div className="vd-empty">
                      {isCashbackCampaign
                        ? "Belum ada peserta"
                        : "Belum ada voucher"}
                    </div>
                  ) : (
                    vouchers.map((voucher) => (
                      <div key={voucher.id} className="vd-voucher-item">
                        <div className="vd-voucher-info">
                          <span className="vd-voucher-name">
                            {voucher.nama || "-"}
                          </span>
                          <span className="vd-voucher-detail">
                            {voucher.kantor}
                            {isCashbackCampaign &&
                              voucher.userPoints !== undefined && (
                                <>
                                  {" "}
                                  •{" "}
                                  {voucherService.formatCurrency(
                                    voucher.userPoints
                                  )}{" "}
                                  poin
                                </>
                              )}
                          </span>
                        </div>
                        <div className="vd-voucher-status">
                          {isCashbackCampaign ? (
                            // Campaign-specific status badges
                            voucher.status === "REDEEMED" ? (
                              <span className="vd-badge vd-badge--redeemed">
                                Terpakai
                              </span>
                            ) : voucher.status === "CLAIMED" ? (
                              <span className="vd-badge vd-badge--ready">
                                Siap Pakai
                              </span>
                            ) : (
                              <span className="vd-badge vd-badge--progress">
                                Mengumpulkan
                              </span>
                            )
                          ) : // Regular voucher status
                          voucher.isOneTimeUse === false ? (
                            (() => {
                              const spent = voucher.amountSpent || 0;
                              const remaining = voucher.value - spent;
                              if (remaining <= 0) {
                                return (
                                  <span className="vd-badge vd-badge--redeemed">
                                    Saldo Habis
                                  </span>
                                );
                              }
                              return (
                                <span className="vd-badge vd-badge--multiuse">
                                  Sisa{" "}
                                  {voucherService.formatNumber(remaining)}
                                </span>
                              );
                            })()
                          ) : voucher.isClaimed ? (
                            <span className="vd-badge vd-badge--redeemed">
                              Terpakai
                            </span>
                          ) : (
                            <span className="vd-badge vd-badge--available">
                              Tersedia
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Settings Section - hidden for read-only users */}
          {!readOnly && (
            <div className="vd-section vd-section--settings">
              <div className="vd-section-header">
                <h3>Pengaturan</h3>
                {!isEditing ? (
                  <button
                    className="vd-link-btn"
                    onClick={() => setIsEditing(true)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                ) : (
                  <div className="vd-edit-actions">
                    <button
                      className="vd-link-btn"
                      onClick={() => setIsEditing(false)}
                    >
                      Batal
                    </button>
                    <button
                      className="vd-save-btn"
                      onClick={handleSaveEdit}
                      disabled={loading}
                    >
                      Simpan
                    </button>
                  </div>
                )}
              </div>

              <div className="vd-settings-grid">
                <div className="vd-field">
                  <label>
                    {isCashbackCampaign ? "Nama Kampanye" : "Nama Voucher"}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.voucherName}
                      onChange={(e) =>
                        handleEditDataChange("voucherName", e.target.value)
                      }
                    />
                  ) : (
                    <span>{voucherGroup.voucherName}</span>
                  )}
                </div>
                <div className="vd-field">
                  <label>
                    {isCashbackCampaign ? "Nilai Hadiah" : "Nilai"}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.value}
                      onChange={(e) =>
                        handleEditDataChange("value", e.target.value)
                      }
                    />
                  ) : (
                    <span>
                      {voucherService.formatCurrency(voucherGroup.value)}
                    </span>
                  )}
                </div>
                {isCashbackCampaign && (
                  <div className="vd-field">
                    <label>Target Belanja</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.threshold}
                        onChange={(e) =>
                          handleEditDataChange("threshold", e.target.value)
                        }
                      />
                    ) : (
                      <span>
                        {voucherService.formatCurrency(
                          voucherGroup.threshold || 0
                        )}
                      </span>
                    )}
                  </div>
                )}
                <div className="vd-field">
                  <label>Tanggal Mulai</label>
                  {isEditing ? (
                    <input
                      type="datetime-local"
                      value={editData.activeDate}
                      onChange={(e) =>
                        handleEditDataChange("activeDate", e.target.value)
                      }
                    />
                  ) : (
                    <span>{formatDate(voucherGroup.activeDate)}</span>
                  )}
                </div>
                <div className="vd-field">
                  <label>Tanggal Berakhir</label>
                  {isEditing ? (
                    <input
                      type="datetime-local"
                      value={editData.expireDate}
                      onChange={(e) =>
                        handleEditDataChange("expireDate", e.target.value)
                      }
                    />
                  ) : (
                    <span>{formatDate(voucherGroup.expireDate)}</span>
                  )}
                </div>
                <div className="vd-field">
                  <label>Status</label>
                  {isEditing ? (
                    <select
                      value={editData.isActive}
                      onChange={(e) =>
                        handleEditDataChange(
                          "isActive",
                          e.target.value === "true"
                        )
                      }
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  ) : (
                    <span>
                      {voucherGroup.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="vd-danger">
                <button
                  className="vd-danger-btn"
                  type="button"
                  onClick={() => setShowDeleteConfirmation(true)}
                  disabled={loading || deleting || isEditing}
                >
                  Hapus Grup Voucher
                </button>
                <button
                  className="vd-report-btn"
                  type="button"
                  onClick={generateReportPdf}
                  disabled={loading || generatingReport || vouchers.length === 0}
                >
                  {generatingReport ? "Membuat PDF..." : "Cetak Laporan"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmation && (
          <div className="vd-confirm-overlay">
            <div className="vd-confirm">
              <h4>Hapus Voucher?</h4>
              <p>
                Grup voucher <strong>{voucherGroup.voucherName}</strong> dan
                semua voucher di dalamnya akan dihapus permanen.
              </p>
              <div className="vd-confirm-actions">
                <button
                  className="vd-confirm-cancel"
                  onClick={() => setShowDeleteConfirmation(false)}
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  className="vd-confirm-delete"
                  onClick={handleDeleteVoucherGroup}
                  disabled={deleting}
                >
                  {deleting ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoucherDetailModalNew;
