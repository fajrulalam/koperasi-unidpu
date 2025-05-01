import React, { createContext, useContext } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useEnvironment } from "./EnvironmentContext";

// Create the Database context
const DatabaseContext = createContext();

// Provider component that wraps the app
export const DatabaseProvider = ({ children }) => {
  const { getCollectionPath, isProduction, environment } = useEnvironment();

  // Get a reference to a collection with environment awareness
  const getCollection = (baseName) => {
    const path = getCollectionPath(baseName);
    return collection(db, path);
  };

  // Get a reference to a document with environment awareness
  const getDocument = (baseName, docId) => {
    const path = getCollectionPath(baseName);
    return doc(db, path, docId);
  };

  // Create a new document
  const createDocument = async (baseName, data, docId = null) => {
    try {
      if (docId) {
        const docRef = getDocument(baseName, docId);
        await setDoc(docRef, {
          ...data,
          environment: environment,
          createdAt: new Date(),
          timestamp: new Date(),
          timestampInMillisEpoch: new Date(),
          updatedAt: new Date(),
        });
        return { id: docId, ...data };
      } else {
        const collectionRef = getCollection(baseName);
        const docRef = await addDoc(collectionRef, {
          ...data,
          environment: environment,
          createdAt: new Date(),
          timestamp: new Date(),
          timestampInMillisEpoch: new Date(),
          updatedAt: new Date(),
        });
        return { id: docRef.id, ...data };
      }
    } catch (error) {
      console.error(`Error creating document in ${baseName}:`, error);
      throw error;
    }
  };

  // Read a single document
  const readDocument = async (baseName, docId) => {
    try {
      const docRef = getDocument(baseName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error reading document from ${baseName}:`, error);
      throw error;
    }
  };

  // Read all documents from a collection
  const readCollection = async (baseName, constraints = []) => {
    try {
      const collectionRef = getCollection(baseName);

      let q = collectionRef;
      if (constraints.length > 0) {
        q = query(collectionRef, ...constraints);
      }

      const querySnapshot = await getDocs(q);
      const documents = [];

      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return documents;
    } catch (error) {
      console.error(`Error reading collection ${baseName}:`, error);
      throw error;
    }
  };

  // Update a document
  const updateDocument = async (baseName, docId, data) => {
    try {
      const docRef = getDocument(baseName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });
      return { id: docId, ...data };
    } catch (error) {
      console.error(`Error updating document in ${baseName}:`, error);
      throw error;
    }
  };

  // Delete a document
  const deleteDocument = async (baseName, docId) => {
    try {
      const docRef = getDocument(baseName, docId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error(`Error deleting document from ${baseName}:`, error);
      throw error;
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        getCollection,
        getDocument,
        createDocument,
        readDocument,
        readCollection,
        updateDocument,
        deleteDocument,
        environment,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

// Custom hook to use the database context
export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
};
