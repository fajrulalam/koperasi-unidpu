import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { voucherService } from "./voucherService";
import { buildVoucherReportData } from "./voucherReportData";

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const formatDate = (dateObj) => {
  if (!dateObj) return "-";
  let d;
  if (dateObj.toDate && typeof dateObj.toDate === "function") {
    d = dateObj.toDate();
  } else if (dateObj.seconds) {
    d = new Date(dateObj.seconds * 1000);
  } else {
    d = new Date(dateObj);
  }
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (dateObj) => {
  if (!dateObj) return "-";
  let d;
  if (dateObj.toDate && typeof dateObj.toDate === "function") {
    d = dateObj.toDate();
  } else if (dateObj.seconds) {
    d = new Date(dateObj.seconds * 1000);
  } else {
    d = new Date(dateObj);
  }
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatLongDateTime = (dateObj) => {
  if (!dateObj) return "-";
  let d;
  if (dateObj.toDate && typeof dateObj.toDate === "function") {
    d = dateObj.toDate();
  } else if (dateObj.seconds) {
    d = new Date(dateObj.seconds * 1000);
  } else {
    d = new Date(dateObj);
  }
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatQuantity = (value) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);

const formatUnitPrices = (unitPrices) => {
  if (!unitPrices || unitPrices.length === 0) return "Rp 0";
  if (unitPrices.length === 1) {
    return voucherService.formatCurrency(unitPrices[0]);
  }
  return `${voucherService.formatCurrency(
    unitPrices[0]
  )} - ${voucherService.formatCurrency(unitPrices[unitPrices.length - 1])}`;
};

export const generateVoucherProgramReportPdf = async ({
  voucherGroup,
  isProduction = true,
  reportVouchers = null,
  reportTransactions = null,
  includeLogos = true,
  shouldSave = true,
  reportGeneratedAt = new Date(),
}) => {
  try {
    // 1. Fetch vouchers and transactions for this voucher group
    const [vouchers, transactions] =
      reportVouchers && reportTransactions
        ? [reportVouchers, reportTransactions]
        : await Promise.all([
            voucherService.getVouchersByGroupId(
              voucherGroup.id,
              isProduction
            ),
            voucherService.getTransactionsByVoucherGroupId(
              voucherGroup.id,
              isProduction
            ),
          ]);
    const reportData = buildVoucherReportData({
      voucherGroup,
      vouchers,
      transactions,
    });

    const doc = new jsPDF();
    doc.setFont("helvetica");

    // Load logo assets
    let logoYapetidu = null;
    let logoUrg = null;
    if (includeLogos) {
      try {
        logoYapetidu = await loadImage(
          "/Logo YAPETIDU (Transparent bg).png"
        );
      } catch (e) {
        console.warn("Could not load YAPETIDU logo:", e);
      }
      try {
        logoUrg = await loadImage("/Kop URG Logo (Latest).png");
      } catch (e) {
        console.warn("Could not load Kop URG logo:", e);
      }
    }

    // Header Logos
    let textX = 14;
    if (logoYapetidu || logoUrg) {
      let currentX = 14;
      if (logoYapetidu) {
        doc.addImage(logoYapetidu, "PNG", currentX, 12, 20, 20);
        currentX += 22;
      }
      if (logoUrg) {
        doc.addImage(logoUrg, "PNG", currentX, 12, 20, 20);
        currentX += 22;
      }
      textX = currentX + 2;
    }

    // Title Header
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("LAPORAN PROGRAM VOUCHER KOPERASI", textX, 17);

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Program Voucher: ${voucherGroup.voucherName}`, textX, 23);
    doc.text(
      `Nilai Nominal: ${voucherService.formatCurrency(voucherGroup.value || 0)}`,
      textX,
      28
    );

    const activeRangeStr = `${formatShortDate(
      voucherGroup.activeDate
    )} s/d ${formatShortDate(voucherGroup.expireDate)}`;
    doc.text(`Masa Berlaku: ${activeRangeStr}`, textX, 33);

    const reportDateRange = `${formatLongDateTime(
      voucherGroup.activeDate
    )} s/d ${formatLongDateTime(reportGeneratedAt)}`;
    doc.text(`Periode Laporan: ${reportDateRange}`, 14, 42);

    // Metadata Summary Box
    const summaryBoxY = 46;
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, summaryBoxY, 182, 24, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Ringkasan Program:", 18, summaryBoxY + 6);

    doc.setFont(undefined, "normal");
    doc.text(
      `Total Penerima: ${reportData.recipients.length} orang`,
      18,
      summaryBoxY + 12
    );
    doc.text(
      `Sudah Belanja: ${reportData.purchasedRecipientCount} orang`,
      75,
      summaryBoxY + 12
    );
    doc.text(
      `Belum Belanja: ${reportData.notPurchasedRecipientCount} orang`,
      132,
      summaryBoxY + 12
    );
    doc.text(
      `Total Transaksi: ${reportData.totalTransactions} kali`,
      18,
      summaryBoxY + 18
    );
    doc.text(
      `Total Penjualan: ${voucherService.formatCurrency(
        reportData.grandSalesValue
      )}`,
      75,
      summaryBoxY + 18
    );
    doc.text(
      `Voucher Digunakan: ${voucherService.formatCurrency(
        reportData.totalVoucherUsed
      )}`,
      132,
      summaryBoxY + 18
    );

    let startY = summaryBoxY + 30;

    // --- SECTION 1: SUMMARY OF ITEMS BOUGHT ---
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(31, 41, 55);
    doc.text("Bagian 1: Ringkasan Barang Dibeli (Summary of Items)", 14, startY);
    startY += 4;

    const itemsRows = reportData.items.map((item, idx) => [
      idx + 1,
      item.name,
      formatUnitPrices(item.unitPrices),
      formatQuantity(item.quantity),
      voucherService.formatCurrency(item.totalValue),
    ]);

    if (itemsRows.length === 0) {
      itemsRows.push(["-", "Belum ada transaksi barang", "-", 0, "Rp 0"]);
    }

    autoTable(doc, {
      theme: "grid",
      rowPageBreak: "avoid",
      head: [["No.", "Nama Barang", "Harga Satuan", "Qty Terjual", "Total Sales Value"]],
      body: itemsRows,
      foot: [
        [
          "TOTAL",
          "",
          "",
          formatQuantity(reportData.grandQuantity),
          voucherService.formatCurrency(reportData.grandSalesValue),
        ],
      ],
      showFoot: "lastPage",
      startY: startY,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        valign: "middle",
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [79, 70, 229], // Indigo #4f46e5
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 16 },
        1: { cellWidth: 65.78 },
        2: { halign: "right", cellWidth: 32 },
        3: { halign: "center", cellWidth: 26 },
        4: { halign: "right", cellWidth: 42 },
      },
    });

    startY = doc.lastAutoTable.finalY + 10;

    // --- SECTION 2: EACH MEMBER'S TRANSACTION HISTORY SUMMARY ---
    if (startY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      startY = 16;
    }

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(31, 41, 55);
    doc.text(
      "Bagian 2: Ringkasan Riwayat Transaksi per Anggota",
      14,
      startY
    );
    startY += 4;

    const memberList = reportData.recipients;

    if (memberList.length === 0) {
      autoTable(doc, {
        theme: "grid",
        head: [["Informasi Anggota", "Detail"]],
        body: [["Status", "Belum ada penerima voucher terdaftar"]],
        startY: startY,
        styles: { fontSize: 8.5 },
      });
    } else {
      const memberSummaryRows = memberList.map((member, index) => [
        index + 1,
        member.name,
        member.nomorAnggota,
        member.office,
        member.hasPurchased ? "SUDAH BELANJA" : "BELUM BELANJA",
        member.totalTransactions,
        voucherService.formatCurrency(member.totalSalesValue),
        voucherService.formatCurrency(member.totalVoucherUsed),
      ]);

      autoTable(doc, {
        theme: "grid",
        rowPageBreak: "avoid",
        head: [
          [
            "No.",
            "Nama Anggota",
            "No. Anggota",
            "Unit",
            "Status",
            "Jml. Tx",
            "Total Belanja",
            "Voucher Digunakan",
          ],
        ],
        body: memberSummaryRows,
        startY,
        styles: {
          fontSize: 7.3,
          cellPadding: 1.7,
          valign: "middle",
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 9 },
          1: { cellWidth: 38.78 },
          2: { cellWidth: 21 },
          3: { cellWidth: 27 },
          4: { halign: "center", cellWidth: 24 },
          5: { halign: "center", cellWidth: 13 },
          6: { halign: "right", cellWidth: 23 },
          7: { halign: "right", cellWidth: 26 },
        },
        didParseCell: (data) => {
          if (data.section !== "body" || data.column.index !== 4) return;
          if (data.cell.raw === "SUDAH BELANJA") {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      startY = doc.lastAutoTable.finalY + 10;
      const purchasedMembers = memberList.filter(
        (member) => member.hasPurchased
      );

      if (purchasedMembers.length > 0) {
        if (startY > doc.internal.pageSize.height - 30) {
          doc.addPage();
          startY = 16;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.setTextColor(31, 41, 55);
        doc.text(
          "Rincian Transaksi Anggota yang Sudah Belanja",
          14,
          startY
        );
        startY += 6;
      }

      purchasedMembers.forEach((member, memberIndex) => {
        if (startY > doc.internal.pageSize.height - 35) {
          doc.addPage();
          startY = 16;
        }

        doc.setFontSize(9.5);
        doc.setFont(undefined, "bold");
        doc.setTextColor(30, 58, 138);
        doc.text(
          `${memberIndex + 1}. ${member.name} ${
            member.nomorAnggota !== "-" ? `(${member.nomorAnggota})` : ""
          }`,
          14,
          startY
        );

        doc.setFontSize(8.5);
        doc.setFont(undefined, "normal");
        doc.setTextColor(75, 85, 99);
        doc.text(
          `Unit: ${member.office} | Total Transaksi: ${
            member.totalTransactions
          } | Total Belanja: ${voucherService.formatCurrency(
            member.totalSalesValue
          )} | Voucher Digunakan: ${voucherService.formatCurrency(
            member.totalVoucherUsed
          )}`,
          14,
          startY + 4
        );

        startY += 7;

        const txRows = member.transactions.map((tx, transactionIndex) => {
          const itemsListStr = Array.isArray(tx.items)
            ? tx.items
                .map(
                  (i) =>
                    `${
                      i.itemName ||
                      i.nama ||
                      i.name ||
                      i.productName ||
                      i.title ||
                      "Barang"
                    } (x${i.quantity ?? i.qty ?? i.jumlah ?? 1})`
                )
                .join(", ")
            : "-";

          return [
            transactionIndex + 1,
            tx.id || "-",
            formatDate(tx.createdAt || tx.updatedAt),
            itemsListStr,
            voucherService.formatCurrency(tx.total || 0),
            voucherService.formatCurrency(tx.voucherDiscount || 0),
          ];
        });

        autoTable(doc, {
          theme: "plain",
          rowPageBreak: "avoid",
          head: [
            [
              "No.",
              "ID Transaksi",
              "Tanggal Transaksi",
              "Daftar Item Dibeli",
              "Total Belanja",
              "Diskon Voucher",
            ],
          ],
          body: txRows,
          startY: startY,
          styles: {
            fontSize: 8,
            cellPadding: 2,
            valign: "middle",
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [243, 244, 246],
            textColor: [55, 65, 81],
            fontStyle: "bold",
            fontSize: 8,
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { cellWidth: 32 },
            2: { cellWidth: 32 },
            3: { cellWidth: 57.78 },
            4: { halign: "right", cellWidth: 25 },
            5: { halign: "right", cellWidth: 25 },
          },
        });

        startY = doc.lastAutoTable.finalY + 6;
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(
        `Halaman ${pageNumber} dari ${pageCount}`,
        doc.internal.pageSize.width - 14,
        doc.internal.pageSize.height - 8,
        { align: "right" }
      );
    }

    // Save PDF
    const fileName = `Laporan_Program_Voucher_${(
      voucherGroup.voucherName || "Detail"
    ).replace(/\s+/g, "_")}.pdf`;
    if (shouldSave) {
      doc.save(fileName);
    }
    return { doc, fileName, reportData };
  } catch (err) {
    console.error("Gagal membuat PDF Laporan Program Voucher:", err);
    throw err;
  }
};
