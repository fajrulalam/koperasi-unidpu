import React, { createContext, useContext } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  limit,
  orderBy,
} from "firebase/firestore";
import { db, getEnvironmentCollectionPath } from "../firebase";
import { useEnvironment } from "./EnvironmentContext";

// Create a context for Firestore operations
const FirestoreContext = createContext();

export const FirestoreProvider = ({ children }) => {
  const { isProduction } = useEnvironment();

  // Collection references
  const getCollection = (collectionName) => {
    const path = getEnvironmentCollectionPath(collectionName, isProduction);
    return collection(db, path);
  };

  const getDocRef = (collectionName, docId) => {
    const path = getEnvironmentCollectionPath(collectionName, isProduction);
    return doc(db, path, docId);
  };

  // CRUD operations
  const createDoc = async (collectionName, data, docId = null) => {
    try {
      const timestamp = serverTimestamp();
      const dataWithTimestamp = {
        ...data,
        createdAt: timestamp,
        timestamp: timestamp,
        timestampInMillisEpoch: timestamp,
        updatedAt: timestamp,
      };

      if (docId) {
        const docRef = getDocRef(collectionName, docId);
        await setDoc(docRef, dataWithTimestamp);
        return { id: docId, ...data };
      } else {
        const collectionRef = getCollection(collectionName);
        const docRef = await addDoc(collectionRef, dataWithTimestamp);
        return { id: docRef.id, ...data };
      }
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  };

  const readDoc = async (collectionName, docId) => {
    try {
      const docRef = getDocRef(collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error reading document from ${collectionName}:`, error);
      throw error;
    }
  };

  const updateDoc_ = async (collectionName, docId, data) => {
    try {
      const docRef = getDocRef(collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return { id: docId, ...data };
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  };

  const deleteDoc_ = async (collectionName, docId) => {
    try {
      const docRef = getDocRef(collectionName, docId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  };

  const queryCollection = async (collectionName, queryFn = null) => {
    try {
      const collectionRef = getCollection(collectionName);
      const q = queryFn ? queryFn(collectionRef) : collectionRef;
      const querySnapshot = await getDocs(q);

      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });

      return docs;
    } catch (error) {
      console.error(`Error querying collection ${collectionName}:`, error);
      throw error;
    }
  };

  // Return all the functions and values we want to expose
  const contextValue = {
    getCollection,
    getDocRef,
    createDoc,
    readDoc,
    updateDoc: updateDoc_,
    deleteDoc: deleteDoc_,
    queryCollection,
    isProduction,
    // Expose Firestore methods directly for more complex queries
    serverTimestamp,
    query,
    where,
    limit,
    orderBy,
  };

  return (
    <FirestoreContext.Provider value={contextValue}>
      {children}
    </FirestoreContext.Provider>
  );
};

// Custom hook to use the Firestore context
export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (context === undefined) {
    throw new Error("useFirestore must be used within a FirestoreProvider");
  }
  return context;
};
