import React, { useState, useEffect } from 'react';
import { registerWithEmailAndPassword } from '../firebase';
import '../styles/AdminPanel.css';
import { useFirestore } from '../context/FirestoreContext';
import { useEnvironment } from '../context/EnvironmentContext';

const AdminPanel = () => {
  const { queryCollection, deleteDoc } = useFirestore();
  const { isProduction, environment } = useEnvironment();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Cashier');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Note: users collection should remain in PRODUCTION_ONLY_COLLECTIONS
        const usersList = await queryCollection('users');
        console.log(`Fetched ${usersList.length} users from collection`);
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isProduction]); // Re-fetch when environment changes

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await registerWithEmailAndPassword(email, password, role);
      setSuccess(`User ${email} successfully created with role: ${role}`);
      setEmail('');
      setPassword('');
      
      // Refresh user list
      const usersList = await queryCollection('users');
      setUsers(usersList);
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user (Note: this only deletes from Firestore, not Firebase Auth)
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        // Note: users collection should remain in PRODUCTION_ONLY_COLLECTIONS
        await deleteDoc('users', userId);
        setUsers(users.filter(user => user.id !== userId));
        setSuccess('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  return (
    <div className="admin-panel">
      <h2>User Management</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="admin-container">
        <div className="create-user-section">
          <h3>Create New User</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="Director">Director</option>
                <option value="Admin">Admin</option>
                <option value="Cashier">Cashier</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="submit-button" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
        
        <div className="users-list-section">
          <h3>Existing Users</h3>
          {loading ? (
            <p>Loading users...</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                    <td>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="4" className="no-users">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;