import React from "react";
import { formatCurrency } from "../utils/memberBerandaUtils";

const CampaignCard = ({
  campaign,
  progress,
  claimingVoucher,
  onClaim,
  readOnly = false,
}) => {
  const userPoints = progress?.userPoints || 0;
  const threshold = campaign.threshold || 0;
  const progressPercent =
    threshold > 0 ? Math.min((userPoints / threshold) * 100, 100) : 0;
  const canClaim =
    userPoints >= threshold &&
    (!progress?.status || progress.status === "IN_PROGRESS");
  const isClaimed =
    progress?.status === "CLAIMED" || progress?.status === "REDEEMED";
  const isRedeemed = progress?.status === "REDEEMED";
  const canClaimInteractively = canClaim && !readOnly;

  // Format expiry date
  const expireDate = campaign.expireDate?.toDate
    ? campaign.expireDate.toDate()
    : new Date(campaign.expireDate);
  const daysLeft = Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24));

  const handleClaimClick = () => {
    if (canClaimInteractively && onClaim) {
      onClaim(campaign.voucherGroupId);
    }
  };

  return (
    <div
      className={`campaign-card ${isClaimed ? "claimed" : ""} ${
        canClaimInteractively ? "can-claim" : ""
      }`}
    >
      <div className="campaign-card-header">
        <span className="campaign-badge">
          {isClaimed
            ? isRedeemed
              ? "✓ TERPAKAI"
              : "🎉 SIAP PAKAI"
            : "⚡ AKTIF"}
        </span>
        <span className="campaign-expiry">
          {daysLeft > 0 ? `${daysLeft} hari lagi` : "Berakhir hari ini"}
        </span>
      </div>

      <h4 className="campaign-name">{campaign.voucherName}</h4>

      <div className="campaign-reward">
        <span className="campaign-reward-label">Voucher</span>
        <span className="campaign-reward-value">
          {formatCurrency(campaign.value)}
        </span>
      </div>

      <div className="campaign-progress-section">
        <div className="campaign-progress-labels">
          <span>{formatCurrency(userPoints)}</span>
          <span>{formatCurrency(threshold)}</span>
        </div>
        <div className="campaign-progress-bar">
          <div
            className="campaign-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="campaign-progress-text">
          {isClaimed
            ? isRedeemed
              ? "Voucher sudah digunakan"
              : "Voucher siap digunakan!"
            : canClaim
            ? "Target tercapai! Klaim sekarang"
            : `Belanja ${formatCurrency(
                Math.max(0, threshold - userPoints)
              )} lagi`}
        </div>
      </div>

      {!isClaimed && (
        <button
          className={`campaign-claim-btn ${canClaimInteractively ? "active" : "disabled"}`}
          disabled={
            !canClaimInteractively ||
            claimingVoucher === campaign.voucherGroupId
          }
          onClick={handleClaimClick}
          title={
            readOnly
              ? "Klaim dinonaktifkan selama mode pratinjau"
              : undefined
          }
        >
          {claimingVoucher === campaign.voucherGroupId
            ? "Mengklaim..."
            : readOnly && canClaim
            ? "Mode Pratinjau — Klaim Dinonaktifkan"
            : canClaim
            ? "🎁 Klaim Voucher"
            : "Belum Memenuhi Target"}
        </button>
      )}

      {isClaimed && !isRedeemed && (
        <div className="campaign-claimed-info">
          <span>💳 Gunakan voucher saat checkout</span>
        </div>
      )}
    </div>
  );
};

export default CampaignCard;
