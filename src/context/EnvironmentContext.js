import React, { createContext, useContext, useState, useCallback } from "react";
import { getEnvironmentCollectionPath } from "../firebase";

const EnvironmentContext = createContext();

const STORAGE_KEY = "koperasi_env_isProduction";

// Roles allowed to toggle the environment
const ENV_TOGGLE_ROLES = [
  "Director",
  "Wakil Rektor 2",
  "BAK",
  "Admin",
  "Cashier",
];

// Member document IDs whitelisted for testing access.
// Add/remove IDs here to grant/revoke member testing privileges.
const MEMBER_TESTING_WHITELIST = [
  "Muhammad_Fajrul_Alam_Ulin_Nuha_1745143463041",
];

export const canToggleEnvironment = (role) => ENV_TOGGLE_ROLES.includes(role);

export const isMemberWhitelisted = (docId) =>
  MEMBER_TESTING_WHITELIST.includes(docId);

export const EnvironmentProvider = ({ children }) => {
  const [isProduction, setIsProduction] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to production if no value stored
    return stored === null ? true : stored === "true";
  });

  const toggleEnvironment = useCallback(() => {
    setIsProduction((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const getCollectionPath = useCallback(
    (collectionName) => {
      return getEnvironmentCollectionPath(collectionName, isProduction);
    },
    [isProduction]
  );

  return (
    <EnvironmentContext.Provider
      value={{
        isProduction,
        isLoading: false,
        error: null,
        toggleEnvironment,
        getCollectionPath,
        environment: isProduction ? "production" : "testing",
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
};
