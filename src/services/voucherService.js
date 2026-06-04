import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  limit,
  where,
  orderBy,
  startAfter,
  writeBatch,
} from "firebase/firestore";
import { db, getEnvironmentCollection, getEnvironmentDoc } from "../firebase";

export const voucherService = {
  async getVoucherGroups(
    isProduction = true,
    pageSize = 10,
    lastDocData = null // Renamed for clarity: this is the plain JS object from your state
  ) {
    try {
      const voucherGroupsRef = getEnvironmentCollection(
        "voucherGroups",
        isProduction
      );

      // 1. Define base constraints
      const constraints = [orderBy("createdAt", "desc")];

      // 2. Add cursor if it exists
      if (lastDocData) {
        // IMPORTANT: Because we stripped the 'Snapshot' in the return statement below,
        // 'lastDocData' is a plain object. We must pass the specific field
        // we are sorting by (createdAt) to startAfter().
        constraints.push(startAfter(lastDocData.createdAt));
      }

      // 3. Add limit
      constraints.push(limit(pageSize));

      // 4. Create the query using the spread operator (...)
      const q = query(voucherGroupsRef, ...constraints);

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching voucher groups:", error);
      throw error;
    }
  },

  async getVoucherGroupById(voucherGroupId, isProduction = true) {
    try {
      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );
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
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      throw error;
    }
  },

  async getClaimedVoucherCount(voucherGroupId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId),
        where("isClaimed", "==", true)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error("Error fetching claimed voucher count:", error);
      throw error;
    }
  },

  /**
   * Get campaign voucher counts - specifically for cashbackCampaign type
   * Returns { claimed: number, total: number }
   */
  async getCampaignVoucherCounts(voucherGroupId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);

      // Get total vouchers for this campaign
      const totalQuery = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId)
      );
      const totalSnapshot = await getDocs(totalQuery);

      // Get claimed vouchers (status === "CLAIMED" or status === "REDEEMED")
      const claimedQuery = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId),
        where("status", "==", "CLAIMED")
      );
      const claimedSnapshot = await getDocs(claimedQuery);

      // Get redeemed vouchers
      const redeemedQuery = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId),
        where("status", "==", "REDEEMED")
      );
      const redeemedSnapshot = await getDocs(redeemedQuery);

      return {
        claimed: claimedSnapshot.size + redeemedSnapshot.size,
        total: totalSnapshot.size,
      };
    } catch (error) {
      console.error("Error fetching campaign voucher counts:", error);
      throw error;
    }
  },

  async getMembers(isProduction = true) {
    try {
      const usersRef = getEnvironmentCollection("users", isProduction);
      const q = query(usersRef, where("role", "==", "Member"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching members:", error);
      throw error;
    }
  },

  async createVoucherGroup(
    voucherData,
    selectedMembers,
    isProduction = true,
    onProgress
  ) {
    try {
      const batch = writeBatch(db);
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split("T")[0];
      const timestamp = Math.floor(currentDate.getTime() / 1000);

      const voucherGroupId = `${dateString}_${voucherData.voucherName.replace(
        /\s+/g,
        "_"
      )}_${timestamp}`;

      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );

      const isOneTimeUse = voucherData.isOneTimeUse !== false;

      const voucherGroupDoc = {
        voucherGroupId,
        voucherName: voucherData.voucherName,
        value: voucherData.value,
        activeDate: voucherData.activeDate,
        expireDate: voucherData.expireDate,
        createdAt: currentDate,
        totalVouchers: selectedMembers.length,
        isActive: voucherData.isActive || true,
        isVoucherForMemberOnly: true,
        type: "memberVoucher",
        isOneTimeUse,
      };

      batch.set(voucherGroupRef, voucherGroupDoc);

      let processedCount = 0;
      const totalCount = selectedMembers.length;

      for (const member of selectedMembers) {
        const voucherRef = doc(
          getEnvironmentCollection("vouchers", isProduction)
        );

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
          nomorAnggota: member.nomorAnggota || null,
          isClaimed: false,
          isActive: voucherData.isActive || true,
          isVoucherForMemberOnly: true,
          type: "memberVoucher",
          isOneTimeUse,
          ...(isOneTimeUse ? {} : { amountSpent: 0 }),
          createdAt: currentDate,
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

  async createNonMemberVoucherGroup(
    voucherData,
    quantity,
    isProduction = true,
    onProgress
  ) {
    try {
      const batch = writeBatch(db);
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split("T")[0];
      const timestamp = Math.floor(currentDate.getTime() / 1000);

      const voucherGroupId = `${dateString}_${voucherData.voucherName.replace(
        /\s+/g,
        "_"
      )}_${timestamp}`;

      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );

      const voucherGroupDoc = {
        voucherGroupId,
        voucherName: voucherData.voucherName,
        value: voucherData.value,
        activeDate: voucherData.activeDate,
        expireDate: voucherData.expireDate,
        createdAt: currentDate,
        totalVouchers: quantity,
        isActive: voucherData.isActive || true,
        isVoucherForMemberOnly: false,
      };

      batch.set(voucherGroupRef, voucherGroupDoc);

      let processedCount = 0;

      for (let i = 0; i < quantity; i++) {
        const voucherRef = doc(
          getEnvironmentCollection("vouchers", isProduction)
        );

        const voucherDoc = {
          voucherName: voucherData.voucherName,
          activeDate: voucherData.activeDate,
          expireDate: voucherData.expireDate,
          voucherGroupId,
          value: voucherData.value,
          userId: null,
          nama: null,
          kantor: null,
          satuanKerja: null,
          isClaimed: false,
          isActive: voucherData.isActive || true,
          isVoucherForMemberOnly: false,
          createdAt: currentDate,
        };

        batch.set(voucherRef, voucherDoc);

        processedCount++;
        if (onProgress) {
          onProgress(processedCount, quantity);
        }
      }

      await batch.commit();
      return voucherGroupId;
    } catch (error) {
      console.error("Error creating non-member voucher group:", error);
      throw error;
    }
  },

  /**
   * Creates a cashback campaign voucher group
   * This only creates the voucherGroup document - individual vouchers are created
   * when users accumulate points and claim the reward
   */
  async createCashbackCampaign(campaignData, isProduction = true, onProgress) {
    try {
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split("T")[0];
      const timestamp = Math.floor(currentDate.getTime() / 1000);

      const voucherGroupId = `campaign_${dateString}_${campaignData.voucherName.replace(
        /\s+/g,
        "_"
      )}_${timestamp}`;

      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );

      const voucherGroupDoc = {
        voucherGroupId,
        type: "cashbackCampaign", // Identifier for campaign type
        voucherName: campaignData.voucherName,
        value: campaignData.value, // The voucher value when claimed
        threshold: campaignData.threshold, // Spending threshold to unlock
        activeDate: campaignData.activeDate,
        expireDate: campaignData.expireDate,
        createdAt: currentDate,
        isActive: campaignData.isActive || true,
        totalParticipants: 0, // Will be updated as users participate
        totalClaimed: 0, // Will be updated as users claim rewards
      };

      await setDoc(voucherGroupRef, voucherGroupDoc);

      if (onProgress) {
        onProgress(1, 1);
      }

      return voucherGroupId;
    } catch (error) {
      console.error("Error creating cashback campaign:", error);
      throw error;
    }
  },

  /**
   * Get active cashback campaigns (where current time is between activeDate and expireDate)
   */
  async getActiveCashbackCampaigns(isProduction = true) {
    try {
      const voucherGroupsRef = getEnvironmentCollection(
        "voucherGroups",
        isProduction
      );
      const currentTime = new Date();

      const q = query(
        voucherGroupsRef,
        where("type", "==", "cashbackCampaign"),
        where("isActive", "==", true),
        where("expireDate", ">", currentTime),
        orderBy("expireDate", "asc")
      );

      const snapshot = await getDocs(q);

      // Filter for campaigns that have started (activeDate <= currentTime)
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((campaign) => {
          const activeDate = campaign.activeDate?.toDate
            ? campaign.activeDate.toDate()
            : new Date(campaign.activeDate);
          return activeDate <= currentTime;
        });
    } catch (error) {
      console.error("Error fetching active cashback campaigns:", error);
      throw error;
    }
  },

  /**
   * Get user's campaign progress for a specific campaign
   */
  async getUserCampaignProgress(voucherGroupId, userId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null; // User hasn't participated in this campaign yet
      }

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      };
    } catch (error) {
      console.error("Error fetching user campaign progress:", error);
      throw error;
    }
  },

  /**
   * Create or update user's campaign progress
   * Called when a transaction is completed
   */
  async updateUserCampaignPoints(
    voucherGroupId,
    userId,
    userData,
    campaignData,
    transactionAmount,
    isProduction = true
  ) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);

      // Check if user already has a voucher document for this campaign
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Create new voucher document for tracking progress
        const voucherRef = doc(vouchersRef);
        const currentDate = new Date();

        await setDoc(voucherRef, {
          voucherGroupId,
          voucherName: campaignData.voucherName,
          value: campaignData.value,
          threshold: campaignData.threshold,
          activeDate: campaignData.activeDate,
          expireDate: campaignData.expireDate,
          userId,
          nama: userData.nama,
          kantor: userData.kantor,
          satuanKerja: userData.satuanKerja,
          userPoints: transactionAmount,
          status: "IN_PROGRESS",
          isClaimed: false,
          isActive: false, // Only active when claimed
          type: "cashbackCampaign",
          createdAt: currentDate,
          lastUpdatedAt: currentDate,
        });

        // Update campaign participant count
        const voucherGroupRef = getEnvironmentDoc(
          "voucherGroups",
          voucherGroupId,
          isProduction
        );
        const campaignDoc = await getDoc(voucherGroupRef);
        if (campaignDoc.exists()) {
          await updateDoc(voucherGroupRef, {
            totalParticipants: (campaignDoc.data().totalParticipants || 0) + 1,
          });
        }

        return { created: true, userPoints: transactionAmount };
      } else {
        // Update existing voucher document
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data();

        // Only update if status is IN_PROGRESS
        if (existingData.status === "IN_PROGRESS") {
          const newPoints = (existingData.userPoints || 0) + transactionAmount;

          await updateDoc(existingDoc.ref, {
            userPoints: newPoints,
            lastUpdatedAt: new Date(),
          });

          return { updated: true, userPoints: newPoints };
        }

        // If already CLAIMED or REDEEMED, skip
        return { skipped: true, reason: existingData.status };
      }
    } catch (error) {
      console.error("Error updating user campaign points:", error);
      throw error;
    }
  },

  /**
   * Claim a campaign voucher (when user reaches threshold)
   * Note: isClaimed stays false until the voucher is actually used (redeemed)
   */
  async claimCampaignVoucher(voucherId, isProduction = true) {
    try {
      const voucherRef = getEnvironmentDoc("vouchers", voucherId, isProduction);
      const voucherDoc = await getDoc(voucherRef);

      if (!voucherDoc.exists()) {
        throw new Error("Voucher not found");
      }

      const voucherData = voucherDoc.data();

      // Verify user has reached threshold
      if (voucherData.userPoints < voucherData.threshold) {
        throw new Error("Threshold not reached");
      }

      // Verify status is IN_PROGRESS
      if (voucherData.status !== "IN_PROGRESS") {
        throw new Error("Voucher already claimed or redeemed");
      }

      // Update voucher status to CLAIMED
      // Note: isClaimed stays false - only becomes true when redeemed (used during checkout)
      await updateDoc(voucherRef, {
        status: "CLAIMED",
        isClaimed: false, // Still false - not used yet, just claimed/ready to use
        isActive: true, // Now can be used as a voucher
        claimedAt: new Date(),
      });

      // Update campaign claimed count
      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherData.voucherGroupId,
        isProduction
      );
      const campaignDoc = await getDoc(voucherGroupRef);
      if (campaignDoc.exists()) {
        await updateDoc(voucherGroupRef, {
          totalClaimed: (campaignDoc.data().totalClaimed || 0) + 1,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error claiming campaign voucher:", error);
      throw error;
    }
  },

  /**
   * Redeem a campaign voucher (when used during checkout)
   * This is called when a CLAIMED voucher is actually used as payment
   */
  async redeemCampaignVoucher(voucherId, isProduction = true) {
    try {
      const voucherRef = getEnvironmentDoc("vouchers", voucherId, isProduction);
      const voucherDoc = await getDoc(voucherRef);

      if (!voucherDoc.exists()) {
        throw new Error("Voucher not found");
      }

      const voucherData = voucherDoc.data();

      // Verify status is CLAIMED (ready to be used)
      if (voucherData.status !== "CLAIMED") {
        throw new Error("Voucher is not ready to be redeemed");
      }

      // Update voucher status to REDEEMED
      await updateDoc(voucherRef, {
        status: "REDEEMED",
        isClaimed: true, // Now truly claimed/used
        isActive: false, // No longer active after use
        redeemedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error redeeming campaign voucher:", error);
      throw error;
    }
  },

  async updateVoucherGroup(voucherGroupId, updateData, isProduction = true) {
    try {
      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );
      await updateDoc(voucherGroupRef, updateData);

      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId)
      );
      const snapshot = await getDocs(q);

      // Only update vouchers if there are any to update
      if (snapshot.docs.length > 0) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          const voucherRef = doc.ref;
          const voucherUpdateData = {};

          // Propagate common fields to all voucher documents
          if (updateData.value !== undefined)
            voucherUpdateData.value = updateData.value;
          if (updateData.activeDate !== undefined)
            voucherUpdateData.activeDate = updateData.activeDate;
          if (updateData.expireDate !== undefined)
            voucherUpdateData.expireDate = updateData.expireDate;
          if (updateData.isActive !== undefined)
            voucherUpdateData.isActive = updateData.isActive;
          if (updateData.voucherName !== undefined)
            voucherUpdateData.voucherName = updateData.voucherName;
          // For campaign vouchers, also propagate threshold
          if (updateData.threshold !== undefined)
            voucherUpdateData.threshold = updateData.threshold;

          // Only update if there are changes
          if (Object.keys(voucherUpdateData).length > 0) {
            batch.update(voucherRef, voucherUpdateData);
          }
        });

        await batch.commit();
      }
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

  async addMembersToVoucherGroup(
    voucherGroupId,
    newMembers,
    isProduction = true
  ) {
    try {
      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );
      const voucherGroupDoc = await getDoc(voucherGroupRef);

      if (!voucherGroupDoc.exists()) {
        throw new Error("Voucher group not found");
      }

      const voucherGroupData = voucherGroupDoc.data();
      const batch = writeBatch(db);

      for (const member of newMembers) {
        const voucherRef = doc(
          getEnvironmentCollection("vouchers", isProduction)
        );

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
          createdAt: new Date(),
        };

        batch.set(voucherRef, voucherDoc);
      }

      const currentVouchers = await this.getVouchersByGroupId(
        voucherGroupId,
        isProduction
      );
      const newTotalVouchers = currentVouchers.length + newMembers.length;

      batch.update(voucherGroupRef, {
        totalVouchers: newTotalVouchers,
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
      const q = query(
        vouchersRef,
        where("voucherGroupId", "==", voucherGroupId)
      );
      const snapshot = await getDocs(q);

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      const voucherGroupRef = getEnvironmentDoc(
        "voucherGroups",
        voucherGroupId,
        isProduction
      );
      batch.delete(voucherGroupRef);

      await batch.commit();
    } catch (error) {
      console.error("Error deleting voucher group:", error);
      throw error;
    }
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  parseCurrency(currencyString) {
    return parseInt(currencyString.replace(/[^\d]/g, ""), 10) || 0;
  },

  formatNumber(num) {
    return new Intl.NumberFormat("id-ID").format(num);
  },

  async getAllVouchersByUserId(userId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(
        vouchersRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching user vouchers:", error);
      throw error;
    }
  },

  async getAllVouchersByUserDocId(userDocId, isProduction = true) {
    try {
      const vouchersRef = getEnvironmentCollection("vouchers", isProduction);
      const q = query(
        vouchersRef,
        where("userId", "==", userDocId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching user vouchers by doc ID:", error);
      throw error;
    }
  },

  /**
   * Get member by their nomor anggota (member number)
   * Used for looking up members at POS
   */
  async getMemberByNomorAnggota(nomorAnggota, isProduction = true) {
    try {
      // Users collection is always production (not environment-specific)
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("nomorAnggota", "==", nomorAnggota),
        where("membershipStatus", "==", "approved"),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      };
    } catch (error) {
      console.error("Error fetching member by nomor anggota:", error);
      throw error;
    }
  },
};
