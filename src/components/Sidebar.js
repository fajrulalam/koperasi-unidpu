import React, { useState } from "react";
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
  FaTicketAlt,
  FaWarehouse,
  FaStore,
  FaTruck,
  FaChevronDown,
  FaChevronRight,
  FaBuilding,
  FaShoppingCart,
  FaFileInvoice,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnvironment } from "../context/EnvironmentContext";
import "../styles/Sidebar.css"; // Custom styles for the sidebar

const Sidebar = ({ onSelect, selectedItem, isCollapsed, onCollapseToggle }) => {
  const { hasAccess, userRole } = useAuth();
  const { isProduction, environment } = useEnvironment();
  const [expandedSections, setExpandedSections] = useState({
    unimart: true,
    warehouse: true,
    koperasi: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const allMenuItems = [
    {
      id: "unimart",
      label: "Unimart",
      icon: <FaShoppingCart />,
      type: "parent",
      children: [
        { id: "Transaksi", label: "Transaksi", icon: <FaMoneyCheckAlt /> },
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
      ],
    },
    {
      id: "warehouse",
      label: "Warehouse",
      icon: <FaWarehouse />,
      type: "parent",
      children: [
        {
          id: "WarehouseStock",
          label: "Kulakan",
          icon: <FaWarehouse />,
        },
        {
          id: "SejarahBelanjaWarehouse",
          label: "Riwayat Kulakan",
          icon: <FaStore />,
        },
        {
          id: "WarehouseExit",
          label: "Kirim Barang",
          icon: <FaTruck />,
        },
        {
          id: "SejarahTransaksiWarehouse",
          label: "Riwayat Kirim",
          icon: <FaHistory />,
        },
        {
          id: "NotaBelanjaB2B",
          label: "Nota Belanja B2B",
          icon: <FaFileInvoice />,
        },
      ],
    },
    {
      id: "koperasi",
      label: "Koperasi URG",
      icon: <FaBuilding />,
      type: "parent",
      children: [
        { id: "SimpanPinjam", label: "Simpan-Pinjam", icon: <FaWallet /> },
        {
          id: "DaftarAnggotaBaru",
          label: "Daftar Anggota",
          icon: <FaUserPlus />,
        },
        { id: "TabunganLogs", label: "Tabungan Logs", icon: <FaHistory /> },
        {
          id: "VoucherKoperasi",
          label: "Voucher Koperasi",
          icon: <FaTicketAlt />,
        },
      ],
    },
    {
      id: "TailwindTest",
      label: "Tailwind Test",
      icon: <FaCog />,
      type: "single",
    },
  ];

  // Add AdminPanel and Settings for admin and Director roles
  if (userRole === "admin" || userRole === "Director") {
    allMenuItems.push({
      id: "AdminPanel",
      label: "Admin Panel",
      icon: <FaUsersCog />,
      type: "single",
    });

    // Also add AdminSettings
    allMenuItems.push({
      id: "AdminSettings",
      label: "Settings",
      icon: <FaCog />,
      type: "single",
    });
  }

  // Filter menu items based on user role and flatten for rendering
  const getFilteredMenuItems = () => {
    const filtered = [];

    allMenuItems.forEach((item) => {
      if (item.type === "parent") {
        // Check if user has access to any children
        const accessibleChildren = item.children.filter((child) =>
          hasAccess(child.id)
        );
        if (accessibleChildren.length > 0) {
          filtered.push({
            ...item,
            children: accessibleChildren,
          });
        }
      } else if (hasAccess(item.id)) {
        filtered.push(item);
      }
    });

    return filtered;
  };

  const menuItems = getFilteredMenuItems();

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
        {menuItems.map((item) => {
          if (item.type === "parent") {
            const isExpanded = expandedSections[item.id];
            const hasActiveChild = item.children.some(
              (child) => selectedItem === child.id
            );

            return (
              <li key={item.id} className="kop-menu-parent">
                <div
                  className={`kop-menu-item kop-menu-header ${
                    hasActiveChild ? "kop-active" : ""
                  }`}
                  onClick={() => toggleSection(item.id)}
                  title={isCollapsed ? item.label : ""}
                >
                  <span className="kop-menu-icon">{item.icon}</span>
                  <div className="kop-menu-text-wrapper">
                    <span className="kop-menu-text">{item.label}</span>
                  </div>
                  {!isCollapsed && (
                    <span className="kop-menu-arrow">
                      {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                    </span>
                  )}
                </div>

                {!isCollapsed && isExpanded && (
                  <ul className="kop-submenu">
                    {item.children.map((child) => (
                      <li
                        key={child.id}
                        className={`kop-menu-item kop-submenu-item ${
                          selectedItem === child.id ? "kop-active" : ""
                        }`}
                        onClick={() => onSelect(child.id)}
                        title={child.label}
                      >
                        <span className="kop-menu-icon">{child.icon}</span>
                        <div className="kop-menu-text-wrapper">
                          <span className="kop-menu-text">{child.label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          } else {
            return (
              <li
                key={item.id}
                className={`kop-menu-item ${
                  selectedItem === item.id ? "kop-active" : ""
                }`}
                onClick={() => onSelect(item.id)}
                title={isCollapsed ? item.label : ""}
              >
                <span className="kop-menu-icon">{item.icon}</span>
                <div className="kop-menu-text-wrapper">
                  <span className="kop-menu-text">{item.label}</span>
                </div>
              </li>
            );
          }
        })}
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
