// src/components/ProductTable.js
import React from "react";
import { formatCurrency, convertToSmallestUnit, convertFromSmallestUnit } from "../utils/transaksiUtils";
import "../styles/ProductTable.css";

const ProductTable = ({
  products,
  productData,
  quantityInputs,
  setQuantityInputs,
  updateQuantity,
  updateSatuan,
  removeProduct
}) => {
  const handleQuantityChange = (productId, rawValue) => {
    // Allow empty input or valid decimal numbers (dot or comma)
    if (rawValue === "" || /^(\d+([.,]\d*)?)?$/.test(rawValue)) {
      setQuantityInputs((prev) => ({
        ...prev,
        [productId]: rawValue,
      }));
    }
  };

  const handleQuantityBlur = (productId, rawValue) => {
    const numericValue = parseFloat(rawValue.replace(",", "."));
    if (rawValue.trim() === "" || isNaN(numericValue) || numericValue === 0) {
      // Remove product if input is empty or 0
      removeProduct(productId);
    } else {
      updateQuantity(productId, numericValue);
      // Normalize the displayed value
      setQuantityInputs((prev) => ({
        ...prev,
        [productId]: numericValue.toString(),
      }));
    }
  };

  const handleQuantityIncrement = (productId, increment) => {
    const currentQuantity = quantityInputs[productId] !== undefined
      ? parseFloat(quantityInputs[productId].replace(',', '.'))
      : products.find(p => p.id === productId)?.quantity || 0;
    
    const newQuantity = Math.max(0, currentQuantity + increment);
    updateQuantity(productId, newQuantity);
    setQuantityInputs((prev) => ({
      ...prev,
      [productId]: newQuantity.toString(),
    }));
  };

  const getStockDisplay = (product) => {
    if (!productData[product.id]) {
      return "Loading...";
    }

    const productStockData = productData[product.id];
    const currentStock = productStockData.stock || 0;
    
    // Convert requested quantity to the smallest unit
    const requestedQty = convertToSmallestUnit(
      product.quantity,
      product.satuan,
      {
        smallestUnit: productStockData.smallestUnit,
        piecesPerBox: productStockData.piecesPerBox,
      }
    );
    
    // Convert stock back to the display unit and round to nearest integer
    const stockInDisplayUnit = Math.round(
      convertFromSmallestUnit(
        currentStock,
        product.satuan,
        {
          smallestUnit: productStockData.smallestUnit,
          piecesPerBox: productStockData.piecesPerBox,
        }
      )
    );
    
    // Check if quantity exceeds stock
    const isLowStock = requestedQty > currentStock;
    
    return (
      <span className={isLowStock ? "low-stock" : ""}>
        {stockInDisplayUnit} {product.satuan}
      </span>
    );
  };

  if (products.length === 0) {
    return (
      <div className="empty-table">
        <p>Belum ada produk dalam keranjang</p>
      </div>
    );
  }

  return (
    <div className="product-table-container">
      <table className="product-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Nama Produk</th>
            <th>Jumlah</th>
            <th>Stock</th>
            <th>Harga</th>
            <th>Subtotal</th>
            <th>Hapus</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td className="product-name-cell">{product.name}</td>
              <td>
                <div className="quantity-container">
                  <button
                    className="quantity-btn"
                    onClick={() => handleQuantityIncrement(product.id, -1)}
                  >
                    &minus;
                  </button>
                  <input
                    type="text"
                    className="quantity-input"
                    inputMode="decimal"
                    value={
                      quantityInputs[product.id] !== undefined
                        ? quantityInputs[product.id]
                        : product.quantity
                    }
                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                    onBlur={(e) => handleQuantityBlur(product.id, e.target.value.trim())}
                  />
                  <button
                    className="quantity-btn"
                    onClick={() => handleQuantityIncrement(product.id, 1)}
                  >
                    &#43;
                  </button>
                </div>
              </td>
              <td className="stock-cell">
                {getStockDisplay(product)}
              </td>
              <td className="price-cell">
                <div className="price-container">
                  <span className="price-amount">{formatCurrency(product.price)}</span>
                  <span className="price-separator">/</span>
                  <select
                    className="unit-select"
                    value={product.satuan}
                    onChange={(e) => updateSatuan(product.id, e.target.value)}
                  >
                    {product.satuanOptions.map((satuan) => (
                      <option key={satuan} value={satuan}>
                        {satuan}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="subtotal-cell">{formatCurrency(product.subtotal)}</td>
              <td>
                <button
                  className="delete-btn"
                  onClick={() => removeProduct(product.id)}
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;