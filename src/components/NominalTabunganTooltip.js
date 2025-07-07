import React from "react";
import "../styles/NominalTabunganTooltip.css";
import { getNextPaymentInfo } from "../utils/memberBerandaUtils";

const NominalTabunganTooltip = ({ 
  position, 
  member 
}) => {
  if (!member) return null;
  
  // Get payment info from member data
  const { amount: nextPaymentAmount, date: nextPaymentDate, description: nextPaymentDescription } = 
    getNextPaymentInfo(member);

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
            +{nextPaymentAmount || "Rp 0"}
          </div>
          <div className="tooltip-date">
            pada tanggal {nextPaymentDate || "-"}
          </div>
          <div className="tooltip-description">
            {nextPaymentDescription || "Tidak ada pembayaran terjadwal"}
          </div>
        </div>
      </div>
      <div className="tooltip-arrow"></div>
    </div>
  );
};

export default NominalTabunganTooltip;