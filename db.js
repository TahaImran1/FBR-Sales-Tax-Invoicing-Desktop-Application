// ==========================================
// DATABASE UTILITY - INDEXEDDB LAYER
// ==========================================

const DB_NAME = 'FBRInvoicingDB';
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store 1: Company Profile (single record)
      if (!db.objectStoreNames.contains('company')) {
        db.createObjectStore('company', { keyPath: 'id' });
      }

      // Store 2: Tax Configurations
      if (!db.objectStoreNames.contains('taxes')) {
        db.createObjectStore('taxes', { keyPath: 'id', autoIncrement: true });
      }

      // Store 3: Products (Items)
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      }

      // Store 4: Customers
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      }

      // Store 5: Invoices (Master)
      if (!db.objectStoreNames.contains('invoices')) {
        db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
      }

      // Store 6: Invoice Details (Line Items)
      if (!db.objectStoreNames.contains('invoice_details')) {
        const store = db.createObjectStore('invoice_details', { keyPath: 'id', autoIncrement: true });
        store.createIndex('invoiceId', 'invoiceId', { unique: false });
      }

      // Store 7: Invoice Taxes (Detailed Breakdown)
      if (!db.objectStoreNames.contains('invoice_taxes')) {
        const store = db.createObjectStore('invoice_taxes', { keyPath: 'id', autoIncrement: true });
        store.createIndex('invoiceId', 'invoiceId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject('IndexedDB initialization error: ' + event.target.error);
    };
  });
}

// Helper: Generic read all records
function getAllRecords(storeName) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

// Helper: Generic write single record
function putRecord(storeName, record) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

// Helper: Generic delete record
function deleteRecord(storeName, id) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(Number(id));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// ==========================================
// EXPOSED PERSISTENCE FUNCTIONS
// ==========================================

// Company Configuration
// Company Configuration
function dbGetAllCompanies() {
  return getAllRecords('company');
}

function dbGetCompany(id = 1) {
  return getDB().then(db => {
    return new Promise((resolve) => {
      const tx = db.transaction('company', 'readonly');
      const store = tx.objectStore('company');
      const request = store.get(Number(id));
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => resolve(null);
    });
  });
}

function dbSaveCompany(company) {
  if (!company.id) {
    return dbGetAllCompanies().then(companies => {
      const maxId = companies.reduce((max, c) => Math.max(max, c.id || 0), 0);
      company.id = maxId + 1;
      return putRecord('company', company).then(() => company);
    });
  }
  return putRecord('company', company).then(() => company);
}

function dbSeedDefaultTaxesForCompany(companyId) {
  const defaultTaxes = [
    { taxType: 'Standard 18%', rate: 18, taxNature: 'Exclusive Taxes', type: 'Sales Tax', whTax: false },
    { taxType: 'Further Tax 4%', rate: 4, taxNature: 'Exclusive Taxes', type: 'Further Tax', whTax: false }
  ];
  const promises = defaultTaxes.map(t => {
    t.companyId = companyId;
    return dbAddTax(t);
  });
  return Promise.all(promises);
}


// Taxes
function dbGetTaxes() {
  return getAllRecords('taxes');
}

function dbAddTax(tax) {
  return putRecord('taxes', tax);
}

function dbDeleteTax(id) {
  return deleteRecord('taxes', id);
}

// Items
function dbGetItems() {
  return getAllRecords('items');
}

function dbAddItem(item) {
  return putRecord('items', item);
}

function dbDeleteItem(id) {
  return deleteRecord('items', id);
}

// Customers
function dbGetCustomers() {
  return getAllRecords('customers');
}

function dbAddCustomer(cust) {
  return putRecord('customers', cust);
}

function dbDeleteCustomer(id) {
  return deleteRecord('customers', id);
}

// Invoices (Full transaction write: master, lines, and taxes breakdown)
function dbSaveInvoice(invoiceMaster, itemsList, taxesList) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['invoices', 'invoice_details', 'invoice_taxes'], 'readwrite');
      const invoicesStore = tx.objectStore('invoices');
      const detailsStore = tx.objectStore('invoice_details');
      const taxesStore = tx.objectStore('invoice_taxes');

      const isUpdate = !!invoiceMaster.id;

      if (isUpdate) {
        const invoiceId = Number(invoiceMaster.id);
        
        // Delete existing details
        const detailsIdx = detailsStore.index('invoiceId');
        detailsIdx.openCursor(invoiceId).onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            detailsStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        // Delete existing taxes
        const taxesIdx = taxesStore.index('invoiceId');
        taxesIdx.openCursor(invoiceId).onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            taxesStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      }

      const reqMaster = invoicesStore.put(invoiceMaster);

      reqMaster.onsuccess = () => {
        const generatedId = reqMaster.result;

        // 1. Write invoice lines
        itemsList.forEach(item => {
          item.invoiceId = generatedId;
          detailsStore.put(item);
        });

        // 2. Write invoice taxes breakdown
        taxesList.forEach(tax => {
          tax.invoiceId = generatedId;
          taxesStore.put(tax);
        });
      };

      tx.oncomplete = () => {
        resolve(reqMaster.result);
      };

      tx.onerror = (e) => {
        reject(e.target.error);
      };
    });
  });
}

function dbGetInvoices() {
  return getAllRecords('invoices');
}

function dbGetInvoiceFull(invoiceId) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['invoices', 'invoice_details', 'invoice_taxes'], 'readonly');
      const invStore = tx.objectStore('invoices');
      const detStore = tx.objectStore('invoice_details');
      const taxStore = tx.objectStore('invoice_taxes');

      const reqInv = invStore.get(Number(invoiceId));

      reqInv.onsuccess = () => {
        const inv = reqInv.result;
        if (!inv) {
          return resolve(null);
        }

        const detailsIdx = detStore.index('invoiceId');
        const reqDet = detailsIdx.getAll(Number(invoiceId));

        reqDet.onsuccess = () => {
          inv.items = reqDet.result;

          const taxesIdx = taxStore.index('invoiceId');
          const reqTax = taxesIdx.getAll(Number(invoiceId));

          reqTax.onsuccess = () => {
            inv.taxesBreakdown = reqTax.result;
            resolve(inv);
          };
          reqTax.onerror = () => reject(reqTax.error);
        };
        reqDet.onerror = () => reject(reqDet.error);
      };
      reqInv.onerror = () => reject(reqInv.error);
    });
  });
}

// Delete Invoice and cascade clear details & taxes
function dbDeleteInvoice(invoiceId) {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['invoices', 'invoice_details', 'invoice_taxes'], 'readwrite');

      tx.objectStore('invoices').delete(Number(invoiceId));

      const detStore = tx.objectStore('invoice_details');
      const detIdx = detStore.index('invoiceId');
      detIdx.openCursor(Number(invoiceId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          detStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      const taxStore = tx.objectStore('invoice_taxes');
      const taxIdx = taxStore.index('invoiceId');
      taxIdx.openCursor(Number(invoiceId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          taxStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// ==========================================
// DEMO SEED DATA INJECTOR
// ==========================================
function dbSeedDemoData() {
  return getDB().then(async (db) => {
    // 1. Get raw company profile from DB
    const rawCompany = await new Promise(resolve => {
      const tx = db.transaction('company', 'readonly');
      const store = tx.objectStore('company');
      const req = store.get(1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    const CURRENT_DB_SEED_VERSION = 5; // Incremented for scenario seed expansion

    // If demo data was already seeded, skip seeding completely to respect deletions and custom items
    if (rawCompany && rawCompany.isDemoSeeded && rawCompany.dbVersionSeeded === CURRENT_DB_SEED_VERSION) {
      return Promise.resolve();
    }

    const [taxes, items, customers] = await Promise.all([dbGetTaxes(), dbGetItems(), dbGetCustomers()]);
    const promises = [];

    // Run migration on existing customers if version is < 4
    if (rawCompany && rawCompany.isDemoSeeded && rawCompany.dbVersionSeeded < 4) {
      customers.forEach(c => {
        let changed = false;
        if (c.partyType === 'Customer') {
          c.partyType = 'LOCAL';
          changed = true;
        }
        if (c.province && c.province !== c.province.toUpperCase()) {
          c.province = c.province.toUpperCase();
          changed = true;
        }
        if (changed) {
          promises.push(dbAddCustomer(c));
        }
      });
    }

    if (!rawCompany) {
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
      promises.push(dbSaveCompany(sandboxCompany));
    } else {
      // Mark as seeded to prevent checking missing items in future launches
      rawCompany.isDemoSeeded = true;
      rawCompany.dbVersionSeeded = CURRENT_DB_SEED_VERSION;
      promises.push(dbSaveCompany(rawCompany));
    }

    // Seed Taxes (Empty by default)
    const defaultTaxes = [];
    defaultTaxes.forEach(t => {
      t.companyId = 1;
      const hasTax = taxes.some(x => x.taxType === t.taxType && (x.companyId === 1 || !x.companyId));
      if (!hasTax) promises.push(dbAddTax(t));
    });

    // Seed Products / Items
    const sandboxItems = [];
    sandboxItems.forEach(i => {
      const hasItem = items.some(x => x.hsCode === i.hsCode && x.saleType === i.saleType);
      if (!hasItem) promises.push(dbAddItem(i));
    });

    // Seed Customers
    const sandboxCustomers = [];
    sandboxCustomers.forEach(c => {
      const hasCust = customers.some(x => x.ntn === c.ntn);
      if (!hasCust) promises.push(dbAddCustomer(c));
    });

    return Promise.all(promises);
  });
}


// Backup and Restore DB functions
function dbExportBackup() {
  const stores = ['company', 'taxes', 'items', 'customers', 'invoices', 'invoice_details', 'invoice_taxes'];
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  const promises = stores.map(storeName => {
    return getAllRecords(storeName).then(records => {
      backup.data[storeName] = records;
    });
  });

  return Promise.all(promises).then(() => backup);
}

function dbImportBackup(backup) {
  if (!backup || backup.version !== 1 || !backup.data) {
    return Promise.reject("Invalid backup file format.");
  }

  return getDB().then(db => {
    const stores = ['company', 'taxes', 'items', 'customers', 'invoices', 'invoice_details', 'invoice_taxes'];
    
    // Create transaction covering all stores
    const tx = db.transaction(stores, 'readwrite');
    
    // Clear and restore each store
    const promises = stores.map(storeName => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const clearReq = store.clear();
        
        clearReq.onsuccess = () => {
          const records = backup.data[storeName] || [];
          let index = 0;
          
          function putNext() {
            if (index >= records.length) {
              resolve();
              return;
            }
            
            const putReq = store.put(records[index]);
            putReq.onsuccess = () => {
              index++;
              putNext();
            };
            putReq.onerror = () => {
              reject(putReq.error);
            };
          }
          
          putNext();
        };
        
        clearReq.onerror = () => {
          reject(clearReq.error);
        };
      });
    });

    return Promise.all(promises);
  });
}



// Store the initialization promise globally so other scripts can await it
window.dbInitializationPromise = getDB().then(() => dbSeedDemoData());

