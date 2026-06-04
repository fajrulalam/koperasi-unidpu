import React, { useEffect } from "react";
import { formatCurrency } from "../services/transactionHistoryService";
import "../styles/SejarahTransaksiNew.css";

/**
 * Item Detail Dialog
 * Shows detailed transaction history for a specific item
 */
const ItemDetailDialog = ({ isOpen, onClose, item, transactions }) => {
  // Keyboard handler for Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  return (
    <div className="st-dialog-overlay" onClick={onClose}>
      <div
        className="st-dialog st-item-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-dialog-header">
          <h2>{item.itemName}</h2>
          <button className="st-dialog-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="st-dialog-body">
          <div className="st-item-details">
            <div className="st-item-detail-row">
              <span className="st-item-detail-label">Kategori:</span>
              <span className="st-item-detail-value">
                {item.kategori || "N/A"}
              </span>
            </div>
            <div className="st-item-detail-row">
              <span className="st-item-detail-label">Subkategori:</span>
              <span className="st-item-detail-value">
                {item.subKategori || "N/A"}
              </span>
            </div>
            <div className="st-item-detail-row">
              <span className="st-item-detail-label">
                Total Pendapatan:
              </span>
              <span className="st-item-detail-value">
                {formatCurrency(item.revenue)}
              </span>
            </div>
            <div className="st-item-detail-row">
              <span className="st-item-detail-label">Total Modal:</span>
              <span className="st-item-detail-value">
                {formatCurrency(item.stockWorth)}
              </span>
            </div>
            <div className="st-item-detail-row">
              <span className="st-item-detail-label">Profit Margin:</span>
              <span className="st-item-detail-value">
                {formatCurrency(item.profitMargin)}
              </span>
            </div>
          </div>

          <h3>Riwayat Transaksi</h3>
          <div className="st-tx-table-container">
            <table className="st-tx-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th className="center">Qty</th>
                  <th className="right">Pendapatan</th>
                  <th className="right">Modal</th>
                  <th className="right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
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
                        {tx.timestampInMillisEpoch?.toDate
                          ? tx.timestampInMillisEpoch
                              .toDate()
                              .toLocaleDateString("id-ID")
                          : "N/A"}
                      </td>
                      <td className="center">
                        {txQuantity} {tx.originalUnit || tx.unit}
                      </td>
                      <td className="right">{formatCurrency(txRevenue)}</td>
                      <td className="right">{formatCurrency(txCost)}</td>
                      <td className="right">{formatCurrency(txProfit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailDialog;

