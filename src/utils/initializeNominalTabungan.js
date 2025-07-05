import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Initialize nominalTabungan field for existing users
 * This function should be called once to add the nominalTabungan field
 * to all existing users with role "Member"
 */
export const initializeNominalTabunganForExistingUsers = async () => {
  try {
    console.log('Starting initialization of nominalTabungan field...');
    
    // Query all users with role "Member"
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'Member')
    );
    
    const querySnapshot = await getDocs(usersQuery);
    
    if (querySnapshot.empty) {
      console.log('No members found in the database');
      return {
        success: true,
        message: 'No members found in the database',
        total: 0,
        initialized: 0,
        skipped: 0
      };
    }
    
    console.log(`Found ${querySnapshot.size} members`);
    
    let initializeCount = 0;
    let skipCount = 0;
    const errors = [];
    
    // Process each user
    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if nominalTabungan already exists
      if (userData.nominalTabungan !== undefined) {
        console.log(`Skipping user ${userId} - nominalTabungan already exists: ${userData.nominalTabungan}`);
        skipCount++;
        continue;
      }
      
      // Initialize nominalTabungan to 0
      try {
        await updateDoc(doc(db, 'users', userId), {
          nominalTabungan: 0,
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Initialized nominalTabungan for user ${userId} (${userData.nama || userData.email})`);
        initializeCount++;
        
      } catch (updateError) {
        console.error(`❌ Failed to update user ${userId}:`, updateError);
        errors.push(`Failed to update user ${userId}: ${updateError.message}`);
      }
    }
    
    const result = {
      success: true,
      message: 'Initialization completed',
      total: querySnapshot.size,
      initialized: initializeCount,
      skipped: skipCount,
      errors: errors
    };
    
    console.log('\n=== Initialization Summary ===');
    console.log(`Total members found: ${result.total}`);
    console.log(`Initialized: ${result.initialized}`);
    console.log(`Skipped (already had field): ${result.skipped}`);
    console.log(`Errors: ${errors.length}`);
    console.log('✅ Initialization completed!');
    
    return result;
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    return {
      success: false,
      message: `Initialization failed: ${error.message}`,
      total: 0,
      initialized: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
};

/**
 * Check initialization status
 * Returns information about how many users have/don't have nominalTabungan
 */
export const checkNominalTabunganStatus = async () => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'Member')
    );
    
    const querySnapshot = await getDocs(usersQuery);
    
    let withField = 0;
    let withoutField = 0;
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.nominalTabungan !== undefined) {
        withField++;
      } else {
        withoutField++;
      }
    });
    
    return {
      total: querySnapshot.size,
      withNominalTabungan: withField,
      withoutNominalTabungan: withoutField,
      isFullyInitialized: withoutField === 0
    };
    
  } catch (error) {
    console.error('Error checking status:', error);
    throw error;
  }
};