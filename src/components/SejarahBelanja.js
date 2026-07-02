import React, { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import {
  FaTimes,
  FaChevronDown,
  FaChevronUp,
  FaExternalLinkAlt,
} from "react-icons/fa";
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

  // View mode: "table" (item details) or "transaction" (grouped per invoice)
  const [viewMode, setViewMode] = useState("table");
  const [notaList, setNotaList] = useState([]);
  const [displayedNotas, setDisplayedNotas] = useState([]);
  const [expandedNotas, setExpandedNotas] = useState({});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProduction]);

  async function fetchStockItems() {
    try {
      const actualPath = isProduction ? "stocks" : "stocks_testing";
      console.log(`Querying from collection: ${actualPath}`);

      const stockData = await queryCollection("stocks");
      const arr = stockData.map((data) => ({
        itemName: data.name,
        itemId: data.itemId || data.id,
        kategori: data.kategori || "",
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

      // Fetch corresponding notaBelanja records
      let notas = [];
      try {
        const allNotas = await queryCollection("notaBelanja");
        notas = allNotas
          .filter((nota) => {
            if (!nota.createdAt) return false;
            const date = nota.createdAt.toDate ? nota.createdAt.toDate() : new Date(nota.createdAt);
            return date >= sd && date <= ed;
          })
          .sort((a, b) => {
            const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB - dateA;
          });
      } catch (err) {
        console.error("Error fetching notas:", err);
      }
      setNotaList(notas);
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

  // Construct and filter display transactions per invoice (merging actual notaBelanja and reconstructed manual stockAdditions)
  useEffect(() => {
    const transactionsMap = {};
    const individualAdditions = [];

    // Filter transactions to only keep transactionType === "pengadaan"
    const procurementTxns = transactions.filter(
      (tx) => tx.transactionType === "pengadaan"
    );

    procurementTxns.forEach((tx) => {
      if (tx.transactionVia === "bulkPurchase" && tx.bulkPurchaseId) {
        if (!transactionsMap[tx.bulkPurchaseId]) {
          transactionsMap[tx.bulkPurchaseId] = [];
        }
        transactionsMap[tx.bulkPurchaseId].push(tx);
      } else {
        // manual stockAddition or others without bulkPurchaseId
        individualAdditions.push(tx);
      }
    });

    const reconstructedList = [];

    // 1. Process grouped bulk purchases
    Object.keys(transactionsMap).forEach((bulkId) => {
      const txs = transactionsMap[bulkId];
      // Find if there is an existing notaBelanja for this bulkPurchaseId
      const matchingNota = notaList.find((nota) => nota.bulkPurchaseId === bulkId);

      if (matchingNota) {
        reconstructedList.push(matchingNota);
      } else {
        // Reconstruct transaction block from stockTransactions
        const firstTx = txs[0];
        const items = txs.map((t) => ({
          itemId: t.itemId,
          itemName: t.itemName,
          price: t.quantity > 0 ? t.cost / t.quantity : 0,
          quantity: t.quantity,
          subtotal: t.cost || 0,
          unit: t.originalUnit || t.unit || "pcs",
          kategori: t.kategori || "",
        }));

        reconstructedList.push({
          id: bulkId,
          bulkPurchaseId: bulkId,
          supplierName: firstTx.supplierName || "Lainnya",
          items: items,
          downloadURL: null,
          uploadedBy: {
            email: firstTx.createdBy || "unknown",
          },
          createdAt: firstTx.timestampInMillisEpoch?.toDate
            ? firstTx.timestampInMillisEpoch.toDate().toISOString()
            : new Date(firstTx.timestampInMillisEpoch).toISOString(),
          isReconstructed: true,
        });
      }
    });

    // 2. Process individual manual additions
    individualAdditions.forEach((tx) => {
      const txId = tx.id || `${tx.itemId}_${tx.timestampInMillisEpoch}`;
      const matchingNota = notaList.find(
        (nota) => nota.bulkPurchaseId === txId || nota.id === txId
      );

      if (matchingNota) {
        reconstructedList.push(matchingNota);
      } else {
        reconstructedList.push({
          id: txId,
          supplierName: tx.supplierName || "Penyesuaian Stok (Manual)",
          items: [
            {
              itemId: tx.itemId,
              itemName: tx.itemName,
              price: tx.quantity > 0 ? (tx.cost || 0) / tx.quantity : 0,
              quantity: tx.quantity,
              subtotal: tx.cost || 0,
              unit: tx.originalUnit || tx.unit || "pcs",
              kategori: tx.kategori || "",
            },
          ],
          downloadURL: null,
          uploadedBy: {
            email: tx.createdBy || "unknown",
          },
          createdAt: tx.timestampInMillisEpoch?.toDate
            ? tx.timestampInMillisEpoch.toDate().toISOString()
            : new Date(tx.timestampInMillisEpoch).toISOString(),
          isReconstructed: true,
        });
      }
    });

    // Sort by Date descending
    reconstructedList.sort((a, b) => {
      const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });

    // Apply active chips filter to reconstructedList
    if (chips.length === 0) {
      setDisplayedNotas(reconstructedList);
    } else {
      const filtered = reconstructedList.filter((nota) => {
        return (nota.items || []).some((item) => chips.includes(item.itemId));
      });
      setDisplayedNotas(filtered);
    }
  }, [transactions, notaList, chips]);

  const toggleNotaExpand = (notaId) => {
    setExpandedNotas((prev) => ({
      ...prev,
      [notaId]: !prev[notaId],
    }));
  };

  const getNotaTotal = (nota) => {
    return (nota.items || []).reduce(
      (sum, item) => sum + (item.subtotal || 0),
      0
    );
  };

  const getItemCategory = (item) => {
    if (item.kategori) return item.kategori;
    const matched = stockList.find((s) => s.itemId === item.itemId);
    return matched ? matched.kategori : "-";
  };

  // Export to Excel
  function exportToExcel() {
    let dataToExport = [];
    if (viewMode === "transaction") {
      dataToExport = displayedNotas.flatMap((nota) =>
        (nota.items || []).map((item) => {
          const date = nota.createdAt.toDate ? nota.createdAt.toDate() : new Date(nota.createdAt);
          return {
            Tanggal: nota.createdAt ? formatDateDDMMYYYY(date) : "",
            Supplier: nota.supplierName || "",
            "Dibuat Oleh": nota.uploadedBy?.email || "unknown",
            "Nama Produk": item.itemName || "",
            Satuan: item.unit || "",
            Qty: item.quantity || 0,
            Harga: item.price || 0,
            Subtotal: item.subtotal || 0,
          };
        })
      );
    } else {
      dataToExport = displayed.map((tx) => ({
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
    }
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SejarahBelanja");
    XLSX.writeFile(wb, "SejarahBelanja.xlsx");
  }

  return (
    <div className="sejarah-belanja-container">
      <h1>Sejarah Belanja</h1>

      {/* View Mode Switcher */}
      <div className="view-mode-chips">
        <button
          className={`view-mode-chip ${viewMode === "table" ? "active" : ""}`}
          onClick={() => setViewMode("table")}
        >
          Item Details Table
        </button>
        <button
          className={`view-mode-chip ${
            viewMode === "transaction" ? "active" : ""
          }`}
          onClick={() => setViewMode("transaction")}
        >
          Per Transaction List
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

      {viewMode === "transaction" ? (
        <table className="sejarah-belanja-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama Supplier</th>
              <th>Jumlah Barang</th>
              <th>Total Pembelian</th>
              <th>Dibuat Oleh</th>
              <th>File Nota</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {displayedNotas.map((nota) => {
              const notaId = nota.id || nota.bulkPurchaseId;
              const isExpanded = !!expandedNotas[notaId];
              return (
                <React.Fragment key={notaId}>
                  <tr
                    className="nota-row"
                    onClick={() => toggleNotaExpand(notaId)}
                  >
                    <td>
                      {nota.createdAt
                        ? (nota.createdAt.toDate ? nota.createdAt.toDate() : new Date(nota.createdAt)).toLocaleString("id-ID")
                        : ""}
                    </td>
                    <td>{nota.supplierName || "Lainnya"}</td>
                    <td>{(nota.items || []).length} jenis barang</td>
                    <td>{formatCurrency(getNotaTotal(nota))}</td>
                    <td>{nota.uploadedBy?.email || "unknown"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {nota.downloadURL ? (
                        <a
                          href={nota.downloadURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nota-link-btn"
                        >
                          <FaExternalLinkAlt /> Lihat Nota
                        </a>
                      ) : (
                        <span className="no-nota-text">Tidak ada file</span>
                      )}
                    </td>
                    <td>
                      <button className="expand-btn">
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="expanded-details-row">
                      <td colSpan="7">
                        <div className="nota-details-container">
                          <h4>Daftar Barang Belanja</h4>
                          <table className="nota-details-table">
                            <thead>
                              <tr>
                                <th>Nama Produk</th>
                                <th>Kategori</th>
                                <th>Satuan</th>
                                <th>Qty</th>
                                <th>Harga Satuan</th>
                                <th>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(nota.items || []).map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.itemName}</td>
                                  <td>{getItemCategory(item)}</td>
                                  <td>{item.unit}</td>
                                  <td>{item.quantity}</td>
                                  <td>{formatCurrency(item.price)}</td>
                                  <td>{formatCurrency(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {displayedNotas.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", color: "#888" }}>
                  Tidak ada data transaksi pengadaan yang ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
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
            {displayed.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", color: "#888" }}>
                  Tidak ada detail item transaksi belanja yang ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
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
