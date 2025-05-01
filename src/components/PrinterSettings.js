// src/components/PrinterSettings.js
import React, { useState, useEffect } from 'react';
import { setLocalPrintServer } from './Transaksi';
import '../styles/PrinterSettings.css';

const PrinterSettings = () => {
  const [serverUrl, setServerUrl] = useState('http://localhost:9001');
  const [printerStatus, setPrinterStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Load existing settings on component mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('localPrintServerUrl') || 'http://localhost:9001';
    setServerUrl(savedUrl);
    
    // Check printer status when component loads
    checkPrinterStatus(savedUrl);
  }, []);
  
  // Check if the print server is running and if a printer is connected
  const checkPrinterStatus = async (url) => {
    setStatusLoading(true);
    setPrinterStatus(null);
    
    try {
      const statusUrl = url.endsWith('/') ? `${url}status` : `${url}/status`;
      const response = await fetch(statusUrl, { timeout: 3000 });
      
      if (response.ok) {
        const status = await response.json();
        setPrinterStatus(status);
      } else {
        setPrinterStatus({ status: 'offline', error: 'Server tidak merespon dengan benar' });
      }
    } catch (error) {
      console.error('Error checking printer status:', error);
      setPrinterStatus({ 
        status: 'offline', 
        error: 'Tidak dapat terhubung ke server print lokal'
      });
    } finally {
      setStatusLoading(false);
    }
  };
  
  const handleSave = () => {
    // Save to localStorage
    setLocalPrintServer(serverUrl);
    
    // Check status after saving
    checkPrinterStatus(serverUrl);
    
    // Show success message
    setSaveMessage('Pengaturan print server berhasil disimpan');
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setSaveMessage('');
    }, 3000);
  };
  
  return (
    <div className="printer-settings">
      <h2>Pengaturan Print Server Lokal</h2>
      <p>Masukkan alamat URL dari print server lokal untuk printer termal USB.</p>
      
      <div className="form-group">
        <label htmlFor="serverUrl">URL Print Server</label>
        <input
          type="text"
          id="serverUrl"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="contoh: http://localhost:9001"
        />
      </div>
      
      <div className="button-row">
        <button onClick={handleSave} className="save-button">
          Simpan Pengaturan
        </button>
        
        <button 
          onClick={() => checkPrinterStatus(serverUrl)} 
          className="check-button"
          disabled={statusLoading}
        >
          {statusLoading ? 'Memeriksa...' : 'Periksa Koneksi'}
        </button>
      </div>
      
      {saveMessage && (
        <div className="save-message">
          {saveMessage}
        </div>
      )}
      
      {printerStatus && (
        <div className={`status-box ${printerStatus.status === 'online' ? 'online' : 'offline'}`}>
          <h3>Status Print Server:</h3>
          {printerStatus.status === 'online' ? (
            <>
              <p><strong>Server:</strong> Online</p>
              <p><strong>Printer:</strong> {printerStatus.printerConnected ? 'Terdeteksi' : 'Tidak Terdeteksi'}</p>
              {printerStatus.deviceCount > 0 && (
                <p><strong>Jumlah Printer:</strong> {printerStatus.deviceCount}</p>
              )}
              {!printerStatus.printerConnected && (
                <p className="warning">Printer USB tidak terdeteksi. Pastikan printer terhubung dan print server running.</p>
              )}
            </>
          ) : (
            <>
              <p><strong>Server:</strong> Offline</p>
              <p className="error">{printerStatus.error || 'Tidak dapat terhubung ke print server'}</p>
            </>
          )}
        </div>
      )}
      
      <div className="printer-info">
        <h3>Petunjuk Penggunaan</h3>
        <ol>
          <li>Install dan jalankan aplikasi Print Server pada komputer yang terhubung dengan printer termal USB.</li>
          <li>Masukkan URL Print Server di atas (biasanya http://localhost:9001).</li>
          <li>Klik "Periksa Koneksi" untuk memastikan server dan printer terdeteksi.</li>
          <li>Jika semua terhubung dengan baik, status akan menunjukkan "Online" dan "Terdeteksi".</li>
          <li>Jika status "Offline", pastikan Print Server berjalan dan dapat diakses dari browser.</li>
        </ol>
      </div>
    </div>
  );
};

export default PrinterSettings;