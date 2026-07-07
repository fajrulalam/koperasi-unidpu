// src/services/PrinterService.js
/*
 * This service provides direct local thermal printer access
 * It uses Electron or a local server for direct USB access
 * For web-only environments, it falls back to browser printing
 */

// Format number with thousand separator
export const formatNumber = (number) => {
  const val = Number(number);
  if (isNaN(val)) {
    return "0";
  }
  return val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Check if we're running in an Electron environment
export const isElectron = () => {
  return window && window.process && window.process.type;
};

// Direct print function for Electron environment
export const printReceiptElectron = async (receiptData) => {
  if (!isElectron()) {
    console.warn('Not running in Electron environment');
    return false;
  }
  
  try {
    // Use IPC to communicate with the main process
    const { ipcRenderer } = window.require('electron');
    
    // Send print request to main process
    const result = await ipcRenderer.invoke('print-receipt', receiptData);
    return result.success;
  } catch (error) {
    console.error('Electron printing error:', error);
    return false;
  }
};

// Format receipt for browser printing
export const formatReceiptForBrowserPrint = (receiptData) => {
  const { 
    info, 
    items, 
    summary,
    appliedVoucher
  } = receiptData;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Nota Belanja</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 260px;
          margin: 0 auto;
          padding: 10px 0 20px 0;
          font-size: 12.5px;
          color: #000;
          line-height: 1.35;
          font-weight: bold;
        }
        .header-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 12px;
          border-bottom: 1.5px dashed #000;
          padding-bottom: 10px;
        }
        .logo {
          width: 54px;
          height: 54px;
          object-fit: contain;
        }
        .header-text {
          display: flex;
          align-items: flex-start;
          text-align: left;
        }
        .title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 1.5px;
          line-height: 1;
          margin: 0;
        }
        .info-section {
          margin-bottom: 8px;
          font-size: 12px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .divider {
          border-top: 1.5px dashed #000;
          margin: 8px 0;
          width: 100%;
        }
        .item-table {
          width: 100%;
          border-collapse: collapse;
          margin: 5px 0;
        }
        .item-name {
          font-size: 12.5px;
          font-weight: bold;
          padding-top: 4px;
        }
        .item-details {
          font-size: 12px;
          color: #000;
          padding-bottom: 4px;
        }
        .item-total {
          text-align: right;
          font-size: 12.5px;
          font-weight: bold;
          vertical-align: bottom;
          padding-bottom: 4px;
        }
        .total-section {
          width: 100%;
          margin-top: 8px;
          font-size: 12.5px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
        }
        .total-row.grand-total {
          font-weight: 900;
          font-size: 13.5px;
          border-top: 1.5px dashed #000;
          padding-top: 4px;
        }
        .footer-note {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: #000;
          border-top: 1.5px dashed #000;
          padding-top: 8px;
        }
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            width: 72mm;
            margin: 0 auto;
            padding: 5mm 2mm;
            font-weight: bold;
          }
          title {
            display: none;
          }
        }
      </style>
      <script>
        function printDirectly() {
          document.title = "";
          window.print();
          setTimeout(() => {
            window.close();
          }, 500);
        }
      </script>
    </head>
    <body onload="printDirectly()">
      <!-- Header -->
      <div class="header-container">
        <img class="logo" src="/Kop%20URG%20Logo%20(Latest).png" alt="Logo" />
        <div class="header-text">
          <div class="title">UNIMART</div>
        </div>
      </div>
      
      <!-- Info -->
      <div class="info-section">
        <div class="info-row">
          <span>No. Struk:</span>
          <span style="font-weight: bold;">${info.transactionId}</span>
        </div>
        <div class="info-row">
          <span>Waktu    :</span>
          <span>${info.dateTime}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- Items -->
      <table class="item-table">
        ${items.map(item => `
          <tr>
            <td colspan="2" class="item-name">${item.name}</td>
          </tr>
          <tr style="border-bottom: 1px dashed #eee;">
            <td class="item-details">${item.quantity} ${item.unit || 'pcs'} x ${formatNumber(item.price)}</td>
            <td class="item-total">${formatNumber(item.subtotal)}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="divider"></div>
      
      <!-- Totals -->
      <div class="total-section">
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>Rp ${formatNumber(summary.total)}</span>
        </div>
        <div class="total-row">
          <span>TUNAI:</span>
          <span>Rp ${formatNumber(summary.amountPaid)}</span>
        </div>
        <div class="total-row" style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
          <span>KEMBALI:</span>
          <span>Rp ${formatNumber(summary.change)}</span>
        </div>
      </div>

      <!-- Voucher Info -->
      ${appliedVoucher ? `
        <div style="font-size: 10px; border: 1px dashed #000; padding: 6px; border-radius: 4px; margin-top: 8px;">
          <div style="font-weight: bold; text-align: center; margin-bottom: 4px;">INFORMASI VOUCHER</div>
          <div class="total-row">
            <span>Nama Voucher:</span>
            <span>${appliedVoucher.name}</span>
          </div>
          ${appliedVoucher.isOneTimeUse === false ? `
            <div class="total-row">
              <span>Saldo Awal:</span>
              <span>Rp ${formatNumber(appliedVoucher.value)}</span>
            </div>
            <div class="total-row">
              <span>Potongan:</span>
              <span>-Rp ${formatNumber(Math.min(appliedVoucher.value, items.filter(item => item.subtotal > 0).reduce((sum, item) => sum + item.subtotal, 0)))}</span>
            </div>
            <div class="total-row" style="font-weight: bold; border-top: 1px dashed #ccc; padding-top: 3px; margin-top: 3px;">
              <span>Sisa Saldo:</span>
              <span>Rp ${formatNumber(Math.max(0, appliedVoucher.value - Math.min(appliedVoucher.value, items.filter(item => item.subtotal > 0).reduce((sum, item) => sum + item.subtotal, 0))))}</span>
            </div>
          ` : `
            <div class="total-row">
              <span>Status:</span>
              <span>Sekali Pakai (Telah Digunakan)</span>
            </div>
          `}
        </div>
      ` : ''}

      <!-- Footer Message -->
      <div class="footer-note">
        Terima Kasih Atas Kunjungan Anda<br>
        Layanan Pelanggan: unimart@unipdu.ac.id
      </div>
    </body>
    </html>
  `;
};

// Print using browser's print functionality
export const browserPrint = (receiptData) => {
  const receiptHtml = formatReceiptForBrowserPrint(receiptData);
  
  // Create a new window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Could not open print window. Popup blocked?');
    return false;
  }
  
  // Write receipt content
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  
  return true;
};

// Direct print to thermal printer via local server if available
export const printReceiptViaLocalServer = async (receiptData) => {
  try {
    // Check if local print server is running
    const serverUrl = localStorage.getItem('localPrintServerUrl') || 'http://localhost:9001/print';
    
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData)
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Local print server error:', error);
    return false;
  }
};

// Main print function that tries different methods
export const printReceipt = async (receiptData) => {
  try {
    // If running in Electron, try direct printing
    if (isElectron()) {
      const success = await printReceiptElectron(receiptData);
      if (success) return true;
    }
    
    // Try local server printing
    const localServerSuccess = await printReceiptViaLocalServer(receiptData);
    if (localServerSuccess) return true;
    
    // Fall back to browser printing
    return browserPrint(receiptData);
  } catch (error) {
    console.error('Print error:', error);
    // Fall back to browser printing
    return browserPrint(receiptData);
  }
};