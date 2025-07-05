// src/components/SnackbarManager.js
import React, { useEffect } from "react";
import "../styles/SnackbarManager.css";

const SnackbarManager = ({ snackbars, setSnackbars }) => {
  useEffect(() => {
    // Auto-remove snackbars after 5 seconds
    const timers = snackbars.map(snackbar => {
      return setTimeout(() => {
        setSnackbars(prev => prev.filter(sb => sb.id !== snackbar.id));
      }, 5000);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [snackbars, setSnackbars]);

  const handleRemoveSnackbar = (id) => {
    setSnackbars(prev => prev.filter(sb => sb.id !== id));
  };

  if (snackbars.length === 0) {
    return null;
  }

  return (
    <div className="snackbar-container">
      {snackbars.map((snackbar, index) => (
        <div 
          key={snackbar.id} 
          className={`snackbar snackbar-${snackbar.severity || 'info'}`}
          style={{
            bottom: `${20 + (index * 60)}px`, // Stack snackbars
            zIndex: 1000 + index
          }}
        >
          <div className="snackbar-content">
            <span className="snackbar-message">{snackbar.message}</span>
            <button 
              className="snackbar-close"
              onClick={() => handleRemoveSnackbar(snackbar.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SnackbarManager;