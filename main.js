const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');

let mainWindow;

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
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

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
ipcMain.handle('save-pdf', async (event, invoiceNumber) => {
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
    
    const data = await mainWindow.webContents.printToPDF({
      landscape: true,
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.3,
        bottom: 0.3,
        left: 0.3,
        right: 0.3
      }
    });
    
    fs.writeFileSync(filePath, data);
    return { success: true };
  } catch (err) {
    console.error('PDF Save failed:', err);
    return { success: false, error: err.message };
  }
});
