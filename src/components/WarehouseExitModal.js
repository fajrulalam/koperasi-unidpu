import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import "../styles/WarehouseExitModal.css";

// Helper function for currency formatting
function formatRupiah(value) {
  if (!value) return "";
  const numeric = value.toString().replace(/\D/g, "");
  if (!numeric) return "";
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiah(value) {
  if (!value) return 0;
  const numeric = value.toString().replace(/\D/g, "");
  return parseInt(numeric, 10) || 0;
}

const WarehouseExitModal = ({
  isOpen,
  onClose,
  onSave,
  products,
  currentUser,
}) => {
  const [rows, setRows] = useState([
    {
      id: 1,
      product: null,
      quantity: "",
      unit: "",
      unitPrice: "",
      subtotal: "",
    },
    {
      id: 2,
      product: null,
      quantity: "",
      unit: "",
      unitPrice: "",
      subtotal: "",
    },
    {
      id: 3,
      product: null,
      quantity: "",
      unit: "",
      unitPrice: "",
      subtotal: "",
    },
  ]);
  const [nextId, setNextId] = useState(4);
  const [searchTerms, setSearchTerms] = useState({});
  const [showDropdowns, setShowDropdowns] = useState({});
  const [filteredProducts, setFilteredProducts] = useState({});
  const [highlightedIndex, setHighlightedIndex] = useState({});
  const [errors, setErrors] = useState({});

  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [businessType, setBusinessType] = useState("");

  const dropdownRefs = useRef({});

  // Convert products object to array for searching
  const productsArray = Object.values(products || {});

  // Handle product search
  const handleProductSearch = (rowId, searchTerm) => {
    setSearchTerms((prev) => ({ ...prev, [rowId]: searchTerm }));
    setHighlightedIndex((prev) => ({ ...prev, [rowId]: 0 }));

    if (!searchTerm.trim()) {
      setFilteredProducts((prev) => ({ ...prev, [rowId]: [] }));
      return;
    }

    const filtered = productsArray.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.itemId && product.itemId.toString().includes(searchTerm))
    );

    setFilteredProducts((prev) => ({ ...prev, [rowId]: filtered }));
  };

  // Handle product selection
  const handleProductSelect = (rowId, product) => {
    const unitPrice = product.pricePerUnit?.[product.smallestUnit] || 0;
    const formattedUnitPrice = formatRupiah(unitPrice.toString());

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              product,
              unit: product.smallestUnit,
              unitPrice: formattedUnitPrice,
              subtotal: "", // Will be calculated when quantity is entered
            }
          : row
      )
    );

    setSearchTerms((prev) => ({ ...prev, [rowId]: product.name }));
    setShowDropdowns((prev) => ({ ...prev, [rowId]: false }));
  };

  // Handle quantity change
  const handleQuantityChange = (rowId, value) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Prevent multiple decimal points
    const parts = numericValue.split(".");
    const cleanValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : numericValue;

    const row = rows.find((r) => r.id === rowId);
    if (row && row.product && cleanValue && parseFloat(cleanValue) > 0) {
      const unitPrice = parseRupiah(row.unitPrice);
      const subtotal = Math.round(parseFloat(cleanValue) * unitPrice);
      const formattedSubtotal = formatRupiah(subtotal.toString());

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                quantity: cleanValue,
                subtotal: formattedSubtotal,
              }
            : r
        )
      );
    } else {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? { ...row, quantity: cleanValue, subtotal: "" }
            : row
        )
      );
    }
  };

  // Handle unit price change
  const handleUnitPriceChange = (rowId, value) => {
    const formattedValue = formatRupiah(value);
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, unitPrice: formattedValue } : row
      )
    );

    // Auto-calculate subtotal if quantity exists
    const row = rows.find((r) => r.id === rowId);
    if (
      row &&
      row.quantity &&
      parseFloat(row.quantity) > 0 &&
      parseRupiah(formattedValue) > 0
    ) {
      const quantity = parseFloat(row.quantity);
      const unitPrice = parseRupiah(formattedValue);
      const subtotal = Math.round(quantity * unitPrice);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                unitPrice: formattedValue,
                subtotal: formatRupiah(subtotal.toString()),
              }
            : r
        )
      );
    }
  };

  // Add new row
  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        product: null,
        quantity: "",
        unit: "",
        unitPrice: "",
        subtotal: "",
      },
    ]);
    setNextId((prev) => prev + 1);
  };

  // Remove row
  const removeRow = (rowId) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((row) => row.id !== rowId));
      setSearchTerms((prev) => {
        const newTerms = { ...prev };
        delete newTerms[rowId];
        return newTerms;
      });
      setShowDropdowns((prev) => {
        const newDropdowns = { ...prev };
        delete newDropdowns[rowId];
        return newDropdowns;
      });
      setFilteredProducts((prev) => {
        const newFiltered = { ...prev };
        delete newFiltered[rowId];
        return newFiltered;
      });
    }
  };

  // Toggle dropdown
  const toggleDropdown = (rowId) => {
    setShowDropdowns((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  // Handle keyboard navigation
  const handleKeyDown = (rowId, e) => {
    const products = filteredProducts[rowId] || [];
    const currentIndex = highlightedIndex[rowId] || 0;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.min(currentIndex + 1, products.length - 1);
      setHighlightedIndex((prev) => ({ ...prev, [rowId]: newIndex }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.max(currentIndex - 1, 0);
      setHighlightedIndex((prev) => ({ ...prev, [rowId]: newIndex }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (products.length > 0 && showDropdowns[rowId]) {
        const selectedProduct = products[currentIndex];
        if (selectedProduct) {
          handleProductSelect(rowId, selectedProduct);
        }
      }
    } else if (e.key === "Escape") {
      setShowDropdowns((prev) => ({ ...prev, [rowId]: false }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Validate customer details
    if (!customerName.trim()) {
      newErrors.customerName = "Nama customer harus diisi";
    }
    if (!businessType) {
      newErrors.businessType = "Jenis bisnis harus dipilih";
    }

    // Validate rows
    rows.forEach((row) => {
      if (!row.product) {
        newErrors[`product_${row.id}`] = "Produk harus dipilih";
      }
      if (!row.quantity || row.quantity === "0") {
        newErrors[`quantity_${row.id}`] = "Jumlah harus diisi";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const validRows = rows.filter(
        (row) => row.product && row.quantity && row.subtotal
      );

      // Check stock availability first
      const stockChecks = [];
      for (const row of validRows) {
        const quantity = parseFloat(row.quantity);
        const availableStock = row.product.stock || 0;

        if (availableStock < quantity) {
          stockChecks.push({
            name: row.product.name,
            requested: quantity,
            available: availableStock,
          });
        }
      }

      if (stockChecks.length > 0) {
        const errorMessage = stockChecks
          .map(
            (item) =>
              `${item.name}: diminta ${item.requested}, tersedia ${item.available}`
          )
          .join("\n");
        alert(`Stok tidak mencukupi:\n${errorMessage}`);
        return;
      }

      // Create transaction data
      const transactionData = {
        customerDetail: {
          customerName: customerName.trim(),
          businessType,
        },
        items: validRows.map((row) => ({
          itemId: row.product.itemId || row.product.id,
          itemName: row.product.name,
          quantity: parseFloat(row.quantity),
          unit: row.unit,
          unitPrice: parseRupiah(row.unitPrice),
          subtotal: parseRupiah(row.subtotal),
        })),
        total: validRows.reduce(
          (sum, row) => sum + parseRupiah(row.subtotal),
          0
        ),
        status: "menunggu PO",
        workflow: {
          notaTagihan: { completed: true, completedAt: new Date() },
          uploadPO: { completed: false },
          uploadBuktiPembayaran: { completed: false },
        },
        createdBy: currentUser ? currentUser.email : "unknown",
      };

      await onSave(transactionData, validRows);

      // Close modal and reset
      handleClose();
    } catch (error) {
      console.error("Error processing warehouse exit:", error);
      alert("Error processing warehouse exit: " + error.message);
    }
  };

  // Handle close
  const handleClose = () => {
    setRows([
      {
        id: 1,
        product: null,
        quantity: "",
        unit: "",
        unitPrice: "",
        subtotal: "",
      },
      {
        id: 2,
        product: null,
        quantity: "",
        unit: "",
        unitPrice: "",
        subtotal: "",
      },
      {
        id: 3,
        product: null,
        quantity: "",
        unit: "",
        unitPrice: "",
        subtotal: "",
      },
    ]);
    setNextId(4);
    setSearchTerms({});
    setShowDropdowns({});
    setFilteredProducts({});
    setErrors({});
    setCustomerName("");
    setBusinessType("");
    onClose();
  };

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(dropdownRefs.current).forEach((rowId) => {
        if (
          dropdownRefs.current[rowId] &&
          !dropdownRefs.current[rowId].contains(event.target)
        ) {
          setShowDropdowns((prev) => ({ ...prev, [rowId]: false }));
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="warehouse-exit-modal-overlay">
      <div className="warehouse-exit-modal-content">
        <div className="warehouse-exit-modal-header">
          <h2>Warehouse Exit - Create New Record</h2>
          <button className="warehouse-exit-modal-close" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className="warehouse-exit-modal-body">
          {/* Customer Details Section */}
          <div className="customer-details-section">
            <h3>Customer Details</h3>
            <div className="customer-details-form">
              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  className={`form-input ${errors.customerName ? "error" : ""}`}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
                {errors.customerName && (
                  <div className="error-text">{errors.customerName}</div>
                )}
              </div>
              <div className="form-group">
                <label>Business Type *</label>
                <select
                  className={`form-input ${errors.businessType ? "error" : ""}`}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  <option value="">Select business type</option>
                  <option value="Asrama">Asrama</option>
                  <option value="MBG">MBG</option>
                </select>
                {errors.businessType && (
                  <div className="error-text">{errors.businessType}</div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table Section */}
          <div className="warehouse-exit-table-container">
            <table className="warehouse-exit-table">
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th>Jumlah</th>
                  <th>Satuan</th>
                  <th>Harga Satuan</th>
                  <th>Subtotal</th>
                  <th width="50"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`warehouse-exit-row ${
                      errors[`product_${row.id}`] ||
                      errors[`quantity_${row.id}`]
                        ? "warehouse-exit-row-error"
                        : ""
                    }`}
                  >
                    <td>
                      <div
                        className="warehouse-exit-dropdown-container"
                        ref={(el) => (dropdownRefs.current[row.id] = el)}
                      >
                        <input
                          type="text"
                          className="warehouse-exit-input"
                          placeholder="Cari produk..."
                          value={searchTerms[row.id] || ""}
                          onChange={(e) =>
                            handleProductSearch(row.id, e.target.value)
                          }
                          onFocus={() => toggleDropdown(row.id)}
                          onKeyDown={(e) => handleKeyDown(row.id, e)}
                        />
                        {showDropdowns[row.id] &&
                          (() => {
                            const rect =
                              dropdownRefs.current[
                                row.id
                              ]?.getBoundingClientRect();
                            const dropdown = (
                              <div
                                className="warehouse-exit-dropdown"
                                style={{
                                  position: "fixed",
                                  zIndex: 2147483647,
                                  backgroundColor: "white",
                                  border: "2px solid #4a90e2",
                                  borderRadius: "4px",
                                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
                                  maxHeight: "200px",
                                  overflowY: "auto",
                                  width: rect ? `${rect.width}px` : "200px",
                                  top: rect ? `${rect.bottom}px` : "0px",
                                  left: rect ? `${rect.left}px` : "0px",
                                  display: "block",
                                  visibility: "visible",
                                  minWidth: "200px",
                                }}
                              >
                                {filteredProducts[row.id]
                                  ?.slice(0, 5)
                                  .map((product, index) => {
                                    const isHighlighted =
                                      index === (highlightedIndex[row.id] || 0);
                                    return (
                                      <div
                                        key={index}
                                        className="warehouse-exit-dropdown-item"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleProductSelect(row.id, product);
                                        }}
                                        onMouseEnter={() => {
                                          setHighlightedIndex((prev) => ({
                                            ...prev,
                                            [row.id]: index,
                                          }));
                                        }}
                                        style={{
                                          padding: "12px",
                                          cursor: "pointer",
                                          borderBottom: "1px solid #f0f0f0",
                                          backgroundColor: isHighlighted
                                            ? "#e3f2fd"
                                            : "white",
                                          fontSize: "0.9rem",
                                        }}
                                      >
                                        {product.name}
                                      </div>
                                    );
                                  })}
                                {filteredProducts[row.id]?.length === 0 && (
                                  <div
                                    className="warehouse-exit-dropdown-item warehouse-exit-dropdown-empty"
                                    style={{
                                      padding: "12px",
                                      color: "#666",
                                      fontStyle: "italic",
                                      backgroundColor: "white",
                                    }}
                                  >
                                    Tidak ada produk ditemukan
                                  </div>
                                )}
                              </div>
                            );
                            return ReactDOM.createPortal(
                              dropdown,
                              document.body
                            );
                          })()}
                        {errors[`product_${row.id}`] && (
                          <div className="warehouse-exit-error-text">
                            {errors[`product_${row.id}`]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="warehouse-exit-input"
                        placeholder="Jumlah (mis: 1.5)"
                        value={row.quantity}
                        onChange={(e) =>
                          handleQuantityChange(row.id, e.target.value)
                        }
                      />
                      {errors[`quantity_${row.id}`] && (
                        <div className="warehouse-exit-error-text">
                          {errors[`quantity_${row.id}`]}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="warehouse-exit-input"
                        value={row.unit}
                        readOnly
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="warehouse-exit-input"
                        placeholder="Harga satuan"
                        value={row.unitPrice}
                        onChange={(e) =>
                          handleUnitPriceChange(row.id, e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="warehouse-exit-input"
                        value={row.subtotal ? `Rp ${row.subtotal}` : ""}
                        readOnly
                      />
                    </td>
                    <td>
                      {rows.length > 1 && (
                        <button
                          className="warehouse-exit-remove-btn"
                          onClick={() => removeRow(row.id)}
                        >
                          <FaTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="warehouse-exit-actions">
            <button className="warehouse-exit-add-btn" onClick={addRow}>
              <FaPlus /> Tambah Barang
            </button>
          </div>
        </div>

        <div className="warehouse-exit-modal-footer">
          <button className="warehouse-exit-cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button className="warehouse-exit-submit-btn" onClick={handleSubmit}>
            Create Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseExitModal;
