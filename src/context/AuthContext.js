import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch user role from Firestore
        try {
          // First try to find the document with user.uid as document ID
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            // If not found, query for documents with the uid field matching user.uid
            const q = query(
              collection(db, "users"),
              where("uid", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              // Use the first matching document
              const userData = querySnapshot.docs[0].data();
              setUserRole(userData.role);
            } else {
              console.error("User document not found in either location");
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Define access permissions based on role
  const hasAccess = (component) => {
    if (!userRole) return false;

    const permissions = {
      Director: [
        "Transaksi",
        "SimpanPinjam",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "Stocks",
        "SejarahBelanja",
        "SejarahTransaksi",
        "AdminPanel",
        "AdminSettings",
        "TailwindTest",
        "VoucherKoperasi",
      ],
      "Wakil Rektor 2": [
        "Transaksi",
        "SimpanPinjam",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "Stocks",
        "SejarahBelanja",
        "SejarahTransaksi",
        "AdminPanel",
        "AdminSettings",
        "TailwindTest",
        "MemberPage",
        "VoucherKoperasi",
      ], // Full access to everything
      BAK: ["SimpanPinjam", "DaftarAnggotaBaru", "TabunganLogs", "SejarahTransaksi", "VoucherKoperasi"], // Access to SimpanPinjam and DaftarAnggotaBaru
      Admin: [
        "Transaksi",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "Stocks",
        "SimpanPinjam",
        "SejarahTransaksi",
        "TailwindTest",
      ],
      Cashier: [
        "Transaksi",
        "DaftarAnggotaBaru",
        "SejarahTransaksi",
        "TailwindTest",
      ],
      admin: [
        "Transaksi",
        "SimpanPinjam",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "Stocks",
        "SejarahBelanja",
        "SejarahTransaksi",
        "AdminPanel",
        "AdminSettings",
        "TailwindTest",
      ],
      Member: ["MemberPage"], // Members only have access to the MemberPage
    };

    // Convert userRole to string and trim any whitespace for comparison
    const normalizedUserRole = userRole.toString().trim();
    return permissions[normalizedUserRole]?.includes(component) || false;
  };

  const value = {
    currentUser,
    userRole,
    loading,
    hasAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
