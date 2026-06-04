import React, { useState, useEffect } from "react";
import { useEnvironment } from "../context/EnvironmentContext";
import { useAuth } from "../context/AuthContext";
import { voucherService } from "../services/voucherService";
import VoucherModalNew from "../components/VoucherModalNew";
import VoucherDetailModalNew from "../components/VoucherDetailModalNew";
import "../styles/VoucherKoperasiPageNew.css";

const PAGE_LIMIT = 5;

const VoucherKoperasiPageNew = () => {
  const { isProduction } = useEnvironment();
  const { userRole } = useAuth();
  const isReadOnly = userRole === "BAK";

  // Data States
  const [voucherGroups, setVoucherGroups] = useState([]);
  const [claimedCounts, setClaimedCounts] = useState({});

  // Pagination States
  const [lastDoc, setLastDoc] = useState(null); // The cursor for the DB
  const [hasMore, setHasMore] = useState(true); // Should we show "Load More"?
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Loading state for the button
  const [loadingInitial, setLoadingInitial] = useState(true); // Loading state for first load

  // UI States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVoucherGroup, setSelectedVoucherGroup] = useState(null);
  const [error, setError] = useState(null);

  // Wrapper to reset state and fetch the first page
  const resetAndFetch = () => {
    setVoucherGroups([]);
    setLastDoc(null);
    setHasMore(true);
    setClaimedCounts({});
    fetchVoucherGroups(null);
  };

  // Reset pagination when environment changes
  useEffect(() => {
    resetAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProduction]);

  const fetchVoucherGroups = async (startAfterDoc = null) => {
    try {
      // Determine which loading state to toggle
      if (!startAfterDoc) {
        setLoadingInitial(true);
      } else {
        setIsFetchingMore(true);
      }
      setError(null);

      // 1. Fetch data from service with pagination params
      // NOTE: You must update your service to accept these params (see below)
      const newGroups = await voucherService.getVoucherGroups(
        isProduction,
        PAGE_LIMIT,
        startAfterDoc
      );

      // 2. Handle Pagination Logic
      if (newGroups.length < PAGE_LIMIT) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (newGroups.length > 0) {
        // Set the cursor to the last item for the next query
        // Ensure your service returns the raw doc or a field we can use as a cursor
        setLastDoc(newGroups[newGroups.length - 1]);

        // 3. Fetch claimed counts ONLY for the new items
        const newCounts = { ...claimedCounts }; // Copy existing counts

        // Use Promise.all for parallel fetching of counts for better speed
        await Promise.all(
          newGroups.map(async (group) => {
            // For cashback campaigns, use different counting logic
            if (group.type === "cashbackCampaign") {
              const campaignCounts =
                await voucherService.getCampaignVoucherCounts(
                  group.id,
                  isProduction
                );
              newCounts[group.id] = campaignCounts; // { claimed: number, total: number }
            } else {
              const claimed = await voucherService.getClaimedVoucherCount(
                group.id,
                isProduction
              );
              newCounts[group.id] = claimed;
            }
          })
        );

        setClaimedCounts(newCounts);

        // 4. Update List
        if (!startAfterDoc) {
          setVoucherGroups(newGroups); // Initial load: replace list
        } else {
          setVoucherGroups((prev) => [...prev, ...newGroups]); // Load more: append
        }
      } else {
        // No new data found
        if (!startAfterDoc) setVoucherGroups([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching voucher groups:", error);
      setError("Gagal memuat data voucher");
    } finally {
      setLoadingInitial(false);
      setIsFetchingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (lastDoc && hasMore && !isFetchingMore) {
      fetchVoucherGroups(lastDoc);
    }
  };

  const handleCreateVoucher = () => {
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleVoucherCreated = () => {
    setShowCreateModal(false);
    resetAndFetch(); // Refresh list from scratch
  };

  const handleViewVoucherGroup = (voucherGroup) => {
    setSelectedVoucherGroup(voucherGroup);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedVoucherGroup(null);
  };

  const handleVoucherGroupUpdated = () => {
    setShowDetailModal(false);
    setSelectedVoucherGroup(null);
    // Determine if we want to refresh everything or just update local state.
    // Ideally, we reset to ensure sort order is correct if dates changed.
    resetAndFetch();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (group) => {
    const now = new Date();
    const activeDate = group.activeDate?.toDate
      ? group.activeDate.toDate()
      : new Date(group.activeDate);
    const expireDate = group.expireDate?.toDate
      ? group.expireDate.toDate()
      : new Date(group.expireDate);

    if (!group.isActive) {
      return <span className="status-badge inactive">Tidak Aktif</span>;
    } else if (now < activeDate) {
      return <span className="status-badge pending">Belum Aktif</span>;
    } else if (now > expireDate) {
      return <span className="status-badge expired">Kedaluwarsa</span>;
    } else {
      return <span className="status-badge active">Aktif</span>;
    }
  };

  const getTypeBadge = (group) => {
    if (group.type === "cashbackCampaign") {
      return <span className="type-badge campaign">Kampanye</span>;
    } else if (group.isVoucherForMemberOnly === false) {
      return <span className="type-badge print">Cetak</span>;
    } else {
      return <span className="type-badge member">Anggota</span>;
    }
  };

  const getUsageDisplay = (group) => {
    const count = claimedCounts[group.id];

    if (count === undefined) {
      return "...";
    }

    // For cashback campaigns, count is { claimed: number, total: number }
    if (group.type === "cashbackCampaign") {
      return `${count.claimed} / ${count.total}`;
    }

    // For regular vouchers, count is just a number
    return `${count} / ${group.totalVouchers}`;
  };

  if (loadingInitial) {
    return (
      <div className="voucher-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Memuat data voucher...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voucher-page">
      <div className="voucher-header">
        <h1>Voucher Koperasi</h1>
        {!isReadOnly && (
          <button className="btn-create-voucher" onClick={handleCreateVoucher}>
            Buat Voucher
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={resetAndFetch} className="retry-button">
            Coba Lagi
          </button>
        </div>
      )}

      <div className="voucher-content">
        {voucherGroups.length === 0 && !loadingInitial ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>Belum ada voucher</h3>
            <p>Klik tombol "Buat Voucher" untuk membuat voucher pertama</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="voucher-table">
                <thead>
                  <tr>
                    <th>Nama Voucher</th>
                    <th>Tipe</th>
                    <th>Status</th>
                    <th>Nilai</th>
                    <th>Terpakai</th>
                    <th>Mulai</th>
                    <th>Berakhir</th>
                    <th>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherGroups.map((group) => (
                    <tr
                      key={group.id}
                      onClick={() => handleViewVoucherGroup(group)}
                      className="clickable-row"
                    >
                      <td className="fw-bold">{group.voucherName}</td>
                      <td>{getTypeBadge(group)}</td>
                      <td>{getStatusBadge(group)}</td>
                      <td>{voucherService.formatCurrency(group.value)}</td>
                      <td>{getUsageDisplay(group)}</td>
                      <td>{formatDate(group.activeDate)}</td>
                      <td>{formatDate(group.expireDate)}</td>
                      <td className="text-muted">
                        {formatDate(group.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {hasMore && (
              <div
                className="pagination-container"
                style={{ textAlign: "center", marginTop: "20px" }}
              >
                <button
                  className="btn-load-more"
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  style={{
                    padding: "10px 20px",
                    cursor: isFetchingMore ? "not-allowed" : "pointer",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  {isFetchingMore ? "Memuat..." : "Tampilkan Lebih Banyak"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <VoucherModalNew
          onClose={handleCloseCreateModal}
          onVoucherCreated={handleVoucherCreated}
        />
      )}

      {showDetailModal && selectedVoucherGroup && (
        <VoucherDetailModalNew
          voucherGroup={selectedVoucherGroup}
          onClose={handleCloseDetailModal}
          onVoucherGroupUpdated={handleVoucherGroupUpdated}
          readOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default VoucherKoperasiPageNew;
