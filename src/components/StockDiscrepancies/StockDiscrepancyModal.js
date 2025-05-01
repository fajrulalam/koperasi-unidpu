import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { useEnvironment } from '../../context/EnvironmentContext';
import './StockDiscrepancyModal.css';

const customModalStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '80vh',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1000,
  },
};

// Format currency with thousand separator
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "Rp 0";
  const roundedAmount = Math.round(amount);
  return `Rp ${roundedAmount.toLocaleString('id-ID')}`;
};

// Format date to Indonesian format
const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
};

const StockDiscrepancyModal = ({ isOpen, onRequestClose }) => {
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  
  const { isProduction } = useEnvironment();
  
  // Fetch discrepancies - simple and straightforward
  const fetchDiscrepancies = async (isInitialFetch = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      // Determine collection name based on environment
      const collectionName = isProduction ? "stockTransactions" : "stockTransactions_testing";
      console.log(`Fetching from collection: ${collectionName}`);
      
      // Create a simple query
      const colRef = collection(db, collectionName);
      let q = query(
        colRef,
        where('isStockDiscrepant', '==', true),
        orderBy('timestampInMillisEpoch', 'desc'),
        limit(10)
      );
      
      // Get documents
      const querySnapshot = await getDocs(q);
      
      // Process results
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      
      // Log results
      console.log(`Query returned ${docs.length} documents`);
      
      // Update state
      if (isInitialFetch) {
        setDiscrepancies(docs);
      } else {
        setDiscrepancies(prev => [...prev, ...docs]);
      }
      
      // Update pagination state
      const lastVisible = querySnapshot.docs.length > 0 ? 
        querySnapshot.docs[querySnapshot.docs.length - 1] : null;
      setLastDoc(lastVisible);
      setHasMore(querySnapshot.docs.length === 10);
    } catch (error) {
      console.error("Error fetching discrepancies:", error);
      setDiscrepancies([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDiscrepancies(true);
    }
  }, [isOpen]);
  
  // Handle resolving a discrepancy
  const handleResolveDiscrepancy = async (id) => {
    try {
      // Determine collection name based on environment
      const collectionName = isProduction ? "stockTransactions" : "stockTransactions_testing";
      
      console.log(`Resolving discrepancy for document ID: ${id} in collection ${collectionName}`);
      
      // Get the document reference and update it
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        isStockDiscrepancyResolved: true
      });
      
      console.log("Document successfully updated");
      
      // Update local state
      setDiscrepancies(prev => 
        prev.map(item => 
          item.id === id 
            ? { ...item, isStockDiscrepancyResolved: true } 
            : item
        )
      );
    } catch (error) {
      console.error("Error resolving discrepancy:", error);
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={customModalStyles}
      contentLabel="Stock Discrepancies"
      ariaHideApp={false}
    >
      <div className="stock-discrepancy-modal">
        <div className="stock-discrepancy-header">
          <h2>Ketidaksesuaian Stok</h2>
          <button className="close-button" onClick={onRequestClose}>×</button>
        </div>
        
        <div className="stock-discrepancy-content">
          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <span>Memuat data...</span>
            </div>
          )}
          
          {discrepancies.length === 0 && !loading && (
            <div className="no-discrepancies">
              Tidak ada ketidaksesuaian stok ditemukan.
              <p>Periksa apakah ada transaksi dengan <code>isStockDiscrepant: true</code></p>
            </div>
          )}
          
          <div className="discrepancy-tiles">
            {discrepancies.map((item) => (
              <div 
                key={item.id} 
                className={`discrepancy-tile ${item.isStockDiscrepancyResolved ? 'resolved' : ''}`}
              >
                <div className="discrepancy-tile-header">
                  <h3>{item.itemName}</h3>
                  {!item.isStockDiscrepancyResolved && (
                    <button 
                      className="resolve-button"
                      onClick={() => handleResolveDiscrepancy(item.id)}
                      title="Tandai sebagai terselesaikan"
                    >
                      ✓
                    </button>
                  )}
                </div>
                
                <div className="discrepancy-tile-body">
                  <div className="discrepancy-detail">
                    <span className="label">Nilai Stok:</span>
                    <span className="value">{formatCurrency(item.stockWorth)}</span>
                  </div>
                  <div className="discrepancy-detail">
                    <span className="label">Harga:</span>
                    <span className="value">{formatCurrency(item.price)}</span>
                  </div>
                  <div className="discrepancy-detail">
                    <span className="label">Kuantitas:</span>
                    <span className="value">
                      {item.originalQuantity} {item.originalUnit}
                    </span>
                  </div>
                  <div className="discrepancy-detail">
                    <span className="label">Waktu Transaksi:</span>
                    <span className="value timestamp">{formatDate(item.timestampInMillisEpoch)}</span>
                  </div>
                </div>
                
                {item.isStockDiscrepancyResolved && (
                  <div className="resolved-badge">Terselesaikan</div>
                )}
              </div>
            ))}
          </div>
          
          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <span>Memuat data...</span>
            </div>
          )}
          
          {hasMore && discrepancies.length > 0 && (
            <button 
              className="load-more-button" 
              onClick={() => {
                // For loading more, we need to use startAfter
                if (lastDoc) {
                  const loadMore = async () => {
                    setLoading(true);
                    try {
                      // Determine collection name based on environment
                      const collectionName = isProduction ? "stockTransactions" : "stockTransactions_testing";
                      
                      // Create query with startAfter for pagination
                      const colRef = collection(db, collectionName);
                      const nextQuery = query(
                        colRef,
                        where('isStockDiscrepant', '==', true),
                        orderBy('timestampInMillisEpoch', 'desc'),
                        startAfter(lastDoc),
                        limit(10)
                      );
                      
                      const querySnapshot = await getDocs(nextQuery);
                      
                      // Process results
                      const newDocs = [];
                      querySnapshot.forEach((doc) => {
                        newDocs.push({ id: doc.id, ...doc.data() });
                      });
                      
                      // Update state
                      setDiscrepancies(prev => [...prev, ...newDocs]);
                      
                      // Update pagination state
                      const newLastVisible = querySnapshot.docs.length > 0 ? 
                        querySnapshot.docs[querySnapshot.docs.length - 1] : null;
                      setLastDoc(newLastVisible);
                      setHasMore(querySnapshot.docs.length === 10);
                    } catch (error) {
                      console.error("Error loading more discrepancies:", error);
                    } finally {
                      setLoading(false);
                    }
                  };
                  
                  loadMore();
                }
              }}
              disabled={loading}
            >
              {loading ? 'Memuat...' : 'Tampilkan Lebih Banyak'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default StockDiscrepancyModal;