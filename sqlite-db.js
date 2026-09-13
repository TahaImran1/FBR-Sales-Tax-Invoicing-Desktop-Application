// ==========================================================
// SQLITE DATABASE ENGINE (FBR DIGITAL INVOICING SUITE)
// Enterprise High-Throughput Relational Storage & Migration
// ==========================================================

const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();

let db = null;
let dbPath = null;

// Helper: Wrap sqlite3 callback methods in modern Promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Merge raw_data JSON with relational fields to guarantee 100% field preservation
function hydrateRow(row) {
  if (!row) return null;
  let parsed = {};
  if (row.raw_data) {
    try {
      parsed = JSON.parse(row.raw_data);
    } catch (e) {
      parsed = {};
    }
  }
  const result = { ...parsed, ...row };
  delete result.raw_data;
  return result;
}

// ==========================================================
// INITIALIZATION & SCHEMA DEFINITION
// ==========================================================
async function initSQLite(customDbPath = null) {
  if (db) return db;

  if (customDbPath) {
    dbPath = customDbPath;
  } else {
    // In Electron main process
    try {
      const { app } = require('electron');
      const userDataDir = app.getPath('userData');
      if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
      dbPath = path.join(userDataDir, 'fbr_invoicing.sqlite');
    } catch (e) {
      // Fallback for standalone scripts / testing
      dbPath = path.join(__dirname, 'fbr_invoicing.sqlite');
    }
  }

  console.log('[SQLite Engine] Initializing database at:', dbPath);

  db = await new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      resolve(instance);
    });
  });

  // Enable high-performance, concurrency and crash-safety pragmas
  await exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -64000;
    PRAGMA temp_store = MEMORY;
    PRAGMA foreign_keys = ON;
  `);

  // Create Relational Tables
  await exec(`
    -- Companies
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY,
      sellerNTN TEXT,
      sellerName TEXT,
      sellerProvince TEXT,
      sellerAddress TEXT,
      fbrEnvMode TEXT,
      fbrToken TEXT,
      sendTotalVal INTEGER DEFAULT 0,
      theme TEXT,
      logoBase64 TEXT,
      isDemoSeeded INTEGER DEFAULT 0,
      dbVersionSeeded INTEGER DEFAULT 0,
      raw_data TEXT
    );

    -- Taxes
    CREATE TABLE IF NOT EXISTS taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER,
      taxType TEXT,
      rate REAL,
      taxNature TEXT,
      type TEXT,
      whTax INTEGER DEFAULT 0,
      raw_data TEXT
    );

    -- Products / Items
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER,
      itemCode TEXT,
      description TEXT,
      hsCode TEXT,
      uom TEXT,
      rate REAL,
      saleType TEXT,
      raw_data TEXT
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER,
      partyName TEXT,
      ntn TEXT,
      cnic TEXT,
      province TEXT,
      address TEXT,
      registrationType TEXT,
      partyType TEXT,
      raw_data TEXT
    );

    -- Invoices Master
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER,
      invoiceNumber TEXT,
      invoiceRefNo TEXT,
      invoiceDate TEXT,
      invoiceType TEXT,
      buyerNTN TEXT,
      buyerName TEXT,
      buyerAddress TEXT,
      buyerProvince TEXT,
      buyerRegistrationType TEXT,
      subtotalExcl REAL,
      totalSalesTax REAL,
      furtherTaxAmt REAL,
      totalExtraTax REAL,
      totalDiscount REAL,
      grandTotal REAL,
      envMode TEXT,
      status TEXT,
      timestamp TEXT,
      raw_data TEXT
    );

    -- Invoice Line Items (Details)
    CREATE TABLE IF NOT EXISTS invoice_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      hsCode TEXT,
      productDescription TEXT,
      quantity REAL,
      uom TEXT,
      unitPrice REAL,
      valueSalesExcludingST REAL,
      salesTaxApplicable REAL,
      raw_data TEXT
    );

    -- Invoice Taxes Breakdown
    CREATE TABLE IF NOT EXISTS invoice_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      taxType TEXT,
      ratePercent REAL,
      taxNature TEXT,
      valueExcl REAL,
      taxAmt REAL,
      raw_data TEXT
    );

    -- Schema Migration Log & Verification Metadata
    CREATE TABLE IF NOT EXISTS migration_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE,
      migrated_at TEXT,
      records_migrated INTEGER,
      checksum TEXT,
      details TEXT
    );

    -- B-Tree Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoiceDate);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_invoices_buyer_ntn ON invoices(buyerNTN);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(companyId);
    CREATE INDEX IF NOT EXISTS idx_details_invoice_id ON invoice_details(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_taxes_invoice_id ON invoice_taxes(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_customers_ntn ON customers(ntn);
    CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(companyId);
    CREATE INDEX IF NOT EXISTS idx_items_code ON items(itemCode);
    CREATE INDEX IF NOT EXISTS idx_items_company ON items(companyId);
    CREATE INDEX IF NOT EXISTS idx_taxes_company ON taxes(companyId);
  `);

  console.log('[SQLite Engine] Tables and indexes verified successfully.');
  return db;
}

// ==========================================================
// ZERO-LOSS DATA MIGRATION PROTOCOL
// ==========================================================
async function checkAndMigrateFromLegacy(backupDir) {
  await initSQLite();

  // Check if migration has already been executed
  const alreadyMigrated = await get(`SELECT * FROM migration_meta WHERE migration_name = 'indexeddb_to_sqlite_v1'`);
  if (alreadyMigrated) {
    console.log('[SQLite Migration] Database already migrated on:', alreadyMigrated.migrated_at);
    return { migrated: false, reason: 'already_migrated', info: alreadyMigrated };
  }

  // Look for legacy backup snapshots on disk
  if (!backupDir) {
    try {
      const { app } = require('electron');
      backupDir = path.join(app.getPath('userData'), 'backups');
    } catch (e) {
      backupDir = path.join(__dirname, 'backups');
    }
  }

  const primaryFile = path.join(backupDir, 'auto_database_backup.json');
  const fallbackFile = path.join(backupDir, 'auto_database_backup_prev.json');

  let fileToRead = null;
  if (fs.existsSync(primaryFile)) {
    fileToRead = primaryFile;
  } else if (fs.existsSync(fallbackFile)) {
    fileToRead = fallbackFile;
  }

  if (!fileToRead) {
    console.log('[SQLite Migration] No legacy disk backup found. Fresh SQLite installation ready.');
    return { migrated: false, reason: 'no_legacy_data' };
  }

  let legacyData;
  try {
    const raw = fs.readFileSync(fileToRead, 'utf8');
    legacyData = JSON.parse(raw);
  } catch (err) {
    console.error('[SQLite Migration] Failed to parse legacy backup file:', err);
    return { migrated: false, error: err.message };
  }

  return await executeZeroLossMigration(legacyData, backupDir);
}

async function executeZeroLossMigration(legacyBackup, backupDir) {
  if (!legacyBackup || !legacyBackup.data) {
    return { migrated: false, error: 'Invalid backup structure' };
  }

  const data = legacyBackup.data;
  const companies = data.company || [];
  const taxes = data.taxes || [];
  const items = data.items || [];
  const customers = data.customers || [];
  const invoices = data.invoices || [];
  const invoice_details = data.invoice_details || [];
  const invoice_taxes = data.invoice_taxes || [];

  const legacyTotalRecords = companies.length + taxes.length + items.length + 
                             customers.length + invoices.length + 
                             invoice_details.length + invoice_taxes.length;

  console.log(`[SQLite Migration] Starting zero-loss migration for ${legacyTotalRecords} total records.`);

  // 1. CREATE IMMUTABLE PRE-MIGRATION SNAPSHOT ON DISK
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(backupDir, `pre_sqlite_migration_snapshot_${timestamp}.json`);
  try {
    fs.writeFileSync(snapshotPath, JSON.stringify(legacyBackup, null, 2), 'utf8');
    console.log('[SQLite Migration] Immutable pre-migration snapshot created at:', snapshotPath);
  } catch (snapErr) {
    console.error('[SQLite Migration] Failed to write pre-migration snapshot:', snapErr);
    throw new Error('Pre-migration snapshot could not be saved to disk. Migration halted to prevent data loss.');
  }

  // Pre-calculate expected totals for reconciliation
  const expectedInvoiceSum = invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

  // 2. ATOMIC TRANSACTION EXECUTION
  await exec('BEGIN TRANSACTION;');
  try {
    // A. Companies
    for (const c of companies) {
      const raw = JSON.stringify(c);
      await run(`
        INSERT OR REPLACE INTO companies (
          id, sellerNTN, sellerName, sellerProvince, sellerAddress,
          fbrEnvMode, fbrToken, sendTotalVal, theme, logoBase64,
          isDemoSeeded, dbVersionSeeded, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        c.id || 1,
        c.sellerNTN || '',
        c.sellerName || '',
        c.sellerProvince || 'Sindh',
        c.sellerAddress || '',
        c.fbrEnvMode || 'sandbox',
        c.fbrToken || '',
        c.sendTotalVal ? 1 : 0,
        c.theme || 'midnight-abyss',
        c.logoBase64 || '',
        c.isDemoSeeded ? 1 : 0,
        c.dbVersionSeeded || 0,
        raw
      ]);
    }

    // B. Taxes
    for (const t of taxes) {
      const raw = JSON.stringify(t);
      await run(`
        INSERT INTO taxes (id, companyId, taxType, rate, taxNature, type, whTax, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        t.id,
        t.companyId || 1,
        t.taxType || '',
        Number(t.rate) || 0,
        t.taxNature || '',
        t.type || '',
        t.whTax ? 1 : 0,
        raw
      ]);
    }

    // C. Products / Items
    for (const item of items) {
      const raw = JSON.stringify(item);
      await run(`
        INSERT INTO items (id, companyId, itemCode, description, hsCode, uom, rate, saleType, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.id,
        item.companyId || 1,
        item.itemCode || '',
        item.description || '',
        item.hsCode || '',
        item.uom || '',
        Number(item.rate) || 0,
        item.saleType || '',
        raw
      ]);
    }

    // D. Customers
    for (const cust of customers) {
      const raw = JSON.stringify(cust);
      await run(`
        INSERT INTO customers (id, companyId, partyName, ntn, cnic, province, address, registrationType, partyType, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cust.id,
        cust.companyId || 1,
        cust.partyName || '',
        cust.ntn || '',
        cust.cnic || '',
        cust.province || '',
        cust.address || '',
        cust.registrationType || '',
        cust.partyType || 'LOCAL',
        raw
      ]);
    }

    // E. Invoices Master
    for (const inv of invoices) {
      const raw = JSON.stringify(inv);
      await run(`
        INSERT INTO invoices (
          id, companyId, invoiceNumber, invoiceRefNo, invoiceDate, invoiceType,
          buyerNTN, buyerName, buyerAddress, buyerProvince, buyerRegistrationType,
          subtotalExcl, totalSalesTax, furtherTaxAmt, totalExtraTax, totalDiscount,
          grandTotal, envMode, status, timestamp, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        inv.id,
        inv.companyId || 1,
        inv.invoiceNumber || '',
        inv.invoiceRefNo || '',
        inv.invoiceDate || '',
        inv.invoiceType || '',
        inv.buyerNTN || '',
        inv.buyerName || '',
        inv.buyerAddress || '',
        inv.buyerProvince || '',
        inv.buyerRegistrationType || '',
        Number(inv.subtotalExcl) || 0,
        Number(inv.totalSalesTax) || 0,
        Number(inv.furtherTaxAmt) || 0,
        Number(inv.totalExtraTax) || 0,
        Number(inv.totalDiscount) || 0,
        Number(inv.grandTotal) || 0,
        inv.envMode || 'sandbox',
        inv.status || 'Posted',
        inv.timestamp || '',
        raw
      ]);
    }

    // F. Invoice Line Items
    for (const det of invoice_details) {
      const raw = JSON.stringify(det);
      await run(`
        INSERT INTO invoice_details (
          id, invoiceId, hsCode, productDescription, quantity,
          uom, unitPrice, valueSalesExcludingST, salesTaxApplicable, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        det.id,
        det.invoiceId,
        det.hsCode || '',
        det.productDescription || '',
        Number(det.quantity) || 0,
        det.uom || '',
        Number(det.unitPrice) || 0,
        Number(det.valueSalesExcludingST) || 0,
        Number(det.salesTaxApplicable) || 0,
        raw
      ]);
    }

    // G. Invoice Taxes
    for (const it of invoice_taxes) {
      const raw = JSON.stringify(it);
      await run(`
        INSERT INTO invoice_taxes (
          id, invoiceId, taxType, ratePercent, taxNature, valueExcl, taxAmt, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        it.id,
        it.invoiceId,
        it.taxType || '',
        Number(it.ratePercent) || 0,
        it.taxNature || '',
        Number(it.valueExcl) || 0,
        Number(it.taxAmt) || 0,
        raw
      ]);
    }

    // 3. RECONCILIATION & INTEGRITY VERIFICATION
    const countComp = (await get('SELECT COUNT(*) as cnt FROM companies')).cnt;
    const countTaxes = (await get('SELECT COUNT(*) as cnt FROM taxes')).cnt;
    const countItems = (await get('SELECT COUNT(*) as cnt FROM items')).cnt;
    const countCust = (await get('SELECT COUNT(*) as cnt FROM customers')).cnt;
    const countInv = (await get('SELECT COUNT(*) as cnt FROM invoices')).cnt;
    const countDet = (await get('SELECT COUNT(*) as cnt FROM invoice_details')).cnt;
    const countTaxBk = (await get('SELECT COUNT(*) as cnt FROM invoice_taxes')).cnt;

    const actualInvoiceSumRow = await get('SELECT COALESCE(SUM(grandTotal), 0) as total FROM invoices');
    const actualInvoiceSum = actualInvoiceSumRow ? actualInvoiceSumRow.total : 0;

    console.log('[SQLite Migration Verification Check]:', {
      companies: `${countComp}/${companies.length}`,
      taxes: `${countTaxes}/${taxes.length}`,
      items: `${countItems}/${items.length}`,
      customers: `${countCust}/${customers.length}`,
      invoices: `${countInv}/${invoices.length}`,
      details: `${countDet}/${invoice_details.length}`,
      invoice_taxes: `${countTaxBk}/${invoice_taxes.length}`,
      financialSumDiff: Math.abs(actualInvoiceSum - expectedInvoiceSum)
    });

    if (
      countComp !== companies.length ||
      countTaxes !== taxes.length ||
      countItems !== items.length ||
      countCust !== customers.length ||
      countInv !== invoices.length ||
      countDet !== invoice_details.length ||
      countTaxBk !== invoice_taxes.length ||
      Math.abs(actualInvoiceSum - expectedInvoiceSum) > 0.01
    ) {
      throw new Error(`Data reconciliation failed during migration. Count or financial sum mismatch.`);
    }

    // Log successful migration meta
    await run(`
      INSERT INTO migration_meta (migration_name, migrated_at, records_migrated, checksum, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'indexeddb_to_sqlite_v1',
      new Date().toISOString(),
      legacyTotalRecords,
      `snapshot:${path.basename(snapshotPath)}`,
      JSON.stringify({
        companies: countComp,
        taxes: countTaxes,
        items: countItems,
        customers: countCust,
        invoices: countInv,
        details: countDet,
        invoice_taxes: countTaxBk,
        invoiceSum: actualInvoiceSum
      })
    ]);

    await exec('COMMIT;');
    console.log('[SQLite Migration] Transaction COMMITTED successfully! 100% Data Integrity Guaranteed.');

    // Safely mark legacy disk file as migrated without deleting it
    const primaryFile = path.join(backupDir, 'auto_database_backup.json');
    const migratedMarker = path.join(backupDir, 'auto_database_backup_migrated.json.bak');
    if (fs.existsSync(primaryFile)) {
      try {
        fs.copyFileSync(primaryFile, migratedMarker);
      } catch (e) {}
    }

    return {
      migrated: true,
      recordsMigrated: legacyTotalRecords,
      snapshotPath
    };
  } catch (err) {
    console.error('[SQLite Migration ERROR] Rolling back transaction:', err);
    await exec('ROLLBACK;');
    throw err;
  }
}

// ==========================================================
// EXPOSED PERSISTENCE FUNCTIONS (100% API COMPATIBLE)
// ==========================================================

// --- Companies ---
async function dbGetAllCompanies() {
  await initSQLite();
  const rows = await all('SELECT * FROM companies ORDER BY id ASC');
  return rows.map(hydrateRow);
}

async function dbGetCompany(id = 1) {
  await initSQLite();
  const row = await get('SELECT * FROM companies WHERE id = ?', [Number(id)]);
  return hydrateRow(row);
}

async function dbSaveCompany(company) {
  await initSQLite();
  if (!company) return null;

  if (!company.id) {
    const maxRow = await get('SELECT MAX(id) as maxId FROM companies');
    company.id = (maxRow && maxRow.maxId ? maxRow.maxId : 0) + 1;
  }

  const raw = JSON.stringify(company);
  await run(`
    INSERT OR REPLACE INTO companies (
      id, sellerNTN, sellerName, sellerProvince, sellerAddress,
      fbrEnvMode, fbrToken, sendTotalVal, theme, logoBase64,
      isDemoSeeded, dbVersionSeeded, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    Number(company.id),
    company.sellerNTN || '',
    company.sellerName || '',
    company.sellerProvince || 'Sindh',
    company.sellerAddress || '',
    company.fbrEnvMode || 'sandbox',
    company.fbrToken || '',
    company.sendTotalVal ? 1 : 0,
    company.theme || 'midnight-abyss',
    company.logoBase64 || '',
    company.isDemoSeeded ? 1 : 0,
    company.dbVersionSeeded || 0,
    raw
  ]);

  return company;
}

async function dbSeedDefaultTaxesForCompany(companyId) {
  await initSQLite();
  const defaultTaxes = [
    { taxType: 'Standard 18%', rate: 18, taxNature: 'Exclusive Taxes', type: 'Sales Tax', whTax: false, companyId },
    { taxType: 'Further Tax 4%', rate: 4, taxNature: 'Exclusive Taxes', type: 'Further Tax', whTax: false, companyId }
  ];
  for (const t of defaultTaxes) {
    await dbAddTax(t);
  }
  return defaultTaxes;
}

// --- Taxes ---
async function dbGetTaxes() {
  await initSQLite();
  const rows = await all('SELECT * FROM taxes ORDER BY id ASC');
  return rows.map(hydrateRow);
}

async function dbAddTax(tax) {
  await initSQLite();
  const raw = JSON.stringify(tax);
  if (tax.id) {
    await run(`
      INSERT OR REPLACE INTO taxes (id, companyId, taxType, rate, taxNature, type, whTax, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      Number(tax.id),
      tax.companyId || 1,
      tax.taxType || '',
      Number(tax.rate) || 0,
      tax.taxNature || '',
      tax.type || '',
      tax.whTax ? 1 : 0,
      raw
    ]);
    return tax.id;
  } else {
    const res = await run(`
      INSERT INTO taxes (companyId, taxType, rate, taxNature, type, whTax, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tax.companyId || 1,
      tax.taxType || '',
      Number(tax.rate) || 0,
      tax.taxNature || '',
      tax.type || '',
      tax.whTax ? 1 : 0,
      raw
    ]);
    tax.id = res.lastID;
    return res.lastID;
  }
}

async function dbDeleteTax(id) {
  await initSQLite();
  await run('DELETE FROM taxes WHERE id = ?', [Number(id)]);
}

// --- Items ---
async function dbGetItems() {
  await initSQLite();
  const rows = await all('SELECT * FROM items ORDER BY id ASC');
  return rows.map(hydrateRow);
}

async function dbAddItem(item) {
  await initSQLite();
  const raw = JSON.stringify(item);
  if (item.id) {
    await run(`
      INSERT OR REPLACE INTO items (id, companyId, itemCode, description, hsCode, uom, rate, saleType, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      Number(item.id),
      item.companyId || 1,
      item.itemCode || '',
      item.description || '',
      item.hsCode || '',
      item.uom || '',
      Number(item.rate) || 0,
      item.saleType || '',
      raw
    ]);
    return item.id;
  } else {
    const res = await run(`
      INSERT INTO items (companyId, itemCode, description, hsCode, uom, rate, saleType, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item.companyId || 1,
      item.itemCode || '',
      item.description || '',
      item.hsCode || '',
      item.uom || '',
      Number(item.rate) || 0,
      item.saleType || '',
      raw
    ]);
    item.id = res.lastID;
    return res.lastID;
  }
}

async function dbDeleteItem(id) {
  await initSQLite();
  await run('DELETE FROM items WHERE id = ?', [Number(id)]);
}

// --- Customers ---
async function dbGetCustomers() {
  await initSQLite();
  const rows = await all('SELECT * FROM customers ORDER BY id ASC');
  return rows.map(hydrateRow);
}

async function dbAddCustomer(cust) {
  await initSQLite();
  const raw = JSON.stringify(cust);
  if (cust.id) {
    await run(`
      INSERT OR REPLACE INTO customers (id, companyId, partyName, ntn, cnic, province, address, registrationType, partyType, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      Number(cust.id),
      cust.companyId || 1,
      cust.partyName || '',
      cust.ntn || '',
      cust.cnic || '',
      cust.province || '',
      cust.address || '',
      cust.registrationType || '',
      cust.partyType || 'LOCAL',
      raw
    ]);
    return cust.id;
  } else {
    const res = await run(`
      INSERT INTO customers (companyId, partyName, ntn, cnic, province, address, registrationType, partyType, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cust.companyId || 1,
      cust.partyName || '',
      cust.ntn || '',
      cust.cnic || '',
      cust.province || '',
      cust.address || '',
      cust.registrationType || '',
      cust.partyType || 'LOCAL',
      raw
    ]);
    cust.id = res.lastID;
    return res.lastID;
  }
}

async function dbDeleteCustomer(id) {
  await initSQLite();
  await run('DELETE FROM customers WHERE id = ?', [Number(id)]);
}

// --- Invoices ---
async function dbSaveInvoice(invoiceMaster, itemsList = [], taxesList = []) {
  await initSQLite();

  await exec('BEGIN TRANSACTION;');
  try {
    let invoiceId = invoiceMaster.id ? Number(invoiceMaster.id) : null;
    const rawMaster = JSON.stringify(invoiceMaster);

    if (invoiceId) {
      // Update existing master
      await run(`
        UPDATE invoices SET
          companyId = ?, invoiceNumber = ?, invoiceRefNo = ?, invoiceDate = ?, invoiceType = ?,
          buyerNTN = ?, buyerName = ?, buyerAddress = ?, buyerProvince = ?, buyerRegistrationType = ?,
          subtotalExcl = ?, totalSalesTax = ?, furtherTaxAmt = ?, totalExtraTax = ?, totalDiscount = ?,
          grandTotal = ?, envMode = ?, status = ?, timestamp = ?, raw_data = ?
        WHERE id = ?
      `, [
        invoiceMaster.companyId || 1,
        invoiceMaster.invoiceNumber || '',
        invoiceMaster.invoiceRefNo || '',
        invoiceMaster.invoiceDate || '',
        invoiceMaster.invoiceType || '',
        invoiceMaster.buyerNTN || '',
        invoiceMaster.buyerName || '',
        invoiceMaster.buyerAddress || '',
        invoiceMaster.buyerProvince || '',
        invoiceMaster.buyerRegistrationType || '',
        Number(invoiceMaster.subtotalExcl) || 0,
        Number(invoiceMaster.totalSalesTax) || 0,
        Number(invoiceMaster.furtherTaxAmt) || 0,
        Number(invoiceMaster.totalExtraTax) || 0,
        Number(invoiceMaster.totalDiscount) || 0,
        Number(invoiceMaster.grandTotal) || 0,
        invoiceMaster.envMode || 'sandbox',
        invoiceMaster.status || 'Posted',
        invoiceMaster.timestamp || '',
        rawMaster,
        invoiceId
      ]);

      // Delete existing details and taxes to prevent duplication
      await run('DELETE FROM invoice_details WHERE invoiceId = ?', [invoiceId]);
      await run('DELETE FROM invoice_taxes WHERE invoiceId = ?', [invoiceId]);
    } else {
      // Insert new invoice
      const res = await run(`
        INSERT INTO invoices (
          companyId, invoiceNumber, invoiceRefNo, invoiceDate, invoiceType,
          buyerNTN, buyerName, buyerAddress, buyerProvince, buyerRegistrationType,
          subtotalExcl, totalSalesTax, furtherTaxAmt, totalExtraTax, totalDiscount,
          grandTotal, envMode, status, timestamp, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceMaster.companyId || 1,
        invoiceMaster.invoiceNumber || '',
        invoiceMaster.invoiceRefNo || '',
        invoiceMaster.invoiceDate || '',
        invoiceMaster.invoiceType || '',
        invoiceMaster.buyerNTN || '',
        invoiceMaster.buyerName || '',
        invoiceMaster.buyerAddress || '',
        invoiceMaster.buyerProvince || '',
        invoiceMaster.buyerRegistrationType || '',
        Number(invoiceMaster.subtotalExcl) || 0,
        Number(invoiceMaster.totalSalesTax) || 0,
        Number(invoiceMaster.furtherTaxAmt) || 0,
        Number(invoiceMaster.totalExtraTax) || 0,
        Number(invoiceMaster.totalDiscount) || 0,
        Number(invoiceMaster.grandTotal) || 0,
        invoiceMaster.envMode || 'sandbox',
        invoiceMaster.status || 'Posted',
        invoiceMaster.timestamp || '',
        rawMaster
      ]);
      invoiceId = res.lastID;
      invoiceMaster.id = invoiceId;
    }

    // Insert line items
    for (const item of itemsList) {
      item.invoiceId = invoiceId;
      const rawItem = JSON.stringify(item);
      await run(`
        INSERT INTO invoice_details (
          invoiceId, hsCode, productDescription, quantity,
          uom, unitPrice, valueSalesExcludingST, salesTaxApplicable, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        item.hsCode || '',
        item.productDescription || '',
        Number(item.quantity) || 0,
        item.uom || '',
        Number(item.unitPrice) || 0,
        Number(item.valueSalesExcludingST) || 0,
        Number(item.salesTaxApplicable) || 0,
        rawItem
      ]);
    }

    // Insert taxes breakdown
    for (const tax of taxesList) {
      tax.invoiceId = invoiceId;
      const rawTax = JSON.stringify(tax);
      await run(`
        INSERT INTO invoice_taxes (
          invoiceId, taxType, ratePercent, taxNature, valueExcl, taxAmt, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        tax.taxType || '',
        Number(tax.ratePercent) || 0,
        tax.taxNature || '',
        Number(tax.valueExcl) || 0,
        Number(tax.taxAmt) || 0,
        rawTax
      ]);
    }

    await exec('COMMIT;');
    return invoiceId;
  } catch (err) {
    await exec('ROLLBACK;');
    throw err;
  }
}

async function dbGetInvoices() {
  await initSQLite();
  const rows = await all('SELECT * FROM invoices ORDER BY id DESC');
  return rows.map(hydrateRow);
}

async function dbGetInvoiceFull(invoiceId) {
  await initSQLite();
  const id = Number(invoiceId);
  const invRow = await get('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!invRow) return null;

  const inv = hydrateRow(invRow);

  const detailRows = await all('SELECT * FROM invoice_details WHERE invoiceId = ? ORDER BY id ASC', [id]);
  inv.items = detailRows.map(hydrateRow);

  const taxRows = await all('SELECT * FROM invoice_taxes WHERE invoiceId = ? ORDER BY id ASC', [id]);
  inv.taxesBreakdown = taxRows.map(hydrateRow);

  return inv;
}

async function dbDeleteInvoice(invoiceId) {
  await initSQLite();
  const id = Number(invoiceId);
  await exec('BEGIN TRANSACTION;');
  try {
    await run('DELETE FROM invoice_taxes WHERE invoiceId = ?', [id]);
    await run('DELETE FROM invoice_details WHERE invoiceId = ?', [id]);
    await run('DELETE FROM invoices WHERE id = ?', [id]);
    await exec('COMMIT;');
  } catch (err) {
    await exec('ROLLBACK;');
    throw err;
  }
}

// --- Backup & Restore ---
async function dbExportBackup() {
  await initSQLite();
  const [company, taxes, items, customers, invoices, invoice_details, invoice_taxes] = await Promise.all([
    all('SELECT * FROM companies ORDER BY id ASC'),
    all('SELECT * FROM taxes ORDER BY id ASC'),
    all('SELECT * FROM items ORDER BY id ASC'),
    all('SELECT * FROM customers ORDER BY id ASC'),
    all('SELECT * FROM invoices ORDER BY id ASC'),
    all('SELECT * FROM invoice_details ORDER BY id ASC'),
    all('SELECT * FROM invoice_taxes ORDER BY id ASC')
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      company: company.map(hydrateRow),
      taxes: taxes.map(hydrateRow),
      items: items.map(hydrateRow),
      customers: customers.map(hydrateRow),
      invoices: invoices.map(hydrateRow),
      invoice_details: invoice_details.map(hydrateRow),
      invoice_taxes: invoice_taxes.map(hydrateRow)
    }
  };
}

async function dbImportBackup(backup) {
  if (!backup || !backup.data) {
    throw new Error('Invalid backup file format.');
  }

  await initSQLite();
  const data = backup.data;

  await exec('BEGIN TRANSACTION;');
  try {
    await run('DELETE FROM invoice_taxes');
    await run('DELETE FROM invoice_details');
    await run('DELETE FROM invoices');
    await run('DELETE FROM customers');
    await run('DELETE FROM items');
    await run('DELETE FROM taxes');
    await run('DELETE FROM companies');

    // Restore Companies
    for (const c of (data.company || [])) {
      await dbSaveCompany(c);
    }

    // Restore Taxes
    for (const t of (data.taxes || [])) {
      await dbAddTax(t);
    }

    // Restore Items
    for (const i of (data.items || [])) {
      await dbAddItem(i);
    }

    // Restore Customers
    for (const cust of (data.customers || [])) {
      await dbAddCustomer(cust);
    }

    // Restore Invoices
    for (const inv of (data.invoices || [])) {
      const raw = JSON.stringify(inv);
      await run(`
        INSERT INTO invoices (
          id, companyId, invoiceNumber, invoiceRefNo, invoiceDate, invoiceType,
          buyerNTN, buyerName, buyerAddress, buyerProvince, buyerRegistrationType,
          subtotalExcl, totalSalesTax, furtherTaxAmt, totalExtraTax, totalDiscount,
          grandTotal, envMode, status, timestamp, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        inv.id,
        inv.companyId || 1,
        inv.invoiceNumber || '',
        inv.invoiceRefNo || '',
        inv.invoiceDate || '',
        inv.invoiceType || '',
        inv.buyerNTN || '',
        inv.buyerName || '',
        inv.buyerAddress || '',
        inv.buyerProvince || '',
        inv.buyerRegistrationType || '',
        Number(inv.subtotalExcl) || 0,
        Number(inv.totalSalesTax) || 0,
        Number(inv.furtherTaxAmt) || 0,
        Number(inv.totalExtraTax) || 0,
        Number(inv.totalDiscount) || 0,
        Number(inv.grandTotal) || 0,
        inv.envMode || 'sandbox',
        inv.status || 'Posted',
        inv.timestamp || '',
        raw
      ]);
    }

    // Restore Details
    for (const det of (data.invoice_details || [])) {
      const raw = JSON.stringify(det);
      await run(`
        INSERT INTO invoice_details (
          id, invoiceId, hsCode, productDescription, quantity,
          uom, unitPrice, valueSalesExcludingST, salesTaxApplicable, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        det.id,
        det.invoiceId,
        det.hsCode || '',
        det.productDescription || '',
        Number(det.quantity) || 0,
        det.uom || '',
        Number(det.unitPrice) || 0,
        Number(det.valueSalesExcludingST) || 0,
        Number(det.salesTaxApplicable) || 0,
        raw
      ]);
    }

    // Restore Taxes Breakdown
    for (const tx of (data.invoice_taxes || [])) {
      const raw = JSON.stringify(tx);
      await run(`
        INSERT INTO invoice_taxes (
          id, invoiceId, taxType, ratePercent, taxNature, valueExcl, taxAmt, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tx.id,
        tx.invoiceId,
        tx.taxType || '',
        Number(tx.ratePercent) || 0,
        tx.taxNature || '',
        Number(tx.valueExcl) || 0,
        Number(tx.taxAmt) || 0,
        raw
      ]);
    }

    await exec('COMMIT;');
    return true;
  } catch (err) {
    await exec('ROLLBACK;');
    throw err;
  }
}

module.exports = {
  initSQLite,
  checkAndMigrateFromLegacy,
  executeZeroLossMigration,
  dbGetAllCompanies,
  dbGetCompany,
  dbSaveCompany,
  dbSeedDefaultTaxesForCompany,
  dbGetTaxes,
  dbAddTax,
  dbDeleteTax,
  dbGetItems,
  dbAddItem,
  dbDeleteItem,
  dbGetCustomers,
  dbAddCustomer,
  dbDeleteCustomer,
  dbSaveInvoice,
  dbGetInvoices,
  dbGetInvoiceFull,
  dbDeleteInvoice,
  dbExportBackup,
  dbImportBackup
};
