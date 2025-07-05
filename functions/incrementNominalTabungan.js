/**
 * Firebase Cloud Function: Increment Nominal Tabungan
 *
 * This function runs automatically on the 5th of each month to increment
 * the nominalTabungan for approved members with Payroll Deduction payment status.
 *
 * Rules:
 * - Only processes members with paymentStatus: "Payroll Deduction"
 * - Excludes members with paymentStatus: "Yayasan Subsidy" or other statuses
 * - First time: increment by iuranPokok + iuranWajib
 * - Subsequent times: increment by iuranWajib only
 * - Creates detailed logs in tabunganLogs collection
 *
 * Schedule: Runs on the 5th of each month at 00:00 UTC+7 (17:00 UTC)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Scheduled function to run on the 5th of each month
exports.incrementNominalTabungan = functions
  .region("asia-southeast1") // Set to Jakarta region for better performance
  .pubsub.schedule("0 17 4 * *") // 5th day of each month at 1:00 UTC (00:00 UTC+7)
  .timeZone("Asia/Jakarta") // Indonesia timezone
  .onRun(async (context) => {
    console.log("Starting nominal tabungan increment process...");

    try {
      // Get all users with role "Member", approved membership, and Payroll Deduction payment status
      const usersQuery = await db
        .collection("users")
        .where("role", "==", "Member")
        .where("membershipStatus", "==", "approved")
        .where("paymentStatus", "==", "Payroll Deduction")
        .get();

      if (usersQuery.empty) {
        console.log(
          "No approved members with Payroll Deduction payment status found"
        );
        return null;
      }

      const batch = db.batch();
      let processedCount = 0;
      let errorCount = 0;
      const logEntries = [];

      // Create a log document for this batch
      const currentDate = new Date();
      const logDate = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      const timestampEpoch = Math.floor(currentDate.getTime() / 1000);
      const logDocumentName = `${logDate}_tabunganBulanan_${timestampEpoch}`;

      for (const userDoc of usersQuery.docs) {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // Initialize nominalTabungan if it doesn't exist
          const currentNominalTabungan = userData.nominalTabungan || 0;
          const iuranPokok = userData.iuranPokok || 250000;
          const iuranWajib = userData.iuranWajib || 25000;

          let incrementAmount;
          let paymentType;

          // Determine increment amount based on whether user has paid before
          let tipePembayaran;
          if (currentNominalTabungan === 0) {
            // First payment: iuran pokok + iuran wajib
            incrementAmount = iuranPokok + iuranWajib;
            paymentType = "first_payment";
            tipePembayaran = "iuran pokok + iuran wajib";
            console.log(`First payment for user ${userId}: ${incrementAmount}`);
          } else {
            // Subsequent payments: iuran wajib only
            incrementAmount = iuranWajib;
            paymentType = "monthly_payment";
            tipePembayaran = "iuran wajib";
            console.log(
              `Monthly payment for user ${userId}: ${incrementAmount}`
            );
          }

          const newNominalTabungan = currentNominalTabungan + incrementAmount;

          // Update the user document
          const userRef = db.collection("users").doc(userId);
          batch.update(userRef, {
            nominalTabungan: newNominalTabungan,
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentAmount: incrementAmount,
            lastPaymentType: paymentType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Create a tabungan log per user record
          const tabunganLogsPerUserRef = db.collection("tabunganLogsPerUser").doc();
          batch.set(tabunganLogsPerUserRef, {
            userId: userId,
            userEmail: userData.email,
            userName: userData.nama,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            amount: incrementAmount,
            paymentType: paymentType,
            previousBalance: currentNominalTabungan,
            newBalance: newNominalTabungan,
            iuranPokok: paymentType === "first_payment" ? iuranPokok : 0,
            iuranWajib: iuranWajib,
            tabunganLogId: logDocumentName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Add to log entries
          logEntries.push({
            userId: userId,
            nama: userData.nama,
            nomorWhatsapp: userData.nomorWhatsapp,
            nominalIncrement: incrementAmount,
            tipePembayaran: tipePembayaran,
            previousBalance: currentNominalTabungan,
            newBalance: newNominalTabungan,
            tabunganLogsPerUserId: tabunganLogsPerUserRef.id,
            timestamp: new Date(),
          });

          processedCount++;
        } catch (userError) {
          console.error(`Error processing user ${userDoc.id}:`, userError);
          errorCount++;
        }
      }

      // Commit all updates in batch
      await batch.commit();

      // Create tabungan log document
      if (logEntries.length > 0) {
        await db.collection("tabunganLogs").doc(logDocumentName).set({
          type: "tabunganBulanan",
          date: logDate,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampEpoch: timestampEpoch,
          processedCount: processedCount,
          errorCount: errorCount,
          entries: logEntries,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Created tabungan log: ${logDocumentName}`);
      }

      console.log(`Nominal tabungan increment completed:`);
      console.log(`- Processed: ${processedCount} members`);
      console.log(`- Errors: ${errorCount} members`);

      // Create a system log entry
      await db.collection("systemLogs").add({
        operation: "increment_nominal_tabungan",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processedCount: processedCount,
        errorCount: errorCount,
        status: "completed",
      });

      return null;
    } catch (error) {
      console.error("Error in incrementNominalTabungan function:", error);

      // Log the error
      await db.collection("systemLogs").add({
        operation: "increment_nominal_tabungan",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        status: "failed",
      });

      throw error;
    }
  });

// Manual trigger function for testing (can be called via HTTP)
exports.manualIncrementNominalTabungan = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    // Add authentication check here in production
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      console.log("Manual increment triggered");

      // Get all users with role "Member", approved membership, and Payroll Deduction payment status
      const usersQuery = await db
        .collection("users")
        .where("role", "==", "Member")
        .where("membershipStatus", "==", "approved")
        .where("paymentStatus", "==", "Payroll Deduction")
        .get();

      if (usersQuery.empty) {
        return res.status(200).json({
          success: true,
          message: "No approved members with Payroll Deduction payment status found",
          processedCount: 0,
        });
      }

      const batch = db.batch();
      let processedCount = 0;
      let errorCount = 0;
      const logEntries = [];

      // Create a log document for this manual batch
      const currentDate = new Date();
      const logDate = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      const timestampEpoch = Math.floor(currentDate.getTime() / 1000);
      const logDocumentName = `${logDate}_manualTrigger_${timestampEpoch}`;

      for (const userDoc of usersQuery.docs) {
        try {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // Initialize nominalTabungan if it doesn't exist
          const currentNominalTabungan = userData.nominalTabungan || 0;
          const iuranPokok = userData.iuranPokok || 250000;
          const iuranWajib = userData.iuranWajib || 25000;

          let incrementAmount;
          let paymentType;

          // Determine increment amount based on whether user has paid before
          let tipePembayaran;
          if (currentNominalTabungan === 0) {
            // First payment: iuran pokok + iuran wajib
            incrementAmount = iuranPokok + iuranWajib;
            paymentType = "first_payment";
            tipePembayaran = "iuran pokok + iuran wajib";
          } else {
            // Subsequent payments: iuran wajib only
            incrementAmount = iuranWajib;
            paymentType = "monthly_payment";
            tipePembayaran = "iuran wajib";
          }

          const newNominalTabungan = currentNominalTabungan + incrementAmount;

          // Update the user document
          const userRef = db.collection("users").doc(userId);
          batch.update(userRef, {
            nominalTabungan: newNominalTabungan,
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentAmount: incrementAmount,
            lastPaymentType: paymentType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Create a tabungan log per user record
          const tabunganLogsPerUserRef = db.collection("tabunganLogsPerUser").doc();
          batch.set(tabunganLogsPerUserRef, {
            userId: userId,
            userEmail: userData.email,
            userName: userData.nama,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            amount: incrementAmount,
            paymentType: paymentType,
            previousBalance: currentNominalTabungan,
            newBalance: newNominalTabungan,
            iuranPokok: paymentType === "first_payment" ? iuranPokok : 0,
            iuranWajib: iuranWajib,
            tabunganLogId: logDocumentName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Add to log entries
          logEntries.push({
            userId: userId,
            nama: userData.nama,
            nomorWhatsapp: userData.nomorWhatsapp,
            nominalIncrement: incrementAmount,
            tipePembayaran: tipePembayaran,
            previousBalance: currentNominalTabungan,
            newBalance: newNominalTabungan,
            tabunganLogsPerUserId: tabunganLogsPerUserRef.id,
            timestamp: new Date(),
          });

          processedCount++;
        } catch (userError) {
          console.error(`Error processing user ${userDoc.id}:`, userError);
          errorCount++;
        }
      }

      // Commit all updates in batch
      await batch.commit();

      // Create tabungan log document
      if (logEntries.length > 0) {
        await db.collection("tabunganLogs").doc(logDocumentName).set({
          type: "manualTrigger",
          date: logDate,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampEpoch: timestampEpoch,
          processedCount: processedCount,
          errorCount: errorCount,
          entries: logEntries,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      res.status(200).json({
        success: true,
        message: "Manual increment completed successfully",
        processedCount: processedCount,
        errorCount: errorCount,
        logDocumentId: logDocumentName,
      });
    } catch (error) {
      console.error("Manual increment failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

// Initialize nominalTabungan for existing members (one-time setup)
exports.initializeNominalTabungan = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      console.log("Initializing nominalTabungan for existing members...");

      // Get all users with role "Member" who don't have nominalTabungan field
      const usersQuery = await db
        .collection("users")
        .where("role", "==", "Member")
        .get();

      const batch = db.batch();
      let initializedCount = 0;

      for (const userDoc of usersQuery.docs) {
        const userData = userDoc.data();

        // Only initialize if nominalTabungan doesn't exist
        if (userData.nominalTabungan === undefined) {
          const userRef = db.collection("users").doc(userDoc.id);
          batch.update(userRef, {
            nominalTabungan: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          initializedCount++;
        }
      }

      await batch.commit();

      console.log(
        `Initialized nominalTabungan for ${initializedCount} members`
      );

      res.status(200).json({
        success: true,
        message: `Initialized nominalTabungan for ${initializedCount} members`,
      });
    } catch (error) {
      console.error("Initialization failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

// Rollback function to reverse tabungan log entries
exports.rollbackTabunganLog = functions
  .region("asia-southeast1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const { logDocumentId } = req.body;

      if (!logDocumentId) {
        return res.status(400).json({
          success: false,
          error: "Log document ID is required",
        });
      }

      console.log(`Starting rollback for log: ${logDocumentId}`);

      // Get the log document
      const logDoc = await db
        .collection("tabunganLogs")
        .doc(logDocumentId)
        .get();

      if (!logDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Log document not found",
        });
      }

      const logData = logDoc.data();
      const entries = logData.entries || [];

      if (entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No entries found in log document",
        });
      }

      const batch = db.batch();
      let rollbackCount = 0;
      let errorCount = 0;

      // Process each entry to rollback
      for (const entry of entries) {
        try {
          const userRef = db.collection("users").doc(entry.userId);
          const userDoc = await userRef.get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            const currentNominalTabungan = userData.nominalTabungan || 0;
            const newNominalTabungan = Math.max(
              0,
              currentNominalTabungan - entry.nominalIncrement
            );

            batch.update(userRef, {
              nominalTabungan: newNominalTabungan,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            rollbackCount++;
            console.log(
              `Rollback for user ${entry.userId}: ${currentNominalTabungan} -> ${newNominalTabungan}`
            );
          } else {
            console.warn(`User ${entry.userId} not found for rollback`);
            errorCount++;
          }
        } catch (entryError) {
          console.error(
            `Error rolling back entry for user ${entry.userId}:`,
            entryError
          );
          errorCount++;
        }
      }

      // Commit the rollback batch
      await batch.commit();

      // Delete related tabunganLogsPerUser documents
      const tabunganLogsPerUserQuery = await db
        .collection("tabunganLogsPerUser")
        .where("tabunganLogId", "==", logDocumentId)
        .get();

      if (!tabunganLogsPerUserQuery.empty) {
        const deletePerUserBatch = db.batch();
        tabunganLogsPerUserQuery.docs.forEach((doc) => {
          deletePerUserBatch.delete(doc.ref);
        });
        await deletePerUserBatch.commit();
        console.log(`Deleted ${tabunganLogsPerUserQuery.docs.length} tabunganLogsPerUser documents`);
      }

      // Delete the log document
      await db.collection("tabunganLogs").doc(logDocumentId).delete();

      console.log(
        `Rollback completed: ${rollbackCount} users processed, ${errorCount} errors`
      );

      res.status(200).json({
        success: true,
        message: `Rollback completed successfully`,
        rollbackCount: rollbackCount,
        errorCount: errorCount,
      });
    } catch (error) {
      console.error("Rollback failed:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
