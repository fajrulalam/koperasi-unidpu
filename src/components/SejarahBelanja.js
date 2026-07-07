import React, { useState, useEffect, useMemo } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import {
  FaTimes,
  FaChevronDown,
  FaChevronUp,
  FaExternalLinkAlt,
  FaCalendarAlt,
  FaTruck,
  FaFileExcel,
  FaExclamationTriangle,
  FaBox
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

  // View mode: "table" (item details) or "transaction" (grouped per invoice/date)
  const [viewMode, setViewMode] = useState("transaction");
  const [notaList, setNotaList] = useState([]);
  const [displayedNotas, setDisplayedNotas] = useState([]);
  
  // Date grouping expand/collapse
  const [expandedDates, setExpandedDates] = useState({});
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

    // Filter transactions to only keep transactionType === "pengadaan" or "pengurangan"
    transactions.forEach((tx) => {
      if (tx.transactionVia === "bulkPurchase" && tx.bulkPurchaseId) {
        if (!transactionsMap[tx.bulkPurchaseId]) {
          transactionsMap[tx.bulkPurchaseId] = [];
        }
        transactionsMap[tx.bulkPurchaseId].push(tx);
      } else {
        individualAdditions.push(tx);
      }
    });

    const reconstructedList = [];

    // 1. Process grouped bulk purchases
    Object.keys(transactionsMap).forEach((bulkId) => {
      const txs = transactionsMap[bulkId];
      const matchingNota = notaList.find((nota) => nota.bulkPurchaseId === bulkId);

      if (matchingNota) {
        reconstructedList.push(matchingNota);
      } else {
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
          type: "pengadaan"
        });
      }
    });

    // 2. Process individual manual additions/adjustments
    individualAdditions.forEach((tx) => {
      const txId = tx.id || `${tx.itemId}_${tx.timestampInMillisEpoch}`;
      const matchingNota = notaList.find(
        (nota) => nota.bulkPurchaseId === txId || nota.id === txId
      );

      if (matchingNota) {
        reconstructedList.push({
          ...matchingNota,
          type: tx.transactionType || "pengadaan"
        });
      } else {
        reconstructedList.push({
          id: txId,
          supplierName: tx.supplierName || (tx.transactionType === "pengurangan" ? "Penyesuaian Stok (Pengurangan)" : "Penyesuaian Stok (Tambah Manual)"),
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
          type: tx.transactionType || "pengadaan"
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

  // Group transactions by date key for accordion view
  const groupedTransactions = useMemo(() => {
    return displayedNotas.reduce((groups, nota) => {
      const date = nota.createdAt.toDate ? nota.createdAt.toDate() : new Date(nota.createdAt);
      const dateKey = date.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(nota);
      return groups;
    }, {});
  }, [displayedNotas]);

  // Summary statistics calculation
  const stats = useMemo(() => {
    let totalPengadaan = 0;
    let totalPengurangan = 0;

    displayed.forEach((tx) => {
      if (tx.transactionType === "pengadaan") {
        totalPengadaan += tx.cost || 0;
      } else if (tx.transactionType === "pengurangan") {
        totalPengurangan += tx.cost || 0;
      }
    });

    return {
      totalPengadaan,
      totalPengurangan,
      transactionCount: displayedNotas.length,
      itemCount: displayed.length
    };
  }, [displayed, displayedNotas]);

  const toggleDateExpand = (dateKey) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

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
            Tipe: nota.type === "pengurangan" ? "Pengurangan" : "Pengadaan",
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
        Jenis: tx.transactionType === "pengurangan" ? "Pengurangan" : "Pengadaan",
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
    <div className="sb-container">
      {/* Header block with Page Title & Tab Selector */}
      <div className="sb-header-row">
        <div>
          <h1>Sejarah Belanja</h1>
          <p className="sb-subtitle">Rentang waktu untuk melihat riwayat transaksi pengadaan (B2B)</p>
        </div>

        {/* View Mode Switching Tabs */}
        <div className="sb-tabs">
          <button
            className={`sb-tab ${viewMode === "transaction" ? "active" : ""}`}
            onClick={() => setViewMode("transaction")}
          >
            Per Transaksi
          </button>
          <button
            className={`sb-tab ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            Daftar Item
          </button>
        </div>
      </div>

      {/* Modern Filter Card */}
      <div className="sb-filter-card">
        <div className="sb-filter-grid">
          {/* Item searching with Chips */}
          <div className="sb-filter-col">
            <label className="sb-label">Cari Nama Barang</label>
            <div className="sb-search-wrapper">
              <div className="sb-chips-input-container">
                {chips.map((c) => (
                  <span key={c} className="sb-chip">
                    {c}
                    <FaTimes className="sb-chip-close" onClick={() => removeChip(c)} />
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={chips.length > 0 ? "" : "Ketik nama barang..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {suggestions.length > 0 && (
                <div className="sb-suggestion-dropdown">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="sb-suggestion-item"
                      onClick={() => addChip(s)}
                    >
                      {s.itemName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="sb-scanner-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={useScanner}
                  onChange={(e) => setUseScanner(e.target.checked)}
                />
                Mode Barcode Scanner
              </label>
            </div>
          </div>

          {/* Date Picker Range */}
          <div className="sb-filter-col">
            <label className="sb-label">Periode Transaksi</label>
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateChange}
            />
          </div>

          {/* Action buttons */}
          <div className="sb-filter-col sb-actions-col">
            <button className="sb-btn sb-btn-export" onClick={exportToExcel}>
              <FaFileExcel size={14} /> Export ke Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Analytics Widget */}
      <div className="sb-stats-grid">
        <div className="sb-stat-card sb-card-procure">
          <div className="sb-stat-icon-wrapper">
            <FaTruck size={22} />
          </div>
          <div>
            <p className="sb-stat-label">Total Pengadaan</p>
            <p className="sb-stat-value">{formatCurrency(stats.totalPengadaan)}</p>
          </div>
        </div>
        <div className="sb-stat-card sb-card-reduction">
          <div className="sb-stat-icon-wrapper">
            <FaExclamationTriangle size={20} />
          </div>
          <div>
            <p className="sb-stat-label">Total Pengurangan</p>
            <p className="sb-stat-value">{formatCurrency(stats.totalPengurangan)}</p>
          </div>
        </div>
        <div className="sb-stat-card sb-card-totals">
          <div className="sb-stat-icon-wrapper">
            <FaBox size={20} />
          </div>
          <div>
            <p className="sb-stat-label">Jumlah Catatan</p>
            <p className="sb-stat-value">
              {viewMode === "transaction" 
                ? `${stats.transactionCount} Transaksi` 
                : `${stats.itemCount} Detail Item`}
            </p>
          </div>
        </div>
      </div>

      {/* Content views */}
      {viewMode === "transaction" ? (
        <div className="sb-grouped-list">
          {Object.keys(groupedTransactions).length === 0 ? (
            <div className="sb-empty-state">
              <FaCalendarAlt size={40} />
              <p>Tidak ada transaksi belanja ditemukan untuk rentang tanggal terpilih.</p>
            </div>
          ) : (
            Object.entries(groupedTransactions).map(([dateKey, dayNotas]) => {
              const isDateExpanded = expandedDates[dateKey] !== false; // Default expanded
              const dayTotal = dayNotas.reduce((sum, n) => sum + getNotaTotal(n), 0);
              const procureCount = dayNotas.filter(n => n.type !== "pengurangan").length;
              const reductionCount = dayNotas.filter(n => n.type === "pengurangan").length;

              return (
                <div key={dateKey} className="sb-date-group">
                  {/* Collapsible Date Header */}
                  <button
                    onClick={() => toggleDateExpand(dateKey)}
                    className="sb-date-header"
                  >
                    <div className="sb-date-header-left">
                      <FaCalendarAlt className="sb-calendar-icon" />
                      <div>
                        <h3>{dateKey}</h3>
                        <p>{procureCount} pengadaan, {reductionCount} pengurangan</p>
                      </div>
                    </div>
                    <div className="sb-date-header-right">
                      <div>
                        <span className="sb-total-lbl">Total</span>
                        <span className="sb-total-val">{formatCurrency(dayTotal)}</span>
                      </div>
                      {isDateExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                  </button>

                  {/* Transactions inside this Date Group */}
                  {isDateExpanded && (
                    <div className="sb-date-transactions">
                      {dayNotas.map((nota) => {
                        const notaId = nota.id || nota.bulkPurchaseId;
                        const isNotaExpanded = !!expandedNotas[notaId];
                        const isAdjustment = nota.type === "pengurangan";

                        return (
                          <div key={notaId} className="sb-tx-tile">
                            <div className="sb-tx-tile-header" onClick={() => toggleNotaExpand(notaId)}>
                              <div className="sb-tx-tile-info">
                                {/* Type icon wrapper */}
                                <div className={`sb-tx-icon ${isAdjustment ? "adjustment" : "procure"}`}>
                                  {isAdjustment ? <FaExclamationTriangle size={15} /> : <FaTruck size={15} />}
                                </div>
                                <div className="sb-tx-text-block">
                                  <div className="sb-tx-main-line">
                                    <span className="sb-tx-id">{notaId}</span>
                                    <span className={`sb-tx-badge ${isAdjustment ? "adjustment" : "procure"}`}>
                                      {isAdjustment ? "Pengurangan" : "Pengadaan"}
                                    </span>
                                    <span className="sb-tx-sep">|</span>
                                    <span className="sb-tx-supplier">
                                      {nota.supplierName || "Lainnya"}
                                    </span>
                                  </div>
                                  <div className="sb-tx-meta">
                                    <span>
                                      Jam: {nota.createdAt 
                                        ? (nota.createdAt.toDate ? nota.createdAt.toDate() : new Date(nota.createdAt)).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                                        : ""
                                      }
                                    </span>
                                    <span>Oleh: {nota.uploadedBy?.email || "unknown"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="sb-tx-right-block">
                                <div className="sb-tx-price-summary">
                                  <span className="sb-tx-total-lbl">Total Nota</span>
                                  <span className="sb-tx-total-val">{formatCurrency(getNotaTotal(nota))}</span>
                                </div>
                                {isNotaExpanded ? <FaChevronUp /> : <FaChevronDown />}
                              </div>
                            </div>

                            {/* Collapsible Details list inside Tile */}
                            {isNotaExpanded && (
                              <div className="sb-tx-details-content">
                                <div className="sb-details-box">
                                  <h4>Daftar Item Detail</h4>
                                  <table className="sb-details-table">
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
                                          <td className="font-semibold">{item.itemName}</td>
                                          <td>{getItemCategory(item)}</td>
                                          <td>{item.unit}</td>
                                          <td>{item.quantity}</td>
                                          <td>{formatCurrency(item.price)}</td>
                                          <td className="font-semibold text-gray-800">{formatCurrency(item.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Attachment Action */}
                                  {nota.downloadURL && (
                                    <div className="sb-attachment-block">
                                      <a
                                        href={nota.downloadURL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="sb-attachment-link"
                                      >
                                        <FaExternalLinkAlt size={12} /> Buka/Lihat File Lampiran Nota
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat Item Details Table View */
        <div className="sb-table-wrapper">
          <table className="sb-details-table flat-table">
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Sub Kategori</th>
                <th>Tipe Transaksi</th>
                <th>Qty</th>
                <th>Total Cost</th>
                <th>Metode Input</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((tx, idx) => (
                <tr key={idx}>
                  <td className="font-semibold text-gray-900">{tx.itemName}</td>
                  <td>{tx.kategori}</td>
                  <td>{tx.subKategori}</td>
                  <td>
                    <span className={`sb-tx-badge ${tx.transactionType === "pengurangan" ? "adjustment" : "procure"}`}>
                      {tx.transactionType === "pengurangan" ? "Pengurangan" : "Pengadaan"}
                    </span>
                  </td>
                  <td>{getDisplayQty(tx)}</td>
                  <td className="font-semibold text-gray-800">{formatCurrency(tx.cost)}</td>
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
                  <td colSpan="8" style={{ textAlign: "center", color: "#888", padding: "30px 10px" }}>
                    Tidak ada data detail item pengadaan yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Custom styled Date range filter component using ReactDatePicker
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
      alert("Silakan pilih tanggal mulai dan akhir.");
      return;
    }
    if (tempStart > tempEnd) {
      alert("Tanggal mulai tidak boleh melebihi tanggal akhir.");
      return;
    }
    onChange(tempStart, tempEnd);
  }

  return (
    <div className="sb-date-range">
      <div className="sb-datepicker-box">
        <ReactDatePicker
          selected={tempStart}
          onChange={(date) => setTempStart(date)}
          selectsStart
          startDate={tempStart}
          endDate={tempEnd}
          dateFormat="dd/MM/yyyy"
          placeholderText="Mulai"
          className="sb-datepicker-input"
        />
      </div>
      <span className="sb-date-sep">s/d</span>
      <div className="sb-datepicker-box">
        <ReactDatePicker
          selected={tempEnd}
          onChange={(date) => setTempEnd(date)}
          selectsEnd
          startDate={tempStart}
          endDate={tempEnd}
          minDate={tempStart}
          dateFormat="dd/MM/yyyy"
          placeholderText="Akhir"
          className="sb-datepicker-input"
        />
      </div>
      <button onClick={applyDates} className="sb-btn sb-btn-filter">
        Tampilkan
      </button>
    </div>
  );
}
