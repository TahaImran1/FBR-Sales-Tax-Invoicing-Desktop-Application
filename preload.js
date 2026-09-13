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
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Automated Continuous Database Protection & Recovery methods
  saveAutoBackup: (backupData) => ipcRenderer.invoke('save-auto-backup', backupData),
  getAutoBackup: () => ipcRenderer.invoke('get-auto-backup'),
  getAutoBackupInfo: () => ipcRenderer.invoke('get-auto-backup-info'),

  // Native SQLite High-Throughput Relational Database Engine
  sqlite: {
    getAllCompanies: () => ipcRenderer.invoke('sqlite-get-all-companies'),
    getCompany: (id) => ipcRenderer.invoke('sqlite-get-company', id),
    saveCompany: (company) => ipcRenderer.invoke('sqlite-save-company', company),
    seedDefaultTaxesForCompany: (companyId) => ipcRenderer.invoke('sqlite-seed-default-taxes', companyId),
    getTaxes: () => ipcRenderer.invoke('sqlite-get-taxes'),
    addTax: (tax) => ipcRenderer.invoke('sqlite-add-tax', tax),
    deleteTax: (id) => ipcRenderer.invoke('sqlite-delete-tax', id),
    getItems: () => ipcRenderer.invoke('sqlite-get-items'),
    addItem: (item) => ipcRenderer.invoke('sqlite-add-item', item),
    deleteItem: (id) => ipcRenderer.invoke('sqlite-delete-item', id),
    getCustomers: () => ipcRenderer.invoke('sqlite-get-customers'),
    addCustomer: (cust) => ipcRenderer.invoke('sqlite-add-customer', cust),
    deleteCustomer: (id) => ipcRenderer.invoke('sqlite-delete-customer', id),
    saveInvoice: (master, items, taxes) => ipcRenderer.invoke('sqlite-save-invoice', master, items, taxes),
    getInvoices: () => ipcRenderer.invoke('sqlite-get-invoices'),
    getInvoiceFull: (id) => ipcRenderer.invoke('sqlite-get-invoice-full', id),
    deleteInvoice: (id) => ipcRenderer.invoke('sqlite-delete-invoice', id),
    exportBackup: () => ipcRenderer.invoke('sqlite-export-backup'),
    importBackup: (backup) => ipcRenderer.invoke('sqlite-import-backup', backup),
    migrateFromLegacy: (legacyBackup) => ipcRenderer.invoke('sqlite-migrate-from-legacy', legacyBackup)
  }
});
