import React, { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { FaTimes } from "react-icons/fa";
import "../styles/SejarahBelanja.css";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";
import {
  getDisplayQty,
  formatCurrency,
  formatDateDDMMYYYY,
  getThisMonthDateRange,
  searchStockItems,
} from "../services/transactionHistoryService";

export default function SejarahBelanja() {
  const { queryCollection, query, where, orderBy } = useFirestore();
  const { isProduction, environment } = useEnvironment();
  const [transactions, setTransactions] = useState([]);
  const [displayed, setDisplayed] = useState([]);

  // For date range
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // For item searching (autocomplete from 'stocks')
  const [stockList, setStockList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [chips, setChips] = useState([]);
  const [useScanner, setUseScanner] = useState(false);

  // On Mount, load "bulan ini" + fetch 'stocks' for autocomplete
  useEffect(() => {
    fetchStockItems();

    const { start, end } = getThisMonthDateRange();
    setStartDate(start);
    setEndDate(end);
    fetchTransactions(start, end);
  }, [isProduction]);

  async function fetchStockItems() {
    try {
      const actualPath = isProduction ? "stocks" : "stocks_testing";
      console.log(`Querying from collection: ${actualPath}`);

      const stockData = await queryCollection("stocks");
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
      const actualPath = isProduction
        ? "stockTransactions"
        : "stockTransactions_testing";
      console.log(`Querying from collection: ${actualPath}`);

      const transactionData = await queryCollection(
        "stockTransactions",
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

  // Date Range Logic
  function handleDateChange(s, e) {
    if (!s || !e) return;
    setStartDate(s);
    setEndDate(e);
    fetchTransactions(s, e);
  }

  // Searching by item(s) with chips + scanning
  useEffect(() => {
    const results = searchStockItems(stockList, searchTerm, useScanner);
    setSuggestions(results);
  }, [searchTerm, useScanner, stockList]);

  function addChip(item) {
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

  // Filter displayed transactions by selected chips
  useEffect(() => {
    if (chips.length === 0) {
      setDisplayed(transactions);
    } else {
      const filtered = transactions.filter((tx) => chips.includes(tx.itemId));
      setDisplayed(filtered);
    }
  }, [chips, transactions]);

  // Export to Excel
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

  return (
    <div className="sejarah-belanja-container">
      <h1>Sejarah Belanja</h1>

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
          <div className="chips-row">
            {chips.map((c) => (
              <div key={c} className="chip">
                <span>{c}</span>
                <FaTimes className="chip-close" onClick={() => removeChip(c)} />
              </div>
            ))}
            <input
              type="text"
              placeholder="Cari item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((tx, idx) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Date range filter component
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
