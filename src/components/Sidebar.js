import React from "react";
import {
  FaMoneyCheckAlt,
  FaWallet,
  FaUserPlus,
  FaArrowLeft,
  FaArrowRight,
  FaChartLine,
  FaBoxOpen,
  FaShoppingBasket,
  FaUsersCog,
  FaCog,
  FaHistory,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnvironment } from "../context/EnvironmentContext";
import "../styles/Sidebar.css"; // Custom styles for the sidebar

const Sidebar = ({ onSelect, selectedItem, isCollapsed, onCollapseToggle }) => {
  const { hasAccess, userRole } = useAuth();
  const { isProduction, environment } = useEnvironment();

  const allMenuItems = [
    { id: "Transaksi", label: "Transaksi", icon: <FaMoneyCheckAlt /> },
    { id: "SimpanPinjam", label: "Simpan-Pinjam", icon: <FaWallet /> },
    { id: "DaftarAnggotaBaru", label: "Anggota Baru", icon: <FaUserPlus /> },
    { id: "TabunganLogs", label: "Tabungan Logs", icon: <FaHistory /> },
    { id: "Stocks", label: "Stocks", icon: <FaBoxOpen /> },
    {
      id: "SejarahBelanja",
      label: "Sejarah Belanja",
      icon: <FaShoppingBasket />,
    },
    {
      id: "SejarahTransaksi",
      label: "Sejarah Transaksi",
      icon: <FaChartLine />,
    },
    {
      id: "TailwindTest",
      label: "Tailwind Test",
      icon: <FaCog />,
    },
  ];

  // Add AdminPanel and Settings for admin and Director roles
  if (userRole === "admin" || userRole === "Director") {
    allMenuItems.push({
      id: "AdminPanel",
      label: "Admin Panel",
      icon: <FaUsersCog />,
    });

    // Also add AdminSettings
    allMenuItems.push({
      id: "AdminSettings",
      label: "Settings",
      icon: <FaCog />,
    });
  }

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter((item) => hasAccess(item.id));

  return (
    <div className={`kop-sidebar ${isCollapsed ? "kop-collapsed" : ""}`}>
      {/* Collapsed vs. Uncollapsed Header */}
      {!isCollapsed ? (
        <div className="kop-sidebar-header">
          {/* Wrap the logo text in a container for the same slide animation */}
          <div className="kop-logo-wrapper">
            <h2 className="kop-logo-text">
              Koperasi Unipdu
              {!isProduction && (
                <span className="kop-env-tag kop-testing">TESTING</span>
              )}
            </h2>
          </div>

          <FaArrowLeft
            className="kop-collapse-btn"
            onClick={onCollapseToggle}
            title="Collapse Sidebar"
          />
        </div>
      ) : (
        <div className="kop-sidebar-header-small">
          {/* Show an image instead of the hamburger icon, remove "M" */}
          <div className="kop-header-small-container">
            <img
              src="/no-background-koperasi-logo-cropped.png"
              alt="Koperasi Unipdu"
              className="kop-collapsed-logo"
              title="Koperasi Unipdu"
            />
            {!isProduction && (
              <span className="kop-env-tag-small kop-testing">T</span>
            )}
          </div>

          <FaArrowRight
            className="kop-expand-btn"
            onClick={onCollapseToggle}
            title="Expand Sidebar"
          />
        </div>
      )}

      <ul className="kop-menu-list">
        {menuItems.map((item) => (
          <li
            key={item.id}
            className={`kop-menu-item ${
              selectedItem === item.id ? "kop-active" : ""
            }`}
            onClick={() => onSelect(item.id)}
            title={isCollapsed ? item.label : ""}
          >
            {/* Icon in its own span, remains static */}
            <span className="kop-menu-icon">{item.icon}</span>

            {/* Text wrapper for sliding animation */}
            <div className="kop-menu-text-wrapper">
              <span className="kop-menu-text">{item.label}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Collapse/Expand control at the bottom */}
      <div className="kop-sidebar-footer">
        {!isCollapsed ? (
          <button
            className="kop-toggle-btn"
            onClick={onCollapseToggle}
            title="Collapse Sidebar"
          >
            <FaArrowLeft /> <span>Collapse</span>
          </button>
        ) : (
          <button
            className="kop-toggle-btn kop-btn-small"
            onClick={onCollapseToggle}
            title="Expand Sidebar"
          >
            <FaArrowRight />
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
