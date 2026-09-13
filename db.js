// ==========================================================
// DATABASE UTILITY - SQLITE NATIVE CLIENT ADAPTER
// 100% Backward Compatible Interface with renderer.js
// Backed by high-throughput embedded SQLite in Electron main process
// ==========================================================

function getSqliteApi() {
  if (typeof window !== 'undefined' && window.api && window.api.sqlite) {
    return window.api.sqlite;
  }
  throw new Error('SQLite bridge is not available in window.api');
}

// Helper: Generic debounced snapshot to disk for extra UI redundancy
let autoBackupTimer = null;
function triggerAutoBackup(immediate = false) {
  if (typeof window === 'undefined' || !window.api || !window.api.saveAutoBackup) return;

  const executeBackup = async () => {
    try {
      const backup = await dbExportBackup();
      if (backup && backup.data) {
        await window.api.saveAutoBackup(backup);
        window.dispatchEvent(new CustomEvent('db-auto-backed-up', { detail: backup.exportedAt }));
      }
    } catch (err) {
      console.warn('[SQLite AutoBackup] Mirroring note:', err);
    }
  };

  if (immediate) {
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    return executeBackup();
  }

  if (autoBackupTimer) clearTimeout(autoBackupTimer);
  autoBackupTimer = setTimeout(executeBackup, 1500);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    triggerAutoBackup(true);
  });
}

// ==========================================================
// EXPOSED PERSISTENCE FUNCTIONS
// ==========================================================

// --- Companies ---
function dbGetAllCompanies() {
  return getSqliteApi().getAllCompanies();
}

function dbGetCompany(id = 1) {
  return getSqliteApi().getCompany(id);
}

function dbSaveCompany(company) {
  return getSqliteApi().saveCompany(company).then(res => {
    triggerAutoBackup();
    return res;
  });
}

function dbSeedDefaultTaxesForCompany(companyId) {
  return getSqliteApi().seedDefaultTaxesForCompany(companyId);
}

// --- Taxes ---
function dbGetTaxes() {
  return getSqliteApi().getTaxes();
}

function dbAddTax(tax) {
  return getSqliteApi().addTax(tax).then(res => {
    triggerAutoBackup();
    return res;
  });
}

function dbDeleteTax(id) {
  return getSqliteApi().deleteTax(id).then(res => {
    triggerAutoBackup();
    return res;
  });
}

// --- Products / Items ---
function dbGetItems() {
  return getSqliteApi().getItems();
}

function dbAddItem(item) {
  return getSqliteApi().addItem(item).then(res => {
    triggerAutoBackup();
    return res;
  });
}

function dbDeleteItem(id) {
  return getSqliteApi().deleteItem(id).then(res => {
    triggerAutoBackup();
    return res;
  });
}

// --- Customers ---
function dbGetCustomers() {
  return getSqliteApi().getCustomers();
}

function dbAddCustomer(cust) {
  return getSqliteApi().addCustomer(cust).then(res => {
    triggerAutoBackup();
    return res;
  });
}

function dbDeleteCustomer(id) {
  return getSqliteApi().deleteCustomer(id).then(res => {
    triggerAutoBackup();
    return res;
  });
}

// --- Invoices ---
function dbSaveInvoice(invoiceMaster, itemsList, taxesList) {
  return getSqliteApi().saveInvoice(invoiceMaster, itemsList, taxesList).then(res => {
    triggerAutoBackup();
    return res;
  });
}

function dbGetInvoices() {
  return getSqliteApi().getInvoices();
}

function dbGetInvoiceFull(invoiceId) {
  return getSqliteApi().getInvoiceFull(invoiceId);
}

function dbDeleteInvoice(invoiceId) {
  return getSqliteApi().deleteInvoice(invoiceId).then(res => {
    triggerAutoBackup();
    return res;
  });
}

// --- Backup & Restore ---
function dbExportBackup() {
  return getSqliteApi().exportBackup();
}

function dbImportBackup(backup) {
  return getSqliteApi().importBackup(backup).then(res => {
    triggerAutoBackup(true);
    return res;
  });
}

// ==========================================================
// LEGACY INDEXEDDB EXTRACTION (FAILSAFE RETRIEVAL ONLY)
// ==========================================================
// If SQLite is freshly initialized and no disk backup was present,
// this checks if the browser IndexedDB stores contain data to migrate.
async function extractLegacyIndexedDBData() {
  if (typeof indexedDB === 'undefined') return null;

  return new Promise((resolve) => {
    const request = indexedDB.open('FBRInvoicingDB', 1);

    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => resolve(null);

    request.onsuccess = async (event) => {
      const idb = event.target.result;
      const stores = ['company', 'taxes', 'items', 'customers', 'invoices', 'invoice_details', 'invoice_taxes'];
      const missing = stores.some(s => !idb.objectStoreNames.contains(s));
      if (missing) {
        idb.close();
        return resolve(null);
      }

      try {
        const tx = idb.transaction(stores, 'readonly');
        const data = {};

        for (const storeName of stores) {
          const store = tx.objectStore(storeName);
          data[storeName] = await new Promise((res) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
          });
        }

        idb.close();

        const totalRecords = Object.values(data).reduce((acc, arr) => acc + arr.length, 0);
        if (totalRecords > 0) {
          console.log(`[Legacy IDB Extraction] Found ${totalRecords} records in Chromium IndexedDB.`);
          resolve({
            version: 1,
            exportedAt: new Date().toISOString(),
            data
          });
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('[Legacy IDB Extraction] Error:', err);
        idb.close();
        resolve(null);
      }
    };
  });
}

// Seed sandbox company if SQLite database is completely fresh
async function dbSeedDemoData() {
  const companies = await dbGetAllCompanies();
  const CURRENT_DB_SEED_VERSION = 5;

  if (companies && companies.length > 0) {
    const primary = companies[0];
    if (primary && primary.isDemoSeeded && primary.dbVersionSeeded === CURRENT_DB_SEED_VERSION) {
      return;
    }
  }

  if (!companies || companies.length === 0) {
    console.log('[SQLite Engine] Seeding default sandbox company profile...');
    const sandboxCompany = {
      id: 1,
      sellerNTN: '',
      sellerName: '',
      sellerProvince: 'Sindh',
      sellerAddress: '',
      fbrEnvMode: 'sandbox',
      fbrToken: '',
      sendTotalVal: false,
      theme: 'midnight-abyss',
      isDemoSeeded: true,
      dbVersionSeeded: CURRENT_DB_SEED_VERSION
    };
    await dbSaveCompany(sandboxCompany);
  }
}

// Auto-recovery / startup verification
async function dbCheckAndRestoreAutoBackup() {
  const companies = await dbGetAllCompanies();
  if (!companies || companies.length === 0) {
    // Check if browser IndexedDB has records to migrate
    const legacyIDB = await extractLegacyIndexedDBData();
    if (legacyIDB) {
      console.log('[SQLite Migration] Migrating from Chromium IndexedDB to SQLite...');
      await getSqliteApi().migrateFromLegacy(legacyIDB);
    }
  }
  return true;
}

// Global initialization promise awaited by renderer.js
window.dbInitializationPromise = (async () => {
  try {
    // 1. Check and migrate any legacy browser data if SQLite is empty
    await dbCheckAndRestoreAutoBackup();

    // 2. Ensure initial seed if brand new install
    await dbSeedDemoData();

    // 3. Trigger initial snapshot sync
    triggerAutoBackup();

    console.log('[SQLite Bridge] Initialized and connected successfully.');
  } catch (err) {
    console.error('[SQLite Bridge Initialization Error]:', err);
  }
})();
