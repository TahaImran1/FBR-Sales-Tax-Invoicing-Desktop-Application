const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');

let mainWindow;

// Auto Updater Configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let updaterInitialized = false;
function setupAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', {
        status: 'not-available',
        version: info?.version
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', {
        status: 'error',
        error: err ? err.message : 'Unknown updater error'
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', {
        status: 'downloading',
        percent: Math.round(progressObj.percent || 0),
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater-message', {
        status: 'downloaded',
        version: info.version
      });
    }
  });

  // Check for updates 5 seconds after startup if packaged
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('Initial check for updates failed:', err);
      });
    }, 5000);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 768,
    title: "FBR Digital Invoicing Suite 2026",
    backgroundColor: '#0b0f19', // Slate-dark background to match dark mode and prevent flash
    show: false, // Show once ready-to-show to prevent laggy rendering
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load UI
  mainWindow.loadFile('index.html');

  // Hide the default browser-style menu bar for a modern, sleek SaaS desktop application look
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupAutoUpdater();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler to securely route FBR API requests from the main process.
// This bypasses browser CORS limitations completely, making integration bulletproof.
ipcMain.handle('fbr-api-request', async (event, { url, method, headers, body }) => {
  try {
    // Log outbound payload to a local JSON file for debugging/testing
    // In development: write to project root so it's visible in the workspace
    // When packaged: write to userData directory (project root is read-only inside Program Files)
    if (body) {
      try {
        const fs = require('node:fs');
        const logDir = app.isPackaged ? app.getPath('userData') : __dirname;
        const logPath = path.join(logDir, 'last_fbr_payload.json');
        fs.writeFileSync(logPath, JSON.stringify(body, null, 2), 'utf8');
      } catch (logErr) {
        console.error('Failed to write last FBR payload log:', logErr);
      }
    }

    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get('content-type') || '';
    let responseData;
    
    if (contentType.includes('application/json')) {
      const text = await response.text();
      try {
        // Tolerantly strip any trailing commas in JSON returned by FBR servers before parsing
        const cleanedText = text.replace(/,(\s*[\]}])/g, '$1');
        responseData = JSON.parse(cleanedText);
      } catch (jsonErr) {
        responseData = { text: text, parseError: jsonErr.message };
      }
    } else {
      responseData = { text: await response.text() };
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      error: error.message
    };
  }
});

// IPC handler for printing the invoice receipt
ipcMain.handle('print-invoice', async (event) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  
  try {
    // Print window triggers standard OS print dialog.
    // For receipts, we can let user print to physical thermal printer or PDF.
    mainWindow.webContents.print({
      silent: false,
      printBackground: true,
      color: true
    }, (success, failureReason) => {
      if (!success && failureReason !== 'user_canceled') {
        console.error('Print failed:', failureReason);
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler to save the invoice as PDF using Electron's native printToPDF API.
// This matches the landscape layout and margins seamlessly.
ipcMain.handle('save-pdf', async (event, invoiceNumber, landscape) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  
  try {
    const fs = require('node:fs');
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save FBR Invoice as PDF',
      defaultPath: `FBR_Invoice_${invoiceNumber || 'Draft'}.pdf`,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (!filePath) {
      return { success: false, error: 'User canceled' };
    }
    
    // Temporarily set window background to white to prevent it leaking into PDF margins
    mainWindow.setBackgroundColor('#ffffff');
    
    let data;
    try {
      data = await mainWindow.webContents.printToPDF({
        landscape: landscape !== false,
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: 0.3,
          bottom: 0.3,
          left: 0.3,
          right: 0.3
        }
      });
    } finally {
      // Restore the window background color immediately
      mainWindow.setBackgroundColor('#0b0f19');
    }
    
    fs.writeFileSync(filePath, data);
    return { success: true };
  } catch (err) {
    console.error('PDF Save failed:', err);
    return { success: false, error: err.message };
  }
});

// Seed default templates helper functions
function getStandardTemplateContent() {
  return `<!-- Template: Standard Landscape -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 20px;
    font-family: Arial, sans-serif;
    font-size: 10px;
    line-height: 1.3;
  }
  .print-fbr-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #000;
    padding: 6px 12px;
    margin-bottom: 12px;
    background-color: #fff;
  }
  @media print {
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="standard">
  <template id="receipt-row-template">
    <tr>
      <td style="text-align: center; border: 1px solid #000; padding: 4px;">{{INDEX}}</td>
      <td style="border: 1px solid #000; padding: 4px;">{{HS_CODE}}</td>
      <td style="white-space: normal; text-align: left; border: 1px solid #000; padding: 4px;">{{PRODUCT_DESCRIPTION}}</td>
      <td style="text-align: center; border: 1px solid #000; padding: 4px;">{{QTY}}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{RATE}}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{VALUE_EXCL}}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{RETAIL_PRICE}}</td>
      <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{FIXED_TAX}}</td>
      <td style="text-align: center; line-height: 1.4; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{GST_RATE}}</td>
      <td style="text-align: right; line-height: 1.4; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{GST_AMOUNT}}</td>
      <td style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 4px; white-space: nowrap;">{{INCL_AMOUNT}}</td>
    </tr>
  </template>
  <!-- FBR Compliance Top Header Banner -->
  <div class="print-fbr-banner">
    <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
      <img src="fbrdigitalinvoicesystemlogo.png" alt="FBR Digital Invoicing System Logo" width="160" height="60" style="object-fit: contain;">
    </div>
    <div style="flex: 1; text-align: center;">
      <div style="font-weight: bold; font-size: 13px; text-transform: uppercase;">FBR Invoice #</div>
      <div style="font-family: monospace; font-size: 13px; font-weight: bold; margin-top: 4px;" id="receipt-fbr-invoice-no">PENDING POSTING</div>
    </div>
    <div style="flex: 1; display: flex; justify-content: flex-end;">
      <div class="receipt-qrcode-box" id="qrcode" style="width: 76px; height: 76px;"></div>
    </div>
  </div>

  <!-- Seller Information Box -->
  <div style="border: 1px solid #000; padding: 10px; margin-bottom: 12px;">
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;" id="receipt-seller-name-header">SELLER BUSINESS NAME</div>
    <div style="margin-bottom: 4px; font-size: 10px;" id="receipt-seller-address">-</div>
    <div style="display: flex; gap: 40px; font-size: 10px;">
      <div><strong>NTN : </strong><span id="receipt-seller-ntn">-</span></div>
      <div><strong>STRN : </strong><span id="receipt-seller-strn"></span></div>
    </div>
  </div>

  <!-- Side-by-Side: Bill To & Sales Invoice Details Table -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 16px;">
    <div style="flex: 1.5; border: 1px solid #000; padding: 8px;">
      <div style="font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;">BILL TO :</div>
      <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;" id="receipt-buyer-name">BUYER BUSINESS NAME</div>
      <div style="margin-bottom: 4px; font-size: 10px;" id="receipt-buyer-address">BUYER ADDRESS</div>
      <div style="font-size: 10px;"><strong>NTN : </strong><span id="receipt-buyer-ntn">3647820</span></div>
    </div>

    <div style="flex: 1; border: 1px solid #000;">
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; height: 100%;">
        <thead>
          <tr>
            <th colspan="3" style="border-bottom: 1px solid #000; padding: 6px; font-size: 13px; font-weight: bold; background-color: #f1f1f1;">Sales Invoice</th>
          </tr>
          <tr style="background-color: #f9f9f9; border-bottom: 1px solid #000;">
            <th style="border-right: 1px solid #000; padding: 4px; font-weight: bold; width: 33%;">Date</th>
            <th style="border-right: 1px solid #000; padding: 4px; font-weight: bold; width: 33%;">Invoice #</th>
            <th style="padding: 4px; font-weight: bold; width: 34%;">Manual Inv #</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border-right: 1px solid #000; padding: 6px;" id="receipt-invoice-date">24-DEC-25</td>
            <td style="border-right: 1px solid #000; padding: 6px;" id="receipt-local-invoice-id">3</td>
            <td style="padding: 6px;" id="receipt-manual-invoice-no">SLS-2025-26-0087</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <div class="invoice-table-container" style="border: 1px solid #000; margin-bottom: 12px;">
    <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; font-size: 9px;">
      <thead>
        <tr style="background-color: #f1f1f1;">
          <th style="border: 1px solid #000; padding: 6px; width: 4%;">Sr #</th>
          <th style="border: 1px solid #000; padding: 6px; width: 9%;">H.S Code</th>
          <th style="border: 1px solid #000; padding: 6px; width: 23%;">Description</th>
          <th style="border: 1px solid #000; padding: 6px; width: 5%;">Qty</th>
          <th style="border: 1px solid #000; padding: 6px; width: 8%; white-space: nowrap;">Rate</th>
          <th style="border: 1px solid #000; padding: 6px; width: 11%; white-space: nowrap;">Excl.Amt</th>
          <th style="border: 1px solid #000; padding: 6px; width: 7%; white-space: nowrap;">Retail</th>
          <th style="border: 1px solid #000; padding: 6px; width: 10%; white-space: nowrap;">Fixed Notify Value</th>
          <th style="border: 1px solid #000; padding: 6px; width: 5%; white-space: nowrap;">Tax %</th>
          <th style="border: 1px solid #000; padding: 6px; width: 7%; white-space: nowrap;">Tax Amt</th>
          <th style="border: 1px solid #000; padding: 6px; width: 11%; white-space: nowrap;">Incl. Amount</th>
        </tr>
      </thead>
      <tbody id="receipt-items-tbody"></tbody>
    </table>
  </div>

  <!-- Bottom Summary block -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 24px;">
    <div style="flex: 1.5; font-size: 11px;">
      <strong>Amount in Words: </strong>
      <span id="receipt-amount-in-words" style="text-decoration: underline; margin-left: 8px;"></span>
    </div>
    <div style="flex: 1; border: 1px solid #000;">
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;" id="receipt-totals-table"></table>
    </div>
  </div>

  <!-- Footer/Prepared By section -->
  <div style="margin-top: 60px;">
    <div style="display: inline-block; text-align: center; width: 180px; border-top: 1px solid #000; padding-top: 6px; font-weight: bold; font-size: 11px;">Prepared By</div>
  </div>
</div>`;
}

function getThermalTemplateContent() {
  return `<!-- Template: Thermal Receipt -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 10px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    max-width: 320px;
    margin: 0 auto;
  }
  .thermal-separator {
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  .invoice-print-table {
    width: 100%;
    border-collapse: collapse;
  }
  .invoice-print-table th {
    border-bottom: 1px dashed #000;
    padding: 4px 2px;
    text-align: left;
    font-size: 10px;
  }
  .invoice-print-table td {
    padding: 4px 2px;
    font-size: 10px;
  }
  @media print {
    @page {
      size: portrait;
    }
    .fbr-invoice-card {
      max-width: 100% !important;
      padding: 0 !important;
    }
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="thermal">
  <div style="text-align: center; margin-bottom: 8px;">
    <img src="fbrdigitalinvoicesystemlogo.png" alt="Logo" width="130" height="50" style="object-fit: contain; margin-bottom: 4px;">
    <div style="font-weight: bold; font-size: 13px;" id="receipt-seller-name-header">SELLER NAME</div>
    <div style="font-size: 9px;" id="receipt-seller-address">SELLER ADDRESS</div>
    <div style="font-size: 9px; margin-top: 4px;">
      <strong>NTN:</strong> <span id="receipt-seller-ntn">-</span> &nbsp;
      <strong>STRN:</strong> <span id="receipt-seller-strn">-</span>
    </div>
  </div>
  
  <div class="thermal-separator"></div>
  
  <div style="font-size: 10px;">
    <div><strong>FBR Inv #:</strong> <span id="receipt-fbr-invoice-no">PENDING</span></div>
    <div><strong>Local ID:</strong> <span id="receipt-local-invoice-id">-</span></div>
    <div><strong>Manual No:</strong> <span id="receipt-manual-invoice-no">-</span></div>
    <div><strong>Date:</strong> <span id="receipt-invoice-date">-</span></div>
  </div>
  
  <div class="thermal-separator"></div>
  
  <div style="font-size: 10px;">
    <strong>BILL TO:</strong>
    <div style="font-weight: bold;" id="receipt-buyer-name">BUYER NAME</div>
    <div id="receipt-buyer-address">BUYER ADDRESS</div>
    <div><strong>Buyer NTN:</strong> <span id="receipt-buyer-ntn">-</span></div>
  </div>
  
  <div class="thermal-separator"></div>
  
  <table class="invoice-print-table">
    <thead>
      <tr>
        <th style="width: 50%;">Item Description</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 35%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody id="receipt-items-tbody"></tbody>
  </table>
  
  <div class="thermal-separator"></div>
  
  <table style="width: 100%; border-collapse: collapse; font-size: 10px;" id="receipt-totals-table"></table>
  
  <div class="thermal-separator"></div>
  
  <div style="font-size: 9px; text-align: center; margin-bottom: 8px;">
    <strong>Amount in Words:</strong>
    <div id="receipt-amount-in-words">-</div>
  </div>
  
  <div style="display: flex; justify-content: center; margin: 12px 0;">
    <div class="receipt-qrcode-box" id="qrcode" style="width: 80px; height: 80px;"></div>
  </div>
  
  <div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 12px;">
    THANK YOU FOR YOUR VISIT!
  </div>
</div>`;
}

function getClassicTemplateContent() {
  return `<!-- Template: Classic Portrait -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 30px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .classic-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0b0f19;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .invoice-print-table {
    width: 100%;
    border-collapse: collapse;
  }
  .invoice-print-table th {
    background-color: #0b0f19;
    color: #ffffff;
    border: 1px solid #0b0f19;
    padding: 6px;
  }
  .invoice-print-table td {
    border: 1px solid #ccc;
    padding: 6px;
  }
  @media print {
    .fbr-invoice-card {
      border: none !important;
      padding: 0 !important;
    }
    .invoice-print-table th {
      background-color: #000000 !important;
      color: #ffffff !important;
      border: 1px solid #000000 !important;
    }
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="classic">
  <template id="receipt-row-template">
    <tr>
      <td style="text-align: center; border: 1px solid #ccc; padding: 6px;">{{INDEX}}</td>
      <td style="border: 1px solid #ccc; padding: 6px;">{{HS_CODE}}</td>
      <td style="white-space: normal; text-align: left; border: 1px solid #ccc; padding: 6px;">{{PRODUCT_DESCRIPTION}}</td>
      <td style="text-align: center; border: 1px solid #ccc; padding: 6px;">{{QTY}}</td>
      <td style="text-align: right; border: 1px solid #ccc; padding: 6px;">{{RATE}}</td>
      <td style="text-align: right; border: 1px solid #ccc; padding: 6px;">{{VALUE_EXCL}}</td>
      <td style="text-align: right; line-height: 1.4; border: 1px solid #ccc; padding: 6px; font-size: 9px;">{{GST_RATE}} ({{GST_AMOUNT}})</td>
      <td style="text-align: right; font-weight: bold; border: 1px solid #ccc; padding: 6px;">{{INCL_AMOUNT}}</td>
    </tr>
  </template>
  <div class="classic-header">
    <div>
      <div style="font-size: 22px; font-weight: bold; color: #0b0f19; text-transform: uppercase;" id="receipt-seller-name-header">SELLER NAME</div>
      <div style="font-size: 10px; color: #555; max-width: 350px;" id="receipt-seller-address">SELLER ADDRESS</div>
      <div style="margin-top: 6px;">
        <strong>NTN:</strong> <span id="receipt-seller-ntn">-</span> &nbsp;|&nbsp;
        <strong>STRN:</strong> <span id="receipt-seller-strn">-</span>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 20px; font-weight: bold; color: #555; letter-spacing: 1px; text-transform: uppercase;">TAX INVOICE</div>
      <div style="margin-top: 8px; font-family: monospace; font-size: 11px;">
        <strong>FBR INVOICE #:</strong> <span id="receipt-fbr-invoice-no" style="font-weight: bold; color: #000;">-</span>
      </div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 40px;">
    <div>
      <div style="font-weight: bold; color: #0b0f19; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 6px; font-size: 12px;">CLIENT DETAILS:</div>
      <div style="font-weight: bold; font-size: 12px;" id="receipt-buyer-name">-</div>
      <div style="color: #555;" id="receipt-buyer-address">-</div>
      <div style="margin-top: 4px;"><strong>NTN:</strong> <span id="receipt-buyer-ntn">-</span></div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: bold; color: #0b0f19; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 6px; font-size: 12px;">INVOICE DETAILS:</div>
      <div><strong>Date:</strong> <span id="receipt-invoice-date">-</span></div>
      <div><strong>System Ref ID:</strong> <span id="receipt-local-invoice-id">-</span></div>
      <div><strong>Manual Ref No:</strong> <span id="receipt-manual-invoice-no">-</span></div>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; font-size: 10px;">
      <thead>
        <tr>
          <th style="width: 4%;">Sr</th>
          <th style="width: 12%;">H.S Code</th>
          <th style="width: 38%;">Description of Goods</th>
          <th style="width: 8%; text-align: center;">Qty</th>
          <th style="width: 10%; text-align: right;">Rate</th>
          <th style="width: 10%; text-align: right;">Excl. Amt</th>
          <th style="width: 18%; text-align: right;">Tax Details</th>
          <th style="width: 10%; text-align: right;">Total Amount</th>
        </tr>
      </thead>
      <tbody id="receipt-items-tbody"></tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-bottom: 30px;">
    <div style="flex: 1.2;">
      <div style="font-weight: bold; color: #0b0f19; margin-bottom: 4px;">Amount in Words:</div>
      <div id="receipt-amount-in-words" style="font-style: italic; background-color: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #eee;">-</div>
      
      <div style="display: flex; align-items: center; gap: 20px; margin-top: 20px;">
        <div class="receipt-qrcode-box" id="qrcode" style="width: 80px; height: 80px;"></div>
        <div style="font-size: 9px; color: #666; max-width: 250px;">
          This sales invoice is transmitted in real-time to the FBR Digital Invoicing System. Scan QR code to verify.
        </div>
      </div>
    </div>
    <div style="flex: 1;">
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;" id="receipt-totals-table"></table>
    </div>
  </div>

  <div style="margin-top: 80px; display: flex; justify-content: space-between; padding: 0 20px;">
    <div style="text-align: center; width: 150px; border-top: 1px solid #333; padding-top: 6px; font-weight: bold;">Prepared By</div>
    <div style="text-align: center; width: 150px; border-top: 1px solid #333; padding-top: 6px; font-weight: bold;">Authorized Sign</div>
  </div>
</div>`;
}

function getFormat1TemplateContent() {
  return `<!-- Template: Format 1 Portrait -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 30px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    border: 1px solid #000000;
    border-radius: 0px;
  }
  .format1-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .invoice-meta-table {
    border-collapse: collapse;
    font-size: 10px;
    margin-top: 5px;
    border: 1px solid #000000;
  }
  .invoice-meta-table th {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 4px 8px;
    font-weight: bold;
    text-align: center;
  }
  .invoice-meta-table td {
    border: 1px solid #000000;
    padding: 4px 8px;
    text-align: center;
  }
  .invoice-print-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    border: 1px solid #000000;
  }
  .invoice-print-table th {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 8px 6px;
    font-weight: bold;
    font-size: 10px;
  }
  .invoice-print-table td {
    border: 1px solid #000000;
    padding: 8px 6px;
    font-size: 10px;
  }
  @media print {
    @page {
      margin: 15mm;
    }
    body, html {
      background-color: #ffffff !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    #receipt-modal, 
    #receipt-modal .modal-card, 
    #receipt-modal .modal-body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    .fbr-invoice-card {
      border: 1px solid #000000 !important;
      padding: 20px !important;
      margin: 0 !important;
      box-shadow: none !important;
      background-color: #ffffff !important;
    }
    .invoice-print-table th {
      background-color: #ffffff !important;
      color: #000000 !important;
      border: 1px solid #000000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="format-1">
  <template id="receipt-row-template">
    <tr>
      <td style="border: 1px solid #000000; padding: 8px; text-align: left; white-space: nowrap;">{{ITEM_CODE}}</td>
      <td style="white-space: normal; text-align: left; border: 1px solid #000000; padding: 8px;">{{PRODUCT_DESCRIPTION}}</td>
      <td style="text-align: center; border: 1px solid #000000; padding: 8px;">{{QTY}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">{{RATE}}</td>
      <td style="text-align: right; font-weight: bold; border: 1px solid #000000; padding: 8px; white-space: nowrap;">{{INCL_AMOUNT}}T</td>
    </tr>
  </template>
  <div class="format1-header">
    <div>
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
        <img id="receipt-seller-logo" src="" alt="Company Logo" style="max-height: 50px; max-width: 150px; object-fit: contain; display: none;">
        <div>
          <div style="font-size: 22px; font-weight: bold; color: #000000; text-transform: uppercase;" id="receipt-seller-name-header">SELLER NAME</div>
          <div style="font-size: 10px; color: #000; max-width: 380px; margin-top: 4px; white-space: pre-wrap;" id="receipt-seller-address">SELLER ADDRESS</div>
        </div>
      </div>
      
      <div style="border: 1px solid #000000; padding: 6px 10px; width: 240px; margin-top: 12px; font-size: 10px; box-sizing: border-box; line-height: 1.5;">
        <strong>NTN:</strong> <span id="receipt-seller-ntn">-</span><br>
        <strong>STRN:</strong> <span id="receipt-seller-strn">-</span>
      </div>

      <div style="border: 1px solid #000000; padding: 8px 10px; width: 240px; margin-top: 12px; font-size: 10px; box-sizing: border-box; line-height: 1.4;">
        <div style="font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 4px; margin-bottom: 6px; font-size: 11px;">Bill To</div>
        <div id="receipt-buyer-name" style="font-weight: bold;">-</div>
        <div id="receipt-buyer-address" style="margin-top: 4px; white-space: pre-wrap;">-</div>
        <div style="margin-top: 6px;"><strong>NTN : </strong><span id="receipt-buyer-ntn">-</span></div>
        <div style="margin-top: 2px;"><strong>STRN : </strong><span id="receipt-buyer-strn">-</span></div>
      </div>
    </div>
    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
      <div style="font-size: 24px; font-weight: bold; color: #000000; letter-spacing: 0.5px; text-transform: uppercase;">Sales Tax Invoice</div>
      <div style="font-size: 10px; font-family: monospace; font-weight: bold; margin-top: 4px; margin-bottom: 6px;">FBR Invoice No: <span id="receipt-fbr-invoice-no">-</span></div>
      <table class="invoice-meta-table">
        <tr>
          <th style="width: 50%;">Date</th>
          <th style="width: 50%;">Invoice #</th>
        </tr>
        <tr>
          <td id="receipt-invoice-date">-</td>
          <td id="receipt-local-invoice-id" style="font-weight: bold;">-</td>
        </tr>
        <tr>
          <th>Vendor No.</th>
          <th>P.O. Number</th>
        </tr>
        <tr>
          <td>-</td>
          <td id="receipt-manual-invoice-no">-</td>
        </tr>
        <tr>
          <td style="border-top: none; border-bottom: none; border-left: none;">&nbsp;</td>
          <th>G.R. No.</th>
        </tr>
        <tr>
          <td style="border-top: none; border-bottom: none; border-left: none;">&nbsp;</td>
          <td>-</td>
        </tr>
      </table>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <table class="invoice-print-table">
      <thead>
        <tr>
          <th style="width: 18%; text-align: left;">Item Code</th>
          <th style="width: 44%; text-align: left;">Description</th>
          <th style="width: 10%; text-align: center;">Quantity</th>
          <th style="width: 13%; text-align: right; white-space: nowrap;">Price Each</th>
          <th style="width: 15%; text-align: right; white-space: nowrap;">Amount</th>
        </tr>
      </thead>
      <tbody id="receipt-items-tbody"></tbody>
    </table>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-bottom: 30px;">
    <div style="flex: 1.2;">
      <div style="font-weight: bold; color: #000000; margin-bottom: 4px; font-size: 11px;">Amount in Words:</div>
      <div id="receipt-amount-in-words" style="font-style: italic; background-color: #ffffff; padding: 10px; border-radius: 0px; border: 1px solid #000000; font-size: 11px; color: #000000; min-height: 28px; box-sizing: border-box;">-</div>
      
      <div style="display: flex; align-items: center; gap: 20px; margin-top: 20px;">
        <div class="receipt-qrcode-box" id="qrcode" style="width: 80px; height: 80px;"></div>
        <div style="font-size: 9px; color: #333333; max-width: 250px;">
          This sales invoice is transmitted in real-time to the FBR Digital Invoicing System. Scan QR code to verify.
        </div>
      </div>
    </div>
    <div style="flex: 1;">
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;" id="receipt-totals-table"></table>
    </div>
  </div>

  <div style="margin-top: 80px; display: flex; justify-content: space-between; padding: 0 10px;">
    <div style="text-align: center; width: 140px; border-top: 1px solid #000000; padding-top: 6px; font-weight: bold; font-size: 10px; color: #000000;">Prepared By</div>
    <div style="text-align: center; width: 140px; border-top: 1px solid #000000; padding-top: 6px; font-weight: bold; font-size: 10px; color: #000000;">Checked By</div>
    <div style="text-align: center; width: 140px; border-top: 1px solid #000000; padding-top: 6px; font-weight: bold; font-size: 10px; color: #000000;">Received By</div>
  </div>
</div>`;
}

// IPC handler to list templates
ipcMain.handle('list-templates', async (event) => {
  try {
    const templatesDir = path.join(app.getPath('userData'), 'templates');
    if (!fs.existsSync(templatesDir)) {
      return [];
    }
    const files = fs.readdirSync(templatesDir);
    return files.filter(f => f.toLowerCase().endsWith('.html')).map(f => f.replace(/\.html$/i, ''));
  } catch (err) {
    console.error('List templates failed:', err);
    return [];
  }
});

// IPC handler to load a template content
ipcMain.handle('load-template', async (event, filename) => {
  try {
    const templatesDir = path.join(app.getPath('userData'), 'templates');
    const fullPath = path.join(templatesDir, `${filename}.html`);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${filename}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (err) {
    console.error('Load template failed:', err);
    throw err;
  }
});

// IPC handler to open templates folder in file explorer
ipcMain.handle('open-templates-folder', async () => {
  try {
    const { shell } = require('electron');
    const templatesDir = path.join(app.getPath('userData'), 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    await shell.openPath(templatesDir);
    return { success: true };
  } catch (err) {
    console.error('Failed to open templates folder:', err);
    return { success: false, error: err.message };
  }
});

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, message: 'Auto-updates are only active in packaged production builds.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler to install update immediately
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// IPC handler to get current app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC handler to read local backup file for restoring local dev database safely without packaging
ipcMain.handle('restore-backup-file', async (event, filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read backup file:', err);
  }
  return null;
});

function getFormat2TemplateContent() {
  return `<!-- Template: Format 2 Portrait -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 30px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    border: 1px solid #000000;
    border-radius: 0px;
  }
  .format2-title {
    text-align: center;
    font-size: 24px;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 25px;
    text-transform: uppercase;
  }
  .format2-panels {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }
  .format2-panel {
    border: 1px solid #000000;
    padding: 10px;
    flex: 1;
    font-size: 10px;
    line-height: 1.5;
    box-sizing: border-box;
  }
  .format2-panel h3 {
    margin: 0 0 6px 0;
    font-size: 11px;
    font-weight: bold;
    border-bottom: 1px solid #000000;
    padding-bottom: 4px;
  }
  .format2-panel-strip {
    background-color: #f1f1f1;
    margin-top: 8px;
    padding: 4px 6px;
    border-top: 1px solid #000000;
    font-weight: bold;
  }
  .invoice-print-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    border: 1px solid #000000;
  }
  .invoice-print-table th {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 8px 6px;
    font-weight: bold;
    font-size: 10px;
  }
  .invoice-print-table td {
    border: 1px solid #000000;
    padding: 8px 6px;
    font-size: 10px;
    vertical-align: top;
  }
  @media print {
    @page {
      margin: 15mm;
    }
    body, html {
      background-color: #ffffff !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    #receipt-modal, 
    #receipt-modal .modal-card, 
    #receipt-modal .modal-body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    .fbr-invoice-card {
      border: 1px solid #000000 !important;
      padding: 20px !important;
      margin: 0 !important;
      box-shadow: none !important;
      background-color: #ffffff !important;
    }
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="format-2" data-items-source="customer-linked" data-gst-display="stacked">
  <template id="receipt-row-template">
    <tr>
      <td style="border: 1px solid #000000; padding: 8px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>{{PRODUCT_DESCRIPTION}}</span>
          <span style="font-family: monospace; font-size: 9px; font-weight: bold; margin-left: 10px; color: #333;">{{ITEM_CODE}}</span>
        </div>
      </td>
      <td style="text-align: center; border: 1px solid #000000; padding: 8px;">{{QTY}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">{{RATE}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">{{VALUE_EXCL}}</td>
      <td style="text-align: center; border: 1px solid #000000; padding: 8px; white-space: nowrap; line-height: 1.2;">{{GST_RATE}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap; line-height: 1.2;">{{GST_AMOUNT}}</td>
      <td style="text-align: right; font-weight: bold; border: 1px solid #000000; padding: 8px; white-space: nowrap;">{{INCL_AMOUNT}}</td>
    </tr>
  </template>
  <div class="format2-title">Sales Tax Invoice</div>
  
  <div class="format2-panels">
    <!-- Left Box: Supplier/Seller details -->
    <div class="format2-panel">
      <h3>Supplier Info</h3>
      <strong>Supplier Name:</strong> <span id="receipt-seller-name-header">-</span><br>
      <strong>NTN/CNIC:</strong> <span id="receipt-seller-ntn">-</span><br>
      <strong>Address :</strong> <span id="receipt-seller-address">-</span>
      <div class="format2-panel-strip">
        <strong>Sales Tax invoice number:</strong> <span id="receipt-local-invoice-id">-</span><br>
        <strong>Invoice date:</strong> <span id="receipt-invoice-date">-</span>
      </div>
    </div>
    
    <!-- Right Box: Customer/Buyer details -->
    <div class="format2-panel">
      <h3>Customer Info</h3>
      <strong>Customer Name:</strong> <span id="receipt-buyer-name">-</span><br>
      <strong>NTN/CNIC:</strong> <span id="receipt-buyer-ntn">-</span><br>
      <strong>Address:</strong> <span id="receipt-buyer-address">-</span>
      <div class="format2-panel-strip">
        <strong>PO number:</strong> <span id="receipt-manual-invoice-no">-</span>
      </div>
    </div>
  </div>

  <table class="invoice-print-table">
    <thead>
      <tr>
        <th style="width: 45%; text-align: left;">Product Description</th>
        <th style="width: 7%; text-align: center;">Qty</th>
        <th style="width: 10%; text-align: right;">Unit Price</th>
        <th style="width: 11%; text-align: right;">Excl amount</th>
        <th style="width: 9%; text-align: center;">GST rate</th>
        <th style="width: 9%; text-align: right;">GST amount</th>
        <th style="width: 9%; text-align: right;">Incl amount</th>
      </tr>
    </thead>
    <tbody id="receipt-items-tbody">
      <!-- Generated Dynamically via JS -->
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
    <div style="width: 250px; font-size: 10px; line-height: 1.5; text-align: right;" id="receipt-summary-container">
      <!-- Generated Dynamically via JS -->
    </div>
  </div>

  <div style="margin-top: 60px; display: flex; justify-content: flex-end; padding-right: 20px;">
    <div style="text-align: center; width: 180px; border-top: 1px solid #000000; padding-top: 6px; font-weight: bold; font-size: 10px; color: #000000;">Sign & Stamp</div>
  </div>
</div>`;
}

function getFormat3TemplateContent() {
  return `<!-- Template: Format 3 Portrait -->
<style>
  .fbr-invoice-card {
    background-color: #ffffff;
    color: #000000;
    padding: 30px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    border: 1px solid #000000;
    border-radius: 0px;
  }
  .format3-title {
    text-align: center;
    font-size: 26px;
    font-weight: bold;
    background-color: #cccccc;
    padding: 8px;
    margin-bottom: 25px;
    text-transform: uppercase;
    border: 1px solid #000000;
  }
  .format3-header-container {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 20px;
  }
  .format3-header-col {
    flex: 1;
    font-size: 10px;
    line-height: 1.5;
  }
  .format3-header-col table {
    width: 100%;
    border-collapse: collapse;
  }
  .format3-header-col td {
    padding: 3px 0;
    vertical-align: top;
  }
  .invoice-print-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    border: 1px solid #000000;
  }
  .invoice-print-table th {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 6px;
    font-weight: bold;
    font-size: 11px;
    text-align: center;
  }
  .invoice-print-table td {
    border: 1px solid #000000;
    padding: 6px;
    font-size: 10px;
    vertical-align: middle;
  }
  @media print {
    @page {
      margin: 15mm;
    }
    body, html {
      background-color: #ffffff !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    #receipt-modal, 
    #receipt-modal .modal-card, 
    #receipt-modal .modal-body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    .fbr-invoice-card {
      border: none !important;
      padding: 20px !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
  }
</style>
<div class="fbr-invoice-card" id="printable-receipt-card" data-columns-mode="format-3" data-items-source="customer-linked">
  <template id="receipt-row-template">
    <tr>
      <td style="text-align: center; border: 1px solid #000000; padding: 6px; font-weight: bold;">{{INDEX}}</td>
      <td style="border: 1px solid #000000; padding: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-weight: bold;">{{PRODUCT_DESCRIPTION}}</span>
          <span style="font-weight: bold; margin-left: 10px; font-size: 11px;">{{BOX_QTY}}</span>
        </div>
      </td>
      <td style="text-align: right; border: 1px solid #000000; padding: 6px; font-weight: bold;">{{CARTONS}}</td>
      <td style="text-align: center; border: 1px solid #000000; padding: 6px; font-weight: bold;">{{PACKETS}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 6px; font-weight: bold;">{{RATE}}</td>
      <td style="text-align: right; border: 1px solid #000000; padding: 6px; font-weight: bold;">{{TOTAL_AMOUNT}}</td>
    </tr>
  </template>
  
  <div class="format3-title">Sales Tax Invoice</div>
  
  <div class="format3-header-container">
    <!-- Left Header Box -->
    <div class="format3-header-col">
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
        <img id="receipt-seller-logo" src="" alt="Company Logo" style="max-height: 50px; max-width: 150px; object-fit: contain; display: none;">
      </div>
      <table>
        <tr>
          <td style="width: 100px; font-weight: bold;">Supplier Name:</td>
          <td id="receipt-seller-name-header">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Supplier Address:</td>
          <td id="receipt-seller-address">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">GST NO.</td>
          <td id="receipt-seller-strn">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">NTN NO</td>
          <td id="receipt-seller-ntn">-</td>
        </tr>
      </table>
    </div>
    
    <!-- Right Header Box -->
    <div class="format3-header-col" style="padding-left: 40px;">
      <table style="margin-bottom: 12px;">
        <tr>
          <td style="width: 100px; font-weight: bold;">Date:</td>
          <td id="receipt-invoice-date">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">INVOICE NO.</td>
          <td style="font-weight: bold;"><span id="receipt-local-invoice-id" style="background-color: #ffff00; padding: 2px 6px;">-</span></td>
        </tr>
      </table>
      <table>
        <tr>
          <td style="width: 100px; font-weight: bold;">Customer Name:</td>
          <td id="receipt-buyer-name" style="font-weight: bold;">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Customer Address:</td>
          <td id="receipt-buyer-address">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">GST NO.</td>
          <td id="receipt-manual-invoice-no" style="font-weight: bold;">-</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">NTN NO</td>
          <td id="receipt-buyer-ntn">-</td>
        </tr>
      </table>
    </div>
  </div>

  <table class="invoice-print-table">
    <thead>
      <tr>
        <th style="width: 8%;">SR No</th>
        <th style="width: 52%; text-align: left;">Description</th>
        <th style="width: 10%;">Cartons</th>
        <th style="width: 10%;">Packets</th>
        <th style="width: 10%;">Rate Per Packet</th>
        <th style="width: 10%;">Total Amount</th>
      </tr>
    </thead>
    <tbody id="receipt-items-tbody">
      <!-- Generated Dynamically via JS -->
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; border-top: 1px solid #000000; border-bottom: 1px solid #000000;">
        <td colspan="2" style="padding: 6px; text-align: center; border: 1px solid #000000;">&nbsp;</td>
        <td style="text-align: right; padding: 6px; border: 1px solid #000000; font-weight: bold;">{{TOTAL_CARTONS}}</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000000; font-weight: bold;">{{TOTAL_PACKETS}}</td>
        <td style="padding: 6px; border: 1px solid #000000;"></td>
        <td style="padding: 6px; border: 1px solid #000000;"></td>
      </tr>
    </tfoot>
  </table>

  <!-- Bottom totals box -->
  <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
    <table style="width: 300px; border-collapse: collapse; font-size: 10px; font-weight: bold; border: 1px solid #000000;">
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; width: 65%;">Total Excl. Amt:</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; width: 35%; font-weight: bold;">{{SUBTOTAL_EXCL}}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right;">Discount / Reductions ({{DISCOUNT_PERCENT}}%):</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; font-weight: bold;">{{TOTAL_DISCOUNT}}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right;">Sales Tax Amount:</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; font-weight: bold;">{{TOTAL_SALES_TAX}}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right;">Further Tax:</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; font-weight: bold;">{{TOTAL_FURTHER_TAX}}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right;">Total Inclusive Sales Tax:</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; font-weight: bold;">{{NET_INCL}}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right;">Withheld Tax ({{WHT_PERCENT}}%):</td>
        <td style="border: 1px solid #000000; padding: 5px; text-align: right; font-weight: bold;">{{TOTAL_WHT}}</td>
      </tr>
      <tr style="font-size: 11px; border-top: 1px solid #000000; background-color: #fafafa;">
        <td style="border: 1px solid #000000; padding: 6px; text-align: right;">Grand Total:</td>
        <td style="border: 1px solid #000000; padding: 6px; text-align: right; font-weight: bold; font-size: 11px;">{{GRAND_TOTAL}}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 80px; display: flex; justify-content: space-between; padding: 0 20px; font-size: 11px; font-weight: bold;">
    <div style="text-align: center; width: 180px; border-top: 1px solid #000000; padding-top: 6px;">Received By</div>
    <div style="text-align: center; width: 180px; border-top: 1px solid #000000; padding-top: 6px;">Authorized Signatures</div>
  </div>
</div>`;
}

// Initialize templates directory at startup
app.whenReady().then(() => {
  const templatesDir = path.join(app.getPath('userData'), 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  const standardPath = path.join(templatesDir, 'Standard.html');
  const thermalPath = path.join(templatesDir, 'Thermal.html');
  const classicPath = path.join(templatesDir, 'Classic.html');
  const format1Path = path.join(templatesDir, 'Format-1.html');
  const format2Path = path.join(templatesDir, 'Format-2.html');
  const format3Path = path.join(templatesDir, 'Format-3.html');

  fs.writeFileSync(standardPath, getStandardTemplateContent());
  fs.writeFileSync(format1Path, getFormat1TemplateContent());
  fs.writeFileSync(classicPath, getClassicTemplateContent());
  fs.writeFileSync(format2Path, getFormat2TemplateContent());
  fs.writeFileSync(format3Path, getFormat3TemplateContent());

  if (!fs.existsSync(thermalPath)) {
    fs.writeFileSync(thermalPath, getThermalTemplateContent());
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
