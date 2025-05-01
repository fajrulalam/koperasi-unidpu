import React, { useState, useRef, useEffect } from 'react';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase';
import '../styles/UserMenu.css';

const UserMenu = () => {
  const { currentUser, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  const handleLogout = async () => {
    try {
      await logoutUser();
      // Auth context will handle the redirect
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Close menu when clicking outside
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