import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, getEnvironmentCollection, getEnvironmentDoc } from "../../firebase";

const useVoucherKoperasi = (isProduction = true) => {
  const [voucherGroups, setVoucherGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  
  // Collection references
  const vouchersCollection = getEnvironmentCollection("vouchers", isProduction);
  const voucherGroupCollection = getEnvironmentCollection("voucherGroup", isProduction);
  const usersCollection = getEnvironmentCollection("users", isProduction);

  // Fetch all voucher groups
  const fetchVoucherGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        voucherGroupCollection,
        orderBy("activeDate", "desc")
      );
      
      // Immediately check if the collection is empty to avoid showing loading indefinitely
      const initialSnapshot = await getDocs(q);
      if (initialSnapshot.empty) {
        setVoucherGroups([]);
        setLoading(false);
      }
      
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const groups = [];
          querySnapshot.forEach((doc) => {
            groups.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          setVoucherGroups(groups);
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching voucher groups:", err);
          setError(err.message);
          setLoading(false);
        }
      );
      
      return unsubscribe;
    } catch (err) {
      console.error("Error setting up voucher groups listener:", err);
      setError(err.message);
      setLoading(false);
      return () => {};
    }
  }, [voucherGroupCollection]);

  // Fetch vouchers by group ID
  const fetchVouchersByGroupId = useCallback(async (groupId) => {
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        vouchersCollection,
        where("voucherGroupId", "==", groupId)
      );
      
      const querySnapshot = await getDocs(q);
      const vouchers = [];
      
      querySnapshot.forEach((doc) => {
        vouchers.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      setLoading(false);
      return vouchers;
    } catch (err) {
      console.error("Error fetching vouchers by group ID:", err);
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [vouchersCollection]);

  // Fetch members (users with role "Member")
  const fetchMembers = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      let q = query(
        usersCollection,
        where("role", "==", "Member")
      );
      
      const querySnapshot = await getDocs(q);
      let members = [];
      
      querySnapshot.forEach((doc) => {
        members.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      // Apply filters if provided
      if (filters.kantor && filters.kantor.length > 0) {
        members = members.filter(member => filters.kantor.includes(member.kantor));
      }
      
      if (filters.satuanKerja && filters.satuanKerja.length > 0) {
        members = members.filter(member => filters.satuanKerja.includes(member.satuanKerja));
      }
      
      setLoading(false);
      return members;
    } catch (err) {
      console.error("Error fetching members:", err);
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [usersCollection]);

  // Get unique kantor and satuanKerja values for filtering
  const fetchFilterOptions = useCallback(async () => {
    try {
      const members = await fetchMembers();
      
      // Extract unique values
      const kantorOptions = [...new Set(members.map(member => member.kantor).filter(Boolean))];
      const satuanKerjaOptions = [...new Set(members.map(member => member.satuanKerja).filter(Boolean))];
      
      return {
        kantorOptions,
        satuanKerjaOptions
      };
    } catch (err) {
      console.error("Error fetching filter options:", err);
      setError(err.message);
      return {
        kantorOptions: [],
        satuanKerjaOptions: []
      };
    }
  }, [fetchMembers]);

  // Create a new voucher group and individual vouchers
  const createVouchers = useCallback(async (voucherData, selectedMembers) => {
    setError(null);
    setProgress({ current: 0, total: selectedMembers.length + 1, percentage: 0 });
    
    try {
      // Format the document ID for voucherGroup
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const timestampSeconds = Math.floor(currentDate.getTime() / 1000);
      const voucherGroupId = `${dateString}_${voucherData.voucherName.replace(/\s+/g, "_")}_${timestampSeconds}`;
      
      // Convert dates to Firestore timestamps
      const activeDate = voucherData.startNow 
        ? Timestamp.now() 
        : Timestamp.fromDate(new Date(voucherData.activeDate));
      
      const expireDate = Timestamp.fromDate(new Date(voucherData.expireDate));
      
      // Create voucher group document
      await addDoc(voucherGroupCollection, {
        voucherName: voucherData.voucherName,
        voucherGroupId: voucherGroupId,
        activeDate: activeDate,
        expireDate: expireDate,
        value: voucherData.value,
        createdAt: serverTimestamp(),
        totalVouchers: selectedMembers.length
      });
      
      // Update progress
      setProgress(prev => ({
        current: 1,
        total: prev.total,
        percentage: Math.round((1 / prev.total) * 100)
      }));
      
      // Create individual vouchers for each selected member
      for (let i = 0; i < selectedMembers.length; i++) {
        const member = selectedMembers[i];
        
        await addDoc(vouchersCollection, {
          voucherName: voucherData.voucherName,
          activeDate: activeDate,
          expireDate: expireDate,
          voucherGroupId: voucherGroupId,
          value: voucherData.value,
          userId: member.id,
          nama: member.nama,
          kantor: member.kantor,
          satuanKerja: member.satuanKerja,
          isClaimed: false,
          isActive: voucherData.startNow || new Date() >= new Date(voucherData.activeDate),
          createdAt: serverTimestamp()
        });
        
        // Update progress
        setProgress(prev => ({
          current: prev.current + 1,
          total: prev.total,
          percentage: Math.round(((prev.current + 1) / prev.total) * 100)
        }));
      }
      
      return true;
    } catch (err) {
      console.error("Error creating vouchers:", err);
      setError(err.message);
      return false;
    }
  }, [voucherGroupCollection, vouchersCollection]);

  // Delete a voucher
  const deleteVoucher = useCallback(async (voucherId) => {
    setError(null);
    
    try {
      const voucherRef = getEnvironmentDoc("vouchers", voucherId, isProduction);
      await deleteDoc(voucherRef);
      return true;
    } catch (err) {
      console.error("Error deleting voucher:", err);
      setError(err.message);
      return false;
    }
  }, [isProduction]);

  // Add new vouchers to an existing group
  const addVouchersToGroup = useCallback(async (groupData, newMembers) => {
    setError(null);
    setProgress({ current: 0, total: newMembers.length, percentage: 0 });
    
    try {
      for (let i = 0; i < newMembers.length; i++) {
        const member = newMembers[i];
        
        await addDoc(vouchersCollection, {
          voucherName: groupData.voucherName,
          activeDate: groupData.activeDate,
          expireDate: groupData.expireDate,
          voucherGroupId: groupData.voucherGroupId,
          value: groupData.value,
          userId: member.id,
          nama: member.nama,
          kantor: member.kantor,
          satuanKerja: member.satuanKerja,
          isClaimed: false,
          isActive: groupData.isActive,
          createdAt: serverTimestamp()
        });
        
        // Update progress
        setProgress(prev => ({
          current: prev.current + 1,
          total: prev.total,
          percentage: Math.round(((prev.current + 1) / prev.total) * 100)
        }));
      }
      
      // Update the voucher group total count
      const groupRef = doc(voucherGroupCollection, groupData.id);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const currentTotal = groupDoc.data().totalVouchers || 0;
        await updateDoc(groupRef, {
          totalVouchers: currentTotal + newMembers.length
        });
      }
      
      return true;
    } catch (err) {
      console.error("Error adding vouchers to group:", err);
      setError(err.message);
      return false;
    }
  }, [vouchersCollection, voucherGroupCollection]);

  // Update voucher group details and all related vouchers
  const updateVoucherGroup = useCallback(async (groupId, updatedData) => {
    setError(null);
    
    try {
      // First update the group document
      const groupRef = doc(voucherGroupCollection, groupId);
      await updateDoc(groupRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });
      
      // Then update all vouchers in this group
      const q = query(
        vouchersCollection,
        where("voucherGroupId", "==", updatedData.voucherGroupId)
      );
      
      const querySnapshot = await getDocs(q);
      const updatePromises = [];
      
      querySnapshot.forEach((doc) => {
        const voucherRef = getEnvironmentDoc("vouchers", doc.id, isProduction);
        updatePromises.push(
          updateDoc(voucherRef, {
            voucherName: updatedData.voucherName,
            activeDate: updatedData.activeDate,
            expireDate: updatedData.expireDate,
            value: updatedData.value,
            isActive: updatedData.isActive,
            updatedAt: serverTimestamp()
          })
        );
      });
      
      await Promise.all(updatePromises);
      return true;
    } catch (err) {
      console.error("Error updating voucher group:", err);
      setError(err.message);
      return false;
    }
  }, [voucherGroupCollection, vouchersCollection, isProduction]);

  // Format currency with thousand separator
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  // Parse currency string back to number
  const parseCurrency = (value) => {
    return parseInt(value.replace(/\./g, ''), 10);
  };

  // Initialize data fetching
  useEffect(() => {
    let unsubscribeFunction = () => {};
    
    // Set up the listener and store the unsubscribe function
    const setupListener = async () => {
      unsubscribeFunction = await fetchVoucherGroups();
    };
    
    setupListener();
    
    // Return cleanup function
    return () => {
      if (typeof unsubscribeFunction === 'function') {
        unsubscribeFunction();
      }
    };
  }, [fetchVoucherGroups]);

  return {
    voucherGroups,
    loading,
    error,
    progress,
    fetchVoucherGroups,
    fetchVouchersByGroupId,
    fetchMembers,
    fetchFilterOptions,
    createVouchers,
    deleteVoucher,
    addVouchersToGroup,
    updateVoucherGroup,
    formatCurrency,
    parseCurrency
  };
};

export default useVoucherKoperasi;
