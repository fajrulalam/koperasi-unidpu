import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import '../styles/BarcodeExpandedView.css';

const BarcodeExpandedView = ({ isOpen, onClose, voucher }) => {
  const barcodeRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Generate barcode with larger dimensions
  useEffect(() => {
    if (isOpen && barcodeRef.current && voucher?.id) {
      try {
        // Use larger dimensions for better scanner readability
        JsBarcode(barcodeRef.current, voucher.id, {
          format: "CODE128",
          width: isMobile ? 3.5 : 3,     // Wider on mobile
          height: isMobile ? 280 : 150,   // Much higher on mobile for vertical orientation
          displayValue: true,
          fontSize: isMobile ? 20 : 18,   // Larger font on mobile
          margin: isMobile ? 20 : 15,     // More margin on mobile
          background: "transparent",
          textAlign: "center",
          textPosition: "bottom",
          fontOptions: "bold"
        });
      } catch (error) {
        console.error('Error generating expanded barcode:', error);
      }
    }
  }, [isOpen, voucher, isMobile]);
  
  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  if (!isOpen || !voucher) return null;
  
  return (
    <div className={`barcode-expanded-overlay ${isMobile ? 'mobile' : 'desktop'}`} onClick={onClose}>
      <div 
        className={`barcode-expanded-container ${isMobile ? 'bottom-sheet' : 'modal'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="barcode-expanded-header">
          <h3>{voucher.voucherName}</h3>
          <span className="barcode-value">{formatCurrency(voucher.value)}</span>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className={`barcode-expanded-content ${isMobile ? 'vertical' : 'horizontal'}`}>
          <svg ref={barcodeRef} className="expanded-barcode"></svg>
        </div>
        
        <div className="barcode-expanded-footer">
          <p className="scan-instructions">Tunjukkan barcode ini untuk dipindai</p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeExpandedView;
