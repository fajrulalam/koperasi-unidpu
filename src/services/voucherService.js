import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch 
} from "firebase/firestore";
import { db, getEnvironmentCollection, getEnvironmentDoc } from "../firebase";

export const voucherService = {
  async getVoucherGroups(isProduction = true) {
    try {
      const voucherGroupsRef = getEnvironmentCollection("voucherGroups", isProduction);
      const q = query(voucherGroupsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching voucher groups:", error);
      throw error;
    }
  },

  async getVoucherGroupById(voucherGroupId, isProduction = true) {
    try {
      const voucherGroupRef = getEnvironmentDoc("voucherGroups", voucherGroupId, isProduction);
      const doc = await getDoc(voucherGroupRef);
      if (doc.exists()) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error("Error fetching voucher group:", error);
      throw error;
    }
  },

  async getVouchersByGroupId(voucherGroupId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(vouchersRef, where("voucherGroupId", "==", voucherGroupId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      throw error;
    }
  },

  async getMembers(isProduction = true) {
    try {
      const usersRef = getEnvironmentCollection("users", isProduction);
      const q = query(usersRef, where("role", "==", "Member"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching members:", error);
      throw error;
    }
  },

  async createVoucherGroup(voucherData, selectedMembers, isProduction = true, onProgress) {
    try {
      const batch = writeBatch(db);
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0];
      const timestamp = Math.floor(currentDate.getTime() / 1000);
      
      const voucherGroupId = `${dateString}_${voucherData.voucherName.replace(/\s+/g, '_')}_${timestamp}`;
      
      const voucherGroupRef = getEnvironmentDoc("voucherGroups", voucherGroupId, isProduction);
      
      const voucherGroupDoc = {
        voucherGroupId,
        voucherName: voucherData.voucherName,
        value: voucherData.value,
        activeDate: voucherData.activeDate,
        expireDate: voucherData.expireDate,
        createdAt: currentDate,
        totalVouchers: selectedMembers.length,
        isActive: voucherData.isActive || true
      };
      
      batch.set(voucherGroupRef, voucherGroupDoc);
      
      let processedCount = 0;
      const totalCount = selectedMembers.length;
      
      for (const member of selectedMembers) {
        const voucherRef = doc(getEnvironmentCollection("vouchers", isProduction));
        
        const voucherDoc = {
          voucherName: voucherData.voucherName,
          activeDate: voucherData.activeDate,
          expireDate: voucherData.expireDate,
          voucherGroupId,
          value: voucherData.value,
          userId: member.id,
          nama: member.nama,
          kantor: member.kantor,
          satuanKerja: member.satuanKerja,
          isClaimed: false,
          isActive: voucherData.isActive || true,
          createdAt: currentDate
        };
        
        batch.set(voucherRef, voucherDoc);
        
        processedCount++;
        if (onProgress) {
          onProgress(processedCount, totalCount);
        }
      }
      
      await batch.commit();
      return voucherGroupId;
    } catch (error) {
      console.error("Error creating voucher group:", error);
      throw error;
    }
  },

  async updateVoucherGroup(voucherGroupId, updateData, isProduction = true) {
    try {
      const voucherGroupRef = getEnvironmentDoc("voucherGroups", voucherGroupId, isProduction);
      await updateDoc(voucherGroupRef, updateData);
      
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(vouchersRef, where("voucherGroupId", "==", voucherGroupId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        const voucherRef = doc.ref;
        const voucherUpdateData = {};
        
        if (updateData.value !== undefined) voucherUpdateData.value = updateData.value;
        if (updateData.activeDate !== undefined) voucherUpdateData.activeDate = updateData.activeDate;
        if (updateData.expireDate !== undefined) voucherUpdateData.expireDate = updateData.expireDate;
        if (updateData.isActive !== undefined) voucherUpdateData.isActive = updateData.isActive;
        
        batch.update(voucherRef, voucherUpdateData);
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error updating voucher group:", error);
      throw error;
    }
  },

  async deleteVoucherFromGroup(voucherId, isProduction = true) {
    try {
      const voucherRef = getEnvironmentDoc("vouchers", voucherId, isProduction);
      await deleteDoc(voucherRef);
    } catch (error) {
      console.error("Error deleting voucher:", error);
      throw error;
    }
  },

  async addMembersToVoucherGroup(voucherGroupId, newMembers, isProduction = true) {
    try {
      const voucherGroupRef = getEnvironmentDoc("voucherGroups", voucherGroupId, isProduction);
      const voucherGroupDoc = await getDoc(voucherGroupRef);
      
      if (!voucherGroupDoc.exists()) {
        throw new Error("Voucher group not found");
      }
      
      const voucherGroupData = voucherGroupDoc.data();
      const batch = writeBatch(db);
      
      for (const member of newMembers) {
        const voucherRef = doc(getEnvironmentCollection("vouchers", isProduction));
        
        const voucherDoc = {
          voucherName: voucherGroupData.voucherName,
          activeDate: voucherGroupData.activeDate,
          expireDate: voucherGroupData.expireDate,
          voucherGroupId,
          value: voucherGroupData.value,
          userId: member.id,
          nama: member.nama,
          kantor: member.kantor,
          satuanKerja: member.satuanKerja,
          isClaimed: false,
          isActive: voucherGroupData.isActive,
          createdAt: new Date()
        };
        
        batch.set(voucherRef, voucherDoc);
      }
      
      const currentVouchers = await this.getVouchersByGroupId(voucherGroupId, isProduction);
      const newTotalVouchers = currentVouchers.length + newMembers.length;
      
      batch.update(voucherGroupRef, {
        totalVouchers: newTotalVouchers
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error adding members to voucher group:", error);
      throw error;
    }
  },

  async deleteVoucherGroup(voucherGroupId, isProduction = true) {
    try {
      const batch = writeBatch(db);
      
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(vouchersRef, where("voucherGroupId", "==", voucherGroupId));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      const voucherGroupRef = getEnvironmentDoc("voucherGroups", voucherGroupId, isProduction);
      batch.delete(voucherGroupRef);
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting voucher group:", error);
      throw error;
    }
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  parseCurrency(currencyString) {
    return parseInt(currencyString.replace(/[^\d]/g, ''), 10) || 0;
  },

  formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
  },

  async getAllVouchersByUserId(userId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(vouchersRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching user vouchers:", error);
      throw error;
    }
  },

  async getAllVouchersByUserDocId(userDocId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(vouchersRef, where("userId", "==", userDocId), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error fetching user vouchers by doc ID:", error);
      throw error;
    }
  }
};