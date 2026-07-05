const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer process safely
contextBridge.exposeInMainWorld('api', {
  // IPC call to execute FBR API requests from the main process
  fbrRequest: (options) => ipcRenderer.invoke('fbr-api-request', options),
  
  // IPC call to invoke native OS printing dialog
  printInvoice: () => ipcRenderer.invoke('print-invoice'),
  
  // IPC call to save PDF
  savePDF: (invoiceNumber) => ipcRenderer.invoke('save-pdf', invoiceNumber)
});
