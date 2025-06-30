// src/pages/MainPage.js
import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import UserMenu from "../components/UserMenu";
// Import LoginTailwind instead of the original Login component
import { LoginTailwind as Login } from "../components";
import { useAuth } from "../context/AuthContext";
import { useEnvironment } from "../context/EnvironmentContext";
import { useDatabase } from "../context/DatabaseContext";
import MemberPage from "./MemberPage"; // Import the dedicated MemberPage component
import { 
  TransaksiWithEnv as Transaksi,
  SimpanPinjamWithEnv as SimpanPinjam,
  DaftarAnggotaBaruWithEnv as DaftarAnggotaBaru,
  StocksWithEnv as Stocks,
  SejarahBelanjaWithEnv as SejarahBelanja,
  SejarahTransaksiWithEnv as SejarahTransaksi,
  AdminPanelWithEnv as AdminPanel,
  AdminSettings
} from "../components";
import TailwindTest from "../components/TailwindTest";
import TabunganLogs from "../components/TabunganLogs";

const MainPage = () => {
  const { currentUser, userRole, hasAccess } = useAuth();
  const { isProduction, environment } = useEnvironment();
  const [activeComponent, setActiveComponent] = useState("Transaksi");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // If user doesn't have access to current component, switch to one they can access
  useEffect(() => {
    if (currentUser && !hasAccess(activeComponent)) {
      // Find the first component they have access to
      if (hasAccess("Transaksi")) {
        setActiveComponent("Transaksi");
      } else if (hasAccess("DaftarAnggotaBaru")) {
        setActiveComponent("DaftarAnggotaBaru");
      } else if (hasAccess("Stocks")) {
        setActiveComponent("Stocks");
      } else if (hasAccess("SimpanPinjam")) {
        setActiveComponent("SimpanPinjam");
      } else if (hasAccess("SejarahTransaksi")) {
        setActiveComponent("SejarahTransaksi");
      } else if (hasAccess("TabunganLogs")) {
        setActiveComponent("TabunganLogs");
      } else if (hasAccess("SejarahBelanja")) {
        setActiveComponent("SejarahBelanja");
      } else if (hasAccess("AdminPanel")) {
        setActiveComponent("AdminPanel");
      } else if (hasAccess("MemberPage")) {
        setActiveComponent("MemberPage");
      }
    }
  }, [currentUser, activeComponent, hasAccess]);

  const renderContent = () => {
    // Check if user has access to this component
    if (currentUser && !hasAccess(activeComponent)) {
      return <div className="access-denied">
        <h2>Akses Terbatas</h2>
        <p>Maaf, Anda tidak memiliki akses ke halaman ini.</p>
      </div>;
    }

    switch (activeComponent) {
      case "Transaksi":
        return <Transaksi />;
      case "SimpanPinjam":
        return <SimpanPinjam />;
      case "DaftarAnggotaBaru":
        return <DaftarAnggotaBaru setActivePage={setActiveComponent} />;
      case "TabunganLogs":
        return <TabunganLogs />;
      case "Stocks":
        return <Stocks />;
      case "SejarahBelanja":
        return <SejarahBelanja />;
      case "SejarahTransaksi":
        return <SejarahTransaksi />;
      case "AdminPanel":
        return <AdminPanel />;
      case "AdminSettings":
        return <AdminSettings />;
      case "TailwindTest":
        return <TailwindTest />;
      case "MemberPage":
        return <MemberPage />;
      default:
        return <Transaksi />;
    }
  };

  const handleToggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  // If not logged in, show login page
  if (!currentUser) {
    return <Login />;
  }

  // If user is a Member, show the dedicated Member Page without sidebar
  if (userRole === "Member") {
    return <MemberPage />;
  }

  // For all other roles, show the standard admin interface with sidebar
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header with user menu */}
      <header style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 20px",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "relative",
        zIndex: 10
      }}>
        <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Koperasi Unipdu</h1>
        <div style={{ 
          marginLeft: "auto", 
          marginRight: "20px",
          display: "flex",
          alignItems: "center" 
        }}>
          {!isProduction && (
            <div style={{
              backgroundColor: "#ff9800",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontWeight: "bold",
              marginRight: "15px"
            }}>
              TESTING MODE
            </div>
          )}
        </div>
        <UserMenu />
      </header>
      
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar
          onSelect={setActiveComponent}
          selectedItem={activeComponent}
          isCollapsed={isCollapsed}
          onCollapseToggle={handleToggleSidebar}
        />

        <div
          style={{
            marginLeft: isCollapsed ? "70px" : "250px",
            padding: "20px",
            width: "calc(100% - 70px)",
            maxWidth: isCollapsed ? "calc(100% - 70px)" : "calc(100% - 250px)",
            transition: "all 0.3s ease",
            overflow: "auto"
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default MainPage;
