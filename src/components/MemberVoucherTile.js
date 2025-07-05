import React, { useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import '../styles/MemberVoucherTile.css';

const MemberVoucherTile = ({ voucher }) => {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && voucher.id) {
      try {
        JsBarcode(barcodeRef.current, voucher.id, {
          format: "CODE128",
          width: 1.5,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 0,
          background: "transparent",
          textAlign: "center",
          textPosition: "bottom",
          fontOptions: "bold"
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [voucher.id]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusText = () => {
    const now = new Date();
    const activeDate = voucher.activeDate?.toDate ? voucher.activeDate.toDate() : new Date(voucher.activeDate);
    const expireDate = voucher.expireDate?.toDate ? voucher.expireDate.toDate() : new Date(voucher.expireDate);
    
    if (voucher.isClaimed) {
      return { text: 'SUDAH DICLAIM', className: 'claimed' };
    } else if (!voucher.isActive) {
      return { text: 'TIDAK AKTIF', className: 'inactive' };
    } else if (now < activeDate) {
      return { text: 'BELUM AKTIF', className: 'pending' };
    } else if (now > expireDate) {
      return { text: 'KEDALUWARSA', className: 'expired' };
    } else {
      return { text: 'AKTIF', className: 'active' };
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const status = getStatusText();

  return (
    <div className="member-voucher-tile">
      <div className="voucher-header">
        <div className="voucher-name-section">
          <h4 className="voucher-name">{voucher.voucherName}</h4>
          <p className="voucher-value">{formatCurrency(voucher.value)}</p>
        </div>
        <div className={`voucher-status ${status.className}`}>
          {status.text}
        </div>
      </div>

      <div className="voucher-barcode-section">
        <svg ref={barcodeRef} className="voucher-barcode"></svg>
      </div>

      <div className="voucher-footer">
        <div className="voucher-date-info">
          <div className="date-item">
            <span className="date-label">Aktif sejak</span>
            <span className="date-value">
              {formatDate(voucher.activeDate)} {formatTime(voucher.activeDate)}
            </span>
          </div>
        </div>
        <div className="voucher-date-info">
          <div className="date-item">
            <span className="date-label">Kadaluarsa</span>
            <span className="date-value">
              {formatDate(voucher.expireDate)} {formatTime(voucher.expireDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberVoucherTile;