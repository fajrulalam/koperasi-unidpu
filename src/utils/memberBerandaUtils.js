import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

// Format currency to IDR
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("Rp ", "Rp")
    .trim();
};

// Format date from Firestore timestamp
export const formatDate = (timestamp) => {
  if (!timestamp) return "-";

  // Convert Firebase timestamp to JS Date
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  // Format the date
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

// Get status badge class
export const getStatusBadgeClass = (status) => {
  switch (status) {
    case "Disetujui dan Aktif":
    case "Lunas":
      return "status-badge success";
    case "Menunggu Transfer BAK":
    case "Menunggu Persetujuan BAK":
    case "Menunggu Persetujuan Wakil Rektor 2":
      return "status-badge info";
    case "Direvisi BAK":
      return "status-badge warning";
    case "Ditolak BAK":
    case "Ditolak Wakil Rektor 2":
    case "Dibatalkan":
    case "Ditolak":
      return "status-badge error";
    default:
      return "status-badge";
  }
};

// Format detailed date with time
export const formatDetailedDate = (timestamp) => {
  if (!timestamp) return "-";

  // Convert Firebase timestamp or date object to JS Date
  const date = timestamp.toDate
    ? timestamp.toDate()
    : timestamp instanceof Date
    ? timestamp
    : new Date(timestamp);

  // Format the date with time
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

// Format date from ISO string
export const formatDateIso = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return dateString;
  }
};

// Generate a mock transaction history
export const generateTransactionHistory = () => {
  return [
    {
      date: "15 April 2025",
      type: "Simpanan Wajib",
      amount: 25000,
      status: "Sukses",
    },
    {
      date: "15 Maret 2025",
      type: "Simpanan Wajib",
      amount: 25000,
      status: "Sukses",
    },
    {
      date: "15 Februari 2025",
      type: "Simpanan Wajib",
      amount: 25000,
      status: "Sukses",
    },
  ];
};

// Get current date formatted in Indonesian
export const getCurrentDate = () => {
  return new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// User data fetching logic
export const setupUserDataListener = (
  setUserData,
  setUserDocRef,
  setLoading
) => {
  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Try direct document match first
      const docRef = doc(db, "users", user.uid);

      // Set up real-time listener for user data
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log("User data updated:", data);
            console.log("Payment Status:", data.paymentStatus);
            setUserData(data);
            setUserDocRef(docRef);
          } else {
            // Try to find by uid field
            const findByUid = async () => {
              const q = query(
                collection(db, "users"),
                where("uid", "==", user.uid)
              );
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                const data = querySnapshot.docs[0].data();
                console.log("User data found by uid:", data);
                console.log("Payment Status (by uid):", data.paymentStatus);
                setUserData(data);
                setUserDocRef(doc(db, "users", querySnapshot.docs[0].id));
              }
            };
            findByUid();
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error in user data listener:", error);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up user data listener:", error);
      setLoading(false);
    }
  };

  return fetchUserData();
};

// Active loans fetching logic
export const setupActiveLoansListener = (setActiveLoans, setLoadingLoans) => {
  const fetchActiveLoans = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Query loans collection for this user
      const loansQuery = query(
        collection(db, "simpanPinjam"),
        where("userId", "==", user.uid)
      );

      // Use onSnapshot for real-time updates
      const unsubscribe = onSnapshot(
        loansQuery,
        (snapshot) => {
          // Filter loans to show only active ones (not rejected or finished)
          const excludedStatuses = [
            "Ditolak",
            "Ditolak BAK",
            "Ditolak Wakil Rektor 2",
            "Lunas",
            "Revisi Ditolak Anggota",
          ];
          const loansData = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((loan) => !excludedStatuses.includes(loan.status));

          setActiveLoans(loansData);
          setLoadingLoans(false);
        },
        (error) => {
          console.error("Error fetching loans:", error);
          setLoadingLoans(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up loans listener:", error);
      setLoadingLoans(false);
    }
  };

  return fetchActiveLoans();
};

// Handle membership status update
export const handleUpdateToActiveStatus = async (
  termsAgreed,
  userDocRef,
  userData,
  setUserData,
  setShowRegistrationModal
) => {
  if (!termsAgreed || !userDocRef) return;

  try {
    await updateDoc(userDocRef, {
      membershipStatus: "Pending",
      iuranPokok: 250000,
      iuranWajib: 25000,
      paymentStatus:
        userData.kantor === "Unipdu"
          ? "Payroll Deduction"
          : "Pending Verification",
    });

    // Update local state
    setUserData({
      ...userData,
      membershipStatus: "Pending",
      iuranPokok: 250000,
      iuranWajib: 25000,
      paymentStatus:
        userData.kantor === "Unipdu"
          ? "Payroll Deduction"
          : "Pending Verification",
    });

    setShowRegistrationModal(false);

    // Show success message
    alert(
      "Pendaftaran berhasil! Status keanggotaan Anda telah diubah menjadi Pending."
    );
  } catch (error) {
    console.error("Error updating membership status:", error);
    alert(
      "Terjadi kesalahan saat memperbarui status keanggotaan. Silakan coba lagi."
    );
  }
};

// Check membership status
export const getMembershipStatus = (userData) => {
  const isInactive = userData?.membershipStatus === "inactive";
  const isApproved = userData?.membershipStatus === "approved";

  return { isInactive, isApproved };
};

// Calculate next 5th of the month
export const getNext5thOfMonth = () => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let targetMonth = currentMonth;
  let targetYear = currentYear;

  // If today is after the 5th, move to next month
  if (currentDay > 5) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  return new Date(targetYear, targetMonth, 5);
};

// Format month name in Indonesian
export const getIndonesianMonthName = (date) => {
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return monthNames[date.getMonth()];
};

// Check if user has paid iuran pokok (one-time payment)
export const hasUserPaidIuranPokok = (userData) => {
  // If user has nominalTabungan > 0 and membershipStatus is approved,
  // we assume they've made at least one payment which includes iuran pokok
  return (
    userData?.nominalTabungan > 0 && userData?.membershipStatus === "approved"
  );
};

// Get next payment amount, date, and description
export const getNextPaymentInfo = (userData) => {
  const hasPaidIuranPokok = hasUserPaidIuranPokok(userData);
  const iuranPokok = userData?.iuranPokok || 250000;
  const iuranWajib = userData?.iuranWajib || 25000;
  
  // Get next payment date (5th of next month)
  const next5th = getNext5thOfMonth();
  const monthName = getIndonesianMonthName(next5th);
  const paymentDate = `5 ${monthName}`;

  if (hasPaidIuranPokok) {
    return {
      amount: formatCurrency(iuranWajib),
      date: paymentDate,
      description: "(iuran wajib)",
    };
  } else {
    return {
      amount: formatCurrency(iuranPokok + iuranWajib),
      date: paymentDate,
      description: "(iuran pokok dan iuran wajib)",
    };
  }
};

// Get balance display value with upcoming payment info
export const getBalanceDisplay = (isInactive, userData) => {
  if (isInactive) {
    return {
      currentBalance: formatCurrency(0),
      nextPayment: null,
    };
  }

  if (userData?.paymentStatus === "Yayasan Subsidy") {
    return {
      currentBalance: "[Subsidi Yapetidu]",
      nextPayment: null,
    };
  }

  // Check if user has Payroll Deduction payment status
  if (userData?.paymentStatus !== "Payroll Deduction") {
    return {
      currentBalance: formatCurrency(userData?.nominalTabungan || 0),
      nextPayment: {
        amount: "Tidak ada",
        date: "-",
        description: "(bukan potong gaji)",
      },
    };
  }

  const currentBalance = userData?.nominalTabungan || 0;
  const next5th = getNext5thOfMonth();
  const monthName = getIndonesianMonthName(next5th);
  const nextPaymentInfo = getNextPaymentInfo(userData);

  return {
    currentBalance: formatCurrency(currentBalance),
    nextPayment: {
      amount: nextPaymentInfo.amount, // Already formatted in getNextPaymentInfo
      date: nextPaymentInfo.date,
      description: nextPaymentInfo.description,
    },
  };
};

// Get button text for loan section
export const getLoanButtonText = (activeLoans) => {
  return activeLoans && activeLoans.length > 0
    ? "Lihat Lebih Lanjut"
    : "Ajukan Pinjaman Baru";
};
