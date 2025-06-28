// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "firebase/auth";
import { getNextMemberNumber } from "./utils/memberNumberUtils";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB_sA0peKgiDudDGks0RNlwq6cB0IOer1M",
  authDomain: "koperasi-unipdu.firebaseapp.com",
  projectId: "koperasi-unipdu",
  storageBucket: "koperasi-unipdu.firebasestorage.app",
  messagingSenderId: "10094241377",
  appId: "1:10094241377:web:d788174993244f0d33ec20",
  measurementId: "G-BCP472H8DE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// List of collections that should never have testing versions
const PRODUCTION_ONLY_COLLECTIONS = ["users", "settings", "stockSnapshots"];

// Firestore utility functions that handle environment routing
export const getEnvironmentCollectionPath = (
  collectionName,
  isProduction = true
) => {
  // Skip adding '_testing' suffix for certain collections
  if (PRODUCTION_ONLY_COLLECTIONS.includes(collectionName) || isProduction) {
    return collectionName;
  } else {
    return `${collectionName}_testing`;
  }
};

export const getEnvironmentCollection = (
  collectionName,
  isProduction = true
) => {
  const path = getEnvironmentCollectionPath(collectionName, isProduction);
  return collection(db, path);
};

export const getEnvironmentDoc = (
  collectionName,
  documentId,
  isProduction = true
) => {
  const path = getEnvironmentCollectionPath(collectionName, isProduction);
  return doc(db, path, documentId);
};

// Authentication helper functions
export const loginWithEmailAndPassword = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};



export const registerWithEmailAndPassword = async (
  email,
  password,
  userData
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const timestamp = Date.now();
    const docId = `${userData.nama.replace(/\s+/g, "_")}_${timestamp}`;
    
    // Generate a member number if the user is being approved directly
    // Otherwise, it will be assigned when approved by admin
    let nomorAnggota = null;
    if (userData.status === "approved" || userData.membershipStatus === "approved") {
      nomorAnggota = await getNextMemberNumber();
    }
    
    // Store user data in Firestore
    await setDoc(doc(db, "users", docId), {
      ...userData,
      email,
      uid: userCredential.user.uid,
      createdAt: new Date(),
      status: "pending", // pending, approved, rejected
      timestamp: timestamp,
      nomorAnggota, // Will be null for pending users
    });
    return { userCredential, docId };
  } catch (error) {
    throw error;
  }
};

export const logoutUser = () => {
  return signOut(auth);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const sendPasswordResetEmail = (email) => {
  return firebaseSendPasswordResetEmail(auth, email);
};

// Upload a file to Firebase Storage and return the download URL
export const uploadFile = async (file, path) => {
  if (!file) return null;

  try {
    // Create a storage reference with a unique path
    const storageRef = ref(storage, path);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};
