import React from "react";
import "../styles/NominalTabunganTooltip.css";

const NominalTabunganTooltip = ({ 
  isVisible, 
  position, 
  nextPaymentAmount, 
  nextPaymentDate, 
  nextPaymentDescription 
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className="nominal-tabungan-tooltip"
      style={{
        left: position.x + 10,
        top: position.y - 100,
      }}
    >
      <div className="tooltip-content">
        <div className="tooltip-title">Pembayaran Berikutnya</div>
        <div className="tooltip-info">
          <div className="tooltip-amount">
            +{nextPaymentAmount}
          </div>
          <div className="tooltip-date">
            pada tanggal {nextPaymentDate}
          </div>
          <div className="tooltip-description">
            {nextPaymentDescription}
          </div>
        </div>
      </div>
      <div className="tooltip-arrow"></div>
    </div>
  );
};

export default NominalTabunganTooltip;