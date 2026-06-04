// src/pages/hooks/useMemberSejarahBelanja.js
import { useState, useEffect, useCallback } from "react";
import {
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { getEnvironmentCollection } from "../../firebase";
import { useEnvironment } from "../../context/EnvironmentContext";

const useMemberSejarahBelanja = (userData) => {
  const { isProduction } = useEnvironment();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);

  // Date range filter (default: last 7 days)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchTransactions = useCallback(async () => {
    // Use the document ID (which matches userId in transactionDetail)
    const userDocId = userData?.docId || userData?.userId;
    
    if (!userDocId) {
      setError("User ID tidak ditemukan");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Validate max 30 days range
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        setError("Rentang tanggal maksimal 30 hari");
        setLoading(false);
        return;
      }

      if (start > end) {
        setError("Tanggal mulai harus sebelum tanggal akhir");
        setLoading(false);
        return;
      }

      const txQuery = query(
        getEnvironmentCollection("transactionDetail", isProduction),
        where("userId", "==", userDocId),
        where("updatedAt", ">=", start),
        where("updatedAt", "<=", end),
        orderBy("updatedAt", "desc"),
        limit(10)
      );

      const querySnapshot = await getDocs(txQuery);
      const txList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTransactions(txList);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError("Gagal memuat riwayat belanja. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userData, isProduction]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const toggleExpand = (txId) => {
    setExpandedTx(expandedTx === txId ? null : txId);
  };

  const handleDateChange = (type, value) => {
    if (type === "start") {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Calculate summary stats
  const summaryStats = {
    totalTransactions: transactions.length,
    totalSpending: transactions.reduce((sum, tx) => sum + (tx.total || 0), 0),
    totalPoints: transactions.reduce((sum, tx) => sum + (tx.userPoints || 0), 0),
  };

  return {
    // State
    transactions,
    loading,
    error,
    expandedTx,
    startDate,
    endDate,
    summaryStats,

    // Actions
    toggleExpand,
    handleDateChange,

    // Formatters
    formatCurrency,
    formatDate,
    formatTime,
  };
};

export default useMemberSejarahBelanja;
