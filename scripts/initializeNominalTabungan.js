/**
 * Script to initialize nominalTabungan field for existing users
 * 
 * This script should be run once to add the nominalTabungan field
 * to all existing users with role "Member"
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  serverTimestamp 
} = require('firebase/firestore');

// Firebase configuration - replace with your config
const firebaseConfig = {
  // Add your Firebase config here
  // This should match the config in your main app
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeNominalTabungan() {
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
      return;
    }
    
    console.log(`Found ${querySnapshot.size} members`);
    
    let initializeCount = 0;
    let skipCount = 0;
    
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
      }
    }
    
    console.log('\n=== Initialization Summary ===');
    console.log(`Total members found: ${querySnapshot.size}`);
    console.log(`Initialized: ${initializeCount}`);
    console.log(`Skipped (already had field): ${skipCount}`);
    console.log('✅ Initialization completed!');
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
}

// Run the script
if (require.main === module) {
  initializeNominalTabungan()
    .then(() => {
      console.log('Script execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeNominalTabungan };