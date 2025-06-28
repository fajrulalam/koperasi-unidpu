import React, { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import MemberBeranda from "./MemberBeranda";
import MemberVoucher from "./MemberVoucher";
import MemberSimpanPinjam from "./MemberSimpanPinjam";
import "../styles/Member.css";

const MemberPage = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("beranda");

  useEffect(() => {
    // Check for current user
    const user = auth.currentUser;
    if (!user) return;

    // Try to find user document that contains the UID field
    const checkUserData = async () => {
      try {
        // First check if user document exists with the user's UID as the document ID
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          // User document found with direct ID match
          setUserData(docSnap.data());
          setLoading(false);
          setRefreshing(false);

          // Set up real-time listener for future updates
          const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              setUserData(snapshot.data());
            }
            setRefreshing(false);
          });

          return unsubscribe;
        } else {
          // If direct match not found, try to query by uid field
          const q = query(
            collection(db, "users"),
            where("uid", "==", user.uid)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Found a document with matching uid field
            const userDoc = querySnapshot.docs[0];
            setUserData(userDoc.data());

            // Set up real-time listener for future updates
            const userDocRef = doc(db, "users", userDoc.id);
            const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
              if (snapshot.exists()) {
                setUserData(snapshot.data());
              }
              setRefreshing(false);
            });

            setLoading(false);
            setRefreshing(false);
            return unsubscribe;
          } else {
            // No document found at all
            console.error("No user document found");
            setUserData(null);
            setLoading(false);
            setRefreshing(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData(null);
        setLoading(false);
        setRefreshing(false);
      }

      // Return empty function if no unsubscribe was set
      return () => {};
    };

    const unsubscribe = checkUserData();
    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);

    // Add a small delay to show refreshing state
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      // The AuthContext will redirect to login
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (!userData) return;

    // Format the WhatsApp number properly
    const nomorBuAna = "+6285604795346"; // Admin number

    const message = encodeURIComponent(
      `[Pendaftaran Anggota Koperasi]\n\nNama: ${userData.nama}\nKantor: ${userData.kantor}\nSatuan Kerja: ${userData.satuanKerja}\n\nSaya telah mendaftar sebagai anggota koperasi dan menunggu persetujuan. Terima kasih.`
    );

    window.open(`https://wa.me/${nomorBuAna}?text=${message}`, "_blank");
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderPage = () => {
    if (!userData) return null;

    // For approved members, show the requested page
    if (
      userData.membershipStatus === "approved" ||
      userData.membershipStatus === "inactive"
    ) {
      switch (activePage) {
        case "voucher":
          return <MemberVoucher />;
        case "simpanpinjam":
          return <MemberSimpanPinjam />;
        case "beranda":
        default:
          return <MemberBeranda setActivePage={setActivePage} />;
      }
    } else {
      // For pending members, always show the pending status page
      return renderPendingStatusPage();
    }
  };

  const renderPendingStatusPage = () => {
    return (
      <div className="member-content">
        <h2 className="page-title">Status Keanggotaan</h2>

        <div className="info-card">
          <div className="member-info-section">
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="status-indicator status-pending">Pending</span>
            </div>

            <div className="pending-message">
              <p>
                Pendaftaran Anda sedang dalam proses verifikasi. Silakan hubungi
                admin melalui WhatsApp untuk mempercepat proses verifikasi.
              </p>
            </div>

            <div className="member-actions">
              <button
                onClick={handleWhatsAppClick}
                className="brutal-button primary-button"
              >
                Hubungi Admin via WhatsApp
              </button>
              <button
                onClick={handleRefresh}
                className={`brutal-button secondary-button ${
                  refreshing ? "button-loading" : ""
                }`}
                disabled={refreshing}
              >
                {refreshing ? "Menyegarkan..." : "Refresh Status"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="member-page-container">
        <div className="member-nav-container">
          <div className="nav-logo">Koperasi Unipdu</div>
          <button className="nav-menu-button">
            <span>☰</span>
          </button>
        </div>
        <div className="loading-message">Memuat data...</div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="member-page-container">
        <div className="member-nav-container">
          <div className="nav-logo">Koperasi Unipdu</div>
          <button className="nav-menu-button">
            <span>☰</span>
          </button>
        </div>

        <div className="member-content">
          <div className="info-card">
            <h3 className="section-title">Data Tidak Ditemukan</h3>

            <div className="error-message" style={{ margin: "20px 0" }}>
              Data anggota tidak ditemukan. Akun Anda terdaftar tetapi belum
              terhubung dengan data keanggotaan. Mohon hubungi administrator
              atau keluar dan daftar ulang.
            </div>

            <div className="member-actions">
              <button
                onClick={handleLogout}
                className="brutal-button primary-button"
              >
                Keluar dan Kembali ke Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isApproved = userData.membershipStatus === "approved";
  const isInactive = userData.membershipStatus === "inactive";

  return (
    <div className="member-page-container">
      {/* Top Navigation */}
      <div className="member-nav-container">
        <div className="nav-logo">Koperasi Unipdu</div>
        <button className="nav-menu-button" onClick={toggleMenu}>
          <span>☰</span>
        </button>
      </div>

      {/* Menu Overlay */}
      <div
        className={`menu-overlay ${menuOpen ? "open" : ""}`}
        onClick={closeMenu}
      ></div>

      {/* Menu Drawer */}
      <div className={`menu-drawer ${menuOpen ? "open" : ""}`}>
        <button className="menu-close" onClick={closeMenu}>
          ✕
        </button>

        <div className="menu-header">
          <div className="menu-user">{userData.nama}</div>
          <div className={`menu-status ${isApproved ? "approved" : "pending"}`}>
            {isApproved ? "Approved" : isInactive ? "Non-Aktif" : "Pending"}
          </div>
        </div>

        <div className="menu-items">
          <div
            className={`menu-item ${activePage === "beranda" ? "active" : ""}`}
            onClick={() => {
              setActivePage("beranda");
              closeMenu();
            }}
          >
            Beranda
          </div>

          {(isApproved || isInactive) && (
            <>
              {/* <div
                className={`menu-item ${
                  activePage === "voucher" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("voucher");
                  closeMenu();
                }}
              >
                Ambil Sembako
              </div> */}

              <div
                className={`menu-item ${
                  activePage === "simpanpinjam" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("simpanpinjam");
                  closeMenu();
                }}
              >
                Simpan/Pinjam
              </div>
            </>
          )}

          <div className="menu-logout" onClick={handleLogout}>
            Keluar
          </div>
        </div>
      </div>

      {/* Main Content */}
      {renderPage()}
    </div>
  );
};

export default MemberPage;
