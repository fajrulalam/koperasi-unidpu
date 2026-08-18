import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
import {
  MEMBER_PREVIEW_STORAGE_KEY,
  buildMemberPreview,
  canStartMemberPreview,
  isMemberPreviewActor,
  parseMemberPreviewSession,
} from "../utils/memberPreview";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [memberPreviewSession, setMemberPreviewSession] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return parseMemberPreviewSession(
        window.sessionStorage.getItem(MEMBER_PREVIEW_STORAGE_KEY)
      );
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const canPreviewMembers = isMemberPreviewActor(userRole);

  const clearMemberPreview = useCallback(() => {
    setMemberPreviewSession(null);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(MEMBER_PREVIEW_STORAGE_KEY);
      } catch (error) {
        console.warn("Unable to clear member preview session storage:", error);
      }
    }
  }, []);

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
        clearMemberPreview();
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [clearMemberPreview]);

  useEffect(() => {
    if (
      !loading &&
      memberPreviewSession &&
      (!currentUser ||
        !canPreviewMembers ||
        memberPreviewSession.actorUid !== currentUser.uid)
    ) {
      clearMemberPreview();
    }
  }, [
    canPreviewMembers,
    clearMemberPreview,
    currentUser,
    loading,
    memberPreviewSession,
  ]);

  const startMemberPreview = async (member) => {
    if (!currentUser || !canStartMemberPreview(userRole, member)) {
      throw new Error(
        "Hanya Wakil Rektor 2 yang dapat menggunakan pratinjau akun anggota."
      );
    }

    const selectedDocId = member.docId || member.id;
    const latestSnapshot = await getDoc(doc(db, "users", selectedDocId));

    if (!latestSnapshot.exists()) {
      throw new Error("Data anggota tidak ditemukan.");
    }

    const latestMember = buildMemberPreview({
      id: latestSnapshot.id,
      ...latestSnapshot.data(),
    });

    if (!latestMember) {
      throw new Error("Akun yang dipilih bukan akun anggota yang valid.");
    }

    const session = {
      actorUid: currentUser.uid,
      member: latestMember,
    };

    setMemberPreviewSession(session);
    try {
      window.sessionStorage.setItem(
        MEMBER_PREVIEW_STORAGE_KEY,
        JSON.stringify(session)
      );
    } catch (error) {
      console.warn("Unable to persist member preview session:", error);
    }

    return latestMember;
  };

  const stopMemberPreview = () => {
    clearMemberPreview();
  };

  const previewMember = memberPreviewSession?.member || null;
  const isMemberPreviewing =
    canPreviewMembers &&
    memberPreviewSession?.actorUid === currentUser?.uid &&
    previewMember !== null;

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
        "WarehouseStock",
        "SejarahBelanja",
        "SejarahBelanjaWarehouse",
        "SejarahTransaksiWarehouse",
        "WarehouseExit",
        "SejarahTransaksi",
        "Finance",
        "AdminPanel",
        "AdminSettings",
        // "TailwindTest",
        "VoucherKoperasi",
        "NotaBelanjaB2B",
      ],
      "Wakil Rektor 2": [
        "Transaksi",
        "SimpanPinjam",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "Stocks",
        "WarehouseStock",
        "SejarahBelanja",
        "SejarahBelanjaWarehouse",
        "SejarahTransaksiWarehouse",
        "WarehouseExit",
        "SejarahTransaksi",
        "Finance",
        "AdminPanel",
        "AdminSettings",
        // "TailwindTest",
        "MemberPage",
        "VoucherKoperasi",
        "NotaBelanjaB2B",
      ], // Full access to everything
      BAK: [
        "SimpanPinjam",
        "DaftarAnggotaBaru",
        "TabunganLogs",
        "SejarahTransaksi",
        "Finance",
        "WarehouseExit",
        "VoucherKoperasi",
        "NotaBelanjaB2B",
      ],
      Admin: [
        "Transaksi",
        "DaftarAnggotaBaru",
        // "TabunganLogs",
        "Stocks",
        "WarehouseStock",
        // "SimpanPinjam",
        "SejarahBelanjaWarehouse",
        "SejarahTransaksiWarehouse",
        "WarehouseExit",
        "SejarahTransaksi",
        "Finance",
        "AdminSettings",
        // "TailwindTest",
        "NotaBelanjaB2B",
      ],
      Cashier: [
        "Transaksi",
        "DaftarAnggotaBaru",
        "SejarahTransaksi",
        "Finance",
        // "TailwindTest",
      ],
      admin: [
        "Transaksi",
        // "SimpanPinjam",
        "DaftarAnggotaBaru",
        // "TabunganLogs",
        "Stocks",
        "WarehouseStock",
        // "SejarahBelanja",
        "SejarahBelanjaWarehouse",
        "SejarahTransaksiWarehouse",
        "SejarahTransaksi",
        "Finance",
        // "AdminPanel",
        "AdminSettings",
        // "TailwindTest",
      ],
      Mitra: ["WarehouseExit"], // Mitra users can access WarehouseExit to upload PO
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
    previewMember,
    isMemberPreviewing,
    canPreviewMembers,
    startMemberPreview,
    stopMemberPreview,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
