import React, { useCallback, useEffect, useState } from "react";
import { useEnvironment } from "../context/EnvironmentContext";
import { voucherService } from "../services/voucherService";
import { db } from "../firebase";
import MemberVoucherTile from "./MemberVoucherTile";
import { getVoucherRemainingBalance } from "../utils/voucherBalance";
import { resolveMemberDocument } from "../utils/memberIdentity";
import "../styles/MemberVoucherList.css";

const MemberVoucherList = ({
  onVoucherClick,
  refreshTrigger,
  memberIdentity,
}) => {
  const { isProduction } = useEnvironment();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const memberDocId = memberIdentity?.docId || memberIdentity?.id || null;
  const memberUid = memberIdentity?.uid || null;

  const fetchUserVouchers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!memberDocId && !memberUid) {
        setError("Identitas anggota tidak ditemukan");
        return;
      }

      let userDocId = memberDocId;
      let targetUid = memberUid;

      if (!userDocId) {
        const resolvedMember = await resolveMemberDocument(db, {
          uid: memberUid,
        });
        userDocId = resolvedMember?.snapshot.id || null;
        targetUid = resolvedMember?.snapshot.data()?.uid || targetUid;
      }

      if (!userDocId) {
        setError("Data anggota tidak ditemukan");
        return;
      }

      // Try both methods to get vouchers
      let allVouchers = [];
      try {
        allVouchers = await voucherService.getAllVouchersByUserDocId(
          userDocId,
          isProduction
        );
      } catch (error1) {
        try {
          if (!targetUid) throw error1;
          allVouchers = await voucherService.getAllVouchersByUserId(
            targetUid,
            isProduction
          );
        } catch (error2) {
          console.error("Both voucher fetch methods failed:", error1, error2);
          throw error2;
        }
      }

      // Filter for active vouchers that haven't expired
      const now = new Date();
      const activeVouchers = allVouchers.filter((voucher) => {
        const expireDate = voucher.expireDate?.toDate
          ? voucher.expireDate.toDate()
          : new Date(voucher.expireDate);
        if (!voucher.isActive || expireDate <= now) return false;

        // Multi-use vouchers: show as long as they have remaining balance
        if (voucher.isOneTimeUse === false) {
          const remaining = getVoucherRemainingBalance(voucher);
          return remaining > 0;
        }

        return !voucher.isClaimed;
      });

      setVouchers(activeVouchers);
    } catch (error) {
      console.error("Error fetching user vouchers:", error);
      setError("Gagal memuat voucher");
    } finally {
      setLoading(false);
    }
  }, [isProduction, memberDocId, memberUid]);

  useEffect(() => {
    fetchUserVouchers();
  }, [fetchUserVouchers, refreshTrigger]);

  if (loading) {
    return (
      <div className="member-voucher-list">
        <div className="section-header">
          <h3 className="section-title">Voucher Saya</h3>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Memuat voucher...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="member-voucher-list">
        <div className="section-header">
          <h3 className="section-title">Voucher Saya</h3>
        </div>
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={fetchUserVouchers}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="member-voucher-list">
      <div className="section-header">
        <h3 className="section-title">Voucher Saya</h3>
        <span className="voucher-count">{vouchers.length} voucher</span>
      </div>

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h4>Belum ada voucher</h4>
          <p>Anda belum memiliki voucher yang aktif saat ini</p>
        </div>
      ) : (
        <div className="vouchers-container">
          {vouchers.map((voucher) => (
            <MemberVoucherTile
              key={voucher.id}
              voucher={voucher}
              onClick={onVoucherClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberVoucherList;
