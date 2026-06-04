import React, { useState, useEffect, useCallback } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import "../styles/SejarahTransaksiNew.css";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";
import {
  formatCurrency,
  formatDateShort,
  groupTransactionsByDay,
  groupTransactionsByItem,
  sortItems,
  filterItemsBySearch,
  getInitialDateRange,
} from "../services/transactionHistoryService";
import DayBreakdownDialog from "./DayBreakdownDialog";
import ItemDetailDialog from "./ItemDetailDialog";

// Tab configuration - clean, no emojis
const TABS = [
  { id: "Daily", label: "Harian" },
  { id: "Items", label: "Per Item" },
  { id: "Monthly", label: "Bulanan" },
];

const SejarahTransaksi = () => {
  const { queryCollection, query, where, orderBy } = useFirestore();
  const { isProduction, environment } = useEnvironment();

  // Tab selection
  const [selectedTab, setSelectedTab] = useState("Daily");

  // Date range
  const initialRange = getInitialDateRange(14);
  const [dateRange, setDateRange] = useState(initialRange);
  const [tempStart, setTempStart] = useState(initialRange.start);
  const [tempEnd, setTempEnd] = useState(initialRange.end);

  // Data states
  const [dailyData, setDailyData] = useState([]);
  const [itemsData, setItemsData] = useState([]);
  const [filteredItemsData, setFilteredItemsData] = useState([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [daysLoaded, setDaysLoaded] = useState(14);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [itemSortConfig, setItemSortConfig] = useState({
    key: "revenue",
    direction: "desc",
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  // Dialog states
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemTransactions, setItemTransactions] = useState([]);

  // Fetch daily transactions from transactionDetail collection
  const fetchDailyTransactions = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - daysLoaded);

    try {
      const actualPath = isProduction
        ? "transactionDetail"
        : "transactionDetail_testing";
      console.log(`Querying from collection: ${actualPath}`);

      const transactions = await queryCollection(
        "transactionDetail",
        (collectionRef) =>
          query(
            collectionRef,
            where("timestamp", ">=", cutoff),
            orderBy("timestamp", "desc")
          )
      );

      console.log(
        `Fetched ${transactions.length} transactions from ${environment} environment`
      );

      const grouped = groupTransactionsByDay(transactions);

      if (dailyData.length === grouped.length && daysLoaded > 14) {
        setAllDataLoaded(true);
        setSnackbar({ open: true, message: "Seluruh data sudah ditampilkan" });
      } else {
        setAllDataLoaded(false);
      }

      setDailyData(grouped);
    } catch (err) {
      console.error("Error fetching daily transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [
    daysLoaded,
    isProduction,
    queryCollection,
    query,
    where,
    orderBy,
    environment,
    dailyData.length,
  ]);

  // Fetch items transactions from stockTransactions collection
  const fetchItemsTransactions = useCallback(async () => {
    setLoading(true);
    const endDatePlusOne = new Date(dateRange.end);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

    try {
      const actualPath = isProduction
        ? "stockTransactions"
        : "stockTransactions_testing";
      console.log(`Querying penjualan from: ${actualPath}`);

      const transactions = await queryCollection(
        "stockTransactions",
        (collectionRef) =>
          query(
            collectionRef,
            where("transactionType", "==", "penjualan"),
            where("timestampInMillisEpoch", ">=", dateRange.start),
            where("timestampInMillisEpoch", "<=", endDatePlusOne),
            orderBy("timestampInMillisEpoch", "desc")
          )
      );

      console.log(`Fetched ${transactions.length} penjualan transactions`);

      const grouped = groupTransactionsByItem(transactions);
      const sorted = sortItems(
        grouped,
        itemSortConfig.key,
        itemSortConfig.direction
      );

      setItemsData(sorted);
      setFilteredItemsData(sorted);
    } catch (err) {
      console.error("Error fetching items transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [
    dateRange,
    isProduction,
    queryCollection,
    query,
    where,
    orderBy,
    itemSortConfig,
  ]);

  // Effects
  useEffect(() => {
    if (selectedTab === "Daily") {
      fetchDailyTransactions();
    }
  }, [selectedTab, daysLoaded, isProduction]);

  useEffect(() => {
    if (selectedTab === "Items") {
      fetchItemsTransactions();
    }
  }, [selectedTab, dateRange, isProduction]);

  // Handlers
  const applyDateFilter = () => {
    if (!tempStart || !tempEnd) {
      alert("Please pick valid dates");
      return;
    }
    if (tempStart > tempEnd) {
      alert("Start date cannot exceed end date");
      return;
    }
    setDateRange({ start: tempStart, end: tempEnd });
  };

  const handleShowMore = () => {
    setDaysLoaded((prev) => prev + 14);
  };

  const handleItemSearch = (e) => {
    const term = e.target.value;
    setItemSearchTerm(term);
    setFilteredItemsData(filterItemsBySearch(itemsData, term));
  };

  const requestItemSort = (key) => {
    const direction =
      itemSortConfig.key === key && itemSortConfig.direction === "desc"
        ? "asc"
        : "desc";
    setItemSortConfig({ key, direction });
    setFilteredItemsData(sortItems(filteredItemsData, key, direction));
  };

  const openDayDialog = (dayGroup) => {
    setSelectedDay(dayGroup);
    setDayDialogOpen(true);
  };

  const closeDayDialog = () => {
    setDayDialogOpen(false);
    setSelectedDay(null);
  };

  const openItemDialog = (item) => {
    setSelectedItem(item);
    setItemTransactions(
      item.transactions.sort(
        (a, b) =>
          b.timestampInMillisEpoch.toDate() - a.timestampInMillisEpoch.toDate()
      )
    );
    setItemDialogOpen(true);
  };

  const closeItemDialog = () => {
    setItemDialogOpen(false);
    setSelectedItem(null);
    setItemTransactions([]);
  };

  // Export to XLSX
  const handleExportXLSX = () => {
    const exportData = [];
    exportData.push(["Sejarah Transaksi Export"]);
    exportData.push([
      "Date Range:",
      `${formatDateShort(dateRange.start)} - ${formatDateShort(dateRange.end)}`,
    ]);
    exportData.push(["View:", selectedTab]);
    exportData.push([]);

    if (selectedTab === "Daily") {
      filteredDailyData.forEach((day) => {
        exportData.push(["Date", day.formattedDate, "Total", day.total]);
        exportData.push(["Item Name", "Quantity", "Unit", "Subtotal"]);
        day.breakdown.forEach((item) => {
          exportData.push([
            item.itemName,
            item.quantity,
            item.unit,
            item.subtotal,
          ]);
        });
        exportData.push([]);
      });
    } else if (selectedTab === "Items") {
      exportData.push([
        "Item Name",
        "Category",
        "Subcategory",
        "Quantity",
        "Unit",
        "Revenue",
        "Cost",
        "Profit",
      ]);
      filteredItemsData.forEach((item) => {
        exportData.push([
          item.itemName || "N/A",
          item.kategori || "N/A",
          item.subKategori || "N/A",
          Math.round(item.quantity),
          item.unit || "N/A",
          Math.round(item.revenue),
          Math.round(item.stockWorth),
          Math.round(item.profitMargin),
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `SejarahTransaksi_${selectedTab}.xlsx`);
  };

  // Filter data by date range
  const filteredDailyData = dailyData.filter(
    (day) => day.date >= dateRange.start && day.date <= dateRange.end
  );

  return (
    <div className="st-container">
      <h1>Sejarah Transaksi</h1>

      {/* Tab Selector */}
      <div className="st-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`st-tab ${selectedTab === tab.id ? "active" : ""}`}
            onClick={() => setSelectedTab(tab.id)}
          >
            <span className="st-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      {(selectedTab === "Daily" || selectedTab === "Items") && (
        <div className="st-controls">
          <span className="st-controls-label">Rentang Tanggal:</span>
          <div className="st-date-filter">
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
            <button className="st-btn st-btn-primary" onClick={applyDateFilter}>
              Filter
            </button>
          </div>
          <button className="st-btn st-btn-export" onClick={handleExportXLSX}>
            Export ke Excel
          </button>
        </div>
      )}

      {/* Daily View */}
      {selectedTab === "Daily" && (
        <>
          {loading ? (
            <div className="st-loading">
              <p>Memuat data...</p>
            </div>
          ) : filteredDailyData.length === 0 ? (
            <div className="st-empty">
              Tidak ada transaksi dalam periode ini.
            </div>
          ) : (
            <div className="st-daily-list">
              {filteredDailyData.map((dayGroup) => (
                <div
                  key={dayGroup.key}
                  className="st-day-card"
                  onClick={() => openDayDialog(dayGroup)}
                >
                  <span className="st-day-date">{dayGroup.formattedDate}</span>
                  <span className="st-day-total">
                    {formatCurrency(dayGroup.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleShowMore}
            disabled={allDataLoaded}
            className="st-show-more"
          >
            {allDataLoaded ? "Semua Data Ditampilkan" : "Tampilkan Lebih"}
          </button>
        </>
      )}

      {/* Items View */}
      {selectedTab === "Items" && (
        <>
          <div className="st-search">
            <input
              type="text"
              placeholder="Cari item berdasarkan nama, ID, kategori..."
              value={itemSearchTerm}
              onChange={handleItemSearch}
            />
            <span className="st-search-count">
              {filteredItemsData.length} item
            </span>
          </div>

          {loading ? (
            <div className="st-loading">
              <p>Memuat data item...</p>
            </div>
          ) : filteredItemsData.length === 0 ? (
            <div className="st-empty">
              Tidak ada transaksi dalam periode ini.
            </div>
          ) : (
            <div className="st-table-container">
              <table className="st-table">
                <thead>
                  <tr>
                    <th
                      className={`sortable ${
                        itemSortConfig.key === "itemName"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("itemName")}
                    >
                      Nama Item
                    </th>
                    <th
                      className={`sortable ${
                        itemSortConfig.key === "kategori"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("kategori")}
                    >
                      Kategori
                    </th>
                    <th
                      className={`sortable center ${
                        itemSortConfig.key === "quantity"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("quantity")}
                    >
                      Qty
                    </th>
                    <th className="center">Unit</th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "revenue"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("revenue")}
                    >
                      Pendapatan
                    </th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "stockWorth"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("stockWorth")}
                    >
                      Modal
                    </th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "profitMargin"
                          ? `sorted-${itemSortConfig.direction}`
                          : ""
                      }`}
                      onClick={() => requestItemSort("profitMargin")}
                    >
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemsData.map((item, index) => (
                    <tr
                      key={`item-${index}`}
                      onClick={() => openItemDialog(item)}
                    >
                      <td>{item.itemName || "N/A"}</td>
                      <td>{item.kategori || "N/A"}</td>
                      <td className="center">{Math.round(item.quantity)}</td>
                      <td className="center">{item.unit || "N/A"}</td>
                      <td className="right">{formatCurrency(item.revenue)}</td>
                      <td className="right">
                        {formatCurrency(item.stockWorth)}
                      </td>
                      <td className="right">
                        {formatCurrency(item.profitMargin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Monthly View (Coming Soon) */}
      {selectedTab === "Monthly" && (
        <div className="st-coming-soon">
          <h3>Coming Soon</h3>
          <p>Fitur laporan bulanan sedang dalam pengembangan</p>
        </div>
      )}

      {/* Day Breakdown Dialog - includes Per Item and Per Pembeli views */}
      <DayBreakdownDialog
        isOpen={dayDialogOpen}
        onClose={closeDayDialog}
        dayData={selectedDay}
      />

      {/* Item Detail Dialog */}
      <ItemDetailDialog
        isOpen={itemDialogOpen}
        onClose={closeItemDialog}
        item={selectedItem}
        transactions={itemTransactions}
      />

      {/* Snackbar */}
      {snackbar.open && (
        <div className="st-snackbar">
          {snackbar.message}
          <button onClick={() => setSnackbar({ ...snackbar, open: false })}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default SejarahTransaksi;
