import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Create the Environment context
const EnvironmentContext = createContext();

// Environment settings document path
const ENVIRONMENT_SETTINGS_DOC = "settings/environment";

// Provider component to wrap around app
export const EnvironmentProvider = ({ children }) => {
  const [isProduction, setIsProduction] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen for environment settings changes in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, ENVIRONMENT_SETTINGS_DOC),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setIsProduction(data.isProduction);
        } else {
          // Create default settings if they don't exist
          createDefaultSettings();
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching environment settings:", err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Create default settings if they don't exist
  const createDefaultSettings = async () => {
    try {
      await setDoc(doc(db, ENVIRONMENT_SETTINGS_DOC), {
        isProduction: true,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error("Error creating default environment settings:", error);
      setError(error.message);
    }
  };

  // Toggle environment and save to Firestore
  const toggleEnvironment = async () => {
    try {
      const newValue = !isProduction;
      await setDoc(doc(db, ENVIRONMENT_SETTINGS_DOC), {
        isProduction: newValue,
        lastUpdated: new Date()
      });
      
      // Force reload the page to ensure all components reflect the new environment
      window.location.reload();
    } catch (error) {
      console.error("Error toggling environment:", error);
      setError(error.message);
    }
  };

  // Helper function to get the correct collection path based on environment
  const getCollectionPath = (collectionName) => {
    if (isProduction) {
      return collectionName;
    } else {
      return `${collectionName}_testing`;
    }
  };

  return (
    <EnvironmentContext.Provider
      value={{
        isProduction,
        isLoading,
        error,
        toggleEnvironment,
        getCollectionPath,
        environment: isProduction ? "production" : "testing"
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

// Custom hook to use the environment context
export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
};