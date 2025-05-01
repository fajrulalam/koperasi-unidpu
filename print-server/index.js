// Local print server for direct USB thermal printer access
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const escpos = require('escpos');
const USB = require('escpos-usb');

// Initialize escpos
escpos.USB = USB;

const app = express();
const PORT = process.env.PORT || 9001;

// Use middleware
app.use(cors());
app.use(bodyParser.json());

// Format number with thousand separator
function formatNumber(number) {
  return number.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Print endpoint
app.post('/print', async (req, res) => {
  try {
    const receiptData = req.body;
    
    if (!receiptData) {
      return res.status(400).json({ 
        success: false, 
        error: 'No receipt data provided' 
      });
    }
    
    // Check for connected USB devices
    let devices;
    try {
      devices = USB.findPrinter();
      if (!devices || devices.length === 0) {
        console.warn('No USB printers found');
        return res.status(200).json({
          success: false,
          error: 'No USB printers found'
        });
      }
    } catch (deviceError) {
      console.error('Error finding USB printers:', deviceError);
      return res.status(500).json({
        success: false,
        error: 'Error detecting USB printers: ' + deviceError.message
      });
    }
    
    // Create a Promise to handle the async device operations
    const printPromise = new Promise((resolve, reject) => {
      try {
        const device = new USB();
        
        device.open(function(err) {
          if (err) {
            console.error('Error opening printer device:', err);
            return reject(err);
          }
          
          const printer = new escpos.Printer(device);
          
          // Print receipt with much larger text
          printer
            .font('a')
            .align('ct')
            .style('b')
            .size(1, 2) // Much larger header (double width, triple height)
            .text(receiptData.header.storeName)
            .size(0, 1) // Normal width, double height
            .style('normal')
            .text(receiptData.header.storeAddress)
            .text(receiptData.header.storeCity)
            .style('b')
            .size(1, 1) // Double size for subtitle
            .text(receiptData.header.title)
            .text('')
            .size(0, 0) // Reset size
            .align('lt')
            .text(\`No: \${receiptData.info.transactionId}\`)
            .align('rt')
            .text(\`\${receiptData.info.dateTime}\`)
            .drawLine()
            .text('');
          
          // Print table headers - with larger columns for Item and Total, no Harga column
          printer
            .align('lt')
            .style('b')
            .size(0, 1) // Larger text for headers (normal width, double height)
            .tableCustom([
              { text: 'Item', width: 0.6, align: 'LEFT' },
              { text: 'Qty', width: 0.1, align: 'CENTER' },
              { text: 'Total', width: 0.3, align: 'RIGHT' }
            ])
            .size(0, 0) // Reset to normal size
            .style('normal');
          
          // Print items - without units and price, just quantity and total
          receiptData.items.forEach(item => {
            printer.tableCustom([
              { text: item.name, width: 0.6, align: 'LEFT' },
              { text: item.quantity.toString(), width: 0.1, align: 'CENTER' },
              { text: formatNumber(item.subtotal), width: 0.3, align: 'RIGHT' }
            ]);
          });
          
          // Print summary with larger text and right margin
          printer
            .drawLine()
            .align('rt')
            .style('b')
            .size(1, 1) // Double size for totals
            .text(\`TOTAL: \${formatNumber(receiptData.summary.total)}  \`) // Added space padding
            .text(\`TUNAI: \${formatNumber(receiptData.summary.amountPaid)}  \`)
            .text(\`KEMBALI: \${formatNumber(receiptData.summary.change)}  \`)
            .text('') // Extra line for bottom spacing
            .text('') // Extra line for bottom spacing
            .cut()
            .close();
          
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
    
    await printPromise;
    
    return res.status(200).json({
      success: true,
      message: 'Receipt printed successfully'
    });
  } catch (error) {
    console.error('Error processing print request:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to print receipt: ' + error.message
    });
  }
});

// Status endpoint to check if server is running
app.get('/status', (req, res) => {
  try {
    // Check for connected USB devices
    const devices = USB.findPrinter();
    const printerConnected = devices && devices.length > 0;
    
    res.status(200).json({
      status: 'online',
      printerConnected,
      deviceCount: devices ? devices.length : 0
    });
  } catch (error) {
    res.status(200).json({
      status: 'online',
      printerConnected: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(\`Local print server running on http://localhost:\${PORT}\`);
  
  // List available printers
  try {
    const devices = USB.findPrinter();
    console.log(\`Found \${devices ? devices.length : 0} printer(s)\`);
    if (devices && devices.length > 0) {
      devices.forEach((device, index) => {
        console.log(\`Printer \${index + 1}: \${device.deviceDescriptor.idVendor.toString(16)}:\${device.deviceDescriptor.idProduct.toString(16)}\`);
      });
    } else {
      console.log('No printers found. Please connect a thermal printer.');
    }
  } catch (error) {
    console.error('Error detecting printers:', error);
  }
});