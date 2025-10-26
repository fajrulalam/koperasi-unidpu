import { useState } from "react";
// Using xlsx-js-style which supports proper styling including bold text
import XLSX from "xlsx-js-style";

export const useLoanHistoryExtract = () => {
  const [extracting, setExtracting] = useState(false);

  // Calculate bunga based on the loan amount using brackets
  const calculateBunga = (jumlahPinjaman) => {
    // Calculate which bracket the loan amount falls into
    // Each bracket is 2,000,000 and bunga increases by 100,000 per bracket
    const bracket = Math.ceil(jumlahPinjaman / 2000000);
    return bracket * 100000;
  };

  // Calculate pokok (principal) based on loan amount and bunga
  const calculatePokok = (jumlahPinjaman) => {
    const bunga = calculateBunga(jumlahPinjaman);
    return jumlahPinjaman - bunga;
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID").format(amount);
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    // Get month name in Indonesian
    const monthNames = [
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

    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    // Format: dd-MMMM-yyyy
    return `${day.toString().padStart(2, "0")}-${
      monthNames[monthIndex]
    }-${year}`;
  };

  // Extract loan history data in the format required for the table
  const extractLoanHistory = (loan) => {
    setExtracting(true);

    try {
      if (!loan || !loan.history) {
        throw new Error("Loan data is incomplete");
      }

      // Find the index where the loan became active
      const activeIndex = loan.history.findIndex(
        (entry) => entry.status === "Disetujui dan Aktif"
      );

      if (activeIndex === -1) {
        throw new Error("Loan has not been activated yet");
      }

      const jumlahPinjaman = loan.jumlahPinjaman;
      const tenor = loan.tenor;
      const bunga = calculateBunga(jumlahPinjaman);
      const pokok = calculatePokok(jumlahPinjaman);

      // Create the initial row (when loan was activated)
      const activeDate = loan.history[activeIndex].timestamp;

      const historyData = [
        {
          tanggal: activeDate,
          pokok: jumlahPinjaman - bunga, // Pokok is loan amount minus bunga
          bayar: 0,
          sisa: jumlahPinjaman, // Sisa is the full loan amount
          bunga: bunga,
          jumlah: jumlahPinjaman, // Jumlah is the full loan amount
        },
      ];

      // Find payment entries in history (after the loan was activated)
      const paymentEntries = loan.history
        .filter(
          (entry, index) =>
            index > activeIndex && entry.status === "Pembayaran Cicilan"
        )
        .sort((a, b) => {
          const dateA = a.timestamp.toDate
            ? a.timestamp.toDate()
            : new Date(a.timestamp);
          const dateB = b.timestamp.toDate
            ? b.timestamp.toDate()
            : new Date(b.timestamp);
          return dateA - dateB;
        });

      // Calculate payment amount per installment (equal payments)
      const installmentAmount = Math.round(jumlahPinjaman / tenor);

      // Add payment rows
      let remainingAmount = jumlahPinjaman;

      paymentEntries.forEach((entry) => {
        const payment = installmentAmount;
        remainingAmount -= payment;

        historyData.push({
          tanggal: entry.timestamp,
          pokok: 0,
          bayar: payment,
          sisa: remainingAmount > 0 ? remainingAmount : 0,
          bunga: 0,
          jumlah: remainingAmount > 0 ? remainingAmount : 0,
        });
      });

      return historyData;
    } catch (error) {
      console.error("Error extracting loan history:", error);
      throw error;
    } finally {
      setExtracting(false);
    }
  };

  // Generate Excel workbook from the history data
  const generateExcel = (historyData, loan) => {
    // Create a new workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([]);

    // Add member and loan details at the top
    // Row 1-4: Member and loan information with separated keys and values
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          "Nomor Anggota",
          loan.userData.nomorAnggota || "",
          "",
          "",
          "Pinjaman Nomor",
          loan.id || "",
          "",
        ],
        [
          "N a m a",
          loan.userData.namaLengkap || "",
          "",
          "",
          "Pekerjaan",
          `${loan.userData.kantor} (${loan.userData.satuanKerja})`,
          "",
        ],
        [
          "Alamat",
          `${loan.userData.email} / ${loan.userData.nomorWhatsapp}`,
          "",
          "",
          "Perjanjian",
          `Peminjaman Rp${formatCurrency(loan.jumlahPinjaman)} dengan tenor ${loan.tenor} bulan`,
          "",
        ],
        [
          "Alasan Meminjam",
          loan.tujuanPinjaman || "",
          "",
          "",
          "Harus Lunas Tanggal",
          formatDate(
            loan.jatuhTempo ||
              new Date(Date.now() + loan.tenor * 30 * 24 * 60 * 60 * 1000)
          ),
          "",
        ],
        [""], // Empty row as spacing
      ],
      { origin: "A1" }
    );

    // Set column widths
    const columnWidths = [
      { wch: 18 }, // A - TANGGAL
      { wch: 5 }, // B - +/-
      { wch: 15 }, // C - POKOK
      { wch: 15 }, // D - BAYAR
      { wch: 15 }, // E - SISA
      { wch: 15 }, // F - BUNGA
      { wch: 15 }, // G - JUMLAH
    ];
    worksheet["!cols"] = columnWidths;

    // Create header structure - starting from row 6 (after member details)
    // Row 6: Headers
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [["TANGGAL", "+", "UANG PINJAMAN", "", "", "BUNGA", "JUMLAH"]],
      { origin: "A6" }
    );

    // Row 7: Sub-headers
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [["", "-", "POKOK", "BAYAR", "SISA", "", ""]],
      { origin: "A7" }
    );

    // Row 8: Column numbers
    XLSX.utils.sheet_add_aoa(worksheet, [["1", "2", "3", "4", "5", "6", "7"]], {
      origin: "A8",
    });

    // Add data rows
    let rowIndex = 9; // Start after headers and member details (row 9)

    historyData.forEach((item, index) => {
      const rowData = [
        formatDate(item.tanggal),
        index === 0 ? "+" : "-",
        item.pokok > 0 ? item.pokok : "",
        item.bayar > 0 ? item.bayar : "",
        item.sisa,
        item.bunga > 0 ? item.bunga : "",
        item.jumlah,
      ];

      XLSX.utils.sheet_add_aoa(worksheet, [rowData], {
        origin: `A${rowIndex}`,
      });
      rowIndex++;
    });

    // Format member details at the top
    // Add borders and styling to the member details section
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
        if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };
        if (!worksheet[cellRef].s) worksheet[cellRef].s = {};

        if (r < 4) {
          // Only add borders to the detail rows, not the spacing row
          worksheet[cellRef].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };

          // Add bold to header cells (column A and E)
          if (c === 0 || c === 4) {
            worksheet[cellRef].s.font = { bold: true };
          }
        }
      }
    }

    // Define merged cells for member information and table headers
    const merges = [
      // Merge B-D for values in member information section
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },

      // Merge F-G for values in member information section
      { s: { r: 0, c: 5 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 5 }, e: { r: 3, c: 6 } },

      // UANG PINJAMAN header (spans 3 columns)
      { s: { r: 5, c: 2 }, e: { r: 5, c: 4 } },

      // TANGGAL header (spans 2 rows)
      { s: { r: 5, c: 0 }, e: { r: 6, c: 0 } },

      // BUNGA header (spans 2 rows)
      { s: { r: 5, c: 5 }, e: { r: 6, c: 5 } },

      // JUMLAH header (spans 2 rows)
      { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },
    ];

    worksheet["!merges"] = merges;

    // Format header cells (bold and centered)
    for (let c = 0; c <= 6; c++) {
      // Header row 1 (row 6 in the sheet)
      const cellRef1 = XLSX.utils.encode_cell({ r: 5, c: c });
      if (worksheet[cellRef1]) {
        worksheet[cellRef1].s = {
          font: { bold: true, sz: 12 },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Header row 2 (row 7 in the sheet)
      const cellRef2 = XLSX.utils.encode_cell({ r: 6, c: c });
      if (worksheet[cellRef2]) {
        worksheet[cellRef2].s = {
          font: { bold: true, sz: 12 },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Column numbers row (row 8 in the sheet)
      const cellRef3 = XLSX.utils.encode_cell({ r: 7, c: c });
      if (worksheet[cellRef3]) {
        worksheet[cellRef3].s = {
          font: { bold: true, italic: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }
    }

    // Format data cells - add borders and number formatting
    for (let r = 8; r < rowIndex; r++) {
      for (let c = 0; c <= 6; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
        if (!worksheet[cellRef]) continue;

        // Add borders to all cells
        if (!worksheet[cellRef].s) worksheet[cellRef].s = {};
        worksheet[cellRef].s.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };

        // Format numbers (columns C-G)
        if (
          c >= 2 &&
          c <= 6 &&
          worksheet[cellRef].v &&
          typeof worksheet[cellRef].v === "number"
        ) {
          worksheet[cellRef].z = "#,##0";
          worksheet[cellRef].s.alignment = { horizontal: "right" };
        }
      }
    }

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Pinjaman");

    return workbook;
  };

  // Download the Excel file
  const downloadCSV = (loan) => {
    try {
      const historyData = extractLoanHistory(loan);
      const workbook = generateExcel(historyData, loan);

      // Generate file name
      const fileName = `pinjaman_${loan.userData?.namaLengkap || "anggota"}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Error downloading Excel file:", error);
      alert("Gagal mengunduh riwayat pinjaman. Silakan coba lagi.");
    }
  };

  return {
    extracting,
    extractLoanHistory,
    downloadCSV,
  };
};
