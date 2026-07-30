import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { voucherService } from "./voucherService";

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

export const generateVoucherProgramReportPdf = async ({
  voucherGroup,
  isProduction = true,
}) => {
  try {
    // 1. Fetch vouchers and transactions for this voucher group
    const [vouchers, transactions] = await Promise.all([
      voucherService.getVouchersByGroupId(voucherGroup.id, isProduction),
      voucherService.getTransactionsByVoucherGroupId(voucherGroup.id, isProduction),
    ]);

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

    const todayStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Dicetak Pada: ${todayStr}`, 14, 42);

    // Metadata Summary Box
    let totalDiscountUsed = 0;
    transactions.forEach((tx) => {
      totalDiscountUsed += Number(tx.voucherDiscount || 0);
    });

    const summaryBoxY = 46;
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, summaryBoxY, 182, 18, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Ringkasan Program:", 18, summaryBoxY + 6);

    doc.setFont(undefined, "normal");
    doc.text(
      `Total Penerima: ${vouchers.length} orang`,
      18,
      summaryBoxY + 12
    );
    doc.text(
      `Total Transaksi: ${transactions.length} kali`,
      78,
      summaryBoxY + 12
    );
    doc.text(
      `Total Diskon Voucher Digunakan: ${voucherService.formatCurrency(
        totalDiscountUsed
      )}`,
      132,
      summaryBoxY + 12
    );

    let startY = summaryBoxY + 24;

    // --- SECTION 1: SUMMARY OF ITEMS BOUGHT ---
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(31, 41, 55);
    doc.text("Bagian 1: Ringkasan Barang Dibeli (Summary of Items)", 14, startY);
    startY += 4;

    // Aggregate items across transactions
    const itemsMap = {};
    let grandQty = 0;
    let grandSalesValue = 0;

    transactions.forEach((tx) => {
      const itemsList = Array.isArray(tx.items) ? tx.items : [];
      itemsList.forEach((item) => {
        const itemName =
          item.itemName ||
          item.nama ||
          item.name ||
          item.productName ||
          item.title ||
          "Barang Tanpa Nama";
        const itemKey = item.itemId || item.id || item.productId || itemName;
        const unitPrice = Number(item.price ?? item.harga ?? item.unitPrice ?? 0);
        const qty = Number(item.quantity ?? item.qty ?? item.jumlah ?? 1);
        const subtotal = Number(
          item.subtotal ?? item.total ?? unitPrice * qty
        );

        if (!itemsMap[itemKey]) {
          itemsMap[itemKey] = {
            name: itemName,
            unitPrice: unitPrice,
            quantity: 0,
            totalValue: 0,
          };
        }
        itemsMap[itemKey].quantity += qty;
        itemsMap[itemKey].totalValue += subtotal;
        grandQty += qty;
        grandSalesValue += subtotal;
      });
    });

    const itemsRows = Object.values(itemsMap).map((item, idx) => [
      idx + 1,
      item.name,
      voucherService.formatCurrency(item.unitPrice),
      item.quantity,
      voucherService.formatCurrency(item.totalValue),
    ]);

    if (itemsRows.length === 0) {
      itemsRows.push(["-", "Belum ada transaksi barang", "-", 0, "Rp 0"]);
    }

    autoTable(doc, {
      theme: "grid",
      head: [["No.", "Nama Barang", "Harga Satuan", "Qty Terjual", "Total Sales Value"]],
      body: itemsRows,
      foot: [
        [
          "TOTAL",
          "",
          "",
          grandQty,
          voucherService.formatCurrency(grandSalesValue),
        ],
      ],
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
        1: { cellWidth: 66 },
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
      "Bagian 2: Riwayat Transaksi per Anggota (Member Transaction History)",
      14,
      startY
    );
    startY += 4;

    // Group vouchers and transactions by member
    const memberMap = {};

    // First populate from vouchers list (ensures all recipients appear)
    vouchers.forEach((v) => {
      const memberKey = v.userId || v.nomorAnggota || v.nama || "non_member";
      if (!memberMap[memberKey]) {
        memberMap[memberKey] = {
          name: v.nama || "Voucher Cetak (Non-Member)",
          nomorAnggota: v.nomorAnggota || v.kantor || "-",
          office: v.kantor || "-",
          voucherValue: v.value || voucherGroup.value || 0,
          remainingValue: v.remainingValue ?? (v.isClaimed ? 0 : v.value || voucherGroup.value || 0),
          transactions: [],
        };
      }
    });

    // Populate transactions into corresponding member bucket
    transactions.forEach((tx) => {
      const memberKey = tx.userId || tx.nomorAnggota || tx.memberName || "non_member";
      if (!memberMap[memberKey]) {
        memberMap[memberKey] = {
          name: tx.memberName || "Tanpa Nama",
          nomorAnggota: tx.nomorAnggota || "-",
          office: "-",
          voucherValue: voucherGroup.value || 0,
          remainingValue: 0,
          transactions: [],
        };
      }
      memberMap[memberKey].transactions.push(tx);
    });

    const memberList = Object.values(memberMap);

    if (memberList.length === 0) {
      autoTable(doc, {
        theme: "grid",
        head: [["Informasi Anggota", "Detail"]],
        body: [["Status", "Belum ada penerima voucher terdaftar"]],
        startY: startY,
        styles: { fontSize: 8.5 },
      });
    } else {
      memberList.forEach((m, idx) => {
        if (startY > doc.internal.pageSize.height - 35) {
          doc.addPage();
          startY = 16;
        }

        const totalMemberTx = m.transactions.length;
        let totalMemberDiscount = 0;
        m.transactions.forEach((t) => {
          totalMemberDiscount += Number(t.voucherDiscount || 0);
        });

        // Member Header line
        doc.setFontSize(9.5);
        doc.setFont(undefined, "bold");
        doc.setTextColor(30, 58, 138);
        doc.text(
          `${idx + 1}. ${m.name} ${m.nomorAnggota !== "-" ? `(${m.nomorAnggota})` : ""}`,
          14,
          startY
        );

        doc.setFontSize(8.5);
        doc.setFont(undefined, "normal");
        doc.setTextColor(75, 85, 99);
        doc.text(
          `Unit: ${m.office} | Total Transaksi: ${totalMemberTx} | Total Voucher Digunakan: ${voucherService.formatCurrency(
            totalMemberDiscount
          )}`,
          14,
          startY + 4
        );

        startY += 7;

        // Transactions table for this member
        const txRows = m.transactions.map((tx, tIdx) => {
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
            tIdx + 1,
            tx.id || "-",
            formatDate(tx.updatedAt || tx.createdAt),
            itemsListStr,
            voucherService.formatCurrency(tx.total || 0),
            voucherService.formatCurrency(tx.voucherDiscount || 0),
          ];
        });

        if (txRows.length === 0) {
          txRows.push([
            "-",
            "-",
            "-",
            "Belum ada transaksi penggunaan voucher",
            "Rp 0",
            "Rp 0",
          ]);
        }

        autoTable(doc, {
          theme: "plain",
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
            3: { cellWidth: 58 },
            4: { halign: "right", cellWidth: 25 },
            5: { halign: "right", cellWidth: 25 },
          },
        });

        startY = doc.lastAutoTable.finalY + 6;
      });
    }

    // Save PDF
    const fileName = `Laporan_Program_Voucher_${(
      voucherGroup.voucherName || "Detail"
    ).replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error("Gagal membuat PDF Laporan Program Voucher:", err);
    throw err;
  }
};
