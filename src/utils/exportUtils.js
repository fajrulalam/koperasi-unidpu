// src/utils/exportUtils.js
import * as XLSX from "xlsx";

/**
 * Export loan data to Excel file
 * @param {Array} loans - Array of loan objects to export
 * @param {Function} formatDate - Function to format date objects
 * @param {Function} calculateEndDate - Function to calculate end date based on approval date and tenor
 */
/**
 * Export member data to Excel file
 * @param {Array} members - Array of member objects to export
 * @param {Function} formatDate - Function to format date objects
 * @param {Function} formatCurrency - Function to format currency values
 */
export const exportMembersToExcel = (members, formatDate, formatCurrency) => {
  if (!members || members.length === 0) {
    alert("Tidak ada data anggota untuk diekspor");
    return;
  }

  try {
    // Transform member data to the format needed for Excel
    const excelData = members.map((member) => {
      return {
        "No. Anggota": member.nomorAnggota || (member.id ? member.id.split("_").pop() : "-"),
        "Nama Lengkap": member.namaLengkap || "-",
        "NIK": member.nik || "-",
        "Email": member.email || "-",
        "No. Telp": member.noTelp || "-",
        "Satuan Kerja": member.satuanKerja || "-",
        "Nominal Tabungan": member.nominalTabungan || 0,
        "Status Pembayaran": member.paymentStatus || "-",
        "Status Keanggotaan": member.membershipStatus || "-",
        "Tanggal Bergabung": member.joinDate ? formatDate(member.joinDate) : "-",
        "Alamat": member.alamat || "-",
        "Bank": member.bankDetails?.bank || "-",
        "Nomor Rekening": member.bankDetails?.nomorRekening || "-",
        "Catatan": member.notes || "-"
      };
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // No. Anggota
      { wch: 25 }, // Nama Lengkap
      { wch: 20 }, // NIK
      { wch: 25 }, // Email
      { wch: 15 }, // No. Telp
      { wch: 20 }, // Satuan Kerja
      { wch: 15 }, // Nominal Tabungan
      { wch: 20 }, // Status Pembayaran
      { wch: 20 }, // Status Keanggotaan
      { wch: 20 }, // Tanggal Bergabung
      { wch: 30 }, // Alamat
      { wch: 15 }, // Bank
      { wch: 25 }, // Nomor Rekening
      { wch: 30 }  // Catatan
    ];
    worksheet["!cols"] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Anggota");

    // Generate file name with current date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const fileName = `Data_Anggota_${dateStr}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);

    return true;
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Gagal mengekspor data: " + error.message);
    return false;
  }
};

export const exportLoansToExcel = (loans, formatDate, calculateEndDate) => {
  if (!loans || loans.length === 0) {
    alert("Tidak ada data pinjaman untuk diekspor");
    return;
  }

  try {
    // Transform loan data to the format needed for Excel
    const excelData = loans.map((loan) => {
      // Get the last history note if available
      const lastHistoryNote =
        loan.history && loan.history.length > 0
          ? loan.history[loan.history.length - 1].notes
          : "";

      // Get user data
      const userData = loan.userData || {};

      // Format dates
      const tanggalPengajuan = loan.tanggalPengajuan
        ? formatDate(loan.tanggalPengajuan)
        : "-";

      // Calculate end date based on approval date and tenor
      let tanggalPelunasan = "-";
      if (loan.tanggalPelunasan) {
        // If we already have a completion date recorded, use that
        tanggalPelunasan = formatDate(loan.tanggalPelunasan);
      } else if (loan.tanggalDisetujui && loan.tenor) {
        // Use the formatted end date string directly instead of calling calculateEndDate
        // This avoids the timestamp.toDate() error
        try {
          // Safely get a JavaScript Date from the approval date
          let approvalDate;
          if (
            loan.tanggalDisetujui.toDate &&
            typeof loan.tanggalDisetujui.toDate === "function"
          ) {
            // Firebase Timestamp
            approvalDate = loan.tanggalDisetujui.toDate();
          } else if (loan.tanggalDisetujui.seconds) {
            // Firebase Timestamp-like object
            approvalDate = new Date(loan.tanggalDisetujui.seconds * 1000);
          } else if (loan.tanggalDisetujui instanceof Date) {
            // JavaScript Date
            approvalDate = loan.tanggalDisetujui;
          } else if (typeof loan.tanggalDisetujui === "string") {
            // ISO string or other date string
            approvalDate = new Date(loan.tanggalDisetujui);
          } else {
            // Fallback
            approvalDate = null;
          }

          if (approvalDate) {
            // Add tenor months to the start date
            const endDate = new Date(approvalDate);
            endDate.setMonth(endDate.getMonth() + loan.tenor);
            tanggalPelunasan = formatDate(endDate);
          }
        } catch (error) {
          console.error("Error calculating end date:", error);
        }
      }

      // Calculate amount paid so far
      const jumlahMenyicil = loan.jumlahMenyicil || 0;
      const tenor = loan.tenor || 1; // Avoid division by zero
      const jumlahPinjaman = loan.jumlahPinjaman || 0;
      const terbayar = (jumlahPinjaman / tenor) * jumlahMenyicil;

      return {
        ID: loan.id || "",
        Nama: userData.namaLengkap || "",
        NIK: userData.nik || "",
        Email: userData.email || loan.userEmail || "",
        "Jumlah Pinjaman": jumlahPinjaman,
        Tenor: tenor,
        Pembayaran: jumlahMenyicil, // Just the payment count
        Terbayar: terbayar, // New column for amount paid
        "Tanggal Pengajuan": tanggalPengajuan,
        "Tanggal Pelunasan": tanggalPelunasan,
        Status: loan.status || "",
        "Tujuan Pinjaman": loan.tujuanPinjaman || "",
        "Bukti Transfer": loan.buktiTransfer || "",
        "Catatan Terakhir": lastHistoryNote,
      };
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 20 }, // ID
      { wch: 25 }, // Nama
      { wch: 20 }, // NIK
      { wch: 30 }, // Email
      { wch: 15 }, // Jumlah Pinjaman
      { wch: 8 }, // Tenor
      { wch: 12 }, // Pembayaran
      { wch: 15 }, // Terbayar
      { wch: 20 }, // Tanggal Pengajuan
      { wch: 20 }, // Tanggal Pelunasan
      { wch: 25 }, // Status
      { wch: 30 }, // Tujuan Pinjaman
      { wch: 40 }, // Bukti Transfer
      { wch: 40 }, // Catatan Terakhir
    ];
    worksheet["!cols"] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Pinjaman");

    // Generate file name with current date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const fileName = `Data_Pinjaman_${dateStr}.xlsx`;

    // Export to file
    XLSX.writeFile(workbook, fileName);

    return true;
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Gagal mengekspor data: " + error.message);
    return false;
  }
};
