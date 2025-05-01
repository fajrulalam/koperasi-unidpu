import React, { useState } from "react";
import { useEnvironment } from "../context/EnvironmentContext";
import { useAuth } from "../context/AuthContext";
import PrinterSettings from "./PrinterSettings";
import "../styles/AdminSettings.css";

const AdminSettings = () => {
  const { currentUser, userRole } = useAuth();
  const { isProduction, toggleEnvironment, isLoading, environment } = useEnvironment();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  // Only admins and Directors should access this page
  if (userRole !== "admin" && userRole !== "Director") {
    return (
      <div className="admin-settings">
        <h1>Admin Settings</h1>
        <div className="access-denied">
          <p>Access denied. Only administrators and directors can access this page.</p>
        </div>
      </div>
    );
  }

  const handleToggleClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (confirmInput.toLowerCase() === "confirm") {
      toggleEnvironment();
      setShowConfirmDialog(false);
      setConfirmInput("");
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setConfirmInput("");
  };

  if (isLoading) {
    return (
      <div className="admin-settings">
        <h1>Admin Settings</h1>
        <div className="loading">Loading environment settings...</div>
      </div>
    );
  }

  return (
    <div className="admin-settings">
      <h1>Admin Settings</h1>

      <div className="settings-card">
        <h2>Environment Settings</h2>
        <div className="environment-toggle">
          <p>
            Current Environment: 
            <span className={`environment-badge ${environment}`}>
              {environment.toUpperCase()}
            </span>
          </p>
          <p className="environment-description">
            {isProduction ? (
              "Production mode uses real collections for transactions."
            ) : (
              <strong className="warning">
                Testing mode uses separate test collections with the suffix '_testing'.
                Data won't affect production.
              </strong>
            )}
          </p>
          <button 
            className={`toggle-button ${isProduction ? "production" : "testing"}`}
            onClick={handleToggleClick}
          >
            Switch to {isProduction ? "TESTING" : "PRODUCTION"}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h2>Printer Settings</h2>
        <PrinterSettings />
      </div>

      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h3>Confirm Environment Change</h3>
            <p className="warning">
              You are about to switch to {isProduction ? "TESTING" : "PRODUCTION"} mode.
            </p>
            <p>
              {isProduction 
                ? "Testing mode will use separate collections with '_testing' suffix. This won't affect production data."
                : "Production mode will use the real data collections. All changes will be permanent."
              }
            </p>
            <p>All users will be affected by this change.</p>
            <p>Type <strong>confirm</strong> to proceed:</p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type 'confirm' here"
            />
            <div className="dialog-buttons">
              <button className="cancel-button" onClick={handleCancel}>
                Cancel
              </button>
              <button 
                className="confirm-button"
                onClick={handleConfirm}
                disabled={confirmInput.toLowerCase() !== "confirm"}
              >
                Switch Environment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;