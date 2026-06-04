import React, { useState, useRef, useEffect } from 'react';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useEnvironment, canToggleEnvironment } from '../context/EnvironmentContext';
import { logoutUser } from '../firebase';
import '../styles/UserMenu.css';

const UserMenu = () => {
  const { currentUser, userRole } = useAuth();
  const { isProduction, toggleEnvironment } = useEnvironment();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const showEnvToggle = canToggleEnvironment(userRole);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleToggleEnv = () => {
    toggleEnvironment();
  };
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="user-menu-container" ref={menuRef}>
      <button 
        className="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FaUserCircle className="user-icon" />
        <span className="user-email">{currentUser?.email}</span>
      </button>
      
      {isOpen && (
        <div className="user-dropdown">
          <div className="user-info">
            <p className="dropdown-email">{currentUser?.email}</p>
            <p className="dropdown-role">{userRole}</p>
          </div>

          {showEnvToggle && (
            <div className="env-toggle-section">
              <div className="env-toggle-row">
                <span className="env-toggle-label">
                  {isProduction ? "Production" : "Testing"}
                </span>
                <button
                  className={`env-toggle-btn ${!isProduction ? "env-toggle-btn--testing" : ""}`}
                  onClick={handleToggleEnv}
                >
                  <span className="env-toggle-knob" />
                </button>
              </div>
              {!isProduction && (
                <p className="env-toggle-hint">Data menggunakan koleksi testing</p>
              )}
            </div>
          )}
          
          <button 
            className="logout-button"
            onClick={handleLogout}
          >
            <FaSignOutAlt className="logout-icon" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
