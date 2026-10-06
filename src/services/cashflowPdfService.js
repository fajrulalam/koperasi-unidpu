import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ACCOUNTS,
  ACCOUNT_LABELS,
  fmtAmount,
  formatDayLabel,
} from "../utils/cashflowUtils";

// Landscape statement styled like the on-screen ledger: charcoal headers,
// semantic amount colors, lighter running balances and a bold closing row.
// Always exports every account regardless of the active filter.
export const generateCashflowPdf = (rows, monthLabel) => {
  const pdf = new jsPDF({ orientation: "landscape" });

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Laporan Arus Kas Unimart", 14, 16);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text(monthLabel, 14, 23);
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Dibuat ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`,
    14,
    29
  );
  pdf.setTextColor(0, 0, 0);

  const head = [
    [
      { content: "Tanggal", rowSpan: 2 },
      { content: "Keterangan", rowSpan: 2 },
      ...ACCOUNTS.map((account) => ({
        content: ACCOUNT_LABELS[account],
        colSpan: 2,
      })),
    ],
    ACCOUNTS.flatMap(() => ["Jumlah", "Saldo"]),
  ];

  const formatChange = (value) => {
    if (value === 0) return "";
    return `${value > 0 ? "+" : ""}${fmtAmount(value)}`;
  };

  const body = rows.map((row, index) => {
    const isTotalRow = row.rowType === "opening" || row.rowType === "closing";
    const showDate = row.rawDate && row.rawDate !== rows[index - 1]?.rawDate;
    return [
      showDate ? formatDayLabel(row.rawDate) : "",
      row.description,
      ...ACCOUNTS.flatMap((account) => [
        isTotalRow ? "" : formatChange(row.amounts[account]),
        fmtAmount(row.balances[account]),
      ]),
    ];
  });

  autoTable(pdf, {
    head,
    body,
    startY: 34,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: [30, 30, 30],
      lineColor: [209, 213, 219],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [209, 213, 219],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      lineColor: [55, 65, 81],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 56 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row) return;

      if (row.rowType === "opening") {
        data.cell.styles.fillColor = [248, 250, 252];
        data.cell.styles.fontStyle = "bold";
      } else if (row.rowType === "adjustment") {
        data.cell.styles.fillColor = [239, 246, 255];
      } else if (row.rowType === "closing") {
        data.cell.styles.fillColor = [203, 213, 225];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.lineWidth = 0.5;
        data.cell.styles.lineColor = [100, 116, 139];
        data.cell.styles.fontSize = 9;
      }

      if (data.column.index < 2) return;
      const account = ACCOUNTS[Math.floor((data.column.index - 2) / 2)];
      const isAmountColumn = data.column.index % 2 === 0;

      if (isAmountColumn) {
        const value = row.amounts[account];
        data.cell.styles.textColor =
          value < 0 ? [239, 68, 68] : value > 0 ? [16, 185, 129] : [148, 163, 184];
        // Thick left border between account groups.
        data.cell.styles.lineWidth = { top: 0.3, bottom: 0.3, left: 1, right: 0.3 };
      } else {
        const balance = row.balances[account];
        if (row.rowType === "closing") {
          data.cell.styles.textColor = balance < 0 ? [239, 68, 68] : [30, 30, 30];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor =
            balance < 0 ? [248, 113, 113] : [148, 163, 184];
          data.cell.styles.fontSize = 7;
        }
      }
    },
  });

  const safeName = monthLabel.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  pdf.save(`arus-kas-${safeName}.pdf`);
};
