import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { FaTimes, FaPlus, FaTrash, FaUpload, FaFileAlt } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { uploadFile } from "../firebase";
import "../styles/BulkPurchaseModal.css";

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

function getTimestampString() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

// Function to compress image files
function compressImage(file, quality = 0.7) {
  return new Promise((resolve) => {
    // If it's not an image, return the original file
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          // Create a new File object with the compressed blob
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        file.type,
        quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

const BulkPurchaseModal = ({
  isOpen,
  onClose,
  onSave,
  products,
  currentUser,
  collectionPrefix = "", // "stocks" or "stocks_b2b"
  transactionCollection = "stockTransactions", // "stockTransactions" or "stockTransactions_b2b"
  isWarehouse = false, // true if accessed from warehouse menu, false if from unimart
}) => {
  const [rows, setRows] = useState([
    {
      id: 1,
      product: null,
      quantity: "",
      unit: "",
      hargaSatuan: "",
      subtotal: "",
    },
    {
      id: 2,
      product: null,
      quantity: "",
      unit: "",
      hargaSatuan: "",
      subtotal: "",
    },
    {
      id: 3,
      product: null,
      quantity: "",
      unit: "",
      hargaSatuan: "",
      subtotal: "",
    },
  ]);
  const [nextId, setNextId] = useState(4);
  const [searchTerms, setSearchTerms] = useState({});
  const [showDropdowns, setShowDropdowns] = useState({});
  const [filteredProducts, setFilteredProducts] = useState({});
  const [highlightedIndex, setHighlightedIndex] = useState({});
  const [errors, setErrors] = useState({});
  const [uploadedNota, setUploadedNota] = useState(null);
  const [uploadingNota, setUploadingNota] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [adminFee, setAdminFee] = useState("10000");

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
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              product,
              unit: product.smallestUnit,
              searchTerm: product.name,
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

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, quantity: cleanValue } : row
      )
    );

    // Auto-calculate based on existing harga satuan or subtotal
    const row = rows.find((r) => r.id === rowId);
    if (row && cleanValue && parseFloat(cleanValue) > 0) {
      const quantity = parseFloat(cleanValue);

      // If harga satuan exists, calculate subtotal
      if (row.hargaSatuan && parseRupiah(row.hargaSatuan) > 0) {
        const hargaSatuan = parseRupiah(row.hargaSatuan);
        const newSubtotal = quantity * hargaSatuan;
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  quantity: cleanValue,
                  subtotal: formatRupiah(newSubtotal.toString()),
                }
              : r
          )
        );
      }
      // If subtotal exists but no harga satuan, calculate harga satuan
      else if (row.subtotal && parseRupiah(row.subtotal) > 0) {
        const subtotal = parseRupiah(row.subtotal);
        const newHargaSatuan = Math.round(subtotal / quantity);
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  quantity: cleanValue,
                  hargaSatuan: formatRupiah(newHargaSatuan.toString()),
                }
              : r
          )
        );
      }
    }
  };

  // Handle harga satuan change
  const handleHargaSatuanChange = (rowId, value) => {
    const formattedValue = formatRupiah(value);
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, hargaSatuan: formattedValue } : row
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
      const hargaSatuan = parseRupiah(formattedValue);
      const newSubtotal = quantity * hargaSatuan;

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                hargaSatuan: formattedValue,
                subtotal: formatRupiah(newSubtotal.toString()),
              }
            : r
        )
      );
    }
  };

  // Handle subtotal change
  const handleSubtotalChange = (rowId, value) => {
    const formattedValue = formatRupiah(value);
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, subtotal: formattedValue } : row
      )
    );

    // Auto-calculate harga satuan if quantity exists
    const row = rows.find((r) => r.id === rowId);
    if (
      row &&
      row.quantity &&
      parseFloat(row.quantity) > 0 &&
      parseRupiah(formattedValue) > 0
    ) {
      const quantity = parseFloat(row.quantity);
      const subtotal = parseRupiah(formattedValue);
      const newHargaSatuan = Math.round(subtotal / quantity);

      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                subtotal: formattedValue,
                hargaSatuan: formatRupiah(newHargaSatuan.toString()),
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
        hargaSatuan: "",
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

  // Handle nota upload
  const handleNotaUpload = async (file) => {
    if (!file) return;

    setUploadingNota(true);
    try {
      // Compress the file if it's an image
      const compressedFile = await compressImage(file, 0.7);

      const timestamp = getTimestampString();
      const folderPath = isWarehouse ? "warehouse" : "unimart";
      const fileName = `${timestamp}_${compressedFile.name}`;
      const filePath = `${folderPath}/notaBelanja/${fileName}`;

      const downloadURL = await uploadFile(compressedFile, filePath);

      // Store uploaded file info without saving to database yet
      setUploadedNota({
        fileName: compressedFile.name,
        downloadURL: downloadURL,
        originalFile: compressedFile,
        timestamp: timestamp,
      });
    } catch (error) {
      console.error("Error uploading nota:", error);
      alert("Error uploading nota: " + error.message);
    } finally {
      setUploadingNota(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    rows.forEach((row) => {
      if (!row.product) {
        newErrors[`product_${row.id}`] = "Produk harus dipilih";
      }
      if (!row.quantity || parseFloat(row.quantity) === 0) {
        newErrors[`quantity_${row.id}`] = "Jumlah harus diisi";
      }
      if (!row.hargaSatuan || parseRupiah(row.hargaSatuan) === 0) {
        newErrors[`hargaSatuan_${row.id}`] = "Harga satuan harus diisi";
      }
      if (!row.subtotal || parseRupiah(row.subtotal) === 0) {
        newErrors[`subtotal_${row.id}`] = "Subtotal harus diisi";
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

      // Build items array
      const items = validRows.map((row) => ({
        itemId: row.product.itemId || row.product.id,
        itemName: row.product.name,
        price: parseRupiah(row.hargaSatuan),
        quantity: parseFloat(row.quantity),
        subtotal: parseRupiah(row.subtotal),
        unit: row.unit,
      }));

      // Add admin fee as a separate item
      const adminFeeAmount = parseRupiah(adminFee);
      if (adminFeeAmount > 0) {
        items.push({
          itemId: "admin_fee",
          itemName: "Biaya Admin",
          price: -adminFeeAmount,
          quantity: 1,
          subtotal: -adminFeeAmount,
          unit: "pcs",
        });
      }

      for (const row of validRows) {
        const quantity = parseFloat(row.quantity);
        const subtotal = parseRupiah(row.subtotal);
        const hargaSatuan = parseRupiah(row.hargaSatuan);

        // Create transaction record with items array
        const transactionDoc = {
          itemId: row.product.itemId || row.product.id,
          itemName: row.product.name,
          kategori: row.product.kategori || "",
          subKategori: row.product.subKategori || "",
          unit: row.unit,
          cost: subtotal,
          quantity: quantity,
          originalQuantity: quantity,
          originalUnit: row.unit,
          transactionType: "pengadaan",
          transactionVia: "bulkPurchase",
          isDeleted: false,
          createdBy: currentUser ? currentUser.email : "unknown",
          items: items, // Add items array to transaction
        };

        const txId = uuidv4();
        await onSave("createTransaction", transactionDoc, txId);

        // Update stock
        const newStock = (row.product.stock || 0) + quantity;
        const newStockValue = (row.product.stockValue || 0) + subtotal;

        await onSave("updateStock", {
          id: row.product.id,
          stock: newStock,
          stockValue: newStockValue,
        });
      }

      // Create nota belanja record if file was uploaded
      if (uploadedNota && supplierName.trim()) {
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");

        const notaDoc = {
          fileName: uploadedNota.fileName,
          downloadURL: uploadedNota.downloadURL,
          supplierName: supplierName.trim(),
          items: items, // Include items array
          uploadedBy: {
            uid: currentUser?.uid || "unknown",
            email: currentUser?.email || "unknown",
          },
          createdAt: new Date().toISOString(),
          process: {
            notaDibuat: {
              completed: true,
              completedAt: new Date(),
            },
            transferBAK: {
              completed: false,
            },
          },
          status: "nota_dibuat",
        };

        const collectionName = isWarehouse ? "notaBelanja_b2b" : "notaBelanja";
        const docId = `${yyyy}-${mm}-${dd}_${uploadedNota.timestamp}`;

        // Save to Firestore via onSave callback
        await onSave("createNotaBelanja", notaDoc, docId, collectionName);
      }

      // Close modal and reset
      handleClose();
    } catch (error) {
      console.error("Error processing bulk purchase:", error);
      alert("Error processing bulk purchase: " + error.message);
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
        hargaSatuan: "",
        subtotal: "",
      },
      {
        id: 2,
        product: null,
        quantity: "",
        unit: "",
        hargaSatuan: "",
        subtotal: "",
      },
      {
        id: 3,
        product: null,
        quantity: "",
        unit: "",
        hargaSatuan: "",
        subtotal: "",
      },
    ]);
    setNextId(4);
    setSearchTerms({});
    setShowDropdowns({});
    setFilteredProducts({});
    setErrors({});
    setUploadedNota(null);
    setUploadingNota(false);
    setSupplierName("");
    setAdminFee("10000");
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

  // Calculate total
  const calculateTotal = () => {
    const itemsTotal = rows.reduce((total, row) => {
      if (row.subtotal && parseRupiah(row.subtotal) > 0) {
        return total + parseRupiah(row.subtotal);
      }
      return total;
    }, 0);
    
    const adminFeeAmount = parseRupiah(adminFee);
    return itemsTotal - adminFeeAmount;
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-modal-overlay">
      <div className="bulk-modal-content" style={{ overflow: "visible", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="bulk-modal-header">
          <h2>Bulk Purchase</h2>
          <button className="bulk-modal-close" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className="bulk-modal-body" style={{ overflow: "auto", flex: 1, padding: "20px" }}>
          {/* Nota Upload Section */}
          <div className="nota-upload-section">
            <div className="nota-upload-header">
              <h3>Upload Nota dari Supplier</h3>
              <p>
                Upload nota pembelian dari supplier. Nama supplier dapat diisi setelah upload.
              </p>
            </div>

            {/* Supplier Name Input */}
            <div className="supplier-input-container">
              <label className="supplier-label">
                Nama Supplier {uploadedNota && <span className="required">*</span>}
              </label>
              <input
                type="text"
                className="supplier-input"
                placeholder="Masukkan nama supplier..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
              {uploadedNota && !supplierName.trim() && (
                <div className="supplier-warning">
                  Nama supplier diperlukan untuk menyimpan nota yang sudah diupload
                </div>
              )}
            </div>

            <div className="nota-upload-container">
              {uploadedNota ? (
                <div className="nota-uploaded">
                  <FaFileAlt className="nota-file-icon" />
                  <div className="nota-file-info">
                    <span className="nota-file-name">
                      {uploadedNota.fileName}
                    </span>
                    <span className="nota-upload-status">
                      ✅ File berhasil diupload
                    </span>
                    {supplierName.trim() && (
                      <span className="nota-supplier-name">
                        Supplier: {supplierName.trim()}
                      </span>
                    )}
                  </div>
                  <div className="nota-actions">
                    <button
                      className="nota-view-btn"
                      onClick={() =>
                        window.open(uploadedNota.downloadURL, "_blank")
                      }
                    >
                      Lihat File
                    </button>
                    <button
                      className="nota-remove-btn"
                      onClick={() => setUploadedNota(null)}
                      title="Hapus file"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <label className="nota-upload-btn">
                  {uploadingNota ? (
                    <>
                      <div className="loading-spinner"></div>
                      Mengunggah...
                    </>
                  ) : (
                    <>
                      <FaUpload />
                      Upload Nota Supplier
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleNotaUpload(e.target.files[0]);
                      }
                    }}
                    disabled={uploadingNota}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="bulk-table-container" style={{ overflow: "visible" }}>
            <table className="bulk-table">
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
                    className={`bulk-row ${
                      errors[`product_${row.id}`] ||
                      errors[`quantity_${row.id}`] ||
                      errors[`hargaSatuan_${row.id}`] ||
                      errors[`subtotal_${row.id}`]
                        ? "bulk-row-error"
                        : ""
                    }`}
                  >
                    <td style={{ position: "relative", overflow: "visible" }}>
                      <div
                        className="bulk-dropdown-container"
                        ref={(el) => (dropdownRefs.current[row.id] = el)}
                        style={{ position: "relative", zIndex: 2147483646 }}
                      >
                        <input
                          type="text"
                          className="bulk-input"
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
                                className="bulk-dropdown"
                                style={{
                                  position: "fixed",
                                  zIndex: 2147483647,
                                  backgroundColor: "white",
                                  border: "2px solid #007bff",
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
                                        className="bulk-dropdown-item"
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
                                          padding: "8px 12px",
                                          cursor: "pointer",
                                          borderBottom: "1px solid #eee",
                                          backgroundColor: isHighlighted
                                            ? "#e3f2fd"
                                            : "white",
                                          color: "#333",
                                          fontSize: "14px",
                                        }}
                                      >
                                        {product.name}
                                      </div>
                                    );
                                  })}
                                {filteredProducts[row.id]?.length === 0 && (
                                  <div
                                    className="bulk-dropdown-item bulk-dropdown-empty"
                                    style={{
                                      padding: "8px 12px",
                                      color: "#999",
                                      fontSize: "14px",
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
                          <div className="bulk-error-text">
                            {errors[`product_${row.id}`]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="bulk-input"
                        placeholder="Jumlah (mis: 1.5)"
                        value={row.quantity}
                        onChange={(e) =>
                          handleQuantityChange(row.id, e.target.value)
                        }
                      />
                      {errors[`quantity_${row.id}`] && (
                        <div className="bulk-error-text">
                          {errors[`quantity_${row.id}`]}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="bulk-input"
                        value={row.unit}
                        readOnly
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="bulk-input"
                        placeholder="Harga per satuan"
                        value={row.hargaSatuan}
                        onChange={(e) =>
                          handleHargaSatuanChange(row.id, e.target.value)
                        }
                      />
                      {errors[`hargaSatuan_${row.id}`] && (
                        <div className="bulk-error-text">
                          {errors[`hargaSatuan_${row.id}`]}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="bulk-input"
                        placeholder="Total harga"
                        value={row.subtotal}
                        onChange={(e) =>
                          handleSubtotalChange(row.id, e.target.value)
                        }
                      />
                      {errors[`subtotal_${row.id}`] && (
                        <div className="bulk-error-text">
                          {errors[`subtotal_${row.id}`]}
                        </div>
                      )}
                    </td>
                    <td>
                      {rows.length > 1 && (
                        <button
                          className="bulk-remove-btn"
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

          <div className="bulk-actions">
            <button className="bulk-add-btn" onClick={addRow}>
              <FaPlus /> Tambah Barang
            </button>
          </div>

          {/* Admin Fee and Total Section */}
          <div className="bulk-summary-section">
            <div className="admin-fee-container">
              <label className="admin-fee-label">
                Biaya Admin (IDR):
              </label>
              <input
                type="text"
                className="admin-fee-input"
                placeholder="10000"
                value={adminFee}
                onChange={(e) => setAdminFee(formatRupiah(e.target.value))}
              />
            </div>
            
            <div className="total-calculation">
              <div className="total-row">
                <span>Subtotal Barang:</span>
                <span>Rp {formatRupiah(rows.reduce((total, row) => {
                  if (row.subtotal && parseRupiah(row.subtotal) > 0) {
                    return total + parseRupiah(row.subtotal);
                  }
                  return total;
                }, 0).toString())}</span>
              </div>
              <div className="total-row admin-fee-row">
                <span>Biaya Admin:</span>
                <span>- Rp {formatRupiah(adminFee)}</span>
              </div>
              <div className="total-row final-total">
                <span><strong>Total:</strong></span>
                <span><strong>Rp {formatRupiah(calculateTotal().toString())}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="bulk-modal-footer">
          <button className="bulk-cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button className="bulk-submit-btn" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPurchaseModal;
