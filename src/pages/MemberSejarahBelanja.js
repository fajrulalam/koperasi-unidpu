// src/pages/MemberSejarahBelanja.js
import React from "react";
import useMemberSejarahBelanja from "./hooks/useMemberSejarahBelanja";

const MemberSejarahBelanja = ({ userData, setActivePage }) => {
  const {
    transactions,
    loading,
    error,
    expandedTx,
    startDate,
    endDate,
    toggleExpand,
    handleDateChange,
    formatCurrency,
    formatDate,
    formatTime,
  } = useMemberSejarahBelanja(userData);

  return (
    <div className="member-content">
      <h2 className="page-title">Sejarah Belanja</h2>
      {setActivePage && (
        <button className="back-link" onClick={() => setActivePage("beranda")}>
          ← Kembali
        </button>
      )}

      {/* Date Filter */}
      <div className="info-card">
        <div className="filter-section">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Dari Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => handleDateChange("start", e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Sampai Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => handleDateChange("end", e.target.value)}
              />
            </div>
          </div>
          <p className="filter-note">Maksimal rentang 30 hari</p>
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Loading State */}
      {loading && <div className="loading-message">Memuat data...</div>}

      {/* Empty State */}
      {!loading && !error && transactions.length === 0 && (
        <div className="info-card">
          <div className="no-transactions">
            <p>Tidak ada transaksi dalam rentang tanggal ini.</p>
          </div>
        </div>
      )}

      {/* Transaction List */}
      {!loading && !error && transactions.length > 0 && (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className={`tx-card ${expandedTx === tx.id ? "expanded" : ""}`}
            >
              <div className="tx-header" onClick={() => toggleExpand(tx.id)}>
                <div className="tx-info">
                  <div className="tx-date">{formatDate(tx.updatedAt)}</div>
                  <div className="tx-time">{formatTime(tx.updatedAt)}</div>
                </div>
                <div className="tx-summary">
                  <div className="tx-total">{formatCurrency(tx.total)}</div>
                  <div className="tx-items-count">
                    {tx.items?.length || 0} item
                  </div>
                </div>
                <div className="tx-chevron">
                  {expandedTx === tx.id ? "▲" : "▼"}
                </div>
              </div>

              {expandedTx === tx.id && (
                <div className="tx-details">
                  <div className="tx-items-list">
                    {tx.items?.map((item, idx) => (
                      <div key={idx} className="tx-item">
                        <div className="tx-item-name">{item.itemName}</div>
                        <div className="tx-item-qty">
                          {item.quantity} {item.unit}
                        </div>
                        <div className="tx-item-price">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {tx.voucherDiscount && tx.voucherDiscount > 0 && (
                    <div className="tx-voucher">
                      <span className="tx-voucher-label">Diskon Voucher</span>
                      <span className="tx-voucher-value">
                        -{formatCurrency(tx.voucherDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="tx-footer">
                    <div className="tx-total-row">
                      <span className="tx-total-label">Total</span>
                      <span className="tx-total-value">
                        {formatCurrency(tx.total)}
                      </span>
                    </div>
                    {tx.userPoints > 0 && (
                      <div className="tx-points">
                        +{tx.userPoints.toLocaleString("id-ID")} poin
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {/* {!loading && !error && transactions.length > 0 && (
        <div className="info-card summary-card">
          <h4 className="section-title">Ringkasan</h4>
          <div className="summary-row">
            <span>Total Transaksi</span>
            <span className="summary-value">{transactions.length}</span>
          </div>
          <div className="summary-row">
            <span>Total Belanja</span>
            <span className="summary-value">
              {formatCurrency(
                transactions.reduce((sum, tx) => sum + (tx.total || 0), 0)
              )}
            </span>
          </div>
          <div className="summary-row">
            <span>Total Poin</span>
            <span className="summary-value points">
              +{transactions
                .reduce((sum, tx) => sum + (tx.userPoints || 0), 0)
                .toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default MemberSejarahBelanja;
