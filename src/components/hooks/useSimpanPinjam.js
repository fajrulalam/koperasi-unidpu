import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db, auth, storage, uploadFile, getEnvironmentCollectionPath } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { exportLoansToExcel } from "../../utils/exportUtils";
import { useEnvironment } from "../../context/EnvironmentContext";

const calculateFee = (jumlahPinjaman) => {
  if (jumlahPinjaman > 8000000) return 500000;
  if (jumlahPinjaman > 6000000) return 400000;
  if (jumlahPinjaman > 4000000) return 300000;
  if (jumlahPinjaman > 2000000) return 200000;
  if (jumlahPinjaman >= 1000000) return 100000;
  return 0;
};

const calculateSisaHutang = (jumlahPinjaman, jumlahMenyicil, tenor) => {
  if (!tenor || tenor === 0) return jumlahPinjaman || 0;
  const cicilanPerBulan = Math.round(jumlahPinjaman / tenor);
  return Math.max(0, jumlahPinjaman - (jumlahMenyicil * cicilanPerBulan));
};

// Format number to Rupiah currency
const formatRupiah = (number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(number)
    .replace("IDR", "Rp")
    .trim();
};

const useSimpanPinjam = () => {
  const { isProduction } = useEnvironment();
  const spPath = getEnvironmentCollectionPath("simpanPinjam", isProduction);
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [revisionAmount, setRevisionAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  // Removed activeTab state since we're using a filter-based approach now
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [viewingLoan, setViewingLoan] = useState(null);
  const [revisionTenor, setRevisionTenor] = useState("");

  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Get current user and role from Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);

        try {
          // First try: Direct document lookup
          const userDocRef = doc(db, "users", user.uid);
          let userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            // Second try: Query users collection where document ID equals UID
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("uid", "==", user.uid), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              userDoc = querySnapshot.docs[0];
            }
          }

          if (userDoc?.exists?.()) {
            const userData = userDoc.data();
            const role = userData.role || "";
            console.log("Fetched user role from Firestore:", role);
            setUserRole(role);
          } else {
            console.log("No user document found in Firestore");
            setUserRole("");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole("");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch all loans based on status filter
  useEffect(() => {
    // Return early if no user role is set
    if (!userRole) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Parse the status filter if it exists
      const statusFilters = statusFilter
        ? statusFilter.split(",")
        : [
            // Default visible statuses if no filter is set
            "Menunggu Persetujuan BAK",
            "Menunggu Persetujuan Wakil Rektor 2",
            "Direvisi BAK",
            "Menunggu Transfer BAK",
            "Disetujui dan Aktif",
          ];

      // If there are no status filters, don't query anything
      if (statusFilters.length === 0) {
        setLoans([]);
        setLoading(false);
        return;
      }

      // Create a query based on status filters
      const loanQuery = query(
        collection(db, spPath),
        where("status", "in", statusFilters),
        orderBy("tanggalPengajuan", "desc")
      );

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(loanQuery, async (querySnapshot) => {
        try {
          const loansData = [];

          // Process loan data
          for (const loanDoc of querySnapshot.docs) {
            const loanData = { id: loanDoc.id, ...loanDoc.data() };

            // Fetch user data for each loan
            if (loanData.userId) {
              const userDocRef = doc(db, "users", loanData.userId);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                loanData.userData = userDoc.data();
              }
            }

            loansData.push(loanData);
          }

          setLoans(loansData);
          setLoading(false);
        } catch (error) {
          console.error("Error loading loans:", error);
          setError("Gagal memuat data pinjaman");
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up query:", error);
      setError("Terjadi kesalahan saat mengambil data pinjaman");
      setLoading(false);
    }
  }, [userRole, statusFilter, spPath]);

  // Apply filters whenever loans data or filter values change
  useEffect(() => {
    if (!loans) return;

    let filtered = [...loans];

    // Filter by name
    if (nameFilter) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter((loan) => {
        const name = loan.userData?.namaLengkap?.toLowerCase() || "";
        return name.includes(searchTerm);
      });
    }

    // Filter by status - support comma-separated list for multiple statuses
    if (statusFilter) {
      const statuses = statusFilter.split(",");
      filtered = filtered.filter((loan) => statuses.includes(loan.status));
    }

    // Filter by approval date range (start date)
    if (startDateFilter) {
      const startDate = new Date(startDateFilter);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((loan) => {
        // For approved loans, check approval date
        if (loan.tanggalDisetujui) {
          try {
            const approvalDate = loan.tanggalDisetujui.toDate();
            return approvalDate >= startDate;
          } catch (error) {
            return false;
          }
        }
        // For pending loans, check application date
        else if (loan.tanggalPengajuan) {
          try {
            const applicationDate = loan.tanggalPengajuan.toDate();
            return applicationDate >= startDate;
          } catch (error) {
            return false;
          }
        }
        return false;
      });
    }

    // Filter by date range (end date)
    if (endDateFilter) {
      const endDate = new Date(endDateFilter);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((loan) => {
        // For approved loans, check approval date
        if (loan.tanggalDisetujui) {
          try {
            const approvalDate = loan.tanggalDisetujui.toDate();
            return approvalDate <= endDate;
          } catch (error) {
            return false;
          }
        }
        // For pending loans, check application date
        else if (loan.tanggalPengajuan) {
          try {
            const applicationDate = loan.tanggalPengajuan.toDate();
            return applicationDate <= endDate;
          } catch (error) {
            return false;
          }
        }
        return false;
      });
    }

    setFilteredLoans(filtered);
  }, [loans, nameFilter, statusFilter, startDateFilter, endDateFilter]);

  // Handle loan approval
  const handleApprove = async (loanId, currentStatus) => {
    if (!window.confirm("Apakah Anda yakin menyetujui pengajuan pinjaman ini?"))
      return;

    try {
      // Get the current loan document
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      // Get existing history
      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      // Set new status and note based on current status and user role
      let newStatus = "";
      let note = "";
      let setApprovalDate = false;

      const isDirector = userRole === "Direktur" || userRole === "Director";

      // For Director role - special handling to allow any approval path
      if (isDirector) {
        // Allow Director to specify the next status
        if (currentStatus === "Menunggu Persetujuan BAK") {
          // For BAK stage, Director can approve directly or send to WR1
          const selectedOption = window.confirm(
            "Pilih 'OK' untuk menyetujui langsung menjadi 'Menunggu Transfer BAK'.\n" +
              "Pilih 'Cancel' untuk melanjutkan ke proses persetujuan WR1."
          );

          if (selectedOption) {
            // Approve directly to waiting for transfer status
            newStatus = "Menunggu Transfer BAK";
            note =
              "Pinjaman disetujui langsung oleh Direktur, menunggu transfer";
          } else {
            // Move to next step in approval process
            newStatus = "Menunggu Persetujuan Wakil Rektor 2";
            note = "Pinjaman disetujui oleh Direktur dan dilanjutkan ke WR1";
          }
        } else if (currentStatus === "Menunggu Persetujuan Wakil Rektor 2") {
          // For WR1 stage, Director approves to waiting for transfer
          newStatus = "Menunggu Transfer BAK";
          note = "Pinjaman disetujui oleh Direktur, menunggu transfer";
        }
      } else {
        // Standard approval process for non-Director roles
        if (
          currentStatus === "Menunggu Persetujuan BAK" &&
          userRole === "BAK"
        ) {
          newStatus = "Menunggu Persetujuan Wakil Rektor 2";
          note = "Pinjaman disetujui oleh BAK";
        } else if (
          currentStatus === "Menunggu Persetujuan Wakil Rektor 2" &&
          userRole === "Wakil Rektor 2"
        ) {
          newStatus = "Menunggu Transfer BAK";
          note = "Pinjaman disetujui oleh Wakil Rektor 2, menunggu transfer";
        }
      }

      // Create history entry with client-side timestamp
      const newHistoryEntry = {
        status: newStatus,
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: note,
      };

      // Prepare update object
      const updateData = {
        status: newStatus,
        [`approvedBy${userRole.replace(/\s+/g, "")}`]: currentUser.uid,
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      };

      // Update the document
      await updateDoc(loanRef, updateData);

      setSuccess(`Pinjaman berhasil ${note.toLowerCase()}`);
    } catch (error) {
      console.error("Error approving loan:", error);
      setError("Gagal menyetujui pinjaman");
    }
  };

  // Handle loan rejection
  const handleReject = async (loanId, currentStatus) => {
    if (!rejectionReason.trim()) {
      setError("Harap masukkan alasan penolakan");
      return;
    }

    if (!window.confirm("Apakah Anda yakin menolak pengajuan pinjaman ini?"))
      return;

    try {
      // Get the current loan document
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      // Get existing history
      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      // Determine rejection status based on user role
      let rejectionStatus;
      const isDirectorReject = userRole === "Direktur" || userRole === "Director";

      if (isDirectorReject) {
        rejectionStatus = "Ditolak Direktur";
      } else if (userRole === "BAK") {
        rejectionStatus = "Ditolak BAK";
      } else if (userRole === "Wakil Rektor 2") {
        rejectionStatus = "Ditolak Wakil Rektor 2";
      }

      // Create history entry with client-side timestamp
      const newHistoryEntry = {
        status: rejectionStatus,
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: `Ditolak dengan alasan: ${rejectionReason}`,
      };

      // Update the document with combined history
      await updateDoc(loanRef, {
        status: rejectionStatus,
        alasanPenolakan: rejectionReason,
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      });

      // If this was a restructuring request, revert the old loan back to active
      if (loanData.restructuredFromLoanId) {
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);

        if (oldLoanSnap.exists()) {
          const oldLoanData = oldLoanSnap.data();
          const oldHistory = oldLoanData.history || [];

          if (oldLoanData.status === "Menunggu Persetujuan Restrukturisasi") {
            await updateDoc(oldLoanRef, {
              status: "Disetujui dan Aktif",
              restructuredToLoanId: null,
              updatedAt: serverTimestamp(),
              history: [
                ...oldHistory,
                {
                  status: "Disetujui dan Aktif",
                  timestamp: new Date(),
                  updatedBy: currentUser.uid,
                  notes: `Pengajuan restrukturisasi #${loanId.substring(0, 8)} ditolak. Pinjaman dikembalikan ke status aktif.`,
                },
              ],
            });
          }
        }
      }

      setSuccess("Pengajuan pinjaman berhasil ditolak");
      setSelectedLoan(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting loan:", error);
      setError("Gagal menolak pengajuan pinjaman");
    }
  };

  // Handle direct rejection (called from RestrukturisasiReviewModal with explicit reason)
  const handleRejectDirect = async (loanId, reason) => {
    if (!reason || !reason.trim()) throw new Error("Alasan penolakan wajib diisi");
    try {
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) throw new Error("Pinjaman tidak ditemukan");

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];
      const isDirectorReject = userRole === "Direktur" || userRole === "Director";

      let rejectionStatus;
      if (isDirectorReject) rejectionStatus = "Ditolak Direktur";
      else if (userRole === "BAK") rejectionStatus = "Ditolak BAK";
      else if (userRole === "Wakil Rektor 2") rejectionStatus = "Ditolak Wakil Rektor 2";

      await updateDoc(loanRef, {
        status: rejectionStatus,
        alasanPenolakan: reason,
        updatedAt: serverTimestamp(),
        history: [
          ...currentHistory,
          {
            status: rejectionStatus,
            timestamp: new Date(),
            updatedBy: currentUser.uid,
            notes: `Ditolak dengan alasan: ${reason}`,
          },
        ],
      });

      if (loanData.restructuredFromLoanId) {
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);
        if (oldLoanSnap.exists()) {
          const oldLoanData = oldLoanSnap.data();
          if (oldLoanData.status === "Menunggu Persetujuan Restrukturisasi") {
            await updateDoc(oldLoanRef, {
              status: "Disetujui dan Aktif",
              restructuredToLoanId: null,
              updatedAt: serverTimestamp(),
              history: [
                ...(oldLoanData.history || []),
                {
                  status: "Disetujui dan Aktif",
                  timestamp: new Date(),
                  updatedBy: currentUser.uid,
                  notes: `Pengajuan restrukturisasi #${loanId.substring(0, 8)} ditolak. Pinjaman dikembalikan ke status aktif.`,
                },
              ],
            });
          }
        }
      }

      setSuccess("Pengajuan pinjaman berhasil ditolak");
    } catch (error) {
      console.error("Error rejecting loan:", error);
      throw error;
    }
  };

  // Handle loan revision
  const handleRevise = async (loanId) => {
    if (!revisionAmount && !revisionTenor) {
      setError("Harap masukkan jumlah revisi atau tenor baru");
      return;
    }

    if (!window.confirm("Apakah Anda yakin merevisi pinjaman ini?")) return;

    try {
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];
      const isRestrukturisasi = !!loanData.restructuredFromLoanId;
      const sisaHutangLama = loanData.sisaPinjamanSebelumnya || 0;
      const oldRemainingTenor = isRestrukturisasi
        ? (loanData.tenor || 0) - (loanData.additionalTenor || 0)
        : 0;

      const updateData = {
        updatedAt: serverTimestamp(),
        status: "Direvisi BAK",
        history: [...currentHistory],
      };

      const changes = [];

      if (revisionAmount) {
        const revisedAmount = typeof revisionAmount === 'string'
          ? parseInt(revisionAmount.replace(/\./g, ""))
          : revisionAmount;

        if (isRestrukturisasi && revisedAmount < sisaHutangLama) {
          setError(`Jumlah pinjaman tidak boleh kurang dari sisa hutang lama (${formatRupiah(sisaHutangLama)})`);
          return;
        }

        updateData.jumlahPinjaman = revisedAmount;
        updateData.biayaAdmin = calculateFee(revisedAmount);
        updateData.sisaHutang = revisedAmount;

        if (isRestrukturisasi) {
          const newPinjamanBaru = revisedAmount - sisaHutangLama;
          updateData.pinjamanBaru = newPinjamanBaru;

          const oldLoanId = loanData.restructuredFromLoanId;
          updateData.catatanTambahan = [
            `Restrukturisasi dari pinjaman #${oldLoanId.substring(0, 8)}. Sisa hutang saat pengajuan: ${formatRupiah(sisaHutangLama)}, Pinjaman tambahan: ${formatRupiah(newPinjamanBaru)}`,
          ];
          changes.push(`Total pinjaman menjadi ${formatRupiah(revisedAmount)} (sisa hutang lama: ${formatRupiah(sisaHutangLama)}, tambahan: ${formatRupiah(newPinjamanBaru)})`);
        } else {
          changes.push(`Jumlah pinjaman menjadi ${formatRupiah(revisedAmount)}`);
        }
      }

      if (revisionTenor) {
        if (isRestrukturisasi && revisionTenor < oldRemainingTenor) {
          setError(`Tenor tidak boleh kurang dari sisa tenor pinjaman lama (${oldRemainingTenor} bulan)`);
          return;
        }

        updateData.tenor = revisionTenor;

        if (isRestrukturisasi) {
          const newAdditionalTenor = revisionTenor - oldRemainingTenor;
          updateData.additionalTenor = newAdditionalTenor;
          changes.push(`Tenor menjadi ${revisionTenor} bulan (sisa tenor lama: ${oldRemainingTenor}, tambahan: ${newAdditionalTenor})`);
        } else {
          changes.push(`Tenor menjadi ${revisionTenor} bulan`);
        }
      }

      const revisionNotes = "Direvisi: " + changes.join(", ");

      updateData.history.push({
        status: "Direvisi",
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: revisionNotes,
      });

      await updateDoc(loanRef, updateData);

      setSuccess("Pengajuan pinjaman berhasil direvisi");
      setSelectedLoan(null);
      setRevisionAmount("");
      setRevisionTenor("");
    } catch (error) {
      console.error("Error revising loan:", error);
      setError("Gagal merevisi pengajuan pinjaman");
    }
  };

  // Handle direct revision (called from RestrukturisasiReviewModal with explicit values)
  const handleReviseDirect = async (loanId, amount, newTenor) => {
    const savedAmount = revisionAmount;
    const savedTenor = revisionTenor;
    try {
      setRevisionAmount(amount);
      setRevisionTenor(newTenor);
      // Inline the revision logic with explicit values
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);
      if (!loanSnap.exists()) throw new Error("Pinjaman tidak ditemukan");

      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];
      const isRestrukturisasi = !!loanData.restructuredFromLoanId;
      const sisaHutangLama = loanData.sisaPinjamanSebelumnya || 0;
      const oldRemainingTenor = isRestrukturisasi
        ? (loanData.tenor || 0) - (loanData.additionalTenor || 0)
        : 0;

      if (isRestrukturisasi && amount < sisaHutangLama) {
        throw new Error("Jumlah tidak boleh kurang dari sisa hutang lama");
      }
      if (isRestrukturisasi && newTenor < oldRemainingTenor) {
        throw new Error("Tenor tidak boleh kurang dari sisa tenor lama");
      }

      const updateData = {
        updatedAt: serverTimestamp(),
        status: "Direvisi BAK",
        jumlahPinjaman: amount,
        tenor: newTenor,
        biayaAdmin: calculateFee(amount),
        sisaHutang: amount,
        history: [...currentHistory],
      };

      const changes = [];

      if (isRestrukturisasi) {
        const newPinjamanBaru = amount - sisaHutangLama;
        const newAdditionalTenor = newTenor - oldRemainingTenor;
        const oldLoanId = loanData.restructuredFromLoanId;

        updateData.pinjamanBaru = newPinjamanBaru;
        updateData.additionalTenor = newAdditionalTenor;
        updateData.catatanTambahan = [
          `Restrukturisasi dari pinjaman #${oldLoanId.substring(0, 8)}. Sisa hutang saat pengajuan: ${formatRupiah(sisaHutangLama)}, Pinjaman tambahan: ${formatRupiah(newPinjamanBaru)}`,
        ];
        changes.push(`Total pinjaman menjadi ${formatRupiah(amount)} (sisa hutang lama: ${formatRupiah(sisaHutangLama)}, tambahan: ${formatRupiah(newPinjamanBaru)})`);
        changes.push(`Tenor menjadi ${newTenor} bulan (sisa tenor lama: ${oldRemainingTenor}, tambahan: ${newAdditionalTenor})`);
      } else {
        changes.push(`Jumlah pinjaman menjadi ${formatRupiah(amount)}`);
        changes.push(`Tenor menjadi ${newTenor} bulan`);
      }

      updateData.history.push({
        status: "Direvisi",
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: "Direvisi: " + changes.join(", "),
      });

      await updateDoc(loanRef, updateData);
      setSuccess("Pengajuan pinjaman berhasil direvisi");
    } catch (error) {
      console.error("Error revising loan:", error);
      setRevisionAmount(savedAmount);
      setRevisionTenor(savedTenor);
      throw error;
    }
  };

  // Handle making a payment
  const handleMakePayment = async (loanId) => {
    if (
      !window.confirm("Apakah Anda yakin mencatat cicilan untuk pinjaman ini?")
    ) {
      return;
    }

    try {
      // Get the current loan document
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      // Get existing loan data
      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];
      const currentPayments = loanData.jumlahMenyicil || 0;
      const tenor = loanData.tenor || 0;

      // Increment payment count
      const newPaymentCount = currentPayments + 1;

      // Create history entry with client-side timestamp
      const newHistoryEntry = {
        status: "Pembayaran Cicilan", // Use "Pembayaran Cicilan" as the status
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: `${newPaymentCount}/${tenor}`,
      };

      const jumlahPinjaman = loanData.jumlahPinjaman || 0;
      const newSisaHutang = calculateSisaHutang(jumlahPinjaman, newPaymentCount, tenor);

      // Update the document with new payment count and history
      await updateDoc(loanRef, {
        jumlahMenyicil: newPaymentCount,
        sisaHutang: newSisaHutang,
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      });

      setSuccess(`Cicilan ${newPaymentCount} dari ${tenor} berhasil dicatat`);
    } catch (error) {
      console.error("Error recording payment:", error);
      setError("Gagal mencatat pembayaran cicilan");
    }
  };

  // Handle marking a loan as complete
  const handleMarkComplete = async (loanId) => {
    if (
      !window.confirm("Apakah Anda yakin menandai pinjaman ini sebagai Lunas?")
    ) {
      return;
    }

    try {
      // Get the current loan document
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      // Get existing history
      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];
      const tenor = loanData.tenor || 0;

      // Create history entry with client-side timestamp
      const newHistoryEntry = {
        status: "Lunas",
        timestamp: new Date(),
        updatedBy: currentUser.uid,
        notes: "Pinjaman telah dilunasi",
      };

      // Update the document with combined history
      await updateDoc(loanRef, {
        status: "Lunas",
        jumlahMenyicil: tenor,
        sisaHutang: 0,
        tanggalPelunasan: serverTimestamp(),
        updatedAt: serverTimestamp(),
        history: [...currentHistory, newHistoryEntry],
      });

      setSuccess("Pinjaman berhasil ditandai sebagai lunas");
      setViewingLoan(null);
    } catch (error) {
      console.error("Error marking loan as complete:", error);
      setError("Gagal menandai pinjaman sebagai lunas");
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate loan end date based on approval date and tenor
  const calculateEndDate = (approvalDate, tenor) => {
    if (!approvalDate || !tenor) return "-";

    try {
      // Convert Firebase timestamp to JavaScript Date
      const startDate = approvalDate.toDate();

      // Add tenor months to the start date
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + tenor);

      // Format the end date without time
      return endDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error calculating end date:", error);
      return "-";
    }
  };

  // Check if loan is overdue based on end date
  const isLoanOverdue = (approvalDate, tenor) => {
    if (!approvalDate || !tenor) return false;

    try {
      const startDate = approvalDate.toDate();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + tenor);

      const now = new Date();
      return now >= endDate;
    } catch (error) {
      console.error("Error checking if loan is overdue:", error);
      return false;
    }
  };

  // Calculate payment progress in months
  const calculatePaymentProgress = (approvalDate, tenor) => {
    if (!approvalDate || !tenor) return "0/0";

    try {
      const startDate = approvalDate.toDate();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + tenor);

      const now = new Date();

      // Calculate months elapsed since approval
      const monthsElapsed =
        (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth());

      // Ensure we don't exceed the tenor
      const monthsPaid = Math.min(Math.max(0, monthsElapsed), tenor);

      return `${monthsPaid}/${tenor}`;
    } catch (error) {
      console.error("Error calculating payment progress:", error);
      return "0/0";
    }
  };

  // Handle uploading payment proof and activating the loan
  const handleUploadPaymentProof = async (loanId, file) => {
    if (!file) {
      setError("Harap pilih file bukti transfer");
      return;
    }

    if (!window.confirm("Apakah Anda yakin mengupload bukti transfer ini?")) {
      return;
    }

    try {
      // Get the current loan document
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      // Get existing loan data
      const loanData = loanSnap.data();
      const currentHistory = loanData.history || [];

      // Upload file to Firebase Storage
      const fileName = `loan_proof_${loanId}_${Date.now()}.${file.name
        .split(".")
        .pop()}`;
      const storagePath = `loan_proofs/${fileName}`;

      // Create a storage reference
      const storageRef = ref(storage, storagePath);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      if (loanData.restructuredFromLoanId) {
        // Re-read old loan for the LATEST sisaHutang at activation time
        const oldLoanRef = doc(db, spPath, loanData.restructuredFromLoanId);
        const oldLoanSnap = await getDoc(oldLoanRef);

        if (!oldLoanSnap.exists()) {
          throw new Error("Pinjaman lama tidak ditemukan");
        }

        const oldLoanData = oldLoanSnap.data();
        const oldHistory = oldLoanData.history || [];
        const latestSisaHutang = oldLoanData.sisaHutang ?? calculateSisaHutang(
          oldLoanData.jumlahPinjaman || 0,
          oldLoanData.jumlahMenyicil || 0,
          oldLoanData.tenor || 1,
        );
        const latestRemainingMonths = Math.max(0, (oldLoanData.tenor || 0) - (oldLoanData.jumlahMenyicil || 0));
        const pinjamanBaru = loanData.pinjamanBaru || 0;
        const additionalTenor = loanData.additionalTenor || 0;

        const actualJumlahPinjaman = latestSisaHutang + pinjamanBaru;
        const actualTenor = latestRemainingMonths + additionalTenor;
        const actualBiayaAdmin = calculateFee(actualJumlahPinjaman);

        const activationNotes = `Sisa hutang Rp ${latestSisaHutang.toLocaleString("id-ID")} dari pinjaman #${loanData.restructuredFromLoanId.substring(0, 8)} ditransfer ke pinjaman ini. Total pinjaman: Rp ${actualJumlahPinjaman.toLocaleString("id-ID")}, Tenor: ${actualTenor} bulan`;

        const newHistoryEntry = {
          status: "Disetujui dan Aktif",
          timestamp: new Date(),
          updatedBy: currentUser.uid,
          notes: activationNotes,
        };

        await updateDoc(loanRef, {
          status: "Disetujui dan Aktif",
          buktiTransfer: downloadURL,
          buktiTransferPath: storagePath,
          tanggalDisetujui: serverTimestamp(),
          jumlahMenyicil: 0,
          jumlahPinjaman: actualJumlahPinjaman,
          tenor: actualTenor,
          sisaHutang: actualJumlahPinjaman,
          sisaPinjamanSebelumnya: latestSisaHutang,
          biayaAdmin: actualBiayaAdmin,
          updatedAt: serverTimestamp(),
          history: [...currentHistory, newHistoryEntry],
        });

        const oldLoanRestructureNotes = `Sisa hutang Rp ${latestSisaHutang.toLocaleString("id-ID")} ditransfer ke pinjaman #${loanId.substring(0, 8)}. Total pinjaman baru: Rp ${actualJumlahPinjaman.toLocaleString("id-ID")}`;

        await updateDoc(oldLoanRef, {
          status: "Direstrukturisasi",
          restructuredToLoanId: loanId,
          sisaHutang: 0,
          updatedAt: serverTimestamp(),
          history: [
            ...oldHistory,
            {
              status: "Direstrukturisasi",
              timestamp: new Date(),
              updatedBy: currentUser.uid,
              notes: oldLoanRestructureNotes,
            },
          ],
        });
      } else {
        const jumlahPinjaman = loanData.jumlahPinjaman || 0;
        const biayaAdmin = calculateFee(jumlahPinjaman);

        const newHistoryEntry = {
          status: "Disetujui dan Aktif",
          timestamp: new Date(),
          updatedBy: currentUser.uid,
          notes: "Bukti transfer telah diupload, pinjaman diaktifkan",
        };

        await updateDoc(loanRef, {
          status: "Disetujui dan Aktif",
          buktiTransfer: downloadURL,
          buktiTransferPath: storagePath,
          tanggalDisetujui: serverTimestamp(),
          jumlahMenyicil: 0,
          sisaHutang: jumlahPinjaman,
          biayaAdmin: biayaAdmin,
          updatedAt: serverTimestamp(),
          history: [...currentHistory, newHistoryEntry],
        });
      }

      setSuccess(
        "Bukti transfer berhasil diupload dan pinjaman telah diaktifkan"
      );
    } catch (error) {
      console.error("Error uploading payment proof:", error);
      setError("Gagal mengupload bukti transfer");
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Disetujui dan Aktif":
      case "Lunas":
      case "Pembayaran Cicilan":
        return "status-badge success";
      case "Ditolak BAK":
      case "Ditolak Wakil Rektor 2":
        return "status-badge error";
      case "Direvisi BAK":
        return "status-badge warning";
      case "Menunggu Transfer BAK":
        return "status-badge warning";
      case "Menunggu Persetujuan Restrukturisasi":
        return "status-badge restructuring-pending";
      case "Direstrukturisasi":
        return "status-badge restructured";
      default:
        return "status-badge info";
    }
  };

  const fetchLoanById = async (loanId) => {
    const existing = loans.find((l) => l.id === loanId);
    if (existing) return existing;

    try {
      const loanRef = doc(db, spPath, loanId);
      const loanSnap = await getDoc(loanRef);
      if (loanSnap.exists()) {
        return { id: loanSnap.id, ...loanSnap.data() };
      }
    } catch (err) {
      console.error("Error fetching loan:", err);
    }
    return null;
  };

  // Handle exporting loans to Excel
  const handleExportToExcel = () => {
    // Show loading message
    setSuccess("Memproses ekspor data...");
    setError(""); // Clear any previous errors

    try {
      // Use the exportLoansToExcel utility (no need to pass calculateEndDate anymore)
      const result = exportLoansToExcel(filteredLoans, formatDate);

      // Show success message
      if (result) {
        setSuccess("Data berhasil diekspor ke Excel");
      } else {
        setError("Gagal mengekspor data: tidak ada data yang diekspor");
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError(
        `Gagal mengekspor data: ${error.message || "Terjadi kesalahan"}`
      );
      setSuccess("");
    }

    // Clear messages after 3 seconds
    setTimeout(() => {
      setSuccess("");
      setError("");
    }, 3000);
  };

  // Handle updating bank details for a loan
  const handleUpdateBankDetails = async (loanId, bankDetails) => {
    try {
      const loanRef = doc(db, spPath, loanId);
      
      // Update just the bankDetails field
      await updateDoc(loanRef, {
        bankDetails: bankDetails,
        updatedAt: serverTimestamp()
      });
      
      setSuccess("Detail bank berhasil diperbarui");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("Error updating bank details:", error);
      setError("Gagal memperbarui detail bank: " + error.message);
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError("");
      }, 3000);
      
      return false;
    }
  };
  
  // Handle updating user data in the loan document (not in users collection)
  const handleUpdateUserData = async (loanId, userData) => {
    try {
      // Get the loan document
      const loanRef = doc(db, spPath, loanId);
      const loanDoc = await getDoc(loanRef);
      
      if (!loanDoc.exists()) {
        throw new Error("Dokumen pinjaman tidak ditemukan");
      }
      
      // Get the current userData from the loan
      const currentUserData = loanDoc.data().userData || {};
      
      // Update the userData field in the loan document
      await updateDoc(loanRef, {
        userData: {
          ...currentUserData,
          ...userData,
        },
        updatedAt: serverTimestamp()
      });
      
      setSuccess("Data anggota berhasil diperbarui");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
      
      return true;
    } catch (error) {
      console.error("Error updating user data:", error);
      setError("Gagal memperbarui data anggota: " + error.message);
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setError("");
      }, 3000);
      
      return false;
    }
  };

  const migrateLoansWithNewFields = async () => {
    if (!window.confirm(
      "Ini akan memperbarui field biayaAdmin dan sisaHutang ke semua dokumen pinjaman. Lanjutkan?"
    )) return;

    try {
      const allLoansSnap = await getDocs(collection(db, spPath));
      let updated = 0;

      for (const loanDoc of allLoansSnap.docs) {
        const data = loanDoc.data();
        const jumlahPinjaman = data.jumlahPinjaman || 0;
        const jumlahMenyicil = data.jumlahMenyicil || 0;
        const tenor = data.tenor || 1;

        const biayaAdmin = calculateFee(jumlahPinjaman);
        const zeroStatuses = ["Lunas", "Direstrukturisasi"];
        const sisaHutang = zeroStatuses.includes(data.status)
          ? 0
          : calculateSisaHutang(jumlahPinjaman, jumlahMenyicil, tenor);

        await updateDoc(doc(db, spPath, loanDoc.id), {
          biayaAdmin,
          sisaHutang,
        });
        updated++;
      }

      setSuccess(`Migrasi selesai: ${updated} dokumen diperbarui`);
    } catch (err) {
      console.error("Migration error:", err);
      setError("Gagal menjalankan migrasi: " + err.message);
    }
  };

  return {
    loans,
    filteredLoans,
    loading,
    error,
    success,
    selectedLoan,
    setSelectedLoan,
    revisionAmount,
    setRevisionAmount,
    rejectionReason,
    setRejectionReason,
    userRole,
    viewingLoan,
    setViewingLoan,
    revisionTenor,
    setRevisionTenor,
    nameFilter,
    setNameFilter,
    statusFilter,
    setStatusFilter,
    startDateFilter,
    setStartDateFilter,
    endDateFilter,
    setEndDateFilter,
    handleApprove,
    handleReject,
    handleRejectDirect,
    handleRevise,
    handleReviseDirect,
    handleMakePayment,
    handleMarkComplete,
    handleUploadPaymentProof,
    handleExportToExcel,
    handleUpdateBankDetails,
    handleUpdateUserData,
    fetchLoanById,
    migrateLoansWithNewFields,
    formatDate,
    calculateEndDate,
    isLoanOverdue,
    calculatePaymentProgress,
    getStatusBadgeClass,
  };
};

export default useSimpanPinjam;
