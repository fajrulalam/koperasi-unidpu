import React, { useState, useEffect } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import "../styles/SejarahTransaksi.css";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";

// Helper to format numbers as currency (for on-screen display)
const formatCurrency = (number) => {
  // Ensure the number is rounded to the nearest integer
  const roundedNumber = Math.round(number);
  // Format with thousands separator
  return "Rp. " + roundedNumber.toLocaleString("id-ID");
};

// Helper to format dates (e.g., "02 Feb 2025")
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * DateRangeFilter
 * A simple component that holds two date pickers and a Filter button.
 * It only calls onChange when the user clicks the Filter button.
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

const SejarahTransaksi = () => {
  const { queryCollection, query, where, orderBy } = useFirestore();
  const { isProduction, environment } = useEnvironment();

  // Which chip is selected: "Daily", "Items", "Monthly", or "Yearly"
  const [selectedChip, setSelectedChip] = useState("Daily");
  // Number of days to load (14 initially)
  const [daysLoaded, setDaysLoaded] = useState(14);
  // The grouped daily data (each object contains date, total, and breakdown per item)
  const [dailyData, setDailyData] = useState([]);
  // The grouped items data from stockTransactions
  const [itemsData, setItemsData] = useState([]);
  // Search term for items
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  // Filtered items based on search
  const [filteredItemsData, setFilteredItemsData] = useState([]);
  // Sort configuration for items table
  const [itemSortConfig, setItemSortConfig] = useState({
    key: "cost",
    direction: "desc",
  });
  // Selected item for showing transaction history
  const [selectedItem, setSelectedItem] = useState(null);
  // Dialog for showing item transaction history
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  // Item transaction history
  const [itemTransactions, setItemTransactions] = useState([]);
  // Loading indicator while querying
  const [loading, setLoading] = useState(false);
  // Flag to mark when no additional day groups were loaded
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  // Snackbar for messages
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  // State to control the breakdown dialog
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Set the initial date range as the last 14 days.
  const initialEnd = new Date();
  const initialStart = new Date();
  initialStart.setDate(initialEnd.getDate() - 14);
  const [dateRange, setDateRange] = useState({
    start: initialStart,
    end: initialEnd,
  });
  // Indicates whether the user has manually changed the filter.
  const [isManualFilter, setIsManualFilter] = useState(false);

  // Effect: When in Daily mode, query from transactionDetail
  useEffect(() => {
    if (selectedChip !== "Daily") return;

    setLoading(true);
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - daysLoaded);

    // Build the query: get transactions with timestamp on or after the cutoff, ordered descending.
    // Get the actual collection path that will be used
    const actualPath = isProduction
      ? "transactionDetail_b2b"
      : "transactionDetail_b2b_testing";
    console.log(`Querying from collection: ${actualPath}`);

    queryCollection("transactionDetail_b2b", (collectionRef) =>
      query(
        collectionRef,
        where("timestamp", ">=", cutoff),
        orderBy("timestamp", "desc")
      )
    )
      .then((transactions) => {
        console.log(
          `Fetched ${transactions.length} transactions from ${environment} environment (${actualPath})`
        );

        // Group transactions by day (using a key in YYYY-MM-DD format).
        let grouped = {};
        transactions.forEach((tx) => {
          if (!tx.timestamp || !tx.timestamp.toDate) return;
          const dateObj = tx.timestamp.toDate();
          const key =
            dateObj.getFullYear() +
            "-" +
            (dateObj.getMonth() + 1).toString().padStart(2, "0") +
            "-" +
            dateObj.getDate().toString().padStart(2, "0");
          if (!grouped[key]) {
            grouped[key] = {
              date: dateObj,
              transactions: [],
            };
          }
          grouped[key].transactions.push(tx);
        });
        // Build an array from the grouped object.
        let groupedArr = Object.keys(grouped).map((key) => {
          const group = grouped[key];
          // Sum the total for the day.
          const total = group.transactions.reduce(
            (sum, tx) => sum + (tx.total || 0),
            0
          );
          // Create a breakdown per item (grouped by itemName and unit).
          let breakdownMap = {};
          group.transactions.forEach((tx) => {
            if (Array.isArray(tx.items)) {
              tx.items.forEach((item) => {
                const breakdownKey = item.itemName + "_" + item.unit;
                if (!breakdownMap[breakdownKey]) {
                  breakdownMap[breakdownKey] = {
                    itemName: item.itemName,
                    unit: item.unit,
                    quantity: 0,
                    subtotal: 0,
                  };
                }
                breakdownMap[breakdownKey].quantity += item.quantity;
                breakdownMap[breakdownKey].subtotal += item.subtotal;
              });
            }
          });
          let breakdown = Object.values(breakdownMap);
          const formattedDate = group.date.toLocaleDateString("id-ID", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          return {
            key,
            date: group.date,
            formattedDate,
            total,
            breakdown,
          };
        });
        // Sort so that the newest date comes first.
        groupedArr.sort((a, b) => b.date - a.date);

        if (dailyData.length === groupedArr.length && daysLoaded > 14) {
          setAllDataLoaded(true);
          setSnackbar({
            open: true,
            message: "Seluruh data sudah ditampikan",
          });
        } else {
          setAllDataLoaded(false);
        }
        setDailyData(groupedArr);

        // Auto-update date range (if the user has not manually filtered)
        if (!isManualFilter && groupedArr.length > 0) {
          setDateRange({
            start: groupedArr[groupedArr.length - 1].date,
            end: groupedArr[0].date,
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [daysLoaded, selectedChip, isProduction]);

  // Effect: When in Items mode, query penjualan transactions from stockTransactions
  useEffect(() => {
    if (selectedChip !== "Items") return;

    setLoading(true);

    // Build the query: get penjualan transactions with timestamp between the date range
    const actualPath = isProduction
      ? "stockTransactions_b2b"
      : "stockTransactions_b2b_testing";
    console.log(
      `Querying penjualan transactions from collection: ${actualPath}`
    );

    // Add one day to end date to include transactions on the end date
    const endDatePlusOne = new Date(dateRange.end);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

    queryCollection("stockTransactions_b2b", (collectionRef) =>
      query(
        collectionRef,
        where("transactionType", "==", "penjualan"),
        where("timestampInMillisEpoch", ">=", dateRange.start),
        where("timestampInMillisEpoch", "<=", endDatePlusOne),
        orderBy("timestampInMillisEpoch", "desc")
      )
    )
      .then((transactions) => {
        console.log(
          `Fetched ${transactions.length} penjualan transactions from ${environment} environment (${actualPath})`
        );

        // Process items view: group by item across all transactions
        let groupedByItem = {};

        transactions.forEach((tx) => {
          if (!tx.timestampInMillisEpoch || !tx.timestampInMillisEpoch.toDate)
            return;

          // Use itemId as the key if available, otherwise use itemName
          const itemKey = tx.itemId || tx.itemName;

          if (!groupedByItem[itemKey]) {
            groupedByItem[itemKey] = {
              itemName: tx.itemName,
              unit: tx.unit,
              kategori: tx.kategori || "Unknown",
              subKategori: tx.subKategori || "Unknown",
              quantity: 0,
              revenue: 0, // Sum of price * quantity for all transactions
              stockWorth: 0, // Sum of stockWorth for all transactions
              profitMargin: 0, // Will be calculated as revenue - stockWorth
              transactionCount: 0,
              // Store all transactions for this item
              transactions: [],
            };
          }

          // Add this transaction to the item's transactions array
          groupedByItem[itemKey].transactions.push(tx);

          // Update quantities, revenue, and stockWorth
          const txQuantity = tx.quantity || 0;
          const txPrice = tx.price || 0;
          const txStockWorth = tx.stockWorth || 0;

          groupedByItem[itemKey].quantity += txQuantity;
          groupedByItem[itemKey].revenue += txQuantity * txPrice;
          groupedByItem[itemKey].stockWorth += txStockWorth;
          groupedByItem[itemKey].transactionCount++;
        });

        // Calculate profit margin
        Object.values(groupedByItem).forEach((item) => {
          item.profitMargin = item.revenue - item.stockWorth;
        });

        // Convert to array
        const itemsArray = Object.values(groupedByItem);

        // Initialize with default sort by revenue if not already set
        if (itemSortConfig.key === "cost") {
          setItemSortConfig({ key: "revenue", direction: "desc" });
        }

        // Apply sorting based on current sort configuration
        sortItems(itemsArray);

        // Set both the full data and the filtered data (initially the same)
        setItemsData(itemsArray);
        setFilteredItemsData(itemsArray);

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [
    selectedChip,
    dateRange.start,
    dateRange.end,
    isProduction,
    itemSortConfig.key,
  ]);

  // Handler for "Show More" button: add another 14 days.
  const handleShowMore = () => {
    setDaysLoaded((prev) => prev + 14);
  };

  // Open/close the breakdown dialog for a specific day.
  const openDayDialog = (dayGroup) => {
    setSelectedDay(dayGroup);
    setDayDialogOpen(true);
  };

  const closeDayDialog = () => {
    setDayDialogOpen(false);
    setSelectedDay(null);
  };

  // Sort items based on the current sort configuration
  const sortItems = (items) => {
    return items.sort((a, b) => {
      let aValue = a[itemSortConfig.key];
      let bValue = b[itemSortConfig.key];

      // Handle special case for strings
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle missing values
      if (aValue === undefined || aValue === null) aValue = 0;
      if (bValue === undefined || bValue === null) bValue = 0;

      if (itemSortConfig.direction === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Request sort for items table
  const requestItemSort = (key) => {
    let direction = "desc";

    if (itemSortConfig.key === key) {
      direction = itemSortConfig.direction === "desc" ? "asc" : "desc";
    }

    setItemSortConfig({ key, direction });

    // Apply the new sort to the filtered data
    const sortedItems = [...filteredItemsData];
    sortItems(sortedItems);
    setFilteredItemsData(sortedItems);
  };

  // Handle search for items
  const handleItemSearch = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    setItemSearchTerm(searchTerm);

    if (!searchTerm.trim()) {
      setFilteredItemsData([...itemsData]);
      return;
    }

    // Filter items by name, itemId, kategori, or subKategori
    const filtered = itemsData.filter(
      (item) =>
        (item.itemName && item.itemName.toLowerCase().includes(searchTerm)) ||
        (item.itemId && item.itemId.toLowerCase().includes(searchTerm)) ||
        (item.kategori && item.kategori.toLowerCase().includes(searchTerm)) ||
        (item.subKategori &&
          item.subKategori.toLowerCase().includes(searchTerm))
    );

    setFilteredItemsData(filtered);
  };

  // Open item detail dialog
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

  // Close item detail dialog
  const closeItemDialog = () => {
    setItemDialogOpen(false);
    setSelectedItem(null);
    setItemTransactions([]);
  };

  // Handler for date range changes from the picker.
  // If the new start date is earlier than the fetched data, update daysLoaded.
  const handleDateRangeChange = (newStart, newEnd) => {
    if (newStart > newEnd) {
      alert("Start date cannot exceed end date");
      return;
    }
    let currentFetchedStart = dateRange.start;
    if (dailyData.length > 0) {
      currentFetchedStart = dailyData[dailyData.length - 1].date;
    }
    if (newStart < currentFetchedStart) {
      const now = new Date();
      const diffTime = now - newStart;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > daysLoaded) {
        setDaysLoaded(diffDays);
      }
    }
    setDateRange({ start: newStart, end: newEnd });
    setIsManualFilter(true);
  };

  // Filter the fetched daily data based on the current date range.
  const filteredDailyData = dailyData.filter(
    (day) => day.date >= dateRange.start && day.date <= dateRange.end
  );

  // Export to XLSX: Create one sheet that includes aggregated data
  // based on the current view (Daily or Items)
  const handleExportXLSX = () => {
    const exportData = [];
    // Title and date range information
    exportData.push(["Sejarah Transaksi Export"]);
    exportData.push([
      "Date Range:",
      `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`,
    ]);
    exportData.push(["View:", selectedChip]);
    exportData.push([]); // Blank row

    if (selectedChip === "Daily") {
      // Daily view export
      filteredDailyData.forEach((day) => {
        // Aggregated daily data row (raw number for total)
        exportData.push(["Date", day.formattedDate, "Total", day.total]);
        // Breakdown header row (without a currency column)
        exportData.push(["Item Name", "Quantity", "Unit", "Subtotal"]);
        // One row per breakdown item (raw number for subtotal)
        day.breakdown.forEach((item) => {
          exportData.push([
            item.itemName,
            item.quantity,
            item.unit,
            item.subtotal,
          ]);
        });
        exportData.push([]); // Blank row between days
      });
    } else if (selectedChip === "Items") {
      // Items view export - sales data
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

    // Create worksheet from the array of arrays.
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Loop through all cells in the worksheet.
    // For cells in column D (aggregated total) and column D of breakdown (subtotal)
    // that contain a number, apply a currency number format.
    Object.keys(ws).forEach((cellKey) => {
      if (cellKey[0] === "!") return;
      // Get the column letters (e.g., "A", "B", "C", etc.)
      const colLetters = cellKey.match(/^[A-Z]+/)[0];
      // For aggregated total in column D and breakdown subtotal in column D,
      // apply the number format if the cell value is a number.
      if (colLetters === "D" && typeof ws[cellKey].v === "number") {
        ws[cellKey].z = '"Rp." #,##0';
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `SejarahTransaksi_${selectedChip}.xlsx`);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && dayDialogOpen) {
        closeDayDialog();
      }
    };

    if (dayDialogOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dayDialogOpen]);

  return (
    <div className="sejarah-transaksi-container">
      <h1>Riwayat Pengiriman Barang</h1>
      {/* Chips at the top */}
      <div className="chips-container">
        <button
          className={`chip ${selectedChip === "Daily" ? "active" : ""}`}
          onClick={() => setSelectedChip("Daily")}
        >
          Daily
        </button>
        <button
          className={`chip ${selectedChip === "Items" ? "active" : ""}`}
          onClick={() => setSelectedChip("Items")}
        >
          Per Item
        </button>
        <button
          className={`chip ${selectedChip === "Monthly" ? "active" : ""}`}
          onClick={() => setSelectedChip("Monthly")}
        >
          Monthly
        </button>
        <button
          className={`chip ${selectedChip === "Yearly" ? "active" : ""}`}
          onClick={() => setSelectedChip("Yearly")}
        >
          Yearly
        </button>
      </div>

      {/* Date range header and controls (for Daily and Items modes) */}
      {(selectedChip === "Daily" || selectedChip === "Items") && (
        <div className="date-range-header">
          <div className="date-range-controls">
            Rentang Tanggal:
            <DateRangeFilter
              startDate={dateRange.start}
              endDate={dateRange.end}
              onChange={handleDateRangeChange}
            />
            <button className="export-btn" onClick={handleExportXLSX}>
              Export ke Excel
            </button>
          </div>
        </div>
      )}

      {/* Display based on selected chip */}
      {selectedChip === "Daily" && (
        <>
          {loading ? (
            <p>Loading...</p>
          ) : filteredDailyData.length === 0 ? (
            <p>No transactions found in this period.</p>
          ) : (
            <div className="daily-list">
              {filteredDailyData.map((dayGroup) => (
                <div
                  key={dayGroup.key}
                  className="day-group"
                  onClick={() => openDayDialog(dayGroup)}
                >
                  <div className="day-info">
                    <span className="day-date">{dayGroup.formattedDate}</span>
                    <span className="day-total">
                      {formatCurrency(dayGroup.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleShowMore}
            disabled={allDataLoaded}
            className="show-more-btn"
          >
            Show More
          </button>
        </>
      )}

      {selectedChip === "Items" && (
        <>
          <div className="items-search-container">
            <input
              type="text"
              placeholder="Search items by name, ID, category..."
              value={itemSearchTerm}
              onChange={handleItemSearch}
              className="items-search-input"
            />
            <div className="items-count">
              {filteredItemsData.length} items found
            </div>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredItemsData.length === 0 ? (
            <p>No transactions found in this period.</p>
          ) : (
            <div className="items-table-container">
              <table className="items-table">
                <thead>
                  <tr>
                    <th
                      className={`sortable ${
                        itemSortConfig.key === "itemName"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("itemName")}
                    >
                      Item Name
                    </th>
                    <th
                      className={`sortable ${
                        itemSortConfig.key === "kategori"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("kategori")}
                    >
                      Category
                    </th>
                    <th
                      className={`sortable ${
                        itemSortConfig.key === "subKategori"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("subKategori")}
                    >
                      Subcategory
                    </th>
                    <th
                      className={`sortable center ${
                        itemSortConfig.key === "quantity"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("quantity")}
                    >
                      Quantity
                    </th>
                    <th className="center">Unit</th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "revenue"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("revenue")}
                    >
                      Revenue
                    </th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "stockWorth"
                          ? "sorted-" + itemSortConfig.direction
                          : ""
                      }`}
                      onClick={() => requestItemSort("stockWorth")}
                    >
                      Cost
                    </th>
                    <th
                      className={`sortable right ${
                        itemSortConfig.key === "profitMargin"
                          ? "sorted-" + itemSortConfig.direction
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
                      className="clickable-row"
                    >
                      <td>{item.itemName || "N/A"}</td>
                      <td>{item.kategori || "N/A"}</td>
                      <td>{item.subKategori || "N/A"}</td>
                      <td className="center">{Math.round(item.quantity)}</td>
                      <td className="center">{item.unit || "N/A"}</td>
                      <td className="right">
                        {formatCurrency(Math.round(item.revenue))}
                      </td>
                      <td className="right">
                        {formatCurrency(Math.round(item.stockWorth))}
                      </td>
                      <td className="right">
                        {formatCurrency(Math.round(item.profitMargin))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={handleShowMore}
            disabled={allDataLoaded}
            className="show-more-btn"
          >
            Show More
          </button>
        </>
      )}

      {(selectedChip === "Monthly" || selectedChip === "Yearly") && (
        <p>Data belum cukup, fitur coming soon...</p>
      )}

      {/* Dialog showing breakdown for a given day */}
      {dayDialogOpen && selectedDay && (
        <div
          className="dialog-overlay"
          onClick={closeDayDialog}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeDayDialog();
            }
          }}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <button className="dialog-close-btn" onClick={closeDayDialog}>
              &times;
            </button>
            <h2>{selectedDay.formattedDate}</h2>
            <p>Total Earning: {formatCurrency(selectedDay.total)}</p>
            <div className="breakdown-list">
              {selectedDay.breakdown.map((item, idx) => (
                <div key={idx} className="breakdown-item">
                  <span className="item-name">{item.itemName}</span>
                  <div className="quantity-unit">
                    <span className="item-quantity">{item.quantity}</span>
                    <span className="item-unit">{item.unit}</span>
                  </div>
                  <span className="item-subtotal">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dialog showing transaction history for a selected item */}
      {itemDialogOpen && selectedItem && (
        <div
          className="dialog-overlay"
          onClick={closeItemDialog}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeItemDialog();
            }
          }}
        >
          <div
            className="dialog item-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="dialog-close-btn" onClick={closeItemDialog}>
              &times;
            </button>
            <h2>{selectedItem.itemName}</h2>
            <div className="item-details">
              <div className="item-detail-row">
                <span className="item-detail-label">Category:</span>
                <span className="item-detail-value">
                  {selectedItem.kategori || "N/A"}
                </span>
              </div>
              <div className="item-detail-row">
                <span className="item-detail-label">Subcategory:</span>
                <span className="item-detail-value">
                  {selectedItem.subKategori || "N/A"}
                </span>
              </div>
              <div className="item-detail-row">
                <span className="item-detail-label">Total Revenue:</span>
                <span className="item-detail-value">
                  {formatCurrency(Math.round(selectedItem.revenue))}
                </span>
              </div>
              <div className="item-detail-row">
                <span className="item-detail-label">Total Cost:</span>
                <span className="item-detail-value">
                  {formatCurrency(Math.round(selectedItem.stockWorth))}
                </span>
              </div>
              <div className="item-detail-row">
                <span className="item-detail-label">Profit Margin:</span>
                <span className="item-detail-value">
                  {formatCurrency(Math.round(selectedItem.profitMargin))}
                </span>
              </div>
            </div>

            <h3>Transaction History</h3>
            <div className="transactions-table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Quantity</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {itemTransactions.map((tx, idx) => {
                    // Calculate revenue and profit for each transaction
                    const txQuantity =
                      tx.originalQuantity !== undefined
                        ? tx.originalQuantity
                        : tx.quantity;
                    const txRevenue = txQuantity * tx.price;
                    const txCost = tx.stockWorth || 0;
                    const txProfit = txRevenue - txCost;

                    return (
                      <tr key={idx}>
                        <td>
                          {tx.timestampInMillisEpoch &&
                          tx.timestampInMillisEpoch.toDate
                            ? tx.timestampInMillisEpoch
                                .toDate()
                                .toLocaleDateString("id-ID")
                            : "N/A"}
                        </td>
                        <td className="center">
                          {txQuantity} {tx.originalUnit || tx.unit}
                        </td>
                        <td className="right">
                          {formatCurrency(Math.round(txRevenue))}
                        </td>
                        <td className="right">
                          {formatCurrency(Math.round(txCost))}
                        </td>
                        <td className="right">
                          {formatCurrency(Math.round(txProfit))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar for messages */}
      {snackbar.open && (
        <div className="snackbar">
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
