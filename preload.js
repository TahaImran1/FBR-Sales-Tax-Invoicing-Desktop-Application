const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer process safely
contextBridge.exposeInMainWorld('api', {
  // IPC call to execute FBR API requests from the main process
  fbrRequest: (options) => ipcRenderer.invoke('fbr-api-request', options),
  
  // IPC call to invoke native OS printing dialog
  printInvoice: () => ipcRenderer.invoke('print-invoice'),
  
  // IPC call to save PDF
  savePDF: (invoiceNumber, landscape) => ipcRenderer.invoke('save-pdf', invoiceNumber, landscape),

  // IPC call to list all invoice templates from userData directory
  listTemplates: () => ipcRenderer.invoke('list-templates'),

  // IPC call to load a template's HTML content
  loadTemplate: (filename) => ipcRenderer.invoke('load-template', filename),

  // IPC call to open the templates directory in OS explorer
  openTemplatesFolder: () => ipcRenderer.invoke('open-templates-folder'),

  // IPC call to read local backup file for restoring local dev database safely without packaging
  restoreBackupFile: (filepath) => ipcRenderer.invoke('restore-backup-file', filepath),

  // Auto-updater methods
  onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (event, data) => callback(data)),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
