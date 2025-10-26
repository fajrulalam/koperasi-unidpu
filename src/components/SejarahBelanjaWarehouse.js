import React, { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { FaTimes } from "react-icons/fa";
import "../styles/SejarahBelanja.css";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";

const UNIT_CONVERSION = {
  ton: 1000,
  kwintal: 100, // Added kwintal conversion
  ons: 0.1,
  gram: 0.001,
};

function convertToKg(qty, unit) {
  const conversionRate = UNIT_CONVERSION[unit] || 1;
  return qty * conversionRate;
}

function getDisplayQty(tx) {
  // Handle box conversion first
  if (tx.originalUnit === "box" && tx.piecesPerBox) {
    return `${tx.originalQuantity} box (${tx.quantity} pcs)`;
  }

  // Convert weight units to kg
  if (UNIT_CONVERSION[tx.unit]) {
    const q = convertToKg(tx.quantity, tx.unit);
    return `${q} kg`;
  }

  // For pcs and other non-weight units
  return `${tx.originalQuantity} ${tx.originalUnit || tx.unit || ""}`;
}

function formatCurrency(value) {
  if (!value) return "Rp 0";
  const numeric = Math.round(Number(value)) || 0;
  return "Rp " + numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Format Firestore Timestamp in DD/MM/YYYY
 */
function formatDateDDMMYYYY(ts) {
  if (!ts) return "";
  const dateObj = ts.toDate(); // Convert Firestore Timestamp to JS Date
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format date in Indonesian format: EEEE, DD MM YYYY
 */
function formatDateIndonesian(date) {
  if (!date) return "";

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

export default function SejarahBelanja() {
  const { queryCollection, query, where, orderBy } = useFirestore();
  const { isProduction, environment } = useEnvironment();
  const [transactions, setTransactions] = useState([]);
  const [displayed, setDisplayed] = useState([]);

  // View mode: "table" or "daily"
  const [viewMode, setViewMode] = useState("daily");
  const [dailyData, setDailyData] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  // For date range
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // For item searching (autocomplete from 'stocks')
  const [stockList, setStockList] = useState([]); // entire 'stocks' data
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [chips, setChips] = useState([]);
  const [useScanner, setUseScanner] = useState(false);

  // =========== On Mount, load "bulan ini" + fetch 'stocks' for autocomplete ===========

  useEffect(() => {
    // 1) Load "stocks_b2b" collection for suggestions
    fetchStockItems();

    // 2) Load "bulan ini" from "stockTransactions_b2b"
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    setStartDate(start);
    setEndDate(end);
    fetchTransactions(start, end);
  }, [isProduction]); // Re-fetch when environment changes

  async function fetchStockItems() {
    try {
      // Get the actual collection path that will be used
      const actualPath = isProduction ? "stocks_b2b" : "stocks_testing";
      console.log(`Querying from collection: ${actualPath}`);

      const stockData = await queryCollection("stocks_b2b");
      const arr = stockData.map((data) => ({
        itemName: data.name,
        itemId: data.itemId || data.id,
      }));

      console.log(
        `Fetched ${stockData.length} stock items from ${environment} environment (${actualPath})`
      );
      setStockList(arr);
    } catch (err) {
      console.error("Error fetching stock items:", err);
    }
  }

  async function fetchTransactions(sd, ed) {
    if (!sd || !ed) return;
    try {
      // Get the actual collection path that will be used
      const actualPath = isProduction
        ? "stockTransactions_b2b"
        : "stockTransactions_b2b_testing";
      console.log(`Querying from collection: ${actualPath}`);

      // Use the queryCollection function with a query function parameter
      const transactionData = await queryCollection(
        "stockTransactions_b2b",
        (collectionRef) =>
          query(
            collectionRef,
            where("transactionType", "in", ["pengadaan", "pengurangan"]),
            where("timestampInMillisEpoch", ">=", sd),
            where("timestampInMillisEpoch", "<=", ed),
            orderBy("timestampInMillisEpoch", "desc")
          )
      );

      console.log(
        `Fetched ${transactionData.length} records from ${environment} environment (${actualPath})`
      );
      setTransactions(transactionData);
      setDisplayed(transactionData);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }

  // =========== Date Range Logic ===========

  function handleDateChange(s, e) {
    if (!s || !e) return;
    setStartDate(s);
    setEndDate(e);
    fetchTransactions(s, e); // re-query Firestore
  }

  // =========== Searching by item(s) with chips + scanning ===========

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    // We'll search among "stockList" (which is from 'stocks' collection)
    if (useScanner) {
      // exact match on itemId
      const exact = stockList.filter(
        (st) => st.itemId && st.itemId.toString() === searchTerm.trim()
      );
      setSuggestions(exact);
    } else {
      // partial match on itemName
      const lower = searchTerm.toLowerCase();
      const words = lower.split(/\s+/);
      const partial = stockList.filter((st) => {
        if (!st.itemName) return false;
        const nm = st.itemName.toLowerCase();
        return words.every((w) => nm.includes(w));
      });
      setSuggestions(partial);
    }
  }, [searchTerm, useScanner, stockList]);

  function addChip(item) {
    // item => { itemName, itemId }
    if (!item.itemId) return;
    if (!chips.includes(item.itemId)) {
      setChips([...chips, item.itemId]);
    }
    setSearchTerm("");
    setSuggestions([]);
  }

  function removeChip(c) {
    setChips(chips.filter((x) => x !== c));
  }

  // After user picks item(s), we filter the displayed "transactions" in-memory
  useEffect(() => {
    if (chips.length === 0) {
      setDisplayed(transactions);
    } else {
      const filtered = transactions.filter((tx) => {
        // Only keep if itemId is in chips
        return chips.includes(tx.itemId);
      });
      setDisplayed(filtered);
    }
  }, [chips, transactions]);

  // Group transactions by day for daily view
  useEffect(() => {
    if (displayed.length === 0) {
      setDailyData([]);
      return;
    }

    const grouped = {};
    displayed.forEach((tx) => {
      if (!tx.timestampInMillisEpoch) return;

      const date = tx.timestampInMillisEpoch.toDate();
      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: date,
          dateKey: dateKey,
          formattedDate: formatDateIndonesian(date),
          transactions: [],
          totalCost: 0,
        };
      }

      grouped[dateKey].transactions.push(tx);
      grouped[dateKey].totalCost += tx.cost || 0;
    });

    // Convert to array, round totalCost, and sort by date (newest first)
    const dailyArray = Object.values(grouped)
      .map((day) => ({
        ...day,
        totalCost: Math.round(day.totalCost),
      }))
      .sort((a, b) => b.date - a.date);
    setDailyData(dailyArray);
  }, [displayed]);

  // =========== Modal Dialog Functions ===========

  function openDayModal(dayData) {
    setSelectedDay(dayData);
    setDayModalOpen(true);
  }

  function closeDayModal() {
    setSelectedDay(null);
    setDayModalOpen(false);
  }

  // =========== Export to Excel ===========

  function exportToExcel() {
    const dataToExport = displayed.map((tx) => ({
      Nama: tx.itemName || "",
      Kategori: tx.kategori || "",
      SubKategori: tx.subKategori || "",
      Jenis: tx.transactionType,
      Qty: getDisplayQty(tx),
      Cost: tx.cost || 0,
      Via: tx.transactionVia || "",
      Tanggal: tx.timestampInMillisEpoch
        ? formatDateDDMMYYYY(tx.timestampInMillisEpoch)
        : "",
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SejarahBelanja");
    XLSX.writeFile(wb, "SejarahBelanja.xlsx");
  }

  // =========== Render ===========

  return (
    <div className="sejarah-belanja-container">
      <h1>Riwayat Kulakan Warehouse</h1>

      {/* View Mode Chips */}
      <div className="view-mode-chips" style={{ marginBottom: "20px" }}>
        <button
          className={`chip ${viewMode === "table" ? "active" : ""}`}
          onClick={() => setViewMode("table")}
          style={{
            padding: "8px 16px",
            margin: "0 8px 0 0",
            border: "1px solid #ddd",
            borderRadius: "20px",
            backgroundColor: viewMode === "table" ? "#007bff" : "#fff",
            color: viewMode === "table" ? "#fff" : "#333",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Table View
        </button>
        <button
          className={`chip ${viewMode === "daily" ? "active" : ""}`}
          onClick={() => setViewMode("daily")}
          style={{
            padding: "8px 16px",
            margin: "0 8px 0 0",
            border: "1px solid #ddd",
            borderRadius: "20px",
            backgroundColor: viewMode === "daily" ? "#007bff" : "#fff",
            color: viewMode === "daily" ? "#fff" : "#333",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Daily View
        </button>
      </div>

      <div className="filters-row">
        <div className="search-options">
          <label>
            <input
              type="checkbox"
              checked={useScanner}
              onChange={(e) => setUseScanner(e.target.checked)}
            />
            Barcode Scanner
          </label>
        </div>

        <div className="chips-search">
          {/* Chips */}
          <div className="chips-row">
            {chips.map((c) => (
              <div key={c} className="chip">
                <span>{c}</span>
                <FaTimes className="chip-close" onClick={() => removeChip(c)} />
              </div>
            ))}
            {/* Input */}
            <input
              type="text"
              placeholder="Cari item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="suggestion-dropdown">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onClick={() => addChip(s)}
                >
                  {s.itemName}
                </div>
              ))}
            </div>
          )}
        </div>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
        />

        <button className="export-button" onClick={exportToExcel}>
          Export ke Excel
        </button>
      </div>

      {/* Conditional rendering based on view mode */}
      {viewMode === "table" ? (
        <table className="sejarah-belanja-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kategori</th>
              <th>SubKategori</th>
              <th>Jenis</th>
              <th>Qty</th>
              <th>Cost</th>
              <th>Via</th>
              <th>Tanggal</th> {/* Moved to last column */}
            </tr>
          </thead>
          <tbody>
            {displayed.map((tx, idx) => {
              return (
                <tr key={idx}>
                  <td>{tx.itemName}</td>
                  <td>{tx.kategori}</td>
                  <td>{tx.subKategori}</td>
                  <td>{tx.transactionType}</td>
                  <td>{getDisplayQty(tx)}</td>
                  <td>{formatCurrency(tx.cost)}</td>
                  <td>{tx.transactionVia}</td>
                  <td>
                    {tx.timestampInMillisEpoch
                      ? formatDateDDMMYYYY(tx.timestampInMillisEpoch)
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        /* Daily View */
        <div className="daily-view-container">
          {dailyData.length === 0 ? (
            <p>No data available for the selected period.</p>
          ) : (
            <div
              className="daily-tiles-rows"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              {dailyData.map((dayData, idx) => (
                <div
                  key={dayData.dateKey}
                  className="daily-tile"
                  onClick={() => openDayModal(dayData)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "16px 24px",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0,0,0,0.15)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 2px 4px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    className="daily-tile-date"
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    {dayData.formattedDate}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "24px",
                    }}
                  >
                    <div
                      className="daily-tile-count"
                      style={{
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      {dayData.transactions.length} transaksi
                    </div>
                    <div
                      className="daily-tile-total"
                      style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        color: "#007bff",
                      }}
                    >
                      {formatCurrency(dayData.totalCost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog for Daily Breakdown */}
      {dayModalOpen && selectedDay && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeDayModal}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "800px",
              maxHeight: "80vh",
              overflow: "auto",
              margin: "20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "1px solid #eee",
                paddingBottom: "16px",
              }}
            >
              <h2 style={{ margin: 0, color: "#333" }}>
                {selectedDay.formattedDate}
              </h2>
              <button
                onClick={closeDayModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div
              className="modal-summary"
              style={{
                marginBottom: "20px",
                padding: "16px",
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              <div
                style={{ fontSize: "18px", fontWeight: "600", color: "#333" }}
              >
                Total: {formatCurrency(selectedDay.totalCost)}
              </div>
              <div
                style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}
              >
                {selectedDay.transactions.length} transaksi
              </div>
            </div>

            <div className="modal-breakdown">
              <h3 style={{ marginBottom: "16px", color: "#333" }}>
                Detail Transaksi
              </h3>
              <div className="breakdown-table" style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8f9fa" }}>
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Item
                      </th>
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Kategori
                      </th>
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "center",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Qty
                      </th>
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "right",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Cost
                      </th>
                      <th
                        style={{
                          padding: "12px 8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Via
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDay.transactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "12px 8px" }}>
                          {tx.itemName || "N/A"}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          {tx.kategori || "N/A"}
                        </td>
                        <td
                          style={{ padding: "12px 8px", textAlign: "center" }}
                        >
                          {getDisplayQty(tx)}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right" }}>
                          {formatCurrency(tx.cost)}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          {tx.transactionVia || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Real date range with "DD/MM/YYYY" using react-datepicker
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
      alert("Please pick valid dates");
      return;
    }
    if (tempStart > tempEnd) {
      alert("Start date cannot exceed end date");
      return;
    }
    onChange(tempStart, tempEnd);
  }

  return (
    <div className="date-range-filter">
      <ReactDatePicker
        selected={tempStart}
        onChange={(date) => setTempStart(date)}
        selectsStart
        startDate={tempStart}
        endDate={tempEnd}
        dateFormat="dd/MM/yyyy"
        placeholderText="Start"
      />
      <ReactDatePicker
        selected={tempEnd}
        onChange={(date) => setTempEnd(date)}
        selectsEnd
        startDate={tempStart}
        endDate={tempEnd}
        minDate={tempStart}
        dateFormat="dd/MM/yyyy"
        placeholderText="End"
      />
      <button onClick={applyDates} style={{ marginLeft: 8 }}>
        Filter
      </button>
    </div>
  );
}
