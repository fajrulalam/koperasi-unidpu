import React, { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import MemberBeranda from "./MemberBeranda";
import MemberVoucher from "./MemberVoucher";
import MemberSimpanPinjam from "./MemberSimpanPinjam";
import MemberSejarahBelanja from "./MemberSejarahBelanja";
import { useEnvironment, isMemberWhitelisted } from "../context/EnvironmentContext";
import { useAuth } from "../context/AuthContext";
import { resolveMemberDocument } from "../utils/memberIdentity";
import "../styles/Member.css";

const MemberPage = ({
  previewMember = null,
  readOnly = false,
  onExitPreview,
}) => {
  const { isProduction, toggleEnvironment } = useEnvironment();
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("beranda");
  const targetDocId = previewMember?.docId || previewMember?.id || null;
  const targetUid = previewMember
    ? previewMember.uid || null
    : currentUser?.uid || null;

  useEffect(() => {
    let unsubscribe = null;
    let cancelled = false;

    setLoading(true);
    setUserData(null);

    const checkUserData = async () => {
      try {
        const resolvedMember = await resolveMemberDocument(db, {
          docId: targetDocId,
          uid: targetUid,
        });

        if (cancelled) return;

        if (!resolvedMember) {
          console.error("No user document found");
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const applySnapshot = (snapshot) => {
          if (cancelled) return;

          if (snapshot.exists()) {
            const memberData = snapshot.data();
            if (
              readOnly &&
              memberData.role?.toString().trim() !== "Member"
            ) {
              setUserData(null);
            } else {
              setUserData({ ...memberData, docId: snapshot.id });
            }
          }
          setLoading(false);
          setRefreshing(false);
        };

        applySnapshot(resolvedMember.snapshot);
        unsubscribe = onSnapshot(
          resolvedMember.ref,
          applySnapshot,
          (error) => {
            if (cancelled) return;
            console.error("Error listening for user data:", error);
            setLoading(false);
            setRefreshing(false);
          }
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching user data:", error);
        setUserData(null);
        setLoading(false);
        setRefreshing(false);
      }
    };

    if (targetDocId || targetUid) {
      checkUserData();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [readOnly, targetDocId, targetUid]);

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
    if (readOnly && onExitPreview) {
      onExitPreview();
      return;
    }

    try {
      await auth.signOut();
      // The AuthContext will redirect to login
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleWhatsAppClick = () => {
    if (readOnly || !userData) return;

    // Format the WhatsApp number properly
    const nomorBuAna = "+6285604795346"; // Admin number

    const message = encodeURIComponent(
      `[Pendaftaran Anggota Koperasi]\n\nNama: ${userData.nama}\nKantor: ${userData.kantor}\nSatuan Kerja: ${userData.satuanKerja}\n\nSaya telah mendaftar sebagai anggota koperasi dan menunggu persetujuan. Terima kasih.`
    );

    window.open(`https://wa.me/${nomorBuAna}?text=${message}`, "_blank");
  };

  const renderNavBrand = () => (
    <div className={`nav-brand ${!isProduction ? "nav-brand--testing" : ""}`}>
      <img
        src="/Kop%20URG%20Logo%20(Latest).png"
        alt="Logo Koperasi Unipdu"
        className="nav-brand-logo"
      />
      <span className="nav-member-name">
        {userData?.nama || "Koperasi Unipdu"}
      </span>
    </div>
  );

  const renderPage = () => {
    if (!userData) return null;

    const memberIdentity = {
      docId: userData.docId,
      uid: userData.uid || targetUid,
    };

    // For approved members, show the requested page
    if (
      userData.membershipStatus === "approved" ||
      userData.membershipStatus === "inactive"
    ) {
      switch (activePage) {
        case "voucher":
          return <MemberVoucher />;
        case "simpanpinjam":
          return (
            <MemberSimpanPinjam
              setActivePage={setActivePage}
              memberIdentity={memberIdentity}
              readOnly={readOnly}
            />
          );
        case "sejarahbelanja":
          return <MemberSejarahBelanja userData={userData} setActivePage={setActivePage} />;
        case "beranda":
        default:
          return (
            <MemberBeranda
              setActivePage={setActivePage}
              memberIdentity={memberIdentity}
              readOnly={readOnly}
            />
          );
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
                disabled={readOnly}
                title={
                  readOnly
                    ? "Tindakan dinonaktifkan selama mode pratinjau"
                    : undefined
                }
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
          {renderNavBrand()}
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
          {renderNavBrand()}
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
                {readOnly
                  ? "Kembali ke Daftar Anggota"
                  : "Keluar dan Kembali ke Login"}
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
      <div
        className="member-nav-container"
        style={
          !isProduction
            ? { backgroundColor: "#ff9800", borderColor: "#e65100" }
            : undefined
        }
      >
        {renderNavBrand()}
        {!isProduction && (
          <span className="nav-testing-badge">TESTING</span>
        )}
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

              <div
                className={`menu-item ${
                  activePage === "sejarahbelanja" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("sejarahbelanja");
                  closeMenu();
                }}
              >
                Sejarah Belanja
              </div>
            </>
          )}

          {!readOnly &&
            userData?.docId &&
            isMemberWhitelisted(userData.docId) && (
            <div className="menu-env-toggle">
              <span className="menu-env-label">
                {isProduction ? "Production" : "Testing"}
              </span>
              <button
                className={`menu-env-btn ${!isProduction ? "menu-env-btn--testing" : ""}`}
                onClick={toggleEnvironment}
              >
                <span className="menu-env-knob" />
              </button>
            </div>
          )}
          <div className="menu-logout" onClick={handleLogout}>
            {readOnly ? "Kembali ke Daftar Anggota" : "Keluar"}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {renderPage()}
    </div>
  );
};

export default MemberPage;
