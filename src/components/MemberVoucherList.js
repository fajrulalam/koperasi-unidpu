import React, { useState, useEffect } from 'react';
import { useEnvironment } from '../context/EnvironmentContext';
import { voucherService } from '../services/voucherService';
import { auth, db } from '../firebase';
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import MemberVoucherTile from './MemberVoucherTile';
import '../styles/MemberVoucherList.css';

const MemberVoucherList = () => {
  const { isProduction } = useEnvironment();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserVouchers();
  }, [isProduction]);

  const getUserDocumentId = async (currentUser) => {
    try {
      // Try direct document match first
      const docRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(docRef);
      
      if (snapshot.exists()) {
        return currentUser.uid;
      } else {
        // Try to find by uid field
        const q = query(
          collection(db, "users"),
          where("uid", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].id;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting user document ID:', error);
      return null;
    }
  };

  const fetchUserVouchers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('User not authenticated');
        return;
      }

      // Get user's document ID
      const userDocId = await getUserDocumentId(currentUser);
      if (!userDocId) {
        setError('User document not found');
        return;
      }

      // Try both methods to get vouchers
      let allVouchers = [];
      try {
        allVouchers = await voucherService.getAllVouchersByUserDocId(userDocId, isProduction);
      } catch (error1) {
        try {
          allVouchers = await voucherService.getAllVouchersByUserId(currentUser.uid, isProduction);
        } catch (error2) {
          console.error('Both voucher fetch methods failed:', error1, error2);
          throw error2;
        }
      }
      
      // Filter for active vouchers that haven't expired
      const now = new Date();
      const activeVouchers = allVouchers.filter(voucher => {
        const expireDate = voucher.expireDate?.toDate ? voucher.expireDate.toDate() : new Date(voucher.expireDate);
        return voucher.isActive && expireDate > now;
      });

      setVouchers(activeVouchers);
    } catch (error) {
      console.error('Error fetching user vouchers:', error);
      setError('Gagal memuat voucher');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="member-voucher-list">
        <div className="section-header">
          <h3 className="section-title">Voucher Saya</h3>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Memuat voucher...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="member-voucher-list">
        <div className="section-header">
          <h3 className="section-title">Voucher Saya</h3>
        </div>
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button 
            className="retry-button"
            onClick={fetchUserVouchers}
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="member-voucher-list">
      <div className="section-header">
        <h3 className="section-title">Voucher Saya</h3>
        <span className="voucher-count">{vouchers.length} voucher</span>
      </div>

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h4>Belum ada voucher</h4>
          <p>Anda belum memiliki voucher yang aktif saat ini</p>
        </div>
      ) : (
        <div className="vouchers-container">
          {vouchers.map((voucher) => (
            <MemberVoucherTile key={voucher.id} voucher={voucher} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberVoucherList;