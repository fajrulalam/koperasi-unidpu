import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "../services/transactionHistoryService";
import "../styles/SejarahTransaksiNew.css";

/**
 * Convert string to Title Case
 */
function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Day Breakdown Dialog
 * Shows the breakdown of a specific day with two views:
 * 1. Per Item - breakdown of all items sold
 * 2. Per Pembeli - breakdown by member/buyer with their purchased items
 */
const DayBreakdownDialog = ({ isOpen, onClose, dayData }) => {
  const [activeView, setActiveView] = useState("items"); // "items" or "members"
  const [expandedMembers, setExpandedMembers] = useState({});

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveView("items");
      setExpandedMembers({});
    }
  }, [isOpen]);

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

  // Process transactions to group by member
  const memberGroups = useMemo(() => {
    if (!dayData?.transactions) return [];

    const grouped = {};

    dayData.transactions.forEach((tx) => {
      const isMember = tx.isMember || false;
      const hasVoucher = !!tx.voucherId;

      // Determine the grouping key
      let groupKey;
      let groupName;
      let groupType; // "member", "voucher", or "guest"

      if (isMember && tx.nomorAnggota) {
        // Member with nomor anggota
        groupKey = tx.nomorAnggota;
        groupName = tx.memberName || "Anggota";
        groupType = "member";
      } else if (hasVoucher) {
        // Non-member but has voucher - group under "vouchers"
        groupKey = "vouchers";
        groupName = "Vouchers";
        groupType = "voucher";
      } else {
        // Non-member without voucher
        groupKey = "guest";
        groupName = "Non-Anggota";
        groupType = "guest";
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          nomorAnggota: groupType === "member" ? tx.nomorAnggota : "-",
          memberName: groupName,
          isMember: groupType === "member",
          isVoucher: groupType === "voucher",
          transactions: [],
          items: [],
          total: 0,
          voucherDetails: [], // Track voucher details for voucher group
        };
      }

      grouped[groupKey].transactions.push(tx);
      grouped[groupKey].total += tx.total || 0;

      // Track voucher details if this is a voucher transaction
      if (hasVoucher && groupType === "voucher") {
        grouped[groupKey].voucherDetails.push({
          voucherId: tx.voucherId,
          voucherName: tx.voucherName,
          voucherDiscount: tx.voucherDiscount,
        });
      }

      // Add items from this transaction
      if (Array.isArray(tx.items)) {
        tx.items.forEach((item) => {
          const existingItem = grouped[groupKey].items.find(
            (i) => i.itemId === item.itemId && i.unit === item.unit
          );

          if (existingItem) {
            existingItem.quantity += item.quantity;
            existingItem.subtotal += item.subtotal;
          } else {
            grouped[groupKey].items.push({
              itemId: item.itemId,
              itemName: item.itemName,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal,
              unit: item.unit,
            });
          }
        });
      }
    });

    // Sort items within each member by subtotal (descending)
    Object.values(grouped).forEach((member) => {
      member.items.sort((a, b) => b.subtotal - a.subtotal);
    });

    // Sort: vouchers first, then members (by total desc), then non-members at the bottom
    return Object.values(grouped).sort((a, b) => {
      // Vouchers always at the top
      if (a.isVoucher && !b.isVoucher) return -1;
      if (!a.isVoucher && b.isVoucher) return 1;
      // Members before guests
      if (a.isMember && !b.isMember) return -1;
      if (!a.isMember && b.isMember) return 1;
      // Then sort by total (highest first)
      return b.total - a.total;
    });
  }, [dayData]);

  // Calculate voucher stats
  const voucherStats = useMemo(() => {
    const voucherGroup = memberGroups.find((g) => g.isVoucher);
    if (!voucherGroup) return null;
    return {
      count: voucherGroup.transactions.length,
      total: voucherGroup.total,
    };
  }, [memberGroups]);

  // Sort breakdown items by subtotal (descending) and add voucher quantity info
  const sortedBreakdown = useMemo(() => {
    if (!dayData?.breakdown || !dayData?.transactions) return [];

    // Calculate voucher quantities per item (using itemName + unit as key)
    const voucherQuantities = {};
    dayData.transactions.forEach((tx) => {
      if (tx.voucherId && Array.isArray(tx.items)) {
        tx.items.forEach((item) => {
          const key = `${item.itemName}_${item.unit}`;
          if (!voucherQuantities[key]) {
            voucherQuantities[key] = 0;
          }
          voucherQuantities[key] += item.quantity;
        });
      }
    });

    // Add voucher quantity to breakdown items
    return [...dayData.breakdown]
      .map((item) => {
        const key = `${item.itemName}_${item.unit}`;
        return {
          ...item,
          voucherQuantity: voucherQuantities[key] || 0,
        };
      })
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [dayData]);

  const toggleMemberExpand = (nomorAnggota) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [nomorAnggota]: !prev[nomorAnggota],
    }));
  };

  if (!isOpen || !dayData) return null;

  return (
    <div className="st-dialog-overlay" onClick={onClose}>
      <div
        className="st-dialog st-dialog-large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-dialog-header">
          <h2>{dayData.formattedDate}</h2>
          <button className="st-dialog-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* View Tabs */}
        <div className="st-dialog-tabs">
          <button
            className={`st-dialog-tab ${
              activeView === "items" ? "active" : ""
            }`}
            onClick={() => setActiveView("items")}
          >
            Per Item
          </button>
          <button
            className={`st-dialog-tab ${
              activeView === "members" ? "active" : ""
            }`}
            onClick={() => setActiveView("members")}
          >
            Per Pembeli
          </button>
        </div>

        <div className="st-dialog-body">
          <div className="st-dialog-stats">
            <p className="st-dialog-total">
              Total Pendapatan: <strong>{formatCurrency(dayData.total)}</strong>
            </p>
            {voucherStats && (
              <p className="st-dialog-voucher-stats">
                {voucherStats.count} voucher (
                {formatCurrency(voucherStats.total)})
              </p>
            )}
          </div>

          {/* Items View */}
          {activeView === "items" && (
            <div className="st-breakdown-list">
              {sortedBreakdown.map((item, idx) => (
                <div key={idx} className="st-breakdown-item">
                  <span className="st-breakdown-name">{item.itemName}</span>
                  <div className="st-breakdown-qty-wrapper">
                    <div className="st-breakdown-qty">
                      <span className="st-breakdown-qty-value">
                        {item.quantity}
                      </span>
                      <span className="st-breakdown-qty-unit">{item.unit}</span>
                    </div>
                    {item.voucherQuantity > 0 && (
                      <span className="st-breakdown-voucher-qty">
                        ({item.voucherQuantity} voucher)
                      </span>
                    )}
                  </div>
                  <span className="st-breakdown-subtotal">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Members View */}
          {activeView === "members" && (
            <div className="st-member-list">
              {memberGroups.length === 0 ? (
                <div className="st-empty-small">Tidak ada data pembeli</div>
              ) : (
                memberGroups.map((member) => {
                  // Determine the key based on group type
                  let key;
                  if (member.isMember) {
                    key = member.nomorAnggota;
                  } else if (member.isVoucher) {
                    key = "vouchers";
                  } else {
                    key = "guest";
                  }

                  const isExpanded = expandedMembers[key];

                  return (
                    <div
                      key={key}
                      className={`st-member-tile ${
                        isExpanded ? "expanded" : ""
                      } ${member.isVoucher ? "st-member-tile-voucher" : ""}`}
                    >
                      <div
                        className="st-member-header"
                        onClick={() => toggleMemberExpand(key)}
                      >
                        <div className="st-member-info">
                          <div className="st-member-name-row">
                            {member.isVoucher && (
                              <span className="st-member-icon">🎫</span>
                            )}
                            <span className="st-member-name">
                              {member.memberName}
                            </span>
                            {member.transactions.length > 1 && (
                              <span className="st-member-tx-count">
                                ({member.transactions.length}x transaksi)
                              </span>
                            )}
                          </div>
                          <span className="st-member-id">
                            {member.isVoucher
                              ? `${member.transactions.length} voucher digunakan`
                              : member.nomorAnggota}
                          </span>
                        </div>
                        <div className="st-member-right">
                          <span className="st-member-total">
                            {formatCurrency(member.total)}
                          </span>
                          <span
                            className={`st-member-chevron ${
                              isExpanded ? "expanded" : ""
                            }`}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M4 6L8 10L12 6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="st-member-details">
                          <div className="st-member-items-list">
                            {member.items.map((item, idx) => (
                              <div key={idx} className="st-member-item">
                                <span className="st-member-item-name">
                                  {toTitleCase(item.itemName)}
                                </span>
                                <span className="st-member-item-qty">
                                  {item.quantity} {item.unit}
                                </span>
                                <span className="st-member-item-subtotal">
                                  {formatCurrency(item.subtotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayBreakdownDialog;
