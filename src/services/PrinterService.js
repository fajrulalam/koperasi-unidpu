// src/services/PrinterService.js
/*
 * This service provides direct local thermal printer access
 * It uses Electron or a local server for direct USB access
 * For web-only environments, it falls back to browser printing
 */

// Format number with thousand separator
export const formatNumber = (number) => {
  return number.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
    header, 
    info, 
    items, 
    summary 
  } = receiptData;
  
  // Create receipt HTML content
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt</title>
      <style>
        body {
          font-family: monospace;
          width: 280px; /* Reduced to avoid cutoff */
          margin: 0 auto;
          padding: 15px 5px 30px 5px; /* Doubled bottom padding */
          font-size: 16px; /* Increased font size */
        }
        .center {
          text-align: center;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          margin-top: 10px;
        }
        .title {
          font-size: 20px; /* Much larger header text */
          font-weight: bold;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 18px; /* Second level header */
          font-weight: bold;
          margin-top: 5px;
        }
        .info {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 16px;
        }
        table {
          width: 95%; /* Reduced to prevent right cutoff */
          border-collapse: collapse;
          margin: 10px auto; /* Centered */
        }
        th, td {
          text-align: left;
          padding: 5px 2px; /* Added horizontal padding */
          font-size: 16px;
        }
        th:last-child, td:last-child {
          text-align: right;
          padding-right: 5px; /* Added right padding to prevent cutoff */
        }
        .divider {
          border-bottom: 1px dotted #000;
          margin: 10px 0;
          width: 100%;
        }
        .total-section {
          width: 95%; /* Reduced to prevent right cutoff */
          text-align: right;
          font-size: 18px; /* Larger for better visibility */
          font-weight: bold;
          margin: 10px auto; /* Centered */
          padding-right: 5px; /* Added right padding */
        }
        @media print {
          @page {
            margin: 5mm;
            size: 80mm 200mm;
          }
          html, body {
            width: 70mm;
            height: auto;
            font-size: 16px !important;
          }
          /* Remove the about:blank title */
          title {
            display: none;
          }
        }
      </style>
      <script>
        // This script executes print immediately when the page loads
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
      <div class="header">
        <div class="title">${header.storeName}</div>
        <div>${header.storeAddress}</div>
        <div>${header.storeCity}</div>
        <div class="subtitle">${header.title}</div>
      </div>
      
      <div class="info">
        <span>No: ${info.transactionId}</span>
        <span>${info.dateTime}</span>
      </div>
      
      <div class="divider"></div>
      
      <table>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
        ${items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${formatNumber(item.subtotal)}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="divider"></div>
      
      <div class="total-section">
        <div>TOTAL: ${formatNumber(summary.total)}</div>
        <div>TUNAI: ${formatNumber(summary.amountPaid)}</div>
        <div>KEMBALI: ${formatNumber(summary.change)}</div>
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