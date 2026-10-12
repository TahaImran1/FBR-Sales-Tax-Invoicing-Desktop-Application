// ==========================================================
// EXCEL IMPORT & TEMPLATE SERVICE (FBR DIGITAL INVOICING)
// High-Speed Multi-Invoice Parsing, Validation & Template Engine
// Supporting Auto-Population via Custom IDs & Dedicated Reference Sheets
// ==========================================================

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const sqliteDb = require('./sqlite-db.js');

// 1. Generate Labeled Excel Template with Reference Pages
async function generateInvoiceTemplateBuffer(companyId = 1) {
  const wb = XLSX.utils.book_new();

  // Load existing buyers and products from database for reference and dynamic samples
  let dbCustomers = [];
  let dbItems = [];
  try {
    const allCustomers = await sqliteDb.dbGetCustomers();
    const allItems = await sqliteDb.dbGetItems();
    dbCustomers = (allCustomers || []).filter(c => c.companyId === Number(companyId) || (!c.companyId && Number(companyId) === 1));
    dbItems = (allItems || []).filter(i => (i.companyId === Number(companyId) || (!i.companyId && Number(companyId) === 1)) && i.isActive !== false);
  } catch (err) {
    console.warn('[Excel Service] Warning loading reference data for template:', err.message);
  }

  // Derive sample codes if available in database
  const sampleCustCode = dbCustomers.length > 0 ? (dbCustomers[0].customerCode || dbCustomers[0].customId || String(dbCustomers[0].id)) : 'CUST-001';
  const sampleCustName = dbCustomers.length > 0 ? dbCustomers[0].partyName : 'AHS BEARING INDUSTRY';
  const sampleCustNtn = dbCustomers.length > 0 ? (dbCustomers[0].ntn || '6404189') : '6404189';
  const sampleCustProvince = dbCustomers.length > 0 ? (dbCustomers[0].province || 'PUNJAB') : 'PUNJAB';
  const sampleCustAddress = dbCustomers.length > 0 ? (dbCustomers[0].address || 'Industrial Estate, Lahore') : 'Industrial Estate, Lahore';

  const sampleProdCode1 = dbItems.length > 0 ? (dbItems[0].productCode || dbItems[0].customId || dbItems[0].customProductId || String(dbItems[0].id)) : 'PROD-001';
  const sampleProdDesc1 = dbItems.length > 0 ? (dbItems[0].itemDesc || dbItems[0].description) : 'Ball Bearing 6205-2RS';
  const sampleProdHs1 = dbItems.length > 0 ? dbItems[0].hsCode : '8482.10.00';
  const sampleProdUom1 = dbItems.length > 0 ? dbItems[0].uom : 'PCS';
  const sampleProdRate1 = dbItems.length > 0 && Number(dbItems[0].rate) > 0 ? Number(dbItems[0].rate) : 850.00;

  const sampleProdCode2 = dbItems.length > 1 ? (dbItems[1].productCode || dbItems[1].customId || dbItems[1].customProductId || String(dbItems[1].id)) : 'PROD-002';
  const sampleProdDesc2 = dbItems.length > 1 ? (dbItems[1].itemDesc || dbItems[1].description) : 'Bearing Housing Pillow Block UCP205';
  const sampleProdHs2 = dbItems.length > 1 ? dbItems[1].hsCode : '8483.20.00';
  const sampleProdUom2 = dbItems.length > 1 ? dbItems[1].uom : 'PCS';
  const sampleProdRate2 = dbItems.length > 1 && Number(dbItems[1].rate) > 0 ? Number(dbItems[1].rate) : 1400.00;

  // Sheet 1: Invoices (Template with sample data demonstrating both Auto-Population and Manual Fallback)
  const headers = [
    'InvoiceRefNo',
    'InvoiceDate',
    'InvoiceType',
    'CustomerCode',
    'BuyerNTN',
    'BuyerCNIC',
    'BuyerName',
    'BuyerProvince',
    'BuyerAddress',
    'BuyerRegistrationType',
    'ScenarioId',
    'ProductCode',
    'HSCode',
    'ProductDescription',
    'UOM',
    'Quantity',
    'UnitPrice',
    'Discount',
    'SaleType',
    'TaxRatePercent',
    'FurtherTaxPercent',
    'ExtraTax',
    'RetailPrice'
  ];

  const sampleRows = [
    {
      InvoiceRefNo: 'INV-SAMPLE-001',
      InvoiceDate: '2026-09-28',
      InvoiceType: 'Sale Invoice',
      CustomerCode: sampleCustCode, // Auto-populates buyer info from database!
      BuyerNTN: sampleCustNtn,
      BuyerCNIC: '',
      BuyerName: sampleCustName,
      BuyerProvince: sampleCustProvince,
      BuyerAddress: sampleCustAddress,
      BuyerRegistrationType: 'Registered',
      ScenarioId: 'SN001',
      ProductCode: sampleProdCode1, // Auto-populates product info from database!
      HSCode: sampleProdHs1,
      ProductDescription: sampleProdDesc1,
      UOM: sampleProdUom1,
      Quantity: 50,
      UnitPrice: sampleProdRate1,
      Discount: 500.00,
      SaleType: 'Goods at standard rate',
      TaxRatePercent: 18,
      FurtherTaxPercent: 0,
      ExtraTax: 0,
      RetailPrice: 0
    },
    {
      InvoiceRefNo: 'INV-SAMPLE-001', // Same InvoiceRefNo = Line 2 of Invoice INV-SAMPLE-001
      InvoiceDate: '2026-09-28',
      InvoiceType: 'Sale Invoice',
      CustomerCode: sampleCustCode,
      BuyerNTN: sampleCustNtn,
      BuyerCNIC: '',
      BuyerName: sampleCustName,
      BuyerProvince: sampleCustProvince,
      BuyerAddress: sampleCustAddress,
      BuyerRegistrationType: 'Registered',
      ScenarioId: 'SN001',
      ProductCode: sampleProdCode2, // Line 2 product code auto-population
      HSCode: sampleProdHs2,
      ProductDescription: sampleProdDesc2,
      UOM: sampleProdUom2,
      Quantity: 20,
      UnitPrice: sampleProdRate2,
      Discount: 0,
      SaleType: 'Goods at standard rate',
      TaxRatePercent: 18,
      FurtherTaxPercent: 0,
      ExtraTax: 0,
      RetailPrice: 0
    },
    {
      InvoiceRefNo: 'INV-SAMPLE-002', // Demonstrating seamless manual fallback when codes are blank
      InvoiceDate: '2026-09-28',
      InvoiceType: 'Sale Invoice',
      CustomerCode: '', // Blank: manual entry fallback
      BuyerNTN: '9999997',
      BuyerCNIC: '4210112345671',
      BuyerName: 'Tariq Traders (Unregistered)',
      BuyerProvince: 'SINDH',
      BuyerAddress: 'Saddar, Karachi',
      BuyerRegistrationType: 'Unregistered',
      ScenarioId: 'SN002',
      ProductCode: '', // Blank: manual entry fallback
      HSCode: '8482.20.00',
      ProductDescription: 'Tapered Roller Bearing 30205',
      UOM: 'PCS',
      Quantity: 15,
      UnitPrice: 1200.00,
      Discount: 0,
      SaleType: 'Goods at standard rate',
      TaxRatePercent: 18,
      FurtherTaxPercent: 4,
      ExtraTax: 0,
      RetailPrice: 0
    }
  ];

  const wsInvoices = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  wsInvoices['!cols'] = [
    { wch: 16 }, // InvoiceRefNo
    { wch: 12 }, // InvoiceDate
    { wch: 14 }, // InvoiceType
    { wch: 16 }, // CustomerCode
    { wch: 14 }, // BuyerNTN
    { wch: 16 }, // BuyerCNIC
    { wch: 28 }, // BuyerName
    { wch: 14 }, // BuyerProvince
    { wch: 30 }, // BuyerAddress
    { wch: 20 }, // BuyerRegistrationType
    { wch: 12 }, // ScenarioId
    { wch: 16 }, // ProductCode
    { wch: 14 }, // HSCode
    { wch: 35 }, // ProductDescription
    { wch: 8 },  // UOM
    { wch: 10 }, // Quantity
    { wch: 12 }, // UnitPrice
    { wch: 10 }, // Discount
    { wch: 25 }, // SaleType
    { wch: 14 }, // TaxRatePercent
    { wch: 16 }, // FurtherTaxPercent
    { wch: 10 }, // ExtraTax
    { wch: 12 }  // RetailPrice
  ];

  // Sheet 2: Buyers Reference (Live Directory from Database)
  const buyerRefHeaders = [
    'Customer Code',
    'Customer Name',
    'NTN',
    'CNIC',
    'Registration Type',
    'Province',
    'Address',
    'Party Type',
    'Email',
    'Mobile No'
  ];

  let buyerRefRows = [];
  if (dbCustomers.length > 0) {
    buyerRefRows = dbCustomers.map(c => ({
      'Customer Code': c.customerCode || c.customId || c.customBuyerId || String(c.id),
      'Customer Name': c.partyName || '',
      'NTN': c.ntn || '9999997',
      'CNIC': c.cnic || '',
      'Registration Type': c.registrationType || 'Registered',
      'Province': c.province || 'PUNJAB',
      'Address': c.address || '',
      'Party Type': c.partyType || 'LOCAL',
      'Email': c.email || '',
      'Mobile No': c.mobileNo || ''
    }));
  } else {
    buyerRefRows = [
      {
        'Customer Code': 'CUST-001',
        'Customer Name': 'Sample Registered Industrial Corp',
        'NTN': '1234567',
        'CNIC': '',
        'Registration Type': 'Registered',
        'Province': 'PUNJAB',
        'Address': 'Industrial Area, Lahore',
        'Party Type': 'LOCAL',
        'Email': 'info@industrialcorp.pk',
        'Mobile No': '03001234567'
      },
      {
        'Customer Code': 'CUST-002',
        'Customer Name': 'Walk-in Unregistered Retail Buyer',
        'NTN': '9999997',
        'CNIC': '4210112345671',
        'Registration Type': 'Unregistered',
        'Province': 'SINDH',
        'Address': 'Saddar Market, Karachi',
        'Party Type': 'LOCAL',
        'Email': '',
        'Mobile No': '03219876543'
      }
    ];
  }

  const wsBuyers = XLSX.utils.json_to_sheet(buyerRefRows, { header: buyerRefHeaders });
  wsBuyers['!cols'] = [
    { wch: 18 }, // Customer Code
    { wch: 32 }, // Customer Name
    { wch: 14 }, // NTN
    { wch: 16 }, // CNIC
    { wch: 18 }, // Registration Type
    { wch: 14 }, // Province
    { wch: 35 }, // Address
    { wch: 15 }, // Party Type
    { wch: 24 }, // Email
    { wch: 16 }  // Mobile No
  ];

  // Sheet 3: Products Reference (Live Catalog from Database)
  const productRefHeaders = [
    'Product Code',
    'Item Code / SKU',
    'Product Description',
    'HS Code',
    'UOM',
    'Sale Type',
    'Default Rate (PKR)',
    'Retail Price (PKR)',
    'Status'
  ];

  let productRefRows = [];
  if (dbItems.length > 0) {
    productRefRows = dbItems.map(i => ({
      'Product Code': i.productCode || i.customId || i.customProductId || String(i.id),
      'Item Code / SKU': i.itemCode || '',
      'Product Description': i.itemDesc || i.description || '',
      'HS Code': i.hsCode || '',
      'UOM': i.uom || 'PCS',
      'Sale Type': i.saleType || 'Goods at standard rate',
      'Default Rate (PKR)': Number(i.rate) || 0,
      'Retail Price (PKR)': Number(i.retailPrice) || 0,
      'Status': i.isActive !== false ? 'Active' : 'Inactive'
    }));
  } else {
    productRefRows = [
      {
        'Product Code': 'PROD-001',
        'Item Code / SKU': 'BRG-6205',
        'Product Description': 'Deep Groove Ball Bearing 6205-2RS',
        'HS Code': '8482.10.00',
        'UOM': 'PCS',
        'Sale Type': 'Goods at standard rate',
        'Default Rate (PKR)': 850.00,
        'Retail Price (PKR)': 0.00,
        'Status': 'Active'
      },
      {
        'Product Code': 'PROD-002',
        'Item Code / SKU': 'PLW-205',
        'Product Description': 'Bearing Housing Pillow Block UCP205',
        'HS Code': '8483.20.00',
        'UOM': 'PCS',
        'Sale Type': 'Goods at standard rate',
        'Default Rate (PKR)': 1400.00,
        'Retail Price (PKR)': 0.00,
        'Status': 'Active'
      }
    ];
  }

  const wsProducts = XLSX.utils.json_to_sheet(productRefRows, { header: productRefHeaders });
  wsProducts['!cols'] = [
    { wch: 18 }, // Product Code
    { wch: 16 }, // Item Code / SKU
    { wch: 38 }, // Product Description
    { wch: 14 }, // HS Code
    { wch: 10 }, // UOM
    { wch: 28 }, // Sale Type
    { wch: 18 }, // Default Rate (PKR)
    { wch: 18 }, // Retail Price (PKR)
    { wch: 12 }  // Status
  ];

  // Sheet 4: Guidelines & Reference
  const instructions = [
    ['FBR Digital Invoicing - Bulk Excel Upload Guidelines & Auto-Population'],
    [''],
    ['Field Name', 'Mandatory', 'Data Type', 'Description, Auto-Population & Valid Values'],
    ['InvoiceRefNo', 'YES', 'Text', 'Unique reference or bill number. Rows with the same InvoiceRefNo are grouped into ONE multi-item invoice.'],
    ['InvoiceDate', 'YES', 'Date (YYYY-MM-DD)', 'Date of invoice. Example: 2026-09-28.'],
    ['InvoiceType', 'NO (Default: Sale Invoice)', 'Text', 'Optional. Defaults to "Sale Invoice" if left blank. Can also be "Debit Note" or "Credit Note".'],
    ['CustomerCode', 'NO (Recommended)', 'Text', 'OPTIONAL AUTO-POPULATION: If entered, the system looks up this Customer Code in your database and automatically fills BuyerNTN, BuyerName, BuyerProvince, BuyerAddress, and BuyerRegistrationType! Reference valid codes in the "Buyers Reference" tab. If left blank, manually enter the buyer fields below.'],
    ['BuyerNTN', 'Conditional', 'Text', '7-8 digit NTN of buyer, or 9999997 for unregistered consumers. Auto-filled if CustomerCode is provided.'],
    ['BuyerCNIC', 'NO', 'Text', '13-digit CNIC without hyphens (e.g. 4210112345671) if unregistered buyer. Auto-filled if CustomerCode is provided.'],
    ['BuyerName', 'Conditional', 'Text', 'Registered business name or individual name of the buyer. Auto-filled if CustomerCode is provided.'],
    ['BuyerProvince', 'Conditional', 'Text', 'PUNJAB, SINDH, KPK, BALOCHISTAN, ISLAMABAD, AJK, GILGIT. Auto-filled if CustomerCode is provided.'],
    ['BuyerAddress', 'NO', 'Text', 'Physical address or location of buyer. Auto-filled if CustomerCode is provided.'],
    ['BuyerRegistrationType', 'Conditional', 'Text', 'Registered or Unregistered. Auto-filled if CustomerCode is provided.'],
    ['ScenarioId', 'NO', 'Text', 'FBR Sandbox scenario if testing (e.g. SN001, SN002). Default is SN001 (Registered) or SN002 (Unregistered).'],
    ['ProductCode', 'NO (Recommended)', 'Text', 'OPTIONAL AUTO-POPULATION: If entered (or if HSCode matches your catalog), the system looks up this Product Code in your database and automatically fills HSCode, ProductDescription, UOM, SaleType, and default UnitPrice! Reference valid codes in the "Products Reference" tab. If left blank, manually enter product fields below.'],
    ['HSCode', 'Conditional', 'Text', '8-digit Pakistan Customs HS Code with dots (e.g. 8482.10.00). Auto-filled if ProductCode is provided.'],
    ['ProductDescription', 'Conditional', 'Text', 'Product or item title description. Auto-filled if ProductCode is provided.'],
    ['UOM', 'Conditional', 'Text', 'Unit of measure (e.g. PCS, KGS, MTR, LTR, BAG, PACK, SET). Auto-filled if ProductCode is provided.'],
    ['Quantity', 'YES', 'Number', 'Total quantity sold (must be greater than 0).'],
    ['UnitPrice', 'YES', 'Number', 'Unit price per item excluding sales tax. If 0 and ProductCode is provided, automatically uses default catalog rate.'],
    ['Discount', 'NO', 'Number', 'Discount amount applied on this line item. Default is 0.00.'],
    ['SaleType', 'Conditional', 'Text', 'Goods at standard rate, 3rd Schedule Goods, Exempt goods, Goods at zero-rate, Services, Petroleum Products. Auto-filled if ProductCode is provided.'],
    ['TaxRatePercent', 'YES', 'Number', 'Sales tax rate percentage (e.g. 18 for standard 18%, or 0 for exempt).'],
    ['FurtherTaxPercent', 'NO', 'Number', 'Further tax percentage (4 for unregistered buyers, 0 for registered).'],
    ['ExtraTax', 'NO', 'Number', 'Extra tax amount if applicable. Default is 0.00.'],
    ['RetailPrice', 'NO', 'Number', 'Retail price per unit (mandatory only for 3rd Schedule Goods). Auto-filled if ProductCode is provided.']
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(instructions);
  wsGuide['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 85 }];

  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');
  XLSX.utils.book_append_sheet(wb, wsBuyers, 'Buyers Reference');
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products Reference');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 2. Parse User Uploaded Excel & Draft Invoices to SQLite with Auto-Population
async function parseAndDraftExcelInvoices(filePath, companyId = 1, fbrEnvMode = 'sandbox') {
  if (!fs.existsSync(filePath)) {
    throw new Error('Specified Excel file does not exist on disk: ' + filePath);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  // Identify the Invoices sheet (avoid picking reference sheets if present)
  let invoicesSheetName = wb.SheetNames.find(n => n.toLowerCase().trim() === 'invoices') ||
                          wb.SheetNames.find(n => n.toLowerCase().includes('invoice') || n.toLowerCase().includes('data')) ||
                          wb.SheetNames[0];

  if (!invoicesSheetName) {
    throw new Error('The uploaded workbook contains no valid sheets.');
  }

  const sheet = wb.Sheets[invoicesSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error(`The sheet "${invoicesSheetName}" contains no data rows.`);
  }

  // Load database buyers & products for auto-dereferencing
  let dbCustomers = [];
  let dbItems = [];
  try {
    const allCustomers = await sqliteDb.dbGetCustomers();
    const allItems = await sqliteDb.dbGetItems();
    dbCustomers = (allCustomers || []).filter(c => c.companyId === Number(companyId) || (!c.companyId && Number(companyId) === 1));
    dbItems = (allItems || []).filter(i => (i.companyId === Number(companyId) || (!i.companyId && Number(companyId) === 1)));
  } catch (err) {
    console.warn('[Excel Service] Warning loading catalog for auto-population:', err.message);
  }

  // Group rows by InvoiceRefNo
  const invoiceGroups = new Map();
  let rowNumber = 1; // 1-indexed (header is row 1)

  for (const row of rawRows) {
    rowNumber++;
    // Normalize keys
    const refNo = String(row.InvoiceRefNo || row.invoicerefno || row['Invoice Ref No'] || row['Invoice No'] || '').trim();
    if (!refNo) {
      continue; // Skip empty rows
    }

    if (!invoiceGroups.has(refNo)) {
      invoiceGroups.set(refNo, {
        refNo: refNo,
        firstRow: row,
        items: []
      });
    }

    // Format date string (YYYY-MM-DD)
    let dateStr = '';
    const rawDate = row.InvoiceDate || row.invoicedate || row['Invoice Date'];
    if (rawDate instanceof Date && !isNaN(rawDate)) {
      dateStr = rawDate.toISOString().split('T')[0];
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      dateStr = rawDate.trim().split('T')[0];
    } else {
      dateStr = new Date().toISOString().split('T')[0];
    }

    // Product Code extraction (supporting ProductCode, Product Code, as well as backwards compatibility)
    const prodCode = String(
      row.ProductCode || row.productcode || row['Product Code'] ||
      row.ProductCustomID || row.productcustomid || row['Product Custom ID'] ||
      row.ProductID || row.productid || row['Product ID'] ||
      row.ItemCode || row.itemcode || row['Item Code'] ||
      row.ItemCustomID || row.itemcustomid || row['Item Custom ID'] || ''
    ).trim();

    // Raw row item inputs
    let hsCode = String(row.HSCode || row.hscode || row['HS Code'] || '').trim();
    let desc = String(row.ProductDescription || row.productdescription || row['Product Description'] || row.Description || '').trim();
    let uom = String(row.UOM || row.uom || '').trim().toUpperCase();
    let saleType = String(row.SaleType || row.saletype || row['Sale Type'] || '').trim();
    let unitPrice = parseFloat(row.UnitPrice || row.unitprice || row['Unit Price'] || row.Rate || 0) || 0;
    let discount = parseFloat(row.Discount || row.discount || 0) || 0;
    let taxRate = parseFloat(row.TaxRatePercent || row.taxratepercent || row['Tax Rate %'] || 18) || 0;
    let furtherTaxRate = parseFloat(row.FurtherTaxPercent || row.furthertaxpercent || row['Further Tax %'] || 0) || 0;
    let extraTax = parseFloat(row.ExtraTax || row.extratax || 0) || 0;
    let retailPrice = parseFloat(row.RetailPrice || row.retailprice || 0) || 0;

    // Dereference against dbItems if prodCode is provided OR if hsCode is provided without description
    let matchedItem = null;
    if (prodCode) {
      matchedItem = dbItems.find(x => 
        String(x.productCode || '').trim().toLowerCase() === prodCode.toLowerCase() ||
        String(x.customId || '').trim().toLowerCase() === prodCode.toLowerCase() ||
        String(x.customProductId || '').trim().toLowerCase() === prodCode.toLowerCase() ||
        String(x.itemCode || '').trim().toLowerCase() === prodCode.toLowerCase() ||
        String(x.id) === prodCode
      );
    }
    if (!matchedItem && hsCode && !desc) {
      const cleanHs = hsCode.replace(/\s+/g, '');
      matchedItem = dbItems.find(x => 
        (x.hsCode && x.hsCode.replace(/\s+/g, '') === cleanHs) ||
        x.hsCode === hsCode
      );
    }

    if (matchedItem) {
      // Auto-populate missing/empty fields from database catalog
      if (!hsCode && matchedItem.hsCode) hsCode = matchedItem.hsCode;
      if (!desc) desc = matchedItem.itemDesc || matchedItem.description || '';
      if (!uom && matchedItem.uom) uom = matchedItem.uom.toUpperCase();
      if (!saleType && matchedItem.saleType) saleType = matchedItem.saleType;
      if (unitPrice === 0 && Number(matchedItem.rate) > 0) unitPrice = Number(matchedItem.rate);
      if (retailPrice === 0 && Number(matchedItem.retailPrice) > 0) retailPrice = Number(matchedItem.retailPrice);
    }

    // Fallbacks if still empty
    if (!hsCode) hsCode = '8482.10.00';
    if (!desc) desc = 'General Item';
    if (!uom) uom = 'PCS';
    if (!saleType) saleType = 'Goods at standard rate';

    const qty = parseFloat(row.Quantity || row.quantity || row.Qty || 1) || 1;

    invoiceGroups.get(refNo).items.push({
      prodCode: prodCode || (matchedItem ? (matchedItem.productCode || matchedItem.customId || matchedItem.customProductId) : ''),
      hsCode: hsCode,
      productDescription: desc,
      uom: uom,
      quantity: qty,
      unitPrice: unitPrice,
      discount: discount,
      saleType: saleType,
      taxRatePercent: taxRate,
      furtherTaxPercent: furtherTaxRate,
      extraTax: extraTax,
      retailPrice: retailPrice,
      dateStr: dateStr
    });
  }

  if (invoiceGroups.size === 0) {
    throw new Error('No valid invoice rows with an InvoiceRefNo found in the file.');
  }

  const createdDraftIds = [];
  let totalLineItemsCount = 0;
  let totalGrandAmount = 0;

  // Compile full invoice objects and save to SQLite
  for (const [refNo, group] of invoiceGroups.entries()) {
    const headerRow = group.firstRow;
    const dateStr = group.items[0]?.dateStr || new Date().toISOString().split('T')[0];

    // Customer Code extraction
    const customerCode = String(
      headerRow.CustomerCode || headerRow.customercode || headerRow['Customer Code'] ||
      headerRow.BuyerCode || headerRow.buyercode || headerRow['Buyer Code'] ||
      headerRow.BuyerCustomID || headerRow.buyercustomid || headerRow['Buyer Custom ID'] ||
      headerRow.CustomerID || headerRow.customerid || headerRow['Customer ID'] ||
      headerRow.BuyerID || headerRow.buyerid || headerRow['Buyer ID'] ||
      headerRow['Party ID'] || headerRow['Party #'] || ''
    ).trim();

    let buyerNTN = String(headerRow.BuyerNTN || headerRow.buyerntn || headerRow['Buyer NTN'] || '').trim();
    let buyerCNIC = String(headerRow.BuyerCNIC || headerRow.buyercnic || '').trim();
    let buyerName = String(headerRow.BuyerName || headerRow.buyername || headerRow['Buyer Name'] || '').trim();
    let buyerProvince = String(headerRow.BuyerProvince || headerRow.buyerprovince || '').trim().toUpperCase();
    let buyerAddress = String(headerRow.BuyerAddress || headerRow.buyeraddress || '').trim();
    let buyerRegType = String(headerRow.BuyerRegistrationType || headerRow.buyerregistrationtype || '').trim();
    let invoiceType = String(
      headerRow.InvoiceType || headerRow.invoicetype || headerRow['Invoice Type'] ||
      headerRow['Invoice type'] || headerRow.Type || headerRow['Type'] || ''
    ).trim() || 'Sale Invoice';
    let scenarioId = String(headerRow.ScenarioId || headerRow.scenarioid || '').trim();

    // Dereference against dbCustomers if customerCode is provided
    let matchedCustomer = null;
    if (customerCode) {
      matchedCustomer = dbCustomers.find(c => 
        String(c.customerCode || '').trim().toLowerCase() === customerCode.toLowerCase() ||
        String(c.customId || '').trim().toLowerCase() === customerCode.toLowerCase() ||
        String(c.customBuyerId || '').trim().toLowerCase() === customerCode.toLowerCase() ||
        String(c.id) === customerCode
      );
    }
    // Also allow auto-matching by buyerNTN if buyerName wasn't provided
    if (!matchedCustomer && buyerNTN && buyerNTN !== '9999997' && !buyerName) {
      matchedCustomer = dbCustomers.find(c => c.ntn && c.ntn.trim() === buyerNTN);
    }

    if (matchedCustomer) {
      // Auto-populate missing/empty fields from database customer
      if (!buyerNTN && matchedCustomer.ntn) buyerNTN = matchedCustomer.ntn;
      if (!buyerCNIC && matchedCustomer.cnic) buyerCNIC = matchedCustomer.cnic;
      if (!buyerName && matchedCustomer.partyName) buyerName = matchedCustomer.partyName;
      if (!buyerProvince && matchedCustomer.province) buyerProvince = matchedCustomer.province.toUpperCase();
      if (!buyerAddress && matchedCustomer.address) buyerAddress = matchedCustomer.address;
      if (!buyerRegType && matchedCustomer.registrationType) buyerRegType = matchedCustomer.registrationType;
    }

    // Default fallbacks
    if (!buyerNTN) buyerNTN = '9999997';
    if (!buyerName) buyerName = 'Draft Customer';
    if (!buyerProvince) buyerProvince = 'PUNJAB';
    if (!buyerRegType) buyerRegType = (buyerNTN === '9999997' ? 'Unregistered' : 'Registered');
    if (!scenarioId) scenarioId = (buyerRegType === 'Unregistered' ? 'SN002' : 'SN001');

    // Calculations
    let subtotalExcl = 0;
    let totalDiscount = 0;
    let totalSalesTax = 0;
    let totalFurtherTax = 0;
    let totalExtraTax = 0;

    const itemsToSave = [];
    const taxesGroupMap = {};

    for (const it of group.items) {
      const rowValExcl = it.unitPrice * it.quantity;
      const rowNetValue = Math.max(0, rowValExcl - it.discount);

      let salesTax = 0;
      if (it.saleType === '3rd Schedule Goods' && it.retailPrice > 0) {
        salesTax = it.retailPrice * it.quantity * (it.taxRatePercent / 100);
      } else if (it.saleType === 'Exempt goods' || it.saleType === 'Goods at zero-rate') {
        salesTax = 0.00;
      } else {
        salesTax = rowNetValue * (it.taxRatePercent / 100);
      }

      const furtherTax = rowNetValue * (it.furtherTaxPercent / 100);

      subtotalExcl += rowValExcl;
      totalDiscount += it.discount;
      totalSalesTax += salesTax;
      totalFurtherTax += furtherTax;
      totalExtraTax += it.extraTax;

      // Group taxes breakdown
      const taxKey = `Standard ${it.taxRatePercent}%`;
      if (!taxesGroupMap[taxKey]) {
        taxesGroupMap[taxKey] = {
          taxType: taxKey,
          ratePercent: it.taxRatePercent,
          taxNature: 'Exclusive Taxes',
          valueExcl: 0,
          taxAmt: 0
        };
      }
      taxesGroupMap[taxKey].valueExcl += rowNetValue;
      taxesGroupMap[taxKey].taxAmt += salesTax;

      if (it.furtherTaxPercent > 0) {
        const ftKey = `Further Tax ${it.furtherTaxPercent}%`;
        if (!taxesGroupMap[ftKey]) {
          taxesGroupMap[ftKey] = {
            taxType: ftKey,
            ratePercent: it.furtherTaxPercent,
            taxNature: 'Exclusive Taxes',
            valueExcl: 0,
            taxAmt: 0
          };
        }
        taxesGroupMap[ftKey].valueExcl += rowNetValue;
        taxesGroupMap[ftKey].taxAmt += furtherTax;
      }

      itemsToSave.push({
        hsCode: it.hsCode,
        productDescription: it.productDescription,
        uom: it.uom,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        rateValue: it.unitPrice,
        discount: it.discount,
        valueSalesExcludingST: rowValExcl,
        salesTaxApplicable: salesTax,
        taxRatePercent: it.taxRatePercent,
        furtherTax: furtherTax,
        extraTax: it.extraTax,
        retailPrice: it.retailPrice,
        saleType: it.saleType,
        itemCode: it.prodCode || ''
      });
    }

    const grandTotal = Math.round((subtotalExcl - totalDiscount + totalSalesTax + totalFurtherTax + totalExtraTax + Number.EPSILON) * 100) / 100;
    const taxesList = Object.values(taxesGroupMap);

    const resolvedCustCode = customerCode || (matchedCustomer ? (matchedCustomer.customerCode || matchedCustomer.customId || matchedCustomer.customBuyerId || String(matchedCustomer.id)) : '');

    const invoiceMaster = {
      invoiceNumber: `DRAFT-${refNo}`,
      invoiceRefNo: refNo,
      invoiceDate: dateStr,
      invoiceType: invoiceType,
      customerCode: resolvedCustCode,
      buyerCustomId: resolvedCustCode,
      buyerNTN: buyerNTN,
      buyerCNIC: buyerCNIC,
      buyerName: buyerName,
      buyerAddress: buyerAddress,
      buyerProvince: buyerProvince,
      buyerRegistrationType: buyerRegType,
      scenarioId: scenarioId,
      subtotalExcl: subtotalExcl,
      totalSalesTax: totalSalesTax,
      furtherTaxAmt: totalFurtherTax,
      totalExtraTax: totalExtraTax,
      totalDiscount: totalDiscount,
      grandTotal: grandTotal,
      envMode: fbrEnvMode,
      status: 'Draft',
      timestamp: new Date().toLocaleString(),
      companyId: Number(companyId) || 1
    };

    // Save as Draft in SQLite
    const savedId = await sqliteDb.dbSaveInvoice(invoiceMaster, itemsToSave, taxesList);
    createdDraftIds.push(savedId);
    totalLineItemsCount += itemsToSave.length;
    totalGrandAmount += grandTotal;
  }

  return {
    success: true,
    totalInvoices: invoiceGroups.size,
    totalLineItems: totalLineItemsCount,
    totalAmount: totalGrandAmount,
    draftIds: createdDraftIds
  };
}

module.exports = {
  generateInvoiceTemplateBuffer,
  parseAndDraftExcelInvoices
};
