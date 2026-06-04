import React, { useState, useEffect } from "react";
import {
  FaPlus,
  FaFileInvoice,
  FaUpload,
  FaReceipt,
  FaEye,
  FaCheck,
  FaClock,
  FaExclamationTriangle,
} from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/WarehouseExit.css";
import { useAuth } from "../context/AuthContext";
import { useFirestore } from "../context/FirestoreContext";
import { uploadFile } from "../firebase";
import WarehouseExitModal from "./WarehouseExitModal";

// Helper function for currency formatting
function formatRupiah(value) {
  if (!value) return "0";
  const numeric = value.toString().replace(/\D/g, "");
  if (!numeric) return "0";
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper function to format date in Indonesian (EEEE, DD MM YYYY)
function formatIndonesianDate(dateString) {
  if (!dateString) return "N/A";

  const date =
    typeof dateString === "string"
      ? new Date(dateString)
      : dateString.toDate?.();
  if (!date || isNaN(date.getTime())) return "N/A";

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

function parseRupiah(value) {
  if (!value) return 0;
  const numeric = value.toString().replace(/\D/g, "");
  return parseInt(numeric, 10) || 0;
}

// Helper function to convert to smallest unit (similar to Transaksi.js)
function convertToSmallestUnit(quantity, unit, product) {
  if (quantity == null || !unit || !product.smallestUnit) {
    throw new Error("Missing required parameters for conversion");
  }

  // Handle box conversion first
  if (unit === "box") {
    if (!product.piecesPerBox) {
      throw new Error("Pieces per box not defined for this product");
    }
    return quantity * product.piecesPerBox;
  }

  // For weight-based conversions
  const weightConversions = {
    ton: 1000000, // 1 ton = 1,000,000 grams
    kwintal: 100000, // 1 kwintal = 100,000 grams
    kg: 1000, // 1 kg = 1,000 grams
    ons: 100, // 1 ons = 100 grams
    gram: 1, // base unit
    pcs: 1, // for piece-based items
  };

  // If the unit or product's smallest unit isn't in our conversion table
  if (!weightConversions[unit] || !weightConversions[product.smallestUnit]) {
    throw new Error("Invalid unit for conversion");
  }

  // Convert to grams first, then to target unit
  const valueInGrams = quantity * weightConversions[unit];
  const result = valueInGrams / weightConversions[product.smallestUnit];

  return result;
}

const WarehouseExit = () => {
  const { currentUser, userRole } = useAuth();
  const { createDoc, updateDoc, queryCollection } = useFirestore();

  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState({});
  const [records, setRecords] = useState([]);
  const [stockTxList, setStockTxList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Check if user can create new records
  const canCreateRecord =
    userRole === "Director" ||
    userRole === "Wakil Rektor 2" ||
    userRole === "Admin" ||
    userRole === "superAdmin";
  const canUploadPO = userRole === "Mitra";
  const canUploadPayment = userRole === "BAK";

  // Fetch products from stocks_b2b
  const fetchProducts = async () => {
    try {
      const stocksData = await queryCollection("stocks_b2b");
      const productsObj = {};

      stocksData.forEach((item) => {
        if (!item.isDeleted) {
          productsObj[item.id] = {
            ...item,
            name: item.name
              .split(" ")
              .map(
                (word) =>
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join(" "),
          };
        }
      });

      setProducts(productsObj);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Fetch warehouse exit records
  const fetchRecords = async () => {
    try {
      const recordsData = await queryCollection("warehouseExit");
      const txData = await queryCollection("stockTransactions_b2b");
      setStockTxList(txData);

      // Sort by createdAt descending (newest first)
      const sortedRecords = recordsData.sort((a, b) => {
        const dateA =
          typeof a.createdAt === "string"
            ? new Date(a.createdAt)
            : a.createdAt?.toDate?.() || new Date(0);
        const dateB =
          typeof b.createdAt === "string"
            ? new Date(b.createdAt)
            : b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setRecords(sortedRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate document ID with format yyyy-mm-dd_timestampInSeconds
  const generateDocumentId = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const timestampInSeconds = Math.floor(now.getTime() / 1000);
    return `${yyyy}-${mm}-${dd}_${timestampInSeconds}`;
  };

  // Handle save from modal
  const handleSave = async (transactionData, validRows) => {
    try {
      const documentId = generateDocumentId();
      const transactionDetailId = uuidv4(); // Create once for all transactions

      // Check stock availability and create stock transactions
      for (const row of validRows) {
        const product = row.product;
        const quantity = parseFloat(row.quantity);

        // Convert to smallest unit for stock calculation
        const convertedQty = convertToSmallestUnit(quantity, row.unit, {
          smallestUnit: product.smallestUnit,
          piecesPerBox: product.piecesPerBox,
        });

        let rowHargaKulakVal = parseRupiah(row.hargaKulak);
        if (!rowHargaKulakVal && product.stock && product.stockValue) {
          rowHargaKulakVal = Math.round(product.stockValue / product.stock);
        }
        const rowCost = quantity * rowHargaKulakVal;

        // Create stock transaction (similar to Transaksi.js)
        const stockTransactionId = uuidv4();
        await createDoc(
          "stockTransactions_b2b",
          {
            itemId: product.itemId || product.id,
            itemName: product.name,
            kategori: product.kategori || "",
            subKategori: product.subKategori || "",
            price: parseRupiah(row.unitPrice),
            quantity: convertedQty,
            unit: product.smallestUnit,
            originalQuantity: quantity,
            originalUnit: row.unit,
            isDeleted: false,
            transactionType: "penjualan",
            transactionVia: "warehouseExit",
            cost: rowCost,
            stockWorth: rowCost,
            transactionDetailId: transactionDetailId, // Reference to transaction detail
            createdBy: currentUser ? currentUser.email : "unknown",
          },
          stockTransactionId
        );

        // Update stock and prices (Harga Kulak & Harga Satuan) in stocks_b2b
        const newStock = product.stock - convertedQty;

        let newHargaKulakVal = parseRupiah(row.hargaKulak);
        if (!newHargaKulakVal && product.stock && product.stockValue) {
          newHargaKulakVal = Math.round(product.stockValue / product.stock);
        }
        const newStockValue = Math.max(0, newStock * newHargaKulakVal);

        let newUnitPriceVal = parseRupiah(row.unitPrice);
        if (!newUnitPriceVal && product.pricePerUnit?.[row.unit]) {
          newUnitPriceVal = product.pricePerUnit[row.unit];
        }

        const newPricePerUnit = {
          ...(product.pricePerUnit || {}),
          [row.unit]: newUnitPriceVal,
        };

        await updateDoc("stocks_b2b", product.id, {
          stock: newStock,
          stockValue: newStockValue,
          pricePerUnit: newPricePerUnit,
        });
      }

      // Create transaction detail (similar to Transaksi.js)
      await createDoc(
        "transactionDetail_b2b",
        {
          id: transactionDetailId,
          items: transactionData.items,
          total: transactionData.total,
          customerDetail: transactionData.customerDetail,
          isMember: false,
          createdBy: currentUser ? currentUser.email : "unknown",
        },
        transactionDetailId
      );

      // Create warehouse exit record
      const warehouseExitData = {
        ...transactionData,
        id: documentId,
        transactionDetailId,
        createdAt: new Date().toISOString(),
      };

      await createDoc("warehouseExit", warehouseExitData, documentId);

      // Refresh data
      await fetchRecords();
      await fetchProducts();

      setSnackbar({
        open: true,
        message: "Warehouse exit record created successfully!",
      });

      setTimeout(() => {
        setSnackbar({ open: false, message: "" });
      }, 3000);
    } catch (error) {
      console.error("Error creating warehouse exit record:", error);
      throw error;
    }
  };

  // Generate quotation PDF
  const generateQuotationPDF = (record) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", 105, 30, { align: "center" });

    // Document info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Document ID: ${record.id}`, 20, 50);
    doc.text(
      `Date: ${new Date(record.createdAt).toLocaleDateString("id-ID")}`,
      20,
      60
    );

    // Customer details
    doc.setFont("helvetica", "bold");
    doc.text("Customer Details:", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${record.customerDetail.customerName}`, 20, 90);
    doc.text(`Business Type: ${record.customerDetail.businessType}`, 20, 100);

    // Items table header
    doc.setFont("helvetica", "bold");
    doc.text("Items:", 20, 120);

    // Table headers
    let yPos = 135;
    doc.setFontSize(10);
    doc.text("Item Name", 20, yPos);
    doc.text("Quantity", 80, yPos);
    doc.text("Unit Price", 120, yPos);
    doc.text("Subtotal", 160, yPos);

    // Draw line under headers
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    // Table content
    doc.setFont("helvetica", "normal");
    record.items.forEach((item) => {
      doc.text(item.itemName.substring(0, 25), 20, yPos); // Truncate long names
      doc.text(`${item.quantity} ${item.unit}`, 80, yPos);
      doc.text(`Rp ${formatRupiah(item.unitPrice.toString())}`, 120, yPos);
      doc.text(`Rp ${formatRupiah(item.subtotal.toString())}`, 160, yPos);
      yPos += 8;
    });

    // Draw line above total
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Total: Rp ${formatRupiah(record.total.toString())}`, 160, yPos);

    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("This is a system-generated quotation.", 105, 280, {
      align: "center",
    });

    // Open in new tab
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  };

  // Generate profit report PDF
  const generateProfitReport = () => {
    if (filteredRecords.length === 0) {
      alert("Tidak ada data transaksi untuk rentang tanggal yang dipilih.");
      return;
    }

    // 1. Calculate cumulative statistics
    let grandTotalInvoice = 0;
    let grandTotalCost = 0;

    filteredRecords.forEach((record) => {
      grandTotalInvoice += parseRupiah(record.total);
      grandTotalCost += calculateRecordCost(record);
    });

    const grandTotalProfit = grandTotalInvoice - grandTotalCost;

    // 2. Initialize jsPDF
    const doc = new jsPDF("portrait", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width || 210;
    const pageHeight = doc.internal.pageSize.height || 297;
    const margin = 15;

    // 3. Header Section (Premium Corporate Style)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41); // dark gray
    doc.text("KOPERASI SENTRA DISTRIBUSI REJOSO GEMILANG", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(108, 117, 125); // muted gray
    doc.text("Jombang, Jawa Timur, Indonesia", margin, 25);

    // Separator line
    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, 28, pageWidth - margin, 28);

    // Document Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.text("LAPORAN LABA RUGI PENGIRIMAN BARANG", margin, 38);

    // Period Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(73, 80, 87);
    let periodText = "";
    if (startDate && endDate) {
      const options = { day: "2-digit", month: "long", year: "numeric" };
      const startStr = new Date(startDate).toLocaleDateString("id-ID", options);
      const endStr = new Date(endDate).toLocaleDateString("id-ID", options);
      periodText = `Periode: ${startStr} s/d ${endStr}`;
    } else {
      periodText = "Periode: 7 Transaksi Terakhir (Default)";
    }
    doc.text(periodText, margin, 44);

    // Metadata (Generated date & User)
    const printDate = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(`Dicetak pada: ${printDate} oleh ${currentUser?.email || "System"}`, pageWidth - margin, 44, { align: "right" });

    // 4. Summary boxes
    const boxWidth = 56;
    const boxHeight = 22;
    const boxY = 50;
    const boxSpacing = 6;

    // Box 1: Total Penjualan (Revenue)
    doc.setDrawColor(206, 212, 218);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, boxY, boxWidth, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(108, 117, 125);
    doc.text("TOTAL PENJUALAN", margin + 4, boxY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(0, 123, 255); // primary blue
    doc.text(`Rp ${formatRupiah(grandTotalInvoice)}`, margin + 4, boxY + 15);

    // Box 2: Total Kulakan (Cost)
    const box2X = margin + boxWidth + boxSpacing;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(box2X, boxY, boxWidth, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(108, 117, 125);
    doc.text("TOTAL KULAKAN (COST)", box2X + 4, boxY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(108, 117, 125); // gray
    doc.text(`Rp ${formatRupiah(grandTotalCost)}`, box2X + 4, boxY + 15);

    // Box 3: Total Keuntungan (Net Profit)
    const box3X = box2X + boxWidth + boxSpacing;
    const isProfit = grandTotalProfit >= 0;

    const profitBg = isProfit ? [212, 237, 218] : [248, 215, 218]; // light green vs light red
    const profitBorder = isProfit ? [195, 230, 203] : [245, 198, 203];
    const profitText = isProfit ? [21, 87, 36] : [114, 28, 36];

    doc.setDrawColor(profitBorder[0], profitBorder[1], profitBorder[2]);
    doc.setFillColor(profitBg[0], profitBg[1], profitBg[2]);
    doc.roundedRect(box3X, boxY, boxWidth, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(profitText[0], profitText[1], profitText[2]);
    doc.text("TOTAL KEUNTUNGAN (NET)", box3X + 4, boxY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(profitText[0], profitText[1], profitText[2]);
    doc.text(`${isProfit ? "+" : "-"}Rp ${formatRupiah(Math.abs(grandTotalProfit))}`, box3X + 4, boxY + 15);

    // 5. Data Table
    const headers = [
      [
        "No",
        "Tanggal",
        "ID Invoice",
        "Nama Pelanggan",
        "Penjualan (Rp)",
        "Kulakan (Rp)",
        "Keuntungan (Rp)"
      ]
    ];

    const tableData = filteredRecords.map((record, index) => {
      const totalCost = calculateRecordCost(record);
      const profit = parseRupiah(record.total) - totalCost;
      const profitStr = (profit >= 0 ? "+" : "-") + `Rp ${formatRupiah(Math.abs(profit))}`;

      const recordDate = record.createdAt
        ? (typeof record.createdAt === "string"
          ? new Date(record.createdAt)
          : record.createdAt.toDate?.())
        : null;

      const dateStr = recordDate && !isNaN(recordDate.getTime())
        ? recordDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        })
        : "-";

      return [
        index + 1,
        dateStr,
        record.id || "-",
        record.customerDetail?.customerName || "-",
        formatRupiah(record.total),
        formatRupiah(totalCost),
        profitStr
      ];
    });

    const footRow = [
      [
        "",
        "",
        "",
        "Grand Total",
        formatRupiah(grandTotalInvoice),
        formatRupiah(grandTotalCost),
        (grandTotalProfit >= 0 ? "+" : "-") + `Rp ${formatRupiah(Math.abs(grandTotalProfit))}`
      ]
    ];

    autoTable(doc, {
      head: headers,
      body: tableData,
      foot: footRow,
      startY: 80,
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        font: "helvetica",
      },
      headStyles: {
        fillColor: [52, 58, 64], // sleek dark charcoal
        textColor: 255,
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [241, 243, 245],
        textColor: [33, 37, 41],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 }, // No
        1: { halign: "left", cellWidth: 22 }, // Tanggal
        2: { halign: "left", cellWidth: 38 }, // ID Invoice
        3: { halign: "left", cellWidth: 38 }, // Nama Pelanggan
        4: { halign: "right", cellWidth: 24 }, // Penjualan
        5: { halign: "right", cellWidth: 24 }, // Kulakan
        6: { halign: "right", cellWidth: 24 } // Keuntungan
      },
      didParseCell: function (data) {
        if (data.column.index === 6 && (data.cell.section === "body" || data.cell.section === "foot")) {
          const rawVal = data.cell.raw;
          if (rawVal && rawVal.toString().startsWith("-")) {
            data.cell.styles.textColor = [220, 53, 69]; // Bootstrap danger red
            data.cell.styles.fontStyle = "bold";
          } else if (rawVal && rawVal.toString().startsWith("+")) {
            data.cell.styles.textColor = [40, 167, 69]; // Bootstrap success green
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    // 6. Signature Block
    let finalY = doc.lastAutoTable.finalY || 100;

    if (finalY + 45 > pageHeight) {
      doc.addPage();
      finalY = 20;
    } else {
      finalY += 15;
    }

    const signatureX = pageWidth - margin - 60;
    const todayStr = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(33, 37, 41);
    doc.text(`Jombang, ${todayStr}`, signatureX, finalY);
    doc.text("Mengetahui,", signatureX, finalY + 5);
    doc.text("Kepala Koperasi / Direktur,", signatureX, finalY + 10);

    doc.setFont("helvetica", "bold");
    doc.text("( ________________________ )", signatureX, finalY + 32);

    // Open PDF in new tab
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  };

  // Calculate the total Kulakan (purchase cost) for a shipment record
  const calculateRecordCost = (record) => {
    // 1. Try to find matched transactions in stockTxList
    const matchingTxs = stockTxList.filter(
      (tx) => tx.transactionDetailId === record.transactionDetailId
    );
    if (matchingTxs.length > 0) {
      return Math.round(
        matchingTxs.reduce((sum, tx) => sum + (tx.cost || 0), 0)
      );
    }

    // 2. Fallback to record.items cost calculation using item.hargaKulak if stored
    return Math.round(
      record.items?.reduce((sum, item) => {
        const itemHargaKulak = item.hargaKulak || 0;
        return sum + (item.quantity * itemHargaKulak);
      }, 0) || 0
    );
  };

  // Get status display with enhanced information
  const getStatusDisplay = (record) => {
    const { workflow } = record;

    if (workflow.uploadBuktiPembayaran?.completed) {
      return {
        text: "Selesai",
        color: "#28a745",
        bgColor: "#d4edda",
        textColor: "#155724",
        icon: <FaCheck />,
      };
    } else if (workflow.uploadPO?.completed) {
      return {
        text: "Menunggu Pembayaran",
        color: "#ffc107",
        bgColor: "#fff3cd",
        textColor: "#856404",
        icon: <FaClock />,
      };
    } else {
      return {
        text: "Menunggu PO",
        color: "#dc3545",
        bgColor: "#f8d7da",
        textColor: "#721c24",
        icon: <FaExclamationTriangle />,
      };
    }
  };

  // File upload handler with Firebase Storage
  const handleFileUpload = async (recordId, fileType, file) => {
    const uploadKey = `${recordId}_${fileType}`;

    try {
      // Set loading state
      setUploadingFiles((prev) => ({ ...prev, [uploadKey]: true }));

      // Generate file path with proper naming convention
      const timestamp = Date.now();
      const fileExtension = file.name.split(".").pop();
      const fileName = `${recordId}_${fileType}_${timestamp}.${fileExtension}`;
      const filePath = `warehouse/${fileType}/${fileName}`;

      // Upload file to Firebase Storage
      const downloadURL = await uploadFile(file, filePath);

      // Update workflow status with file information
      const updateData = {};
      if (fileType === "po") {
        updateData[`workflow.uploadPO`] = {
          completed: true,
          completedAt: new Date(),
          fileName: file.name,
          originalFileName: file.name,
          storagePath: filePath,
          downloadURL: downloadURL,
          uploadedBy: {
            email: currentUser?.email || "unknown",
            uid: currentUser?.uid || "unknown",
          },
        };
        updateData.status = "menunggu pembayaran";
      } else if (fileType === "payment") {
        updateData[`workflow.uploadBuktiPembayaran`] = {
          completed: true,
          completedAt: new Date(),
          fileName: file.name,
          originalFileName: file.name,
          storagePath: filePath,
          downloadURL: downloadURL,
          uploadedBy: {
            email: currentUser?.email || "unknown",
            uid: currentUser?.uid || "unknown",
          },
        };
        updateData.status = "completed";
      }

      await updateDoc("warehouseExit", recordId, updateData);
      await fetchRecords();

      setSnackbar({
        open: true,
        message: `${fileType === "po" ? "PO" : "Payment proof"
          } uploaded successfully!`,
      });

      setTimeout(() => {
        setSnackbar({ open: false, message: "" });
      }, 3000);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file: " + error.message);
    } finally {
      // Clear loading state
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[uploadKey];
        return newState;
      });
    }
  };

  // Handle viewing uploaded files
  const handleViewFile = (fileInfo) => {
    if (fileInfo?.downloadURL) {
      window.open(fileInfo.downloadURL, "_blank");
    } else {
      alert("File not available");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchRecords();
  }, []);

  // Get filtered records based on selected date range (or default to last 7)
  const getFilteredRecords = () => {
    if (!startDate || !endDate) {
      // By default show the last 7 records
      return records.slice(0, 7);
    }

    return records.filter((record) => {
      if (!record.createdAt) return false;
      const recordDate = new Date(record.createdAt);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return recordDate >= start && recordDate <= end;
    });
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  // Calculate pagination
  const filteredRecords = getFilteredRecords();
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return <div className="warehouse-exit-loading">Memuat...</div>;
  }

  return (
    <div className="warehouse-exit-container">
      <div className="warehouse-exit-header">
        <h1>Pengiriman Barang</h1>
        {canCreateRecord && (
          <button
            className="warehouse-exit-create-btn"
            onClick={() => setShowModal(true)}
          >
            <FaPlus /> Kirim Barang
          </button>
        )}
      </div>

      <div className="warehouse-exit-controls" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "white",
        padding: "16px 20px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
              setCurrentPage(1);
            }}
          />
          {(startDate || endDate) && (
            <button
              onClick={handleClearFilter}
              style={{
                padding: "8px 16px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => e.target.style.background = "#5a6268"}
              onMouseLeave={(e) => e.target.style.background = "#6c757d"}
            >
              Clear Filter
            </button>
          )}
          <button
            onClick={generateProfitReport}
            disabled={filteredRecords.length === 0}
            style={{
              padding: "8px 16px",
              background: filteredRecords.length === 0 ? "#6c757d" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: filteredRecords.length === 0 ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: filteredRecords.length === 0 ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (filteredRecords.length > 0) {
                e.target.style.background = "#218838";
              }
            }}
            onMouseLeave={(e) => {
              if (filteredRecords.length > 0) {
                e.target.style.background = "#28a745";
              }
            }}
          >
            <FaFileInvoice /> Laporan Keuntungan
          </button>
        </div>
        <div style={{ fontSize: "0.9rem", color: "#666" }}>
          {!startDate && !endDate ? (
            <span>Menampilkan <strong>7 record terakhir</strong></span>
          ) : (
            <span>Menampilkan record tanggal <strong>{startDate.toLocaleDateString("id-ID")} - {endDate.toLocaleDateString("id-ID")}</strong></span>
          )}
        </div>
      </div>

      <div className="warehouse-exit-records">
        {records.length === 0 ? (
          <div className="warehouse-exit-empty">
            <p>Tidak ada catatan keluar gudang ditemukan.</p>
            {canCreateRecord && (
              <button
                className="warehouse-exit-create-btn"
                onClick={() => setShowModal(true)}
              >
                <FaPlus /> Buat Catatan Pertama
              </button>
            )}
          </div>
        ) : (
          <>
            {currentRecords.map((record) => {
              const statusDisplay = getStatusDisplay(record);

              // Check if cost has been recorded
              const matchingTxs = stockTxList.filter(
                (tx) => tx.transactionDetailId === record.transactionDetailId
              );
              const hasRecordedCost = matchingTxs.some(tx => tx.cost !== undefined && tx.cost > 0);
              const hasItemCost = record.items?.some(item => item.hargaKulak !== undefined && item.hargaKulak > 0);
              const hasCost = hasRecordedCost || hasItemCost;

              const totalCost = calculateRecordCost(record);
              const profit = parseRupiah(record.total) - totalCost;

              return (
                <div key={record.id} className="warehouse-exit-record-tile">
                  <div className="record-header">
                    <div className="record-main-info">
                      <div className="record-title-row">
                        <h3 className="customer-name">
                          {formatIndonesianDate(record.createdAt)} -{" "}
                          {record.customerDetail.customerName}
                        </h3>
                      </div>
                      <div className="record-metadata">
                        <span className="record-id">ID: {record.id}</span>
                      </div>
                    </div>
                    <div className="record-right-side">
                      <span
                        className="status-tag"
                        style={{
                          backgroundColor: statusDisplay.bgColor,
                          color: statusDisplay.textColor,
                          border: `1px solid ${statusDisplay.color}`,
                        }}
                      >
                        {statusDisplay.icon}
                        {statusDisplay.text}
                      </span>
                      {hasCost ? (
                        <div className="record-financials" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                          {/* Total Kulakan */}
                          <div className="total-kulakan-badge" style={{
                            background: "#fff3cd",
                            color: "#856404",
                            fontWeight: "600",
                            fontSize: "0.85rem",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #ffeeba",
                          }} title="Total Harga Kulak (Cost)">
                            Kulak: Rp {formatRupiah(totalCost)}
                          </div>

                          {/* Invoiced Total */}
                          <div className="total-price-badge" style={{
                            background: "#007bff",
                            color: "white",
                            fontWeight: "700",
                            fontSize: "0.95rem",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "1px solid #007bff",
                          }} title="Invoiced Total">
                            Rp {formatRupiah(record.total.toString())}
                          </div>

                          {/* Profit / Untung */}
                          <div className="profit-badge" style={{
                            background: profit >= 0 ? "#d4edda" : "#f8d7da",
                            color: profit >= 0 ? "#155724" : "#721c24",
                            fontWeight: "600",
                            fontSize: "0.85rem",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: profit >= 0 ? "1px solid #c3e6cb" : "1px solid #f5c6cb",
                          }} title={profit >= 0 ? "Profit" : "Loss"}>
                            {profit >= 0 ? "Untung" : "Rugi"}: Rp {formatRupiah(Math.abs(profit).toString())}
                          </div>
                        </div>
                      ) : (
                        <div className="total-price-badge">
                          Rp {formatRupiah(record.total.toString())}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="action-row">
                    {/* Always show Nota Tagihan - always available */}
                    <button
                      className="action-btn completed"
                      onClick={() => generateQuotationPDF(record)}
                    >
                      <FaFileInvoice /> Nota Tagihan
                    </button>

                    {/* Always show PO button with different states */}
                    {uploadingFiles[`${record.id}_po`] ? (
                      <button className="action-btn loading" disabled>
                        <div className="loading-spinner"></div> Mengunggah PO...
                      </button>
                    ) : record.workflow.uploadPO?.completed ? (
                      <button
                        className="action-btn completed"
                        onClick={() => handleViewFile(record.workflow.uploadPO)}
                      >
                        <FaEye /> Lihat PO
                      </button>
                    ) : canUploadPO ? (
                      <label className="action-btn active">
                        <FaUpload /> Upload PO
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleFileUpload(
                                record.id,
                                "po",
                                e.target.files[0]
                              );
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <button className="action-btn disabled" disabled>
                        <FaUpload /> Upload PO
                      </button>
                    )}

                    {/* Always show Payment button with different states */}
                    {uploadingFiles[`${record.id}_payment`] ? (
                      <button className="action-btn loading" disabled>
                        <div className="loading-spinner"></div> Mengunggah
                        Bukti...
                      </button>
                    ) : record.workflow.uploadBuktiPembayaran?.completed ? (
                      <button
                        className="action-btn completed"
                        onClick={() =>
                          handleViewFile(record.workflow.uploadBuktiPembayaran)
                        }
                      >
                        <FaEye /> Lihat Bukti
                      </button>
                    ) : canUploadPayment &&
                      record.workflow.uploadPO?.completed ? (
                      <label className="action-btn active">
                        <FaReceipt /> Upload Bukti
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleFileUpload(
                                record.id,
                                "payment",
                                e.target.files[0]
                              );
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <button className="action-btn disabled" disabled>
                        <FaReceipt /> Upload Bukti
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="warehouse-exit-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  &laquo; Previous
                </button>

                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      // Show first page, last page, current page, and pages around current
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            className={`pagination-number ${pageNum === currentPage ? "active" : ""
                              }`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return (
                          <span key={pageNum} className="pagination-ellipsis">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }
                  )}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <WarehouseExitModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        products={products}
        currentUser={currentUser}
      />

      {/* Snackbar */}
      {snackbar.open && (
        <div className="warehouse-exit-snackbar">{snackbar.message}</div>
      )}
    </div>
  );
};

export default WarehouseExit;

/**
 * Custom Date Range Filter for Warehouse Exit page
 */
function DateRangeFilter({ startDate, endDate, onChange }) {
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  function applyDates() {
    if (!tempStart || !tempEnd) {
      alert("Pilih tanggal mulai dan selesai.");
      return;
    }
    if (tempStart > tempEnd) {
      alert("Tanggal mulai tidak boleh melebihi tanggal selesai.");
      return;
    }
    onChange(tempStart, tempEnd);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <div style={{ position: "relative" }}>
        <ReactDatePicker
          selected={tempStart}
          onChange={(date) => setTempStart(date)}
          selectsStart
          startDate={tempStart}
          endDate={tempEnd}
          dateFormat="dd/MM/yyyy"
          placeholderText="Tanggal Mulai"
          className="warehouse-exit-input"
          customInput={
            <input style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.9rem",
              width: "140px",
              background: "white",
            }} readOnly />
          }
        />
      </div>
      <span style={{ color: "#6b7280" }}>s/d</span>
      <div style={{ position: "relative" }}>
        <ReactDatePicker
          selected={tempEnd}
          onChange={(date) => setTempEnd(date)}
          selectsEnd
          startDate={tempStart}
          endDate={tempEnd}
          minDate={tempStart}
          dateFormat="dd/MM/yyyy"
          placeholderText="Tanggal Selesai"
          className="warehouse-exit-input"
          customInput={
            <input style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.9rem",
              width: "140px",
              background: "white",
            }} readOnly />
          }
        />
      </div>
      <button
        onClick={applyDates}
        style={{
          padding: "8px 16px",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: "500",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => e.target.style.background = "#0056b3"}
        onMouseLeave={(e) => e.target.style.background = "#007bff"}
      >
        Filter
      </button>
    </div>
  );
}
