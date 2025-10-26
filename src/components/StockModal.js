import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/StockModal.css";

// Helper functions
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

// Constants for category lists
const KATEGORI_CHOICES = [
  "Makanan",
  "Minuman",
  "Sembako",
  "ATK",
  "Perawatan Diri",
  "Kesehatan",
  "Lainnya",
];

const SUBKATEGORI_MAKANAN = [
  "Makanan Ringan",
  "Makanan Siap Saji",
  "Bumbu",
  "Makanan Manis",
    "Roti & Kue",
  "Lainnya",
];

const SUBKATEGORI_PERAWATAN_DIRI = [
    "Kebersihan Tubuh",
    "Perawatan Rambut",
    "Mulut & Gigi",
    "Kewanitaan",
    "Lainnya",
];

const SUBKATEGORI_MINUMAN = [
  "Susu",
  "Soda",
  "Jus/Sari Buah",
  "Air Mineral",
  "Teh",
  "Kopi",
    "Saset/Serbuk",
  "Lainnya",
];

const SUBKATEGORI_KESEHATAN = [
  "Obat-Obatan",
  "Suplemen",
  "Alat Kesehatan",
  "Antiseptik",
  "Lainnya",
];

const SUBKATEGORI_ATK = [
    "Pulpen",
    "Pensil",
    "Buku",
    "Stipo",
    "Penghapus",
    "Kertas",
    "Lainnya",
];

const TIPE_STOCK_CHOICES = ["Produksi Sendiri", "Kulak", "Titipan", "Supplier/Sales", "Lainnya"];
const NAMA_PEMASOK_CHOICES = ["Nabati", "Mayorca", "Pocari", "Fruitea (Sosro)", "Kulkul", "Yarno Mineral", "Nestle", "Gerry", "Lainnya"];
const SMALLEST_UNITS = ["pcs", "gram", "ons", "kg"];
const ALT_UNITS = ["box", "kg", "kwintal", "ton", "ons"];

function StockModal({ 
  dialogOpen,
  dialogType,
  selectedProductId,
  products,
  onClose,
  onSave,
  tempState: externalTempState,
  setTempState: externalSetTempState,
  convertToSmallestUnit
}) {
  // Local state for form values
  const [localState, setLocalState] = useState({
    tempName: externalTempState.tempName || "",
    tempItemId: externalTempState.tempItemId || "",
    tempKategori: externalTempState.tempKategori || "",
    tempSubKategori: externalTempState.tempSubKategori || "",
    tempTipeStock: externalTempState.tempTipeStock || "",
      tempNamaPemasok: externalTempState.tempNamaPemasok || "",
    tempDefaultSatuan: externalTempState.tempDefaultSatuan || "",
    tempAltSatuan: [...(externalTempState.tempAltSatuan || [])],
    tempPricePerUnit: { ...(externalTempState.tempPricePerUnit || {}) },
    tempAmount: externalTempState.tempAmount || "",
    tempSatuan: externalTempState.tempSatuan || "",
    tempCost: externalTempState.tempCost || "",
    piecesPerBox: externalTempState.piecesPerBox || "",
    tempDocId: externalTempState.tempDocId || "",
    originalSmallestUnit: externalTempState.originalSmallestUnit || ""
  });

  // Sync external state with local state when props change
  useEffect(() => {
    setLocalState({
      tempName: externalTempState.tempName || "",
      tempItemId: externalTempState.tempItemId || "",
      tempKategori: externalTempState.tempKategori || "",
      tempSubKategori: externalTempState.tempSubKategori || "",
      tempTipeStock: externalTempState.tempTipeStock || "",
        tempNamaPemasok: externalTempState.tempNamaPemasok || "",
      tempDefaultSatuan: externalTempState.tempDefaultSatuan || "",
      tempAltSatuan: [...(externalTempState.tempAltSatuan || [])],
      tempPricePerUnit: { ...(externalTempState.tempPricePerUnit || {}) },
      tempAmount: externalTempState.tempAmount || "",
      tempSatuan: externalTempState.tempSatuan || "",
      tempCost: externalTempState.tempCost || "",
      piecesPerBox: externalTempState.piecesPerBox || "",
      tempDocId: externalTempState.tempDocId || "",
      originalSmallestUnit: externalTempState.originalSmallestUnit || ""
    });
  }, [externalTempState, dialogType, selectedProductId]);

  // Update parent state whenever local state changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      externalSetTempState(localState);
    }, 100);
    
    return () => {
      clearTimeout(handler);
    };
  }, [localState, externalSetTempState]);
  
  // Simple form validation state
  const [formErrors, setFormErrors] = useState({});
  
  // Validate form before save
  const validateForm = (type) => {
    const errors = {};
    
    if (type === "addNew" || type === "edit") {
      if (!localState.tempName.trim()) errors.tempName = "Nama barang wajib diisi";
      if (!localState.tempKategori) errors.tempKategori = "Kategori wajib dipilih";
      if (!localState.tempTipeStock) errors.tempTipeStock = "Tipe stock wajib dipilih";
      if (!localState.tempDefaultSatuan) errors.tempDefaultSatuan = "Unit terkecil wajib dipilih";
      
      // Validate box conversion if box is selected
      if (boxIsSelected && !localState.piecesPerBox) {
        errors.piecesPerBox = "Jumlah per box wajib diisi";
      }
    }
    
    if (type === "tambah" || type === "tetapkan") {
      if (localState.tempAmount === "" || localState.tempAmount == null) errors.tempAmount = "Jumlah wajib diisi";
      if (!localState.tempSatuan) errors.tempSatuan = "Satuan wajib dipilih";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const { currentUser } = useAuth();
  const firstFieldRef = useRef(null);

  // Focus on the first field when the modal opens
  useEffect(() => {
    if (dialogOpen && firstFieldRef.current) {
      setTimeout(() => {
        if (firstFieldRef.current) {
          firstFieldRef.current.focus();
        }
      }, 100);
    }
  }, [dialogOpen, dialogType]);
  
  // Close modal when Escape key is pressed
  useEffect(() => {
    function handleEsc(e) {
      if (dialogOpen && e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [dialogOpen, onClose]);

  // Check if box is selected in any of the satuan fields
  const boxIsSelected = 
    localState.tempDefaultSatuan === "box" || 
    localState.tempAltSatuan.includes("box");

  // Handle amount change with numeric formatting
  function handleAmountChange(e) {
    const numericValue = e.target.value.replace(/\D/g, "");
    setLocalState(prev => ({
      ...prev,
      tempAmount: numericValue
    }));
  }

  // Handle cost change with Rupiah formatting
  function handleCostChange(e) {
    const numericValue = e.target.value.replace(/\D/g, "");
    setLocalState(prev => ({
      ...prev,
      tempCost: formatRupiah(numericValue)
    }));
  }

  // Handle pieces per box change
  function handlePiecesPerBoxChange(e) {
    const numeric = e.target.value.replace(/\D/g, "");
    setLocalState(prev => ({
      ...prev,
      piecesPerBox: numeric
    }));
  }

  // Handle toggling alternate units
  function handleToggleAltSatuan(unit) {
    if (unit === localState.tempDefaultSatuan) return; // Prevent adding default satuan
    
    // Update local state
    setLocalState(prev => {
      const updatedTempAltSatuan = prev.tempAltSatuan.includes(unit)
        ? prev.tempAltSatuan.filter(u => u !== unit)
        : [...prev.tempAltSatuan, unit];
        
      return {
        ...prev,
        tempAltSatuan: updatedTempAltSatuan
      };
    });
  }

  // Handle price change per unit
  function handlePriceChange(unit, val) {
    try {
      // Allow only numeric input first
      const numericValue = val.replace(/\D/g, "");
      
      // Format the number
      const formatted = numericValue ? formatRupiah(numericValue) : "";
      
      // Update the local state
      setLocalState(prev => {
        const newPricePerUnit = {
          ...prev.tempPricePerUnit,
          [unit]: formatted
        };
        
        return {
          ...prev,
          tempPricePerUnit: newPricePerUnit
        };
      });
    } catch (error) {
      console.error(`Error updating price for ${unit}:`, error);
    }
  }

  // Handler for kategori change
  function handleKategoriChange(e) {
    const kategori = e.target.value;
    let subKategori = localState.tempSubKategori;

    // Auto-set subKategori if it's not a special kategori
    if (
      kategori !== "Makanan" &&
      kategori !== "Minuman" &&
      kategori !== "Kesehatan"
    ) {
      subKategori = kategori;
    } else {
      subKategori = "";
    }

    setLocalState(prev => ({
      ...prev,
      tempKategori: kategori,
      tempSubKategori: subKategori
    }));
  }

  // Get sub-kategori choices based on selected kategori
  let subKategoriChoices = [];
  if (localState.tempKategori === "Makanan") {
    subKategoriChoices = SUBKATEGORI_MAKANAN;
  } else if (localState.tempKategori === "Minuman") {
    subKategoriChoices = SUBKATEGORI_MINUMAN;
  } else if (localState.tempKategori === "Kesehatan") {
    subKategoriChoices = SUBKATEGORI_KESEHATAN;
  } else if (localState.tempKategori === "Perawatan Diri") {
      subKategoriChoices = SUBKATEGORI_PERAWATAN_DIRI;
  } else if (localState.tempKategori === "ATK") {
      subKategoriChoices = SUBKATEGORI_ATK;
  }

  // Delete Confirmation Dialog
  if (dialogType === "delete" && selectedProductId) {
    return (
      <div className="stockmodal-overlay">
        <div className="stockmodal-content">
          <h2>Delete Stock</h2>
          <div className="stockmodal-body">
            <p>Yakin mau delete {products[selectedProductId]?.name}?</p>
          </div>
          <div className="stockmodal-buttons">
            <button onClick={onClose}>No</button>
            <button onClick={() => onSave("delete")}>Yes</button>
          </div>
        </div>
      </div>
    );
  }

  // Add New Stock Modal
  if (dialogType === "addNew") {
    return (
      <div className="stockmodal-overlay">
        <div className="stockmodal-content">
          <h2>Tambah Barang Baru</h2>
          <div className="stockmodal-body">
            <div className="form-group">
              <label>Nama Barang</label>
              <input
                ref={firstFieldRef}
                type="text"
                value={localState.tempName}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempName: e.target.value
                }))}
                className={formErrors.tempName ? "error" : ""}
              />
              {formErrors.tempName && <div className="error-message">{formErrors.tempName}</div>}
            </div>
            <div className="form-group">
              <label>Doc ID (optional)</label>
              <input
                type="text"
                value={localState.tempDocId}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempDocId: e.target.value
                }))}
              />
            </div>
            <div className="form-group">
              <label>Kategori</label>
              <select
                value={localState.tempKategori}
                onChange={handleKategoriChange}
                className={formErrors.tempKategori ? "error" : ""}
              >
                {formErrors.tempKategori && <div className="error-message">{formErrors.tempKategori}</div>}
                <option value="">-- Pilih Kategori --</option>
                {KATEGORI_CHOICES.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>
            {localState.tempKategori === "Makanan" ||
            localState.tempKategori === "Minuman" ||
            localState.tempKategori === "Perawatan Diri" ||
            localState.tempKategori === "ATK" ||
            localState.tempKategori === "Kesehatan" ? (
              <div className="form-group">
                <label>Sub Kategori</label>
                <select
                  value={localState.tempSubKategori}
                  onChange={(e) => setLocalState(prev => ({
                    ...prev,
                    tempSubKategori: e.target.value
                  }))}
                >
                  <option value="">-- Pilih SubKategori --</option>
                  {subKategoriChoices.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Sub Kategori</label>
                <input type="text" value={localState.tempSubKategori} readOnly />
              </div>
            )}
            <div className="form-group">
              <label>Sumber Pasokan</label>
              <select
                value={localState.tempTipeStock}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempTipeStock: e.target.value
                }))}
                className={formErrors.tempTipeStock ? "error" : ""}
              >
                {formErrors.tempTipeStock && <div className="error-message">{formErrors.tempTipeStock}</div>}
                <option value="">-- Pilih Sumber Pemasok --</option>
                {TIPE_STOCK_CHOICES.map((tipe) => (
                  <option key={tipe} value={tipe}>
                    {tipe}
                  </option>
                ))}
              </select>
            </div>
              <div className="form-group">
                  <label>Nama Pemasok</label>
                  <select
                      value={localState.tempNamaPemasok}
                      onChange={(e) => setLocalState(prev => ({
                          ...prev,
                          tempNamaPemasok: e.target.value
                      }))}
                      className={formErrors.tempNamaPemasok ? "error" : ""}
                  >
                      {formErrors.tempNamaPemasok && <div className="error-message">{formErrors.tempTipeStock}</div>}
                      <option value="">-- Pilih Nama Pemasok --</option>
                      {NAMA_PEMASOK_CHOICES.map((tipe) => (
                          <option key={tipe} value={tipe}>
                              {tipe}
                          </option>
                      ))}
                  </select>
              </div>
            <div className="form-group">
              <label>Unit Terkecil (Wajib)</label>
              <select
                value={localState.tempDefaultSatuan}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempDefaultSatuan: e.target.value
                }))}
                className={formErrors.tempDefaultSatuan ? "error" : ""}
                required
              >
                {formErrors.tempDefaultSatuan && <div className="error-message">{formErrors.tempDefaultSatuan}</div>}
                <option value="">-- Pilih Unit Terkecil --</option>
                {SMALLEST_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Satuan Alternatif (Opsional)</label>
              <div className="checkbox-group">
                {ALT_UNITS.filter((unit) => unit !== localState.tempDefaultSatuan).map(
                  (unit) => {
                    const selected = localState.tempAltSatuan.includes(unit);
                    return (
                      <button
                        type="button"
                        key={unit}
                        className={`pseudo-checkbox ${selected ? "selected" : ""}`}
                        onClick={() => handleToggleAltSatuan(unit)}
                      >
                        {unit}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
            {localState.tempAltSatuan.includes("box") && (
              <div className="form-group">
                <label>Pieces per Box</label>
                <input
                  type="number"
                  value={localState.piecesPerBox}
                  onChange={handlePiecesPerBoxChange}
                  placeholder="e.g. 10"
                  min="1"
                  className={formErrors.piecesPerBox ? "error" : ""}
                  required
                />
                {formErrors.piecesPerBox && <div className="error-message">{formErrors.piecesPerBox}</div>}
              </div>
            )}
            <div className="form-group">
              <label>Harga Jual per Satuan</label>
              <div className="price-field-list">
                {Array.from(
                  new Set(
                    [localState.tempDefaultSatuan, ...localState.tempAltSatuan].filter(Boolean)
                  )
                ).map((u) => (
                  <div key={u} className="price-field">
                    <span>{u}:</span>
                    <input
                      type="text"
                      value={localState.tempPricePerUnit[u] || ""}
                      onChange={(e) => handlePriceChange(u, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="e.g. 10.000"
                      inputMode="numeric"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stockmodal-buttons">
            <button onClick={onClose}>Batal</button>
            <button onClick={() => {
              if (validateForm("addNew")) {
                onSave("addNew");
              }
            }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  }

  // Edit Stock Modal
  if (dialogType === "edit" && selectedProductId && products[selectedProductId]) {
    return (
      <div className="stockmodal-overlay">
        <div className="stockmodal-content">
          <h2>Edit Stock</h2>
          <div className="stockmodal-body">
            <div className="form-group">
              <label>Nama Barang</label>
              <input
                ref={firstFieldRef}
                type="text"
                value={localState.tempName}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempName: e.target.value
                }))}
                className={formErrors.tempName ? "error" : ""}
              />
              {formErrors.tempName && <div className="error-message">{formErrors.tempName}</div>}
            </div>
            <div className="form-group">
              <label>Item ID (Barcode)</label>
              <input
                type="text"
                value={localState.tempItemId}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempItemId: e.target.value
                }))}
                placeholder="Enter barcode ID"
              />
            </div>
            <div className="form-group">
              <label>Kategori</label>
              <select
                value={localState.tempKategori}
                onChange={handleKategoriChange}
                className={formErrors.tempKategori ? "error" : ""}
              >
                {formErrors.tempKategori && <div className="error-message">{formErrors.tempKategori}</div>}
                <option value="">-- Pilih Kategori --</option>
                {KATEGORI_CHOICES.map((kat) => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            </div>
            {localState.tempKategori === "Makanan" ||
            localState.tempKategori === "Minuman" ||
            localState.tempKategori === "Perawatan Diri" ||
            localState.tempKategori === "ATK" ||
            localState.tempKategori === "Kesehatan" ? (
              <div className="form-group">
                <label>Sub Kategori</label>
                <select
                  value={localState.tempSubKategori}
                  onChange={(e) => setLocalState(prev => ({
                    ...prev,
                    tempSubKategori: e.target.value
                  }))}
                >
                  <option value="">-- Pilih SubKategori --</option>
                  {subKategoriChoices.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Sub Kategori</label>
                <input type="text" value={localState.tempSubKategori} readOnly />
              </div>
            )}
            <div className="form-group">
              <label>Sumber Pasokan</label>
              <select
                value={localState.tempTipeStock}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempTipeStock: e.target.value
                }))}
                className={formErrors.tempTipeStock ? "error" : ""}
              >
                {formErrors.tempTipeStock && <div className="error-message">{formErrors.tempTipeStock}</div>}
                <option value="">-- Pilih Tipe --</option>
                {TIPE_STOCK_CHOICES.map((tipe) => (
                  <option key={tipe} value={tipe}>{tipe}</option>
                ))}
              </select>
            </div>
              <div className="form-group">
                  <label>Nama Pemasok</label>
                  <select
                      value={localState.tempNamaPemasok}
                      onChange={(e) => setLocalState(prev => ({
                          ...prev,
                          tempNamaPemasok: e.target.value
                      }))}
                      className={formErrors.tempNamaPemasok ? "error" : ""}
                  >
                      {formErrors.tempNamaPemasok && <div className="error-message">{formErrors.tempTipeStock}</div>}
                      <option value="">-- Pilih Nama Pemasok --</option>
                      {NAMA_PEMASOK_CHOICES.map((tipe) => (
                          <option key={tipe} value={tipe}>
                              {tipe}
                          </option>
                      ))}
                  </select>
              </div>
            <div className="form-group">
              <label>Satuan Terkecil (Wajib)</label>
              <select
                value={localState.tempDefaultSatuan}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempDefaultSatuan: e.target.value
                }))}
                className={formErrors.tempDefaultSatuan ? "error" : ""}
                required
              >
                {formErrors.tempDefaultSatuan && <div className="error-message">{formErrors.tempDefaultSatuan}</div>}
                <option value="">-- Pilih Satuan Terkecil --</option>
                {SMALLEST_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Satuan Alternatif (Opsional)</label>
              <div className="checkbox-group">
                {ALT_UNITS.filter((unit) => unit !== localState.tempDefaultSatuan).map(
                  (unit) => {
                    const selected = localState.tempAltSatuan.includes(unit);
                    return (
                      <button
                        type="button"
                        key={unit}
                        className={`pseudo-checkbox ${selected ? "selected" : ""}`}
                        onClick={() => handleToggleAltSatuan(unit)}
                      >
                        {unit}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
            {boxIsSelected && (
              <div className="form-group">
                <label>Pieces per Box</label>
                <input
                  type="text"
                  value={localState.piecesPerBox}
                  onChange={handlePiecesPerBoxChange}
                  placeholder="e.g. 10"
                />
              </div>
            )}
            <div className="form-group">
              <label>Harga per Unit</label>
              <div className="price-field-list">
                {Array.from(
                  new Set(
                    [localState.tempDefaultSatuan, ...localState.tempAltSatuan].filter(Boolean)
                  )
                ).map((u) => (
                  <div key={u} className="price-field">
                    <span>{u}:</span>
                    <input
                      type="text"
                      value={localState.tempPricePerUnit[u] || ""}
                      onChange={(e) => handlePriceChange(u, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="e.g. 10.000"
                      inputMode="numeric"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stockmodal-buttons">
            <button onClick={onClose}>Batal</button>
            <button onClick={() => {
              if (validateForm("edit")) {
                onSave("edit");
              }
            }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  }

  // Tambah Stock Modal
  if (dialogType === "tambah" && selectedProductId && products[selectedProductId]) {
    return (
      <div className="stockmodal-overlay">
        <div className="stockmodal-content">
          <h2>Tambah Stok</h2>
          <div className="stockmodal-body">
            {products[selectedProductId]?.satuan?.includes("box") && (
              <p>
                <b>Pieces/Box:</b> {products[selectedProductId].piecesPerBox}
              </p>
            )}
            <div className="form-group">
              <label>Jumlah dan Satuan</label>
              <div className="input-group">
                <input
                  ref={firstFieldRef}
                  type="text"
                  value={localState.tempAmount}
                  onChange={handleAmountChange}
                  className={`quantity-input ${formErrors.tempAmount ? "error" : ""}`}
                  placeholder="Jumlah"
                />
                {formErrors.tempAmount && <div className="error-message">{formErrors.tempAmount}</div>}
                <select
                  value={localState.tempSatuan}
                  onChange={(e) => setLocalState(prev => ({
                    ...prev,
                    tempSatuan: e.target.value
                  }))}
                  className={`unit-select ${formErrors.tempSatuan ? "error" : ""}`}
                >
                  {formErrors.tempSatuan && <div className="error-message">{formErrors.tempSatuan}</div>}
                  {(products[selectedProductId]?.satuan || []).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Total Harga Kulak (Rp)</label>
              <div className="currency-input">
                <span className="currency-prefix"></span>
                <input
                  type="text"
                  value={localState.tempCost}
                  onChange={handleCostChange}
                  placeholder=""
                />
              </div>
            </div>
          </div>
          <div className="stockmodal-buttons">
            <button onClick={onClose}>Batal</button>
            <button onClick={() => {
              if (validateForm("tambah")) {
                onSave("tambah");
              }
            }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  }

  // Tetapkan Stock Modal
  if (dialogType === "tetapkan" && selectedProductId && products[selectedProductId]) {
    return (
      <div className="stockmodal-overlay">
        <div className="stockmodal-content">
          <h2>Tetapkan Stok</h2>
          <div className="stockmodal-body">
            {products[selectedProductId].satuan.includes("box") && (
              <p>
                <b>Pieces/Box:</b> {products[selectedProductId].piecesPerBox}
              </p>
            )}
            <div className="form-group">
              <label>Jumlah</label>
              <input
                ref={firstFieldRef}
                type="text"
                value={localState.tempAmount}
                onChange={handleAmountChange}
                className={formErrors.tempAmount ? "error" : ""}
              />
              {formErrors.tempAmount && <div className="error-message">{formErrors.tempAmount}</div>}
            </div>
            <div className="form-group">
              <label>Satuan</label>
              <select
                value={localState.tempSatuan}
                onChange={(e) => setLocalState(prev => ({
                  ...prev,
                  tempSatuan: e.target.value
                }))}
                className={formErrors.tempSatuan ? "error" : ""}
              >
                {formErrors.tempSatuan && <div className="error-message">{formErrors.tempSatuan}</div>}
                {products[selectedProductId].satuan.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Harga Pembelian (Rp)</label>
              <input
                type="text"
                value={localState.tempCost}
                onChange={handleCostChange}
              />
            </div>
          </div>
          <div className="stockmodal-buttons">
            <button onClick={onClose}>Batal</button>
            <button onClick={() => {
              if (validateForm("tetapkan")) {
                onSave("tetapkan");
              }
            }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  }

  // Return null if dialogType is not recognized or dialog should be closed
  return null;
}

export default StockModal;