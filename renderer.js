// ==========================================
// CORE FRONTEND CONTROLLER (FBR INVOICING)
// ==========================================

// Global state variables
let currentPanel = 'dashboard';
let invoiceItems = [];
let invoiceTaxes = [];
let fbrSettings = {
  sellerNTN: '',
  sellerName: '',
  sellerProvince: 'Sindh',
  sellerAddress: '',
  fbrEnvMode: 'sandbox',
  fbrToken: '',
  sendTotalVal: false,
  theme: 'midnight-abyss'
};
let dbItemsList = [];      // Loaded from IndexedDB
let dbCustomersList = [];  // Loaded from IndexedDB
let dbTaxesList = [];      // Loaded from IndexedDB
let invoiceHistory = [];
let activeInvoice = null;  // For print preview

// Replace native thread-blocking alert with custom premium non-blocking toast notifications
window.alert = function(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  
  // Classify toast type based on message keywords
  let type = 'info';
  let icon = 'ℹ️';
  
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('success') || lowerMsg.includes('saved') || lowerMsg.includes('verified') || lowerMsg.includes('posted') || lowerMsg.includes('archived')) {
    type = 'success';
    icon = '✅';
  } else if (lowerMsg.includes('error') || lowerMsg.includes('failed') || lowerMsg.includes('invalid') || lowerMsg.includes('missing') || lowerMsg.includes('mandatory') || lowerMsg.includes('required') || lowerMsg.includes('refused')) {
    type = 'error';
    icon = '❌';
  } else if (lowerMsg.includes('warning') || lowerMsg.includes('caution') || lowerMsg.includes('must') || lowerMsg.includes('verify')) {
    type = 'warning';
    icon = '⚠️';
  }
  
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="font-size: 16px; display: flex; align-items: center; justify-content: center;">${icon}</div>
    <div style="line-height: 1.4;">${message}</div>
  `;
  
  container.appendChild(toast);
  
  // Smoothly fade out and remove the toast after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3500);
};

// Replace native thread-blocking confirm with custom premium non-blocking HTML modal confirm overlay
let confirmResolve = null;

window.showConfirm = function(message, title = "⚠️ Confirm Action", confirmText = "Delete") {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    
    const confirmBtn = document.getElementById('confirm-modal-yes-btn');
    confirmBtn.textContent = confirmText;
    if (confirmText.toLowerCase().includes('delete')) {
      confirmBtn.className = "btn btn-danger";
    } else {
      confirmBtn.className = "btn btn-primary";
    }
    
    document.getElementById('confirm-modal').classList.add('active');
  });
};

window.confirmModalCallback = function(value) {
  document.getElementById('confirm-modal').classList.remove('active');
  if (confirmResolve) {
    confirmResolve(value);
    confirmResolve = null;
  }
};

window.closeConfirmModal = function() {
  window.confirmModalCallback(false);
};

let originalReceiptModalBodyHTML = '';
let currentPdfFilename = '';

// Default values on load
document.addEventListener('DOMContentLoaded', async () => {
  // Store receipt modal body HTML to restore it when rendering single invoices
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (modalBody) {
    originalReceiptModalBodyHTML = modalBody.innerHTML;
  }

  // Wait for IndexedDB database and seed data initialization to complete
  if (window.dbInitializationPromise) {
    await window.dbInitializationPromise;
  }

  // Load settings from IndexedDB
  await loadSettings();
  
  // Seed initial data if necessary and load lists
  await refreshDatabaseLists();
  
  // Disable scroll wheel changing numeric inputs
  document.addEventListener('wheel', (e) => {
    if (document.activeElement && document.activeElement.type === 'number') {
      e.preventDefault();
    }
  }, { passive: false });

  // Set default invoice date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('invoice-date').value = today;
  
  // Load invoice logs history
  await loadHistory();
  
  // Initialize dynamic item table with one default row
  resetInvoiceForm();
  
  // Initial Dashboard stats render
  renderDashboard();
});

// ==========================================
// LIST DATA REFRESHERS
// ==========================================
async function refreshDatabaseLists() {
  try {
    dbItemsList = await dbGetItems();
    dbCustomersList = await dbGetCustomers();
    dbTaxesList = await dbGetTaxes();
  } catch (err) {
    console.error("Error loading setup data lists:", err);
  }
}

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================
function switchPanel(panelId) {
  // Hide active panels
  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  
  // Show target panel
  document.getElementById(`panel-${panelId}`).classList.add('active');
  
  // Handle sidebar highlight matching (settings maps to FBR settings / Company Profile)
  const navBtn = document.getElementById(`nav-${panelId}`);
  if (navBtn) {
    navBtn.classList.add('active');
  }
  
  currentPanel = panelId;
  
  // Refresh data on specific panels
  if (panelId === 'dashboard') {
    loadHistory().then(() => renderDashboard());
  } else if (panelId === 'history') {
    loadHistory().then(() => renderHistory());
  } else if (panelId === 'customers') {
    renderCustomers();
  } else if (panelId === 'items') {
    renderItems();
  } else if (panelId === 'taxes') {
    renderTaxes();
  } else if (panelId === 'invoice') {
    populateInvoicePartyDropdown();
  } else if (panelId === 'invoice-printing') {
    initReports('print');
  } else if (panelId === 'sale-details') {
    initReports('report');
  }
}

// ==========================================
// SETTINGS CONTROLLER (PERSISTENCE)
// ==========================================
async function saveSettings() {
  fbrSettings.sellerNTN = document.getElementById('seller-ntn').value.trim();
  fbrSettings.sellerName = document.getElementById('seller-name').value.trim();
  fbrSettings.sellerProvince = document.getElementById('seller-province').value;
  fbrSettings.sellerAddress = document.getElementById('seller-address').value.trim();
  fbrSettings.fbrEnvMode = document.getElementById('fbr-env-mode').value;
  let tokenVal = document.getElementById('fbr-token').value.trim();
  if (tokenVal.toLowerCase().startsWith('bearer ')) {
    tokenVal = tokenVal.slice(7).trim();
  }
  fbrSettings.fbrToken = tokenVal;
  fbrSettings.sendTotalVal = document.getElementById('seller-send-totalval').checked;
  fbrSettings.theme = document.getElementById('app-theme-val').value;

  // Validate fields
  if (!fbrSettings.sellerNTN || !fbrSettings.sellerName || !fbrSettings.sellerAddress || !fbrSettings.fbrToken) {
    alert("Please fill in all mandatory seller settings and credentials.");
    return;
  }

  // Save to IndexedDB
  try {
    await dbSaveCompany(fbrSettings);
    // Also ensure theme is stored in localStorage for flash-free launch
    localStorage.setItem('app-theme', fbrSettings.theme);
    updateEnvironmentBadge();
    alert("Settings saved successfully.");
    switchPanel('dashboard');
  } catch (err) {
    alert("Error saving settings to DB: " + err.message);
  }
}

async function loadSettings() {
  try {
    const saved = await dbGetCompany();
    if (saved) {
      fbrSettings = saved;
      if (!fbrSettings.theme) {
        fbrSettings.theme = 'midnight-abyss';
      }
      if (fbrSettings.sendTotalVal === undefined) {
        fbrSettings.sendTotalVal = false;
      }
    }
  } catch (e) {
    console.error("Error loading settings from DB", e);
  }

  // Populate form fields
  document.getElementById('seller-ntn').value = fbrSettings.sellerNTN;
  document.getElementById('seller-name').value = fbrSettings.sellerName;
  document.getElementById('seller-province').value = fbrSettings.sellerProvince;
  document.getElementById('seller-address').value = fbrSettings.sellerAddress;
  document.getElementById('fbr-env-mode').value = fbrSettings.fbrEnvMode;
  let displayToken = fbrSettings.fbrToken || '';
  if (displayToken.toLowerCase().startsWith('bearer ')) {
    displayToken = displayToken.slice(7).trim();
  }
  document.getElementById('fbr-token').value = displayToken;
  document.getElementById('seller-send-totalval').checked = fbrSettings.sendTotalVal === true;
  
  // Apply the loaded theme preference
  applyAndSetTheme(fbrSettings.theme);
  
  updateEnvironmentBadge();
}

function updateEnvironmentBadge() {
  const badge = document.getElementById('sidebar-env-badge');
  const text = document.getElementById('sidebar-env-text');
  
  if (fbrSettings.fbrEnvMode === 'production') {
    badge.className = 'env-badge production';
    text.textContent = 'FBR Production';
  } else {
    badge.className = 'env-badge';
    text.textContent = 'FBR Sandbox';
  }
  
  // Toggle the sandbox scenario row in invoicing form
  const sandboxScenarioCol = document.getElementById('group-sandbox-scenario');
  if (sandboxScenarioCol) {
    if (fbrSettings.fbrEnvMode === 'production') {
      sandboxScenarioCol.style.opacity = '0.3';
      sandboxScenarioCol.querySelector('select').disabled = true;
    } else {
      sandboxScenarioCol.style.opacity = '1';
      sandboxScenarioCol.querySelector('select').disabled = false;
    }
  }
}

function onEnvironmentToggle() {
  const env = document.getElementById('fbr-env-mode').value;
  fbrSettings.fbrEnvMode = env;
  updateEnvironmentBadge();
}

// Function to dynamically switch application themes and store selection
function applyAndSetTheme(themeName) {
  // Apply data attribute to root HTML tag
  document.documentElement.setAttribute('data-theme', themeName);
  
  // Store theme preference in localStorage for instant retrieval on startup
  localStorage.setItem('app-theme', themeName);
  
  // Keep hidden settings field in sync
  const themeInput = document.getElementById('app-theme-val');
  if (themeInput) {
    themeInput.value = themeName;
  }
  
  // Toggle card highlighting borders in Settings panel
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.remove('active');
    card.style.borderColor = 'var(--border-color)';
  });
  
  const activeCard = document.getElementById(`theme-${themeName}`);
  if (activeCard) {
    activeCard.classList.add('active');
    activeCard.style.borderColor = 'var(--accent-primary)';
  }
}

// ==========================================
// 1. CUSTOMERS CRUD
// ==========================================
async function renderCustomers() {
  await refreshDatabaseLists();
  const tbody = document.getElementById('customers-list-tbody');
  tbody.innerHTML = '';
  
  if (dbCustomersList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
          No customers registered in local database. Click "+ Add Customer" to create one.
        </td>
      </tr>
    `;
    return;
  }
  
  dbCustomersList.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.partyName}</strong></td>
      <td>${c.ntn || '-'}</td>
      <td>${c.province}</td>
      <td>
        <span class="status-tag ${c.registrationType === 'Registered' ? 'success' : 'sandbox'}">
          ${c.registrationType}
        </span>
      </td>
      <td>${c.email || '-'}</td>
      <td>${c.mobileNo || '-'}</td>
      <td style="text-align: center; display: flex; justify-content: center; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="openCustomerModal(${c.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCustomerModal(id = null) {
  const modal = document.getElementById('customer-modal');
  const title = document.getElementById('customer-modal-title');
  title.textContent = 'Customers Entry';
  
  // Clear inputs
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-id-display').value = 'Auto';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-ntn').value = '';
  document.getElementById('cust-reg-type').value = 'Registered';
  document.getElementById('cust-province').value = 'SINDH';
  document.getElementById('cust-mobile').value = '';
  document.getElementById('cust-email').value = '';
  document.getElementById('cust-address').value = '';
  document.getElementById('cust-party-type').value = 'LOCAL';
  document.getElementById('cust-submit-btn').textContent = 'Create';
  
  if (id) {
    const c = dbCustomersList.find(x => x.id === id);
    if (c) {
      document.getElementById('cust-id').value = c.id;
      document.getElementById('cust-id-display').value = c.id;
      document.getElementById('cust-name').value = c.partyName;
      document.getElementById('cust-ntn').value = c.ntn || '';
      document.getElementById('cust-reg-type').value = c.registrationType;
      document.getElementById('cust-province').value = (c.province || '').toUpperCase();
      document.getElementById('cust-mobile').value = c.mobileNo || '';
      document.getElementById('cust-email').value = c.email || '';
      document.getElementById('cust-address').value = c.address;
      document.getElementById('cust-party-type').value = c.partyType || 'LOCAL';
      document.getElementById('cust-submit-btn').textContent = 'Save';
    }
  }
  
  modal.classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
}

async function saveCustomerForm() {
  const id = document.getElementById('cust-id').value;
  const cust = {
    partyName: document.getElementById('cust-name').value.trim(),
    ntn: document.getElementById('cust-ntn').value.trim(),
    registrationType: document.getElementById('cust-reg-type').value,
    province: document.getElementById('cust-province').value,
    mobileNo: document.getElementById('cust-mobile').value.trim(),
    email: document.getElementById('cust-email').value.trim(),
    address: document.getElementById('cust-address').value.trim(),
    partyType: document.getElementById('cust-party-type').value
  };
  
  if (!cust.partyName || !cust.address) {
    alert("Customer Name and Address are mandatory.");
    return;
  }
  if (cust.registrationType === 'Registered' && !cust.ntn) {
    alert("NTN/CNIC is mandatory for Registered buyers.");
    return;
  }
  
  if (id) {
    cust.id = Number(id);
  }
  
  try {
    await dbAddCustomer(cust);
    closeCustomerModal();
    await renderCustomers();
  } catch (err) {
    alert("Error saving customer: " + err.message);
  }
}

async function deleteCustomer(id) {
  if (await showConfirm("Are you sure you want to delete this customer?")) {
    try {
      await dbDeleteCustomer(id);
      await renderCustomers();
    } catch (err) {
      alert("Error deleting customer: " + err.message);
    }
  }
}

// ==========================================
// 2. ITEMS (PRODUCTS) CRUD
// ==========================================
async function renderItems() {
  await refreshDatabaseLists();
  const tbody = document.getElementById('items-list-tbody');
  tbody.innerHTML = '';
  
  if (dbItemsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
          No product items in database. Click "+ Add Item" to populate.
        </td>
      </tr>
    `;
    return;
  }
  
  dbItemsList.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${i.itemDesc}</strong></td>
      <td style="font-family: monospace;">${i.hsCode}</td>
      <td>${i.uom}</td>
      <td>${i.saleType}</td>
      <td>${i.sroScheduleNo || '-'}</td>
      <td>${i.sroItemSerialNo || '-'}</td>
      <td>PKR ${i.retailPrice !== undefined ? i.retailPrice.toFixed(2) : '0.00'}</td>
      <td>
        <span class="status-tag ${i.isActive ? 'success' : 'danger'}">
          ${i.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="text-align: center; display: flex; justify-content: center; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="openItemModal(${i.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem(${i.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleModalRetailPriceField() {
  const saleType = document.getElementById('item-sale-type').value;
  const container = document.getElementById('item-retailprice-container');
  if (container) {
    if (saleType === '3rd Schedule Goods') {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }
}

function openItemModal(id = null) {
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('item-modal-title');
  
  // Clear inputs
  document.getElementById('item-id').value = '';
  document.getElementById('item-desc').value = '';
  document.getElementById('item-hscode').value = '';
  document.getElementById('item-uom').value = 'Numbers, pieces, units';
  document.getElementById('item-sale-type').value = 'Goods at standard rate (default)';
  document.getElementById('item-sroschedule').value = '';
  document.getElementById('item-sroserial').value = '';
  document.getElementById('item-retailprice').value = '0.00';
  document.getElementById('item-active').checked = true;
  
  if (id) {
    title.textContent = '📦 Edit Product Item';
    const item = dbItemsList.find(x => x.id === id);
    if (item) {
      document.getElementById('item-id').value = item.id;
      document.getElementById('item-desc').value = item.itemDesc;
      document.getElementById('item-hscode').value = item.hsCode;
      document.getElementById('item-uom').value = item.uom;
      document.getElementById('item-sale-type').value = item.saleType;
      document.getElementById('item-sroschedule').value = item.sroScheduleNo || '';
      document.getElementById('item-sroserial').value = item.sroItemSerialNo || '';
      document.getElementById('item-retailprice').value = item.retailPrice !== undefined ? item.retailPrice.toFixed(2) : '0.00';
      document.getElementById('item-active').checked = item.isActive !== false;
    }
  } else {
    title.textContent = '📦 Add Product Item';
  }
  
  toggleModalRetailPriceField();
  modal.classList.add('active');
}

function closeItemModal() {
  document.getElementById('item-modal').classList.remove('active');
}

async function saveItemForm() {
  const id = document.getElementById('item-id').value;
  let hsVal = document.getElementById('item-hscode').value.trim().replace(/\s+/g, '');
  if (/^\d{8}$/.test(hsVal)) {
    hsVal = hsVal.substring(0, 4) + '.' + hsVal.substring(4);
    document.getElementById('item-hscode').value = hsVal;
  }
  
  const item = {
    itemDesc: document.getElementById('item-desc').value.trim(),
    hsCode: hsVal,
    uom: document.getElementById('item-uom').value,
    saleType: document.getElementById('item-sale-type').value,
    sroScheduleNo: document.getElementById('item-sroschedule').value.trim(),
    sroItemSerialNo: document.getElementById('item-sroserial').value.trim(),
    retailPrice: parseFloat(document.getElementById('item-retailprice').value) || 0,
    isActive: document.getElementById('item-active').checked,
    taxedAtRetail: false
  };
  
  if (!item.itemDesc || !item.hsCode) {
    alert("Item Description and HS Code are mandatory.");
    return;
  }
  
  const hsCodeRegex = /^\d{4}\.\d{4}$/;
  if (!hsCodeRegex.test(item.hsCode)) {
    alert("HS Code must be in the format XXXX.XXXX (e.g. 8421.2100).");
    return;
  }
  
  if (id) {
    item.id = Number(id);
  }
  
  try {
    await dbAddItem(item);
    closeItemModal();
    await renderItems();
  } catch (err) {
    alert("Error saving item: " + err.message);
  }
}

async function deleteItem(id) {
  if (await showConfirm("Are you sure you want to delete this product?")) {
    try {
      await dbDeleteItem(id);
      await renderItems();
    } catch (err) {
      alert("Error deleting item: " + err.message);
    }
  }
}

// ==========================================
// 3. TAX RATES CONFIGURATION CRUD
// ==========================================
async function renderTaxes() {
  await refreshDatabaseLists();
  const tbody = document.getElementById('taxes-list-tbody');
  tbody.innerHTML = '';
  
  if (dbTaxesList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
          No tax definitions found. Click "+ Add Tax Type" to define.
        </td>
      </tr>
    `;
    return;
  }
  
  dbTaxesList.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.taxType}</strong></td>
      <td>${t.rate}%${t.fixedRate ? ' + Rs.' + t.fixedRate : ''}</td>
      <td>${t.taxNature}</td>
      <td>${t.type}</td>
      <td>${t.whTax ? 'Yes (Withheld)' : 'No'}</td>
      <td style="text-align: center; display: flex; justify-content: center; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="openTaxModal(${t.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTax(${t.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openTaxModal(id = null) {
  const modal = document.getElementById('tax-modal');
  const title = document.getElementById('tax-modal-title');
  
  // Clear inputs
  document.getElementById('tax-id').value = '';
  document.getElementById('tax-typename').value = '';
  document.getElementById('tax-rate').value = '';
  document.getElementById('tax-fixed-rate').value = '0.00';
  document.getElementById('tax-nature').value = 'Sales Tax';
  document.getElementById('tax-category').value = 'Sales Tax';
  document.getElementById('tax-whtax').checked = false;
  
  if (id) {
    title.textContent = '📊 Edit Tax Rate Details';
    const tax = dbTaxesList.find(x => x.id === id);
    if (tax) {
      document.getElementById('tax-id').value = tax.id;
      document.getElementById('tax-typename').value = tax.taxType;
      document.getElementById('tax-rate').value = tax.rate;
      document.getElementById('tax-fixed-rate').value = tax.fixedRate !== undefined ? tax.fixedRate : '0.00';
      document.getElementById('tax-nature').value = tax.taxNature;
      document.getElementById('tax-category').value = tax.type;
      document.getElementById('tax-whtax').checked = tax.whTax === true;
    }
  } else {
    title.textContent = '📊 Add Tax Rate Configuration';
  }
  
  modal.classList.add('active');
}

function closeTaxModal() {
  document.getElementById('tax-modal').classList.remove('active');
}

async function saveTaxForm() {
  const id = document.getElementById('tax-id').value;
  const tax = {
    taxType: document.getElementById('tax-typename').value.trim(),
    rate: parseFloat(document.getElementById('tax-rate').value),
    fixedRate: parseFloat(document.getElementById('tax-fixed-rate').value) || 0,
    taxNature: document.getElementById('tax-nature').value,
    type: document.getElementById('tax-category').value,
    whTax: document.getElementById('tax-whtax').checked
  };
  
  if (!tax.taxType || isNaN(tax.rate)) {
    alert("Tax label name and percentage rate are required.");
    return;
  }
  
  if (id) {
    tax.id = Number(id);
  }
  
  try {
    await dbAddTax(tax);
    closeTaxModal();
    await renderTaxes();
  } catch (err) {
    alert("Error saving tax config: " + err.message);
  }
}

async function deleteTax(id) {
  if (await showConfirm("Are you sure you want to delete this tax config?")) {
    try {
      await dbDeleteTax(id);
      await renderTaxes();
    } catch (err) {
      alert("Error deleting tax config: " + err.message);
    }
  }
}

// ==========================================
// DYNAMIC INVOICE BUILDER (GRID OPERATIONS)
// ==========================================
async function populateInvoicePartyDropdown() {
  await refreshDatabaseLists();
  const select = document.getElementById('invoice-party-select');
  select.innerHTML = '<option value="">-- Choose Party Customer --</option>';
  
  dbCustomersList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.partyName} (NTN: ${c.ntn || 'Unregistered'})`;
    select.appendChild(opt);
  });
  
  // Clear read-only fields initially
  document.getElementById('buyer-name').value = '';
  document.getElementById('buyer-ntn').value = '';
  document.getElementById('buyer-reg-type').value = '';
  document.getElementById('buyer-province').value = '';
  document.getElementById('buyer-address').value = '';
}

function onInvoicePartySelectChange() {
  const select = document.getElementById('invoice-party-select');
  const custId = Number(select.value);
  
  if (!custId) {
    document.getElementById('buyer-name').value = '';
    document.getElementById('buyer-ntn').value = '';
    document.getElementById('buyer-reg-type').value = '';
    document.getElementById('buyer-province').value = '';
    document.getElementById('buyer-address').value = '';
    recalculateInvoice();
    return;
  }
  
  const c = dbCustomersList.find(x => x.id === custId);
  if (c) {
    document.getElementById('buyer-name').value = c.partyName;
    document.getElementById('buyer-ntn').value = c.ntn || '9999997'; // default unregistered placeholder
    document.getElementById('buyer-reg-type').value = c.registrationType;
    document.getElementById('buyer-province').value = c.province;
    document.getElementById('buyer-address').value = c.address;
  }
  
  recalculateInvoice();
}

async function addInvoiceItemRow(item = null) {
  await refreshDatabaseLists();
  
  const tbody = document.getElementById('items-grid-tbody');
  const index = invoiceItems.length;
  const rowId = `row-${index}-${Date.now()}`;
  const tr = document.createElement('tr');
  tr.id = rowId;
  
  // Product dropdown options
  let productsHtml = '<option value="">-- Select Product --</option>';
  dbItemsList.forEach(i => {
    if (i.isActive !== false) {
      productsHtml += `<option value="${i.id}">${i.itemDesc}</option>`;
    }
  });
  
  // Tax definitions dropdown options
  let taxHtml = '';
  dbTaxesList.forEach(t => {
    taxHtml += `<option value="${t.rate}" data-typename="${t.taxType}">${t.taxType}</option>`;
  });
  
  tr.innerHTML = `
    <td>
      <select class="form-control-cell" id="prod-${rowId}" onchange="onInvoiceItemSelect('${rowId}')">
        ${productsHtml}
      </select>
    </td>
    <td>
      <input class="form-control-cell" type="text" id="hscode-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td>
      <input class="form-control-cell" type="text" id="saletype-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td style="display: none;">
      <input class="form-control-cell" type="text" id="srosched-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td style="display: none;">
      <input class="form-control-cell" type="text" id="sroitem-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td>
      <input class="form-control-cell" type="text" id="uom-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="1" min="1" id="qty-${rowId}" value="1" oninput="recalculateInvoice()">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="valexcl-${rowId}" value="0.00" oninput="recalculateInvoice()">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="totalval-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="retailprice-${rowId}" value="0.00" oninput="recalculateInvoice()" disabled style="background-color: var(--bg-secondary); color: var(--text-muted);" placeholder="N/A">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="totalretail-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" max="100" id="discpercent-${rowId}" value="0.00" oninput="onDiscountPercentInput('${rowId}')">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="discamount-${rowId}" value="0.00" oninput="onDiscountAmountInput('${rowId}')">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="salestax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td style="text-align: center;">
      <button class="btn-remove-row" onclick="removeInvoiceItemRow('${rowId}')" title="Delete Row">&times;</button>
    </td>
  `;
  
  tbody.appendChild(tr);
  
  invoiceItems.push({
    rowId: rowId,
    productSelect: `prod-${rowId}`,
    hscodeInput: `hscode-${rowId}`,
    saleTypeInput: `saletype-${rowId}`,
    sroScheduleInput: `srosched-${rowId}`,
    sroItemSerialInput: `sroitem-${rowId}`,
    uomInput: `uom-${rowId}`,
    qtyInput: `qty-${rowId}`,
    valInput: `valexcl-${rowId}`,
    totalValInput: `totalval-${rowId}`,
    retailPriceInput: `retailprice-${rowId}`,
    totalRetailInput: `totalretail-${rowId}`,
    discountInput: `discamount-${rowId}`,
    discPercentInput: `discpercent-${rowId}`,
    salesTaxInput: `salestax-${rowId}`
  });
  
  if (item) {
    const prodSel = document.getElementById(`prod-${rowId}`);
    prodSel.value = item.productId;
    onInvoiceItemSelect(rowId);
    document.getElementById(`qty-${rowId}`).value = item.quantity;
    document.getElementById(`valexcl-${rowId}`).value = item.rateValue;
    if (item.totalValues !== undefined) {
      document.getElementById(`totalval-${rowId}`).value = item.totalValues;
    } else {
      document.getElementById(`totalval-${rowId}`).value = '0.00';
    }
    if (item.retailPrice !== undefined) {
      document.getElementById(`retailprice-${rowId}`).value = item.retailPrice;
    }
    if (item.salesTaxApplicable !== undefined) {
      document.getElementById(`salestax-${rowId}`).value = item.salesTaxApplicable.toFixed(2);
    }
    
    // Sync discount % and discount amount
    const qty = parseFloat(item.quantity) || 0;
    const val = parseFloat(item.rateValue) || 0;
    const gross = qty * val;
    const discountAmt = parseFloat(item.discount) || 0;
    const discountPct = gross > 0 ? (discountAmt / gross) * 100 : 0;
    
    document.getElementById(`discpercent-${rowId}`).value = discountPct.toFixed(2);
    document.getElementById(`discamount-${rowId}`).value = discountAmt.toFixed(2);
    recalculateInvoice();
  }
}

function onInvoiceItemSelect(rowId) {
  const row = invoiceItems.find(x => x.rowId === rowId);
  if (!row) return;
  
  const prodId = Number(document.getElementById(row.productSelect).value);
  if (!prodId) {
    document.getElementById(row.hscodeInput).value = '';
    document.getElementById(row.saleTypeInput).value = '';
    document.getElementById(row.sroScheduleInput).value = '';
    document.getElementById(row.sroItemSerialInput).value = '';
    document.getElementById(row.uomInput).value = '';
    
    const retailInput = document.getElementById(row.retailPriceInput);
    if (retailInput) {
      retailInput.disabled = true;
      retailInput.value = '0.00';
      retailInput.style.backgroundColor = 'var(--bg-secondary)';
      retailInput.style.color = 'var(--text-muted)';
      retailInput.placeholder = 'N/A';
    }
    
    recalculateInvoice();
    return;
  }
  
  const i = dbItemsList.find(x => x.id === prodId);
  if (i) {
    document.getElementById(row.hscodeInput).value = i.hsCode;
    document.getElementById(row.saleTypeInput).value = i.saleType;
    document.getElementById(row.sroScheduleInput).value = i.sroScheduleNo || '-';
    document.getElementById(row.sroItemSerialInput).value = i.sroItemSerialNo || '-';
    document.getElementById(row.uomInput).value = i.uom;
    
    const retailInput = document.getElementById(row.retailPriceInput);
    if (retailInput) {
      if (i.saleType === '3rd Schedule Goods' || i.taxedAtRetail === true) {
        retailInput.disabled = false;
        retailInput.style.backgroundColor = '';
        retailInput.style.color = '';
        retailInput.value = i.retailPrice !== undefined ? i.retailPrice.toFixed(2) : '0.00';
        retailInput.placeholder = 'Required';
        
        // Auto-set schedule to THIRD SCHEDULE
        if (i.saleType === '3rd Schedule Goods' && (i.sroScheduleNo === '' || i.sroScheduleNo === '-')) {
          document.getElementById(row.sroScheduleInput).value = 'THIRD SCHEDULE';
        }
      } else {
        retailInput.disabled = true;
        retailInput.value = '0.00';
        retailInput.style.backgroundColor = 'var(--bg-secondary)';
        retailInput.style.color = 'var(--text-muted)';
        retailInput.placeholder = 'N/A';
      }
    }
  }
  recalculateInvoice();
}

function removeInvoiceItemRow(rowId) {
  if (invoiceItems.length <= 1) {
    alert("An invoice must contain at least one line item.");
    return;
  }
  const tr = document.getElementById(rowId);
  if (tr) tr.remove();
  invoiceItems = invoiceItems.filter(item => item.rowId !== rowId);
  recalculateInvoice();
}

// Syncing functions for Discount % and Discount Amount
function onDiscountPercentInput(rowId) {
  const qty = parseFloat(document.getElementById(`qty-${rowId}`).value) || 0;
  const val = parseFloat(document.getElementById(`valexcl-${rowId}`).value) || 0;
  const pct = parseFloat(document.getElementById(`discpercent-${rowId}`).value) || 0;
  
  const gross = qty * val;
  const amt = gross * (pct / 100);
  document.getElementById(`discamount-${rowId}`).value = amt.toFixed(2);
  recalculateInvoice();
}

function onDiscountAmountInput(rowId) {
  const qty = parseFloat(document.getElementById(`qty-${rowId}`).value) || 0;
  const val = parseFloat(document.getElementById(`valexcl-${rowId}`).value) || 0;
  const amt = parseFloat(document.getElementById(`discamount-${rowId}`).value) || 0;
  
  const gross = qty * val;
  const pct = gross > 0 ? (amt / gross) * 100 : 0;
  document.getElementById(`discpercent-${rowId}`).value = pct.toFixed(2);
  recalculateInvoice();
}

// Helper to sum all line items net value (gross - discount)
function getNetItemsSubtotal() {
  let total = 0;
  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discAmountInput = document.getElementById(item.discountInput);
    
    if (qtyInput && valInput) {
      const qty = parseFloat(qtyInput.value) || 0;
      const val = parseFloat(valInput.value) || 0;
      const disc = discAmountInput ? parseFloat(discAmountInput.value) : 0;
      total += Math.max(0, (qty * val) - disc);
    }
  });
  return total;
}

// Manual Tax Grid Functions
async function addTaxRow(tax = null) {
  await refreshDatabaseLists();
  
  const tbody = document.getElementById('taxes-grid-tbody');
  const index = invoiceTaxes.length;
  const rowId = `tax-row-${index}-${Date.now()}`;
  const tr = document.createElement('tr');
  tr.id = rowId;
  
  // Tax Type options from dbTaxesList
  let taxOptionsHtml = '<option value="">-- Select Tax Type --</option>';
  dbTaxesList.forEach(t => {
    taxOptionsHtml += `<option value="${t.id}" data-rate="${t.rate}" data-nature="${t.type || 'Sales Tax'}" data-fixed-rate="${t.fixedRate || 0}">${t.taxType}</option>`;
  });
  taxOptionsHtml += '<option value="custom">Custom Tax Type</option>';
  
  tr.innerHTML = `
    <td>
      <select class="form-control-cell" id="taxtype-${rowId}" onchange="onTaxTypeSelect('${rowId}')">
        ${taxOptionsHtml}
      </select>
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="taxrate-${rowId}" value="0.00" oninput="recalculateInvoice()">
    </td>
    <td>
      <select class="form-control-cell" id="taxnature-${rowId}" onchange="recalculateInvoice()">
        <option value="Sales Tax">Sales Tax</option>
        <option value="Further Tax">Further Tax</option>
        <option value="Extra Tax">Extra Tax</option>
        <option value="Withholding Tax">Withholding Tax</option>
        <option value="FED Tax">FED Tax</option>
      </select>
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="taxvalexcl-${rowId}" value="0.00" readonly style="background-color: var(--bg-secondary); color: var(--text-muted); cursor: not-allowed;">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="taxamt-${rowId}" value="0.00" oninput="onTaxAmtInput('${rowId}')">
    </td>
    <td style="text-align: center;">
      <button class="btn-remove-row" onclick="removeTaxRow('${rowId}')" title="Delete Row">&times;</button>
    </td>
  `;
  
  tbody.appendChild(tr);
  
  let fixedRateVal = 0;
  if (tax) {
    if (tax.taxTypeId && tax.taxTypeId !== 'custom') {
      const dbTax = dbTaxesList.find(x => x.id === Number(tax.taxTypeId));
      if (dbTax) {
        fixedRateVal = dbTax.fixedRate || 0;
      }
    } else {
      fixedRateVal = tax.fixedRate || 0;
    }
  }

  invoiceTaxes.push({
    rowId: rowId,
    typeSelect: `taxtype-${rowId}`,
    rateInput: `taxrate-${rowId}`,
    natureSelect: `taxnature-${rowId}`,
    valExclInput: `taxvalexcl-${rowId}`,
    amtInput: `taxamt-${rowId}`,
    fixedRate: fixedRateVal
  });
  
  // Set default values if template provided
  if (tax) {
    document.getElementById(`taxtype-${rowId}`).value = tax.taxTypeId || '';
    document.getElementById(`taxrate-${rowId}`).value = tax.ratePercent !== undefined ? tax.ratePercent.toFixed(2) : '0.00';
    let natureVal = tax.type || 'Sales Tax';
    if (natureVal === 'Sales With Held Tax') {
      natureVal = 'Withholding Tax';
    }
    document.getElementById(`taxnature-${rowId}`).value = natureVal;
    document.getElementById(`taxvalexcl-${rowId}`).value = tax.valueExcl !== undefined ? tax.valueExcl.toFixed(2) : '0.00';
    document.getElementById(`taxamt-${rowId}`).value = tax.taxAmt !== undefined ? tax.taxAmt.toFixed(2) : '0.00';
  } else {
    // Automatically set default value excluding ST to current net items subtotal
    const itemsSubtotal = getNetItemsSubtotal();
    document.getElementById(`taxvalexcl-${rowId}`).value = itemsSubtotal.toFixed(2);
  }
  
  recalculateInvoice();
}

function removeTaxRow(rowId) {
  const tr = document.getElementById(rowId);
  if (tr) tr.remove();
  invoiceTaxes = invoiceTaxes.filter(tax => tax.rowId !== rowId);
  recalculateInvoice();
}

function onTaxTypeSelect(rowId) {
  const select = document.getElementById(`taxtype-${rowId}`);
  const selectedOption = select.options[select.selectedIndex];
  
  let fixedRate = 0;
  if (select.value === 'custom' || !select.value) {
    document.getElementById(`taxrate-${rowId}`).value = '0.00';
    document.getElementById(`taxnature-${rowId}`).value = 'Sales Tax';
  } else {
    const rate = parseFloat(selectedOption.dataset.rate) || 0;
    fixedRate = parseFloat(selectedOption.dataset.fixedRate) || 0;
    let nature = selectedOption.dataset.nature || 'Sales Tax';
    if (nature === 'Sales With Held Tax') {
      nature = 'Withholding Tax';
    }
    
    document.getElementById(`taxrate-${rowId}`).value = rate.toFixed(2);
    document.getElementById(`taxnature-${rowId}`).value = nature;
  }
  
  // Update in invoiceTaxes array
  const foundTax = invoiceTaxes.find(x => x.rowId === rowId);
  if (foundTax) {
    foundTax.fixedRate = fixedRate;
  }
  
  // Sync the amount
  const itemsSubtotal = getNetItemsSubtotal();
  document.getElementById(`taxvalexcl-${rowId}`).value = itemsSubtotal.toFixed(2);
  
  const rate = parseFloat(document.getElementById(`taxrate-${rowId}`).value) || 0;
  const amt = itemsSubtotal * (rate / 100);
  document.getElementById(`taxamt-${rowId}`).value = amt.toFixed(2);
  
  recalculateInvoice();
}

function onTaxAmtInput(rowId) {
  recalculateInvoice();
}

function isPotassiumTaxType(typeText) {
  if (!typeText) return false;
  const upper = typeText.toUpperCase();
  return upper.includes('POTASSIUM') || upper.includes('POSSTIUM') || upper.includes('POTASIUM') || upper.includes('CHLORATE');
}

function getSalesTaxRateForItem(prod, invoiceTaxes) {
  if (!prod) return 0;
  const saleType = prod.saleType || '';
  let matchingTaxRow = null;
  
  if (saleType.includes('Cement')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('CEMENT') || typeText.toUpperCase().includes('CONCRETE');
    });
  } else if (saleType.includes('CNG')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('CNG');
    });
  } else if (saleType.includes('Potassium')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return isPotassiumTaxType(typeText);
    });
  } else if (saleType.includes('Reduced')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('REDUCED');
    });
  } else if (saleType.includes('SRO 297') || saleType.includes('SRO.297')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      const typeTextUpper = typeText.toUpperCase();
      return typeTextUpper.includes('SRO 297') || typeTextUpper.includes('SRO.297');
    });
  } else if (saleType.includes('3rd Schedule')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('3RD SCHEDULE');
    });
  }
  
  if (!matchingTaxRow) {
    // Look for standard or any general Sales Tax row that doesn't match Cement/CNG/Potassium
    matchingTaxRow = invoiceTaxes.find(t => {
      const natureSel = document.getElementById(t.natureSelect);
      if (!natureSel || natureSel.value !== 'Sales Tax') return false;
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      const typeTextUpper = typeText.toUpperCase();
      return !typeTextUpper.includes('CEMENT') && !typeTextUpper.includes('CONCRETE') && !typeTextUpper.includes('CNG') && !isPotassiumTaxType(typeText);
    });
  }
  
  if (matchingTaxRow) {
    const rateInput = document.getElementById(matchingTaxRow.rateInput);
    return rateInput ? (parseFloat(rateInput.value) || 0) : 0;
  }
  
  // Fallback to first Sales Tax row
  const firstSalesTaxRow = invoiceTaxes.find(t => {
    const natureSel = document.getElementById(t.natureSelect);
    return natureSel && natureSel.value === 'Sales Tax';
  });
  if (firstSalesTaxRow) {
    const rateInput = document.getElementById(firstSalesTaxRow.rateInput);
    return rateInput ? (parseFloat(rateInput.value) || 0) : 0;
  }
  
  return 0;
}

function getFixedTaxRateForItem(prod, invoiceTaxes) {
  if (!prod) return 0;
  const saleType = prod.saleType || '';
  let matchingTaxRow = null;
  
  if (saleType.includes('Cement')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('CEMENT') || typeText.toUpperCase().includes('CONCRETE');
    });
  } else if (saleType.includes('CNG')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return typeText.toUpperCase().includes('CNG');
    });
  } else if (saleType.includes('Potassium')) {
    matchingTaxRow = invoiceTaxes.find(t => {
      const typeSelect = document.getElementById(t.typeSelect);
      const typeText = typeSelect ? (typeSelect.options[typeSelect.selectedIndex]?.text || '') : '';
      return isPotassiumTaxType(typeText);
    });
  }
  
  if (matchingTaxRow) {
    return matchingTaxRow.fixedRate || 0;
  }
  
  // Look in dbTaxesList as fallback if the row exists
  const matchingDbTax = dbTaxesList.find(t => {
    if (saleType.includes('Cement')) {
      return t.taxType.toUpperCase().includes('CEMENT') || t.taxType.toUpperCase().includes('CONCRETE');
    }
    if (saleType.includes('CNG')) {
      return t.taxType.toUpperCase().includes('CNG');
    }
    if (saleType.includes('Potassium')) {
      return isPotassiumTaxType(t.taxType);
    }
    return false;
  });
  if (matchingDbTax) {
    return matchingDbTax.fixedRate || 0;
  }
  
  // Fallbacks based on defaults
  if (saleType.includes('Cement')) return 2;
  if (saleType.includes('CNG Sales')) return 200;
  if (saleType.includes('Potassium')) return 60;
  
  return 0;
}

// ==========================================
// COMPLIANCE AUTO-CALCULATOR & TAX GRID
// ==========================================
function recalculateInvoice() {
  // 0. Update column header label for tax rate depending on if we have fixed tax items
  let hasFixedRateTax = false;
  invoiceItems.forEach(item => {
    const prodSelect = document.getElementById(item.productSelect);
    if (!prodSelect) return;
    const prodId = Number(prodSelect.value);
    if (!prodId) return;
    const pr = dbItemsList.find(x => x.id === prodId);
    if (!pr) return;
    const st = pr.saleType || '';
    if (st.includes('Cement') || st.includes('CNG Sales')) {
      hasFixedRateTax = true;
    }
  });

  const taxRateHeader = document.getElementById('tax-rate-header-label');
  if (taxRateHeader) {
    taxRateHeader.textContent = hasFixedRateTax ? 'Tax Rate (Rs)' : 'Tax Rate (%)';
  }

  let subtotalExcl = 0;
  let totalDiscount = 0;
  
  // 1. Calculate items subtotal and discounts
  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discPercentInput = document.getElementById(item.discPercentInput);
    const discAmountInput = document.getElementById(item.discountInput);
    
    if (!qtyInput || !valInput) return;
    
    const qty = parseFloat(qtyInput.value) || 0;
    const valueExcl = parseFloat(valInput.value) || 0;
    const rowValExcl = valueExcl * qty;
    
    let discount = 0;
    if (discPercentInput && discAmountInput) {
      const pct = parseFloat(discPercentInput.value) || 0;
      if (document.activeElement !== discAmountInput) {
        discount = rowValExcl * (pct / 100);
        discAmountInput.value = discount.toFixed(2);
      } else {
        discount = parseFloat(discAmountInput.value) || 0;
        const calculatedPct = rowValExcl > 0 ? (discount / rowValExcl) * 100 : 0;
        discPercentInput.value = calculatedPct.toFixed(2);
      }
    }
    
    subtotalExcl += rowValExcl;
    totalDiscount += discount;
  });

  const netExclValue = Math.max(0, subtotalExcl - totalDiscount);

  // 2. Unregistered buyer warning banner toggle
  const regType = document.getElementById('buyer-reg-type').value;
  const warningBanner = document.getElementById('unregistered-buyer-warning');
  if (warningBanner) {
    if (regType === 'Unregistered') {
      warningBanner.style.display = 'flex';
      warningBanner.style.alignItems = 'center';
      warningBanner.style.gap = '8px';
    } else {
      warningBanner.style.display = 'none';
    }
  }

  // 3. Process manual tax rows
  let totalSalesTax = 0;
  let furtherTaxAmt = 0;
  let totalExtraTax = 0;
  let totalWhTax = 0;
  let totalFedAmt = 0;
  
  const taxesGroup = {};

  // Pre-calculate salesTaxBase (which uses retail prices for 3rd Schedule Goods)
  let salesTaxBase = 0;
  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discountInput = document.getElementById(item.discountInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);

    if (!qtyInput || !valInput || !prodSelect) return;
    
    const qty = parseFloat(qtyInput.value) || 0;
    const val = parseFloat(valInput.value) || 0;
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const rowValExcl = val * qty;
    const rowNetValue = Math.max(0, rowValExcl - discount);
    
    const prodId = Number(prodSelect.value);
    if (!prodId) return;
    const pr = dbItemsList.find(x => x.id === prodId);
    if (!pr) return;
    
    if (pr.saleType === 'Exempt goods' || pr.saleType === 'Goods at zero-rate') {
      // 0 tax base contribution
    } else if (pr.saleType === '3rd Schedule Goods') {
      const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
      salesTaxBase += retailPrice * qty;
    } else {
      salesTaxBase += rowNetValue;
    }
  });

  invoiceTaxes.forEach(tax => {
    const typeSelect = document.getElementById(tax.typeSelect);
    const rateInput = document.getElementById(tax.rateInput);
    const natureSelect = document.getElementById(tax.natureSelect);
    const valExclInput = document.getElementById(tax.valExclInput);
    const amtInput = document.getElementById(tax.amtInput);
    
    if (!typeSelect || !rateInput || !natureSelect || !valExclInput || !amtInput) return;
    
    const rate = parseFloat(rateInput.value) || 0;
    const nature = natureSelect.value;
    
    const valExcl = nature === 'Sales Tax' ? salesTaxBase : netExclValue;
    valExclInput.value = valExcl.toFixed(2);
    
    const typeText = typeSelect.value === 'custom' 
      ? 'Custom Tax' 
      : typeSelect.options[typeSelect.selectedIndex]?.text || 'Tax';

    // Auto-update amount based on value and rate if amount input is NOT active
    let amt = 0;
    if (document.activeElement !== amtInput) {
      if (nature === 'Sales Tax') {
        invoiceItems.forEach(item => {
          const qtyInput = document.getElementById(item.qtyInput);
          const valInput = document.getElementById(item.valInput);
          const prodSelect = document.getElementById(item.productSelect);
          const retailInput = document.getElementById(item.retailPriceInput);
          const discountInput = document.getElementById(item.discountInput);

          if (!qtyInput || !valInput || !prodSelect) return;

          const qty = parseFloat(qtyInput.value) || 0;
          const val = parseFloat(valInput.value) || 0;
          const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
          const rowValExcl = val * qty;
          const rowNetValue = Math.max(0, rowValExcl - discount);

          const prodId = Number(prodSelect.value);
          if (!prodId) return;
          const pr = dbItemsList.find(x => x.id === prodId);
          if (!pr) return;

          const st = pr.saleType || '';
          
          let applies = false;
          const typeTextUpper = typeText.toUpperCase();
          if (st.includes('Exempt') || st.includes('zero-rate')) {
            applies = false;
          } else if (typeTextUpper.includes('CEMENT') || typeTextUpper.includes('CONCRETE')) {
            applies = st.includes('Cement');
          } else if (typeTextUpper.includes('CNG')) {
            applies = st.includes('CNG');
          } else if (isPotassiumTaxType(typeText)) {
            applies = st.includes('Potassium');
          } else {
            // General standard tax row applies to standard/reduced/3rd schedule/etc.
            // but NOT to Cement, CNG, Potassium
            applies = !st.includes('Cement') && !st.includes('CNG') && !st.includes('Potassium');
          }

          if (applies) {
            if (st.includes('3rd Schedule Goods')) {
              const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
              amt += retailPrice * qty * (rate / 100);
            } else if (st.includes('Cement')) {
              amt += qty * rate;
            } else if (st.includes('CNG Sales')) {
              amt += qty * rate;
            } else if (st.includes('Potassium')) {
              const fixedRate = getFixedTaxRateForItem(pr, invoiceTaxes);
              amt += rowNetValue * (rate / 100) + qty * fixedRate;
            } else {
              amt += rowNetValue * (rate / 100);
            }
          }
        });
      } else {
        amt = valExcl * (rate / 100);
      }
      amtInput.value = amt.toFixed(2);
    } else {
      amt = parseFloat(amtInput.value) || 0;
    }
      
    if (nature === 'Sales Tax') {
      totalSalesTax += amt;
    } else if (nature === 'Further Tax') {
      furtherTaxAmt += amt;
    } else if (nature === 'Extra Tax') {
      totalExtraTax += amt;
    } else if (nature === 'Withholding Tax') {
      totalWhTax += amt;
    } else if (nature === 'FED Tax') {
      totalFedAmt += amt;
    }
    
    if (!taxesGroup[typeText]) {
      taxesGroup[typeText] = {
        rate: rate,
        fixedRate: tax.fixedRate || 0,
        taxNature: nature,
        invoiceValueExcl: 0,
        taxAmount: 0
      };
    }
    taxesGroup[typeText].invoiceValueExcl += valExcl;
    taxesGroup[typeText].taxAmount += amt;
  });

  let totalRetailPrice = 0;
  let hasRetailTaxed = false;
  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);
    if (!qtyInput || !prodSelect) return;
    const qty = parseFloat(qtyInput.value) || 0;
    const prodId = Number(prodSelect.value);
    if (!prodId) return;
    const pr = dbItemsList.find(x => x.id === prodId);
    if (!pr) return;
    
    if (pr.saleType === '3rd Schedule Goods' || pr.taxedAtRetail === true) {
      const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
      totalRetailPrice += retailPrice * qty;
      hasRetailTaxed = true;
    }
  });

  const grandTotal = netExclValue + totalSalesTax + furtherTaxAmt + totalExtraTax + totalFedAmt;

  // Render on Invoicing builder panel calculations summary box
  document.getElementById('summary-val-excl').textContent = `PKR ${subtotalExcl.toFixed(2)}`;
  
  const discountRow = document.getElementById('summary-discount-row');
  if (totalDiscount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('summary-discount').textContent = `- PKR ${totalDiscount.toFixed(2)}`;
  } else {
    discountRow.style.display = 'none';
  }

  const retailRow = document.getElementById('summary-retail-row');
  if (retailRow) {
    if (hasRetailTaxed) {
      retailRow.style.display = 'flex';
      document.getElementById('summary-retail').textContent = `PKR ${totalRetailPrice.toFixed(2)}`;
    } else {
      retailRow.style.display = 'none';
    }
  }

  // Show sales tax amount (from manual inputs)
  document.getElementById('summary-sales-tax').textContent = `PKR ${totalSalesTax.toFixed(2)}`;

  const whTaxRow = document.getElementById('summary-whtax-row');
  if (whTaxRow) {
    if (totalWhTax > 0) {
      whTaxRow.style.display = 'flex';
      document.getElementById('summary-whtax').textContent = `PKR ${totalWhTax.toFixed(2)}`;
    } else {
      whTaxRow.style.display = 'none';
    }
  }

  const extraTaxRow = document.getElementById('summary-extra-tax-row');
  if (totalExtraTax > 0) {
    extraTaxRow.style.display = 'flex';
    document.getElementById('summary-extra-tax').textContent = `PKR ${totalExtraTax.toFixed(2)}`;
  } else {
    extraTaxRow.style.display = 'none';
  }

  const furtherTaxRow = document.getElementById('summary-further-tax-row');
  if (furtherTaxAmt > 0) {
    furtherTaxRow.style.display = 'flex';
    document.getElementById('summary-further-tax').textContent = `PKR ${furtherTaxAmt.toFixed(2)}`;
  } else {
    furtherTaxRow.style.display = 'none';
  }

  const fedRow = document.getElementById('summary-fed-row');
  if (fedRow) {
    if (totalFedAmt > 0) {
      fedRow.style.display = 'flex';
      document.getElementById('summary-fed').textContent = `PKR ${totalFedAmt.toFixed(2)}`;
    } else {
      fedRow.style.display = 'none';
    }
  }

  document.getElementById('summary-grand-total').textContent = `PKR ${grandTotal.toFixed(2)}`;

  // Auto-calculate Total Values for each line item row
  let furtherTaxRate = 0;
  let extraTaxRate = 0;
  invoiceTaxes.forEach(t => {
    const natureSelect = document.getElementById(t.natureSelect);
    const rateInput = document.getElementById(t.rateInput);
    if (!natureSelect || !rateInput) return;
    const rateVal = parseFloat(rateInput.value) || 0;
    if (natureSelect.value === 'Further Tax') furtherTaxRate = rateVal;
    else if (natureSelect.value === 'Extra Tax') extraTaxRate = rateVal;
  });

  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discountInput = document.getElementById(item.discountInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);
    const totalValInput = document.getElementById(item.totalValInput);
    const totalRetailInput = document.getElementById(item.totalRetailInput);

    if (!qtyInput || !valInput || !prodSelect || !totalValInput) return;

    const qty = parseFloat(qtyInput.value) || 0;
    const val = parseFloat(valInput.value) || 0;
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const rowValExcl = val * qty;
    const rowNetValue = Math.max(0, rowValExcl - discount);

    const prodId = Number(prodSelect.value);
    if (!prodId) return;
    const pr = dbItemsList.find(x => x.id === prodId);
    if (!pr) return;

    const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;

    const itemSalesTaxRate = getSalesTaxRateForItem(pr, invoiceTaxes);
    let stAmt = 0;
    const st = pr.saleType || '';
    if (st.includes('Exempt') || st.includes('zero-rate')) {
      stAmt = 0;
    } else if (st.includes('3rd Schedule Goods')) {
      stAmt = retailPrice * qty * (itemSalesTaxRate / 100);
    } else if (st.includes('Cement')) {
      stAmt = qty * itemSalesTaxRate;
    } else if (st.includes('CNG Sales')) {
      stAmt = qty * itemSalesTaxRate;
    } else if (st.includes('Potassium')) {
      stAmt = rowNetValue * (itemSalesTaxRate / 100) + qty * 60;
    } else {
      stAmt = rowNetValue * (itemSalesTaxRate / 100);
    }

    const ftAmt = rowNetValue * (furtherTaxRate / 100);
    const etAmt = rowNetValue * (extraTaxRate / 100);

    const salesTaxInput = document.getElementById(item.salesTaxInput);
    if (salesTaxInput) {
      salesTaxInput.value = stAmt.toFixed(2);
    }

    // Display the Total Notified Value (row value excluding ST) in the read-only cell
    if (document.activeElement !== totalValInput) {
      totalValInput.value = rowValExcl.toFixed(2);
    }

    // Display the Total Retail Price in the read-only cell
    if (totalRetailInput) {
      totalRetailInput.value = (retailPrice * qty).toFixed(2);
    }
  });

  return {
    subtotalExcl,
    totalSalesTax,
    furtherTaxAmt,
    grandTotal,
    taxesGroup,
    totalExtraTax,
    totalDiscount,
    totalWhTax,
    totalFedAmt
  };
}

function toggleRefInvoiceField() {
  const refGroup = document.getElementById('group-ref-no');
  if (refGroup) {
    refGroup.style.display = 'flex';
  }
}

// Helper to clear tax grid and seed default sales tax row
function clearAndAddDefaultTaxRow(ratePercent, taxNature) {
  const tbody = document.getElementById('taxes-grid-tbody');
  if (tbody) tbody.innerHTML = '';
  invoiceTaxes = [];
  
  const matchingTax = dbTaxesList.find(t => t.rate === ratePercent && t.taxNature === taxNature);
  const taxId = matchingTax ? matchingTax.id : 'custom';
  
  const itemsSubtotal = getNetItemsSubtotal();
  const amt = itemsSubtotal * (ratePercent / 100);
  
  addTaxRow({
    taxTypeId: taxId,
    ratePercent: ratePercent,
    taxNature: taxNature,
    valueExcl: itemsSubtotal,
    taxAmt: amt
  });
}

// Auto configures buyer data based on standard sandbox test cases to aid testing speed
async function autoConfigureScenario() {
  const scenario = document.getElementById('sandbox-scenario').value;
  await refreshDatabaseLists();
  
  let targetCust = null;
  
  if (['SN001'].includes(scenario)) {
    targetCust = dbCustomersList.find(x => x.ntn === '8989878-3');
  } else if (['SN002', 'SN005', 'SN028'].includes(scenario)) {
    targetCust = dbCustomersList.find(x => x.ntn === '1000000000000') || dbCustomersList.find(x => x.ntn === '9999997');
  } else if (scenario === 'SN003') {
    targetCust = dbCustomersList.find(x => x.ntn === '3710505701479');
  } else if (['SN004', 'SN009', 'SN010', 'SN012', 'SN013', 'SN014', 'SN015', 'SN016', 'SN017', 'SN018', 'SN019', 'SN020', 'SN021', 'SN022', 'SN023', 'SN024', 'SN025'].includes(scenario)) {
    targetCust = dbCustomersList.find(x => x.ntn === '9020846');
  } else if (['SN006', 'SN007', 'SN008', 'SN026', 'SN027'].includes(scenario)) {
    targetCust = dbCustomersList.find(x => x.ntn === '9999997');
  } else {
    // general fallback
    targetCust = dbCustomersList.find(x => x.ntn === '8989878-3') || dbCustomersList.find(x => x.ntn === '9999997');
  }
  
  if (targetCust) {
    document.getElementById('invoice-party-select').value = targetCust.id;
    onInvoicePartySelectChange();
  }

  // Ensure we have at least one line item row
  if (invoiceItems.length === 0) {
    addInvoiceItemRow();
  }

  // Update the first line item row if it exists to match the scenario parameters
  if (invoiceItems.length > 0) {
    const firstRow = invoiceItems[0];
    const prodSelect = document.getElementById(firstRow.productSelect);
    const valInput = document.getElementById(firstRow.valInput);
    const qtyInput = document.getElementById(firstRow.qtyInput);
    const retailInput = document.getElementById(firstRow.retailPriceInput);
    
    let targetItem = null;
    let targetTaxRateVal = 18;
    let defaultValue = 1000;
    let defaultQty = 1;
    let defaultRetail = 0;
    let defaultTotalVal = 0;
    
    if (scenario === 'SN001' || scenario === 'SN002' || scenario === 'SN026') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Goods at standard rate (default)');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    } else if (scenario === 'SN003') {
      targetItem = dbItemsList.find(x => x.hsCode === '7214.1010' && x.saleType === 'Processing/ Conversion of Goods');
      targetTaxRateVal = 18;
      defaultValue = 207000;
    } else if (scenario === 'SN004') {
      targetItem = dbItemsList.find(x => x.hsCode === '7204.4910' && x.saleType === 'Processing/ Conversion of Goods');
      targetTaxRateVal = 18;
      defaultValue = 175000;
    } else if (scenario === 'SN005' || scenario === 'SN028') {
      targetItem = dbItemsList.find(x => x.hsCode === '0102.2930' && x.saleType === 'Goods at Reduced Rate');
      targetTaxRateVal = 1;
      defaultValue = 1000;
    } else if (scenario === 'SN006') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Exempt goods');
      targetTaxRateVal = 0;
      defaultValue = 1000;
    } else if (scenario === 'SN007') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Goods at zero-rate');
      targetTaxRateVal = 0;
      defaultValue = 1000;
    } else if (scenario === 'SN008' || scenario === 'SN027') {
      targetItem = dbItemsList.find(x => x.hsCode === '8516.6000' && x.saleType === '3rd Schedule Goods');
      targetTaxRateVal = 18;
      defaultValue = 0;
      defaultQty = 100;
      defaultRetail = 1000;
      defaultTotalVal = 145;
    } else if (scenario === 'SN009') {
      targetItem = dbItemsList.find(x => x.hsCode === '5201.0090' && x.saleType === 'Cotton Ginners');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    } else if (scenario === 'SN010') {
      targetItem = dbItemsList.find(x => x.hsCode === '9812.1000' && x.saleType === 'Telecommunication services');
      targetTaxRateVal = 19.5;
      defaultValue = 1000;
    } else if (scenario === 'SN011') {
      targetItem = dbItemsList.find(x => x.hsCode === '7214.1010' && x.saleType === 'Toll Manufacturing');
      targetTaxRateVal = 18;
      defaultValue = 207000;
    } else if (scenario === 'SN012') {
      targetItem = dbItemsList.find(x => x.hsCode === '2710.1210' && x.saleType === 'Petroleum Products');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    } else if (scenario === 'SN013') {
      targetItem = dbItemsList.find(x => x.hsCode === '2716.0000' && x.saleType === 'Electricity Supply to Retailers');
      targetTaxRateVal = 7.5;
      defaultValue = 1000;
    } else if (scenario === 'SN014') {
      targetItem = dbItemsList.find(x => x.hsCode === '2711.2100' && x.saleType === 'Gas to CNG stations');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    } else if (scenario === 'SN015') {
      targetItem = dbItemsList.find(x => x.hsCode === '8517.1490' && x.saleType === 'Mobile Phones');
      targetTaxRateVal = 18;
      defaultValue = 1000;
      defaultRetail = 1000;
    } else if (scenario === 'SN016') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Processing/ Conversion of Goods');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    } else if (scenario === 'SN017') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Goods (FED in ST Mode)');
      targetTaxRateVal = 17;
      defaultValue = 1000;
    } else if (scenario === 'SN018') {
      targetItem = dbItemsList.find(x => x.hsCode === '9812.1000' && x.saleType === 'Services (FED in ST Mode)');
      targetTaxRateVal = 19.5;
      defaultValue = 1000;
    } else if (scenario === 'SN019') {
      targetItem = dbItemsList.find(x => x.hsCode === '9812.1000' && x.saleType === 'Services');
      targetTaxRateVal = 16;
      defaultValue = 1000;
    } else if (scenario === 'SN020') {
      targetItem = dbItemsList.find(x => x.hsCode === '8703.8090' && x.saleType === 'Electric Vehicle');
      targetTaxRateVal = 1;
      defaultValue = 1000000;
    } else if (scenario === 'SN021') {
      targetItem = dbItemsList.find(x => x.hsCode === '2523.2900' && x.saleType === 'Cement /Concrete Block');
      targetTaxRateVal = 2;
      defaultValue = 10;
      defaultQty = 100;
    } else if (scenario === 'SN022') {
      targetItem = dbItemsList.find(x => x.hsCode === '2829.1100' && x.saleType === 'Potassium Chlorate');
      targetTaxRateVal = 18;
      defaultValue = 1000;
      defaultQty = 100;
    } else if (scenario === 'SN023') {
      targetItem = dbItemsList.find(x => x.hsCode === '2711.2100' && x.saleType === 'CNG Sales');
      targetTaxRateVal = 200;
      defaultValue = 1000;
      defaultQty = 10;
    } else if (scenario === 'SN024') {
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Goods as per SRO.297(|)/2023');
      targetTaxRateVal = 25;
      defaultValue = 1000;
    } else if (scenario === 'SN025') {
      targetItem = dbItemsList.find(x => x.hsCode === '3004.9099' && x.saleType === 'Non-Adjustable Supplies');
      targetTaxRateVal = 0;
      defaultValue = 1000;
    } else {
      // Defaults for standard sales (SN001, SN002, SN026 etc.)
      targetItem = dbItemsList.find(x => x.hsCode === '8421.2100' && x.saleType === 'Goods at standard rate (default)');
      targetTaxRateVal = 18;
      defaultValue = 1000;
    }
    
    if (targetItem && prodSelect) {
      prodSelect.value = targetItem.id;
      onInvoiceItemSelect(firstRow.rowId);
      if (valInput) valInput.value = defaultValue.toFixed(2);
      if (qtyInput) qtyInput.value = defaultQty.toString();
      const totalValInput = document.getElementById(firstRow.totalValInput);
      if (totalValInput) totalValInput.value = defaultTotalVal.toFixed(2);
      if (retailInput && defaultRetail > 0) {
        retailInput.value = defaultRetail.toFixed(2);
      }
      
      // Clear manual taxes and add standard tax row for scenario (no further tax)
      clearAndAddDefaultTaxRow(targetTaxRateVal, 'Sales Tax');
      
      if (scenario === 'SN002') {
        addTaxRow({
          taxTypeId: 'custom',
          ratePercent: 4,
          taxNature: 'Further Tax',
          valueExcl: defaultValue,
          taxAmt: defaultValue * 0.04
        });
      }
    }
  }
  
  recalculateInvoice();
}

function resetInvoiceForm() {
  // Clear table rows
  const tbody = document.getElementById('items-grid-tbody');
  tbody.innerHTML = '';
  invoiceItems = [];
  
  // Clear manual tax rows
  const taxTbody = document.getElementById('taxes-grid-tbody');
  if (taxTbody) taxTbody.innerHTML = '';
  invoiceTaxes = [];
  
  // Set default values for buyer
  populateInvoicePartyDropdown();
  
  document.getElementById('invoice-type').value = 'Sale Invoice';
  document.getElementById('invoice-ref-no').value = '';
  
  toggleRefInvoiceField();
  
  // Add first default item
  addInvoiceItemRow();
  
  // Hide response inspector
  document.getElementById('fbr-response-inspector').classList.remove('active');
  document.getElementById('success-action-container').style.display = 'none';
  
  // Set sandbox scenario to default
  const sandboxScenario = document.getElementById('sandbox-scenario');
  if (sandboxScenario) {
    sandboxScenario.value = 'SN001';
    autoConfigureScenario();
  }
}

// ==========================================
// FBR GATEWAY CLIENT API (IPC INTEGRATION)
// ==========================================
function buildFbrPayload() {
  const invoiceType = document.getElementById('invoice-type').value;
  const invoiceDate = document.getElementById('invoice-date').value;
  const buyerId = document.getElementById('invoice-party-select').value;
  const refNo = document.getElementById('invoice-ref-no').value.trim();
  const scenarioId = document.getElementById('sandbox-scenario').value;

  const roundTo2 = (num) => {
    if (typeof num !== 'number') return num;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  // Validations
  if (!buyerId) {
    throw new Error("Mandatory field missing: Please select a registered Party Customer.");
  }
  
  const customer = dbCustomersList.find(x => x.id === Number(buyerId));
  if (!customer) {
    throw new Error("Selected Customer does not exist in local database.");
  }

  const calcs = recalculateInvoice();

  // Calculate the total net items value (value excluding ST - discount) to determine proportions
  const totalNetValue = getNetItemsSubtotal();

  // 1. Calculate sums for exact 3rd Schedule and standard taxable items tax allocation
  let thirdSchTaxSum = 0;
  let standardNetValSum = 0;
  invoiceItems.forEach(it => {
    const pId = document.getElementById(it.productSelect).value;
    if (!pId) return;
    const p = dbItemsList.find(x => x.id === Number(pId));
    if (!p) return;
    
    const itemSalesTaxRate = getSalesTaxRateForItem(p, invoiceTaxes);
    if (p.saleType === '3rd Schedule Goods' || p.taxedAtRetail === true) {
      const q = parseFloat(document.getElementById(it.qtyInput).value) || 0;
      const rpInput = document.getElementById(it.retailPriceInput);
      const rp = rpInput ? parseFloat(rpInput.value) || 0 : 0;
      thirdSchTaxSum += rp * q * (itemSalesTaxRate / 100);
    } else if (p.saleType !== 'Exempt goods' && p.saleType !== 'Goods at zero-rate') {
      const q = parseFloat(document.getElementById(it.qtyInput).value) || 0;
      const v = parseFloat(document.getElementById(it.valInput).value) || 0;
      const d = parseFloat(document.getElementById(it.discountInput).value) || 0;
      standardNetValSum += Math.max(0, (v * q) - d);
    }
  });

  const remainingSalesTax = Math.max(0, calcs.totalSalesTax - thirdSchTaxSum);

  // Build items array
  const items = invoiceItems.map((item, idx) => {
    const prodId = document.getElementById(item.productSelect).value;
    const qty = parseFloat(document.getElementById(item.qtyInput).value) || 0;
    const val = document.getElementById(item.valInput) ? parseFloat(document.getElementById(item.valInput).value) : 0;
    const discountVal = document.getElementById(item.discountInput) ? parseFloat(document.getElementById(item.discountInput).value) : 0;
    
    if (!prodId) {
      throw new Error(`Item Row ${idx + 1}: Please select a product.`);
    }
    
    const prod = dbItemsList.find(x => x.id === Number(prodId));
    if (!prod) {
      throw new Error(`Item Row ${idx + 1}: Selected product does not exist.`);
    }
    
    if (qty <= 0 || val < 0 || (val === 0 && prod.saleType !== '3rd Schedule Goods')) {
      throw new Error(`Item Row ${idx + 1}: Quantity must be greater than zero, and Sales Value must be greater than zero (except for 3rd Schedule Goods).`);
    }

    const rowValExcl = val * qty;
    const rowNetValue = Math.max(0, rowValExcl - discountVal);
    const proportion = totalNetValue > 0 ? (rowNetValue / totalNetValue) : 0;
    
    const retailPrice = document.getElementById(item.retailPriceInput) ? parseFloat(document.getElementById(item.retailPriceInput).value) || 0 : 0;
    const itemSalesTaxRate = getSalesTaxRateForItem(prod, invoiceTaxes);
    let stAmt = 0;
    const st = prod.saleType || '';
    if (st.includes('Exempt') || st.includes('zero-rate')) {
      stAmt = 0.00;
    } else if (st.includes('3rd Schedule Goods')) {
      stAmt = retailPrice * qty * (itemSalesTaxRate / 100);
    } else if (st.includes('Cement')) {
      stAmt = qty * itemSalesTaxRate;
    } else if (st.includes('CNG Sales')) {
      stAmt = qty * itemSalesTaxRate;
    } else if (st.includes('Potassium')) {
      const fixedRate = getFixedTaxRateForItem(prod, invoiceTaxes);
      stAmt = rowNetValue * (itemSalesTaxRate / 100) + qty * fixedRate;
    } else {
      stAmt = rowNetValue * (itemSalesTaxRate / 100);
    }
    
    const itemFurtherTax = proportion * calcs.furtherTaxAmt;
    const itemExtraTaxVal = proportion * calcs.totalExtraTax;
    const itemWhTax = proportion * (calcs.totalWhTax || 0);
    const itemFedPayable = proportion * (calcs.totalFedAmt || 0);
    
    const finalExtraTax = itemExtraTaxVal > 0 ? itemExtraTaxVal : "";

    let rateText = itemSalesTaxRate + "%";
    if (st.includes('Exempt')) {
      rateText = 'Exempt';
    } else if (st.includes('zero-rate')) {
      rateText = '0%';
    } else if (st.includes('Cement')) {
      rateText = 'Rs.' + (itemSalesTaxRate || 2);
    } else if (st.includes('CNG Sales')) {
      rateText = 'Rs.' + (itemSalesTaxRate || 200);
    } else if (st.includes('Potassium')) {
      const fixedRate = getFixedTaxRateForItem(prod, invoiceTaxes);
      rateText = (itemSalesTaxRate || 18) + '% along with rupees ' + fixedRate + ' per kilogram';
    }

    const itemPayload = {
      hsCode: prod.hsCode,
      productDescription: prod.itemDesc,
      rate: rateText,
      uoM: (() => {
        if (prod.hsCode.startsWith('7214') || prod.hsCode.startsWith('7216') || prod.hsCode.startsWith('7204.49') || prod.hsCode.startsWith('7204.10')) {
          return 'MT';
        }
        return prod.uom;
      })(),
      quantity: qty,
      valueSalesExcludingST: roundTo2(rowNetValue),
      fixedNotifiedValueOrRetailPrice: (() => {
        if (st.includes('3rd Schedule Goods') || prod.taxedAtRetail === true) {
          return roundTo2(retailPrice * qty);
        }
        return 0.00;
      })(),
      salesTaxApplicable: roundTo2(stAmt),
      salesTaxWithheldAtSource: (() => {
        if (calcs.totalWhTax > 0) {
          return roundTo2(itemWhTax);
        } else if (st.includes('Cotton')) {
          return roundTo2(stAmt);
        }
        return 0.00;
      })(),
      extraTax: typeof finalExtraTax === 'number' ? roundTo2(finalExtraTax) : finalExtraTax, // PDF spec: Number, or "" for not provided
      furtherTax: roundTo2(itemFurtherTax), // PDF spec: Number
      sroScheduleNo: st.includes('3rd Schedule Goods') ? (prod.sroScheduleNo || 'THIRD SCHEDULE') : (prod.sroScheduleNo || ''),
      fedPayable: roundTo2(itemFedPayable),
      discount: roundTo2(discountVal),
      saleType: (() => {
        let mappedSt = prod.saleType || '';
        if (mappedSt === '3rd Schedule Goods') return ' 3rd Schedule Goods ';
        if (mappedSt === 'Services (FED in ST Mode)') return ' Services (FED in ST Mode) ';
        if (mappedSt === 'Services') return ' Services ';
        if (mappedSt === 'Processing/ Conversion of Goods') {
          if (prod.hsCode.startsWith('7204')) {
            return 'Ship breaking';
          } else if (prod.hsCode.startsWith('72')) {
            return 'Steel melting and re-rolling';
          }
          return 'Processing/Conversion of Goods';
        }
        return mappedSt;
      })(),
      sroItemSerialNo: prod.sroItemSerialNo || ''
    };

    itemPayload.totalValues = (() => {
      if (fbrSettings.sendTotalVal === true) {
        return roundTo2(rowNetValue + stAmt + itemFurtherTax + itemExtraTaxVal + itemFedPayable);
      }
      return 0.00;
    })();
    
    return itemPayload;
  });

  const payload = {
    invoiceType: invoiceType,
    invoiceDate: invoiceDate,
    sellerNTNCNIC: fbrSettings.sellerNTN ? fbrSettings.sellerNTN.replace(/-/g, '') : '',
    sellerBusinessName: fbrSettings.sellerName,
    sellerProvince: fbrSettings.sellerProvince,
    sellerAddress: fbrSettings.sellerAddress,
    buyerNTNCNIC: customer.ntn ? customer.ntn.replace(/-/g, '') : "9999997",
    buyerBusinessName: customer.partyName,
    buyerProvince: customer.province,
    buyerAddress: customer.address,
    buyerRegistrationType: customer.registrationType,
    invoiceRefNo: refNo,
    dataSource: "",
    items: items
  };

  // Add scenario ID only in sandbox environment
  if (fbrSettings.fbrEnvMode === 'sandbox') {
    payload.scenarioId = scenarioId;
  }

  return { payload, customer, items };
}

// Translates official FBR status error codes (DI API V1.12 spec pages 36-45)
function translateFbrErrorCode(code) {
  const codes = {
    // Sales Error Codes (Section 7 of PDF)
    "0001": "Seller not registered for sales tax. Please provide a valid seller NTN/registration.",
    "0002": "Invalid Buyer Registration No or NTN. Buyer registration number must be CNIC (13 digits) or NTN (7 or 9 digits).",
    "0003": "Invoice type is not valid or empty. Please provide a valid invoice type (Sale Invoice / Debit Note).",
    "0005": "Invoice date is not in proper format. Please provide date in YYYY-MM-DD format (e.g. 2025-05-25).",
    "0006": "Sales invoice does not exist against STWH.",
    "0007": "Selected invoice type is not associated with proper registration number. Please select correct invoice type.",
    "0008": "ST withheld at source should either be zero or same as sales tax/FED.",
    "0009": "Buyer Registration Number cannot be empty. Please provide proper buyer registration number.",
    "0010": "Buyer Name cannot be empty. Please provide a valid buyer name.",
    "0011": "Invoice type cannot be empty. Please provide a valid invoice type.",
    "0012": "Buyer Registration Type cannot be empty. Please provide valid Buyer Registration type.",
    "0013": "Sale type cannot be empty/null. Please provide a valid sale type.",
    "0018": "Sales Tax/FED cannot be empty. Please provide valid Sales Tax/FED in ST mode.",
    "0019": "HS Code cannot be empty. Please provide a valid HS Code.",
    "0020": "Rate field cannot be empty. Please provide a valid Rate.",
    "0021": "Value of Sales Excl. ST / Quantity cannot be empty. Please provide valid value.",
    "0022": "ST withheld at Source or STS Withheld cannot be empty. Please provide valid value.",
    "0023": "Sales Tax cannot be empty. Please provide valid Sales Tax.",
    "0024": "Sales Tax withheld cannot be empty. Please provide valid Sales Tax withheld.",
    "0026": "Invoice Reference No. is mandatory for debit/credit note. Please provide valid Invoice Reference No.",
    "0027": "Reason is mandatory for debit/credit note. Please provide valid reason.",
    "0028": "Reason is selected as 'Others'. Please provide valid remarks against this reason.",
    "0029": "Debit/Credit note date should be equal or greater from original invoice date.",
    "0030": "Unregistered distributer type not allowed before system cut-off date.",
    "0031": "Sales Tax is not mentioned. Please provide Sales Tax.",
    "0032": "User is not FTN holder. STWH can only be created for GOV/FTN Holders.",
    "0034": "Debit/Credit note can only be added within 180 days of invoice date of the original invoice.",
    "0035": "Note Date must be greater or equal to original invoice date.",
    "0036": "Credit Note Value of Sale must be less or equal to the value of Sale in original invoice.",
    "0037": "Credit Note Value of ST Withheld must be less or equal to the value of ST Withheld in original invoice.",
    "0039": "For registered users, STWH invoice fields must be same as sale invoice.",
    "0041": "Invoice number cannot be empty. Please provide invoice number.",
    "0042": "Invoice date cannot be empty. Please provide invoice date.",
    "0043": "Invoice date is not valid. Please provide valid invoice date.",
    "0044": "HS Code cannot be empty. Please provide HS Code.",
    "0046": "Rate cannot be empty. Please provide valid rate as per selected Sales Type.",
    "0050": "For sale type 'Cotton ginners', Sales Tax Withheld must be equal to Sales Tax or zero.",
    "0052": "HS Code does not match with provided sale type. Please provide valid HS Code against sale type.",
    "0053": "Buyer Registration Type is invalid. Please provide valid Buyer Registration Type.",
    "0055": "Sales tax withheld cannot be empty or invalid format. Please provide valid sales tax withheld.",
    "0056": "Buyer does not exist in steel sector.",
    "0057": "Reference invoice for debit/credit note does not exist. Please provide valid Invoice Reference No.",
    "0058": "Buyer and Seller Registration number are same. Self-invoicing not allowed for this invoice type.",
    "0059": "Declared price is less than the minimum notified price of steel sector (FBR Sandbox enforces 206,170 PKR per MT minimum notified floor value).",
    "0064": "Credit note is already added to this invoice. Reference invoice already exists.",
    "0067": "Sales Tax value of Debit Note is greater than original invoice's sales tax.",
    "0068": "Sales Tax value of Credit Note is less than original invoice's sales tax according to the rate.",
    "0070": "User is not registered. STWH is allowed only for registered users.",
    "0071": "Credit note allowed to add only for specific users. Entry against the declared invoice is not allowed.",
    "0073": "Sale Origination Province of Supplier cannot be empty. Please provide valid province.",
    "0074": "Destination of Supply cannot be empty. Please provide valid Destination of Supply.",
    "0077": "SRO/Schedule Number cannot be empty. Please provide valid SRO/Schedule Number.",
    "0078": "Item serial number cannot be empty. Please provide valid item serial number.",
    "0079": "If sales value is greater than 20,000 then rate 5% is not allowed.",
    "0080": "Further Tax cannot be empty. Please provide valid Further Tax.",
    "0081": "'Input Credit not Allowed' cannot be empty. Please provide 'Input Credit not Allowed'.",
    "0082": "The Seller is not registered for sales tax. Please provide a valid registration/NTN.",
    "0083": "Seller Reg No. doesn't match. Please provide valid Seller Registration Number.",
    "0085": "Total Value of Sales is not provided (In case of PFAD only). Please provide valid Total Value of Sales.",
    "0086": "You are not an EFS license holder who has imported Compressor Scrap in the last 12 months.",
    "0087": "Petroleum Levy rates not configured properly. Please update levy rates properly.",
    "0088": "Invoice number is not valid. Please provide valid invoice number in alphanumeric format (e.g. Inv-001).",
    "0089": "FED Charged cannot be empty. Please provide valid FED Charged.",
    "0090": "Fixed/notified value or Retail Price cannot be empty. Please provide valid value.",
    "0091": "Extra tax must be empty.",
    "0092": "Purchase type cannot be empty. Please provide valid purchase type.",
    "0093": "Selected Sale Type is not allowed for Manufacturer. Please select proper sale type.",
    "0095": "Extra Tax cannot be empty. Please provide valid extra tax.",
    "0096": "For provided HS Code, only KWH UOM is allowed.",
    "0097": "Please provide UOM in KG.",
    "0098": "Quantity / Electricity Unit cannot be empty. Please provide valid value.",
    "0099": "UOM is not valid. UOM must be according to given HS Code.",
    "0100": "Registered user cannot add sale invoice. Only cotton ginner sale type is allowed for registered users.",
    "0101": "Sale type is not selected properly. Please use Toll Manufacturing Sale Type for Steel Sector.",
    "0102": "The calculated sales tax not calculated as per 3rd schedule calculation formula.",
    "0103": "Calculated tax not matched for potassium chlorate.",
    "0104": "Calculated percentage of sales tax not matched. Calculation must be correct with respect to provided rate.",
    "0105": "The calculated sales tax for the quantity is incorrect.",
    "0106": "The Buyer is not registered for sales tax. Please provide a valid registration/NTN.",
    "0107": "Buyer Reg No. doesn't match. Please provide valid Buyer Registration Number.",
    "0108": "Seller Reg No. is not valid. Please provide valid Seller Registration Number/NTN.",
    "0109": "Invoice type is not selected properly. Please select proper invoice type.",
    "0111": "Purchase type is not selected properly. Please provide proper purchase type.",
    "0113": "Date is not in proper format. Please provide date in YYYY-MM-DD format (e.g. 2025-05-25).",
    "0300": "Provided decimal value is not valid. Check numeric fields (Discount, Total, Extra Tax, Further Tax, Fed Payable, Quantity, etc.).",
    // Authorization Error Codes (Section 7 of PDF, added in V1.12)
    "0401": "Unauthorized access: Seller registration number is not 13 digits (CNIC) or 7 digits (NTN), or authorized token does not exist for seller.",
    "0402": "Unauthorized access: Buyer registration number is not 13 digits (CNIC) or 7 digits (NTN), or authorized token does not exist for buyer.",
    "900901": "Invalid Credentials: The Authorization token is invalid or expired. Please verify your FBR Bearer Token in settings."
  };
  return codes[code] || `Compliance Error (${code}): Please consult the FBR Technical Specification document (DI API V1.12).`;
}

// Helper to extract detailed error code and description from FBR gateway response
function extractFbrError(response) {
  let errorCode = '';
  let errorMessage = '';
  
  if (response && response.data) {
    const res = response.data;
    
    // 1. FBR validationResponse structure
    if (res.validationResponse) {
      const valRes = res.validationResponse;
      errorCode = valRes.errorCode || '';
      errorMessage = valRes.error || '';
      
      // If no top-level error but invoiceStatuses contains items with errors
      if (!errorCode && valRes.invoiceStatuses && valRes.invoiceStatuses.length > 0) {
        const errStatus = valRes.invoiceStatuses.find(s => s.errorCode || s.error) || valRes.invoiceStatuses[0];
        if (errStatus) {
          errorCode = errStatus.errorCode || '';
          errorMessage = errStatus.error || '';
        }
      }
    }
    // 2. WSO2 API Gateway fault structure (e.g. 401 Unauthorized)
    else if (res.fault) {
      errorCode = res.fault.code ? String(res.fault.code) : '900901';
      errorMessage = res.fault.description || res.fault.message || '';
    }
    // 3. JSON parse error
    else if (res.parseError) {
      errorMessage = `JSON Parse Error: ${res.parseError}\nRaw Response: ${res.text}`;
    }
    // 4. Raw response text
    else if (res.text) {
      errorMessage = `Raw Response: ${res.text}`;
    }
  }
  
  // 5. Fallback to response.error (e.g. fetch network exception)
  if (!errorMessage && response && response.error) {
    errorMessage = response.error;
  }
  
  return {
    errorCode: String(errorCode || '').trim(),
    errorMessage: String(errorMessage || '').trim()
  };
}

// Pre-Flight Check (VALIDATE INVOICE)
async function executeValidateInvoice() {
  try {
    const { payload } = buildFbrPayload();
    const isSandbox = fbrSettings.fbrEnvMode === 'sandbox';
    
    // Choose endpoint
    const url = isSandbox 
      ? "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb" 
      : "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata";

    // Show loading inspector
    const inspector = document.getElementById('fbr-response-inspector');
    inspector.classList.add('active');
    
    const statusBadge = document.getElementById('response-status-badge');
    statusBadge.className = "inspector-badge";
    statusBadge.textContent = "VALIDATING...";
    
    const generalInfo = document.getElementById('response-general-info');
    generalInfo.innerHTML = `<p style="color: var(--text-secondary);">Connecting to FBR PRAL Enterprise Service Platform... Please wait.</p>`;
    
    const errorBox = document.getElementById('response-error-box');
    errorBox.style.display = 'none';
    document.getElementById('success-action-container').style.display = 'none';

    // Secure IPC fetch
    const response = await window.api.fbrRequest({
      url: url,
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'deflate, gzip',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Authorization': fbrSettings.fbrToken.toLowerCase().startsWith('bearer ') ? fbrSettings.fbrToken : `Bearer ${fbrSettings.fbrToken}`
      },
      body: payload
    });

    const res = response.data;
    const valRes = (res && res.validationResponse) || {};
    const status = (valRes.status || 'invalid').toLowerCase();
    
    if (response.success && status === 'valid') {
      statusBadge.className = "inspector-badge valid";
      statusBadge.textContent = "VALID";
      generalInfo.innerHTML = `
        <p><strong>FBR Validation Status:</strong> PRE-FLIGHT VERIFIED (SUCCESS)</p>
        <p><strong>Validation Timestamp:</strong> ${res.dated || new Date().toLocaleString()}</p>
        <p style="color: var(--success); margin-top: 8px;">Your invoice matches all FBR supply-chain schemas. Ready to post.</p>
      `;
    } else {
      statusBadge.className = "inspector-badge invalid";
      
      let dateString = (res && res.dated) || new Date().toLocaleString();
      
      if (response.status && response.status !== 200) {
        statusBadge.textContent = `HTTP ERROR (${response.status})`;
        generalInfo.innerHTML = `
          <p><strong>HTTP Status:</strong> ${response.status}</p>
          <p>The gateway returned a non-success HTTP status code.</p>
        `;
      } else {
        statusBadge.textContent = "INVALID";
        generalInfo.innerHTML = `
          <p><strong>FBR Validation Status:</strong> REJECTED (COMPLIANCE ERRORS)</p>
          <p><strong>Error Timestamp:</strong> ${dateString}</p>
        `;
      }

      const { errorCode, errorMessage } = extractFbrError(response);
      
      errorBox.style.display = 'block';
      errorBox.innerHTML = `
        <strong>FBR Return Code:</strong> ${errorCode || 'N/A'}<br>
        <strong>API Description:</strong> ${errorMessage || 'No error details returned by gateway.'}<br><br>
        <strong>Compliance Resolution:</strong> ${translateFbrErrorCode(errorCode)}
      `;
    }
  } catch (err) {
    alert("Form Validation Error: " + err.message);
  }
}

// Declare Invoice (POST INVOICE)
async function executePostInvoice() {
  try {
    const { payload, customer } = buildFbrPayload();
    const isSandbox = fbrSettings.fbrEnvMode === 'sandbox';
    
    // Choose endpoint
    const url = isSandbox 
      ? "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb" 
      : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata";

    // Show loading inspector
    const inspector = document.getElementById('fbr-response-inspector');
    inspector.classList.add('active');
    
    const statusBadge = document.getElementById('response-status-badge');
    statusBadge.className = "inspector-badge";
    statusBadge.textContent = "REPORTING...";
    
    const generalInfo = document.getElementById('response-general-info');
    generalInfo.innerHTML = `<p style="color: var(--text-secondary);">Uploading real-time invoice to Federal Board of Revenue... Please wait.</p>`;
    
    const errorBox = document.getElementById('response-error-box');
    errorBox.style.display = 'none';
    document.getElementById('success-action-container').style.display = 'none';

    // Secure IPC post
    const response = await window.api.fbrRequest({
      url: url,
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'deflate, gzip',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Authorization': fbrSettings.fbrToken.toLowerCase().startsWith('bearer ') ? fbrSettings.fbrToken : `Bearer ${fbrSettings.fbrToken}`
      },
      body: payload
    });

    const res = response.data;
    const valRes = (res && res.validationResponse) || {};
    const status = (valRes.status || 'invalid').toLowerCase();
    
    if (response.success && status === 'valid') {
      statusBadge.className = "inspector-badge valid";
      statusBadge.textContent = "DECLARED";
      
      const fbrInvNo = res.invoiceNumber || `FBR${Math.floor(100000 + Math.random() * 900000)}DI2026`;
      
      generalInfo.innerHTML = `
        <p><strong>FBR Upload Status:</strong> SUCCESS (INVOICE ARCHIVED)</p>
        <p><strong>FBR Issued Invoice Number:</strong> <span style="color: var(--accent-primary); font-weight:700;">${fbrInvNo}</span></p>
        <p><strong>Declaration Timestamp:</strong> ${res.dated || new Date().toLocaleString()}</p>
      `;
      
      // Compile invoice object to save in history log
      const calcs = recalculateInvoice();
      const totalNetValue = getNetItemsSubtotal();
      
      // Calculate sums for exact 3rd Schedule and standard taxable items tax allocation
      let thirdSchTaxSum = 0;
      let standardNetValSum = 0;
      invoiceItems.forEach(it => {
        const pId = document.getElementById(it.productSelect).value;
        if (!pId) return;
        const p = dbItemsList.find(x => x.id === Number(pId));
        if (!p) return;
        
        const itemSalesTaxRate = getSalesTaxRateForItem(p, invoiceTaxes);
        if (p.saleType === '3rd Schedule Goods' || p.taxedAtRetail === true) {
          const q = parseFloat(document.getElementById(it.qtyInput).value) || 0;
          const rpInput = document.getElementById(it.retailPriceInput);
          const rp = rpInput ? parseFloat(rpInput.value) || 0 : 0;
          thirdSchTaxSum += rp * q * (itemSalesTaxRate / 100);
        } else if (p.saleType !== 'Exempt goods' && p.saleType !== 'Goods at zero-rate') {
          const q = parseFloat(document.getElementById(it.qtyInput).value) || 0;
          const v = parseFloat(document.getElementById(it.valInput).value) || 0;
          const d = parseFloat(document.getElementById(it.discountInput).value) || 0;
          standardNetValSum += Math.max(0, (v * q) - d);
        }
      });

      const remainingSalesTax = Math.max(0, calcs.totalSalesTax - thirdSchTaxSum);
      
      const itemsToSave = invoiceItems.map(item => {
        const pId = Number(document.getElementById(item.productSelect).value);
        const pr = dbItemsList.find(x => x.id === pId);
        const qty = parseFloat(document.getElementById(item.qtyInput).value) || 0;
        const val = parseFloat(document.getElementById(item.valInput).value) || 0;
        const discountVal = parseFloat(document.getElementById(item.discountInput).value) || 0;
        
        const rowValExcl = val * qty;
        const rowNetValue = Math.max(0, rowValExcl - discountVal);
        const proportion = totalNetValue > 0 ? (rowNetValue / totalNetValue) : 0;
        
        const retailPrice = document.getElementById(item.retailPriceInput) ? parseFloat(document.getElementById(item.retailPriceInput).value) || 0 : 0;
        const itemSalesTaxRate = getSalesTaxRateForItem(pr, invoiceTaxes);
        
        let salesTax = 0;
        if (pr.saleType === 'Exempt goods' || pr.saleType === 'Goods at zero-rate') {
          salesTax = 0.00;
        } else if (pr.saleType === '3rd Schedule Goods' || pr.taxedAtRetail === true) {
          salesTax = retailPrice * qty * (itemSalesTaxRate / 100);
        } else if (pr.saleType.includes('Cement')) {
          salesTax = qty * itemSalesTaxRate;
        } else if (pr.saleType.includes('CNG Sales')) {
          salesTax = qty * itemSalesTaxRate;
        } else if (pr.saleType.includes('Potassium')) {
          const fixedRate = getFixedTaxRateForItem(pr, invoiceTaxes);
          salesTax = rowNetValue * (itemSalesTaxRate / 100) + qty * fixedRate;
        } else {
          const standardProportion = standardNetValSum > 0 ? (rowNetValue / standardNetValSum) : 0;
          salesTax = standardProportion * remainingSalesTax;
        }
        
        const furtherTax = proportion * calcs.furtherTaxAmt;
        const extraTax = proportion * calcs.totalExtraTax;
        const fedPayable = proportion * (calcs.totalFedAmt || 0);
        
        return {
          productId: pId,
          productDescription: pr.itemDesc,
          hsCode: pr.hsCode,
          uom: pr.uom,
          quantity: qty,
          rateValue: val,
          retailPrice: (pr.saleType === '3rd Schedule Goods' || pr.taxedAtRetail === true) ? retailPrice : 0.00,
          taxRatePercent: itemSalesTaxRate,
          extraTax: extraTax,
          furtherTax: furtherTax,
          fedPayable: fedPayable,
          discount: discountVal,
          valueSalesExcludingST: rowValExcl,
          salesTaxApplicable: salesTax,
          salesTaxWithheldAtSource: (() => {
            const itemWhTax = proportion * (calcs.totalWhTax || 0);
            if (calcs.totalWhTax > 0) {
              return itemWhTax;
            } else if (pr.saleType && pr.saleType.includes('Cotton')) {
              return salesTax;
            }
            return 0.00;
          })()
        };
      });
      
      const taxesToSave = [];
      Object.keys(calcs.taxesGroup).forEach(k => {
        const tg = calcs.taxesGroup[k];
        taxesToSave.push({
          taxType: k,
          ratePercent: tg.rate,
          taxNature: tg.taxNature,
          valueExcl: tg.invoiceValueExcl,
          taxAmt: tg.taxAmount
        });
      });
      
      const invoiceMaster = {
        invoiceNumber: fbrInvNo,
        invoiceDate: payload.invoiceDate,
        invoiceType: payload.invoiceType,
        buyerNTN: customer.ntn || '9999997',
        buyerName: customer.partyName,
        buyerProvince: customer.province,
        buyerRegistrationType: customer.registrationType,
        subtotalExcl: calcs.subtotalExcl,
        totalSalesTax: calcs.totalSalesTax,
        furtherTaxAmt: calcs.furtherTaxAmt,
        totalExtraTax: calcs.totalExtraTax,
        totalDiscount: calcs.totalDiscount,
        grandTotal: calcs.grandTotal,
        envMode: fbrSettings.fbrEnvMode,
        status: 'Posted',
        timestamp: res.dated || new Date().toLocaleString()
      };
      
      // Write master, detail items, and taxes breakdown to local DB!
      const savedId = await dbSaveInvoice(invoiceMaster, itemsToSave, taxesToSave);
      invoiceMaster.id = savedId;
      invoiceMaster.items = itemsToSave;
      invoiceMaster.taxesBreakdown = taxesToSave;
      
      activeInvoice = invoiceMaster;
      
      // Reveal modal print receipt button
      document.getElementById('success-action-container').style.display = 'block';
      
    } else {
      statusBadge.className = "inspector-badge invalid";
      
      let dateString = (res && res.dated) || new Date().toLocaleString();
      
      if (response.status && response.status !== 200) {
        statusBadge.textContent = `HTTP ERROR (${response.status})`;
        generalInfo.innerHTML = `
          <p><strong>HTTP Status:</strong> ${response.status}</p>
          <p>The gateway returned a non-success HTTP status code.</p>
        `;
      } else {
        statusBadge.textContent = "DECLARATION FAILED";
        generalInfo.innerHTML = `
          <p><strong>FBR Upload Status:</strong> REFUSED BY GATEWAY (COMPLIANCE BLOCK)</p>
          <p><strong>Error Timestamp:</strong> ${dateString}</p>
        `;
      }
      
      const { errorCode, errorMessage } = extractFbrError(response);
      
      errorBox.style.display = 'block';
      errorBox.innerHTML = `
        <strong>FBR Return Code:</strong> ${errorCode || 'N/A'}<br>
        <strong>API Description:</strong> ${errorMessage || 'No error details returned by gateway.'}<br><br>
        <strong>Compliance Resolution:</strong> ${translateFbrErrorCode(errorCode)}
      `;
    }
  } catch (err) {
    alert("Invoicing Error: " + err.message);
  }
}

// ==========================================
// HISTORY & DASHBOARD DATA RENDERERS
// ==========================================
async function loadHistory() {
  try {
    invoiceHistory = await dbGetInvoices();
  } catch (err) {
    console.error("Error loading invoice history from DB:", err);
  }
}

function renderHistory() {
  const tbody = document.getElementById('history-logs-tbody');
  tbody.innerHTML = '';
  
  if (invoiceHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px 0;">
          No reported invoices found in local database.
        </td>
      </tr>
    `;
    return;
  }
  
  invoiceHistory.forEach(inv => {
    const tr = document.createElement('tr');
    const isSandbox = inv.envMode === 'sandbox';
    
    tr.innerHTML = `
      <td>${inv.invoiceDate}</td>
      <td class="cell-bold" style="color: var(--text-primary);">${inv.invoiceNumber}</td>
      <td>${inv.buyerNTN}</td>
      <td>${inv.buyerName}</td>
      <td class="cell-bold">PKR ${inv.grandTotal.toFixed(2)}</td>
      <td>
        <span class="status-tag ${isSandbox ? 'sandbox' : 'success'}">
          ${inv.envMode.toUpperCase()}
        </span>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="viewHistoryInvoice(${inv.id})">
          🖨️ View & Print
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function viewHistoryInvoice(id) {
  try {
    const fullInv = await dbGetInvoiceFull(id);
    if (fullInv) {
      activeInvoice = fullInv;
      openReceiptModal();
    }
  } catch (err) {
    alert("Error loading invoice details: " + err.message);
  }
}

function renderDashboard() {
  // Update welcome header business profile
  document.getElementById('dashboard-welcome').textContent = `Suite: ${fbrSettings.sellerName}`;
  
  // Calculate statistics
  const count = invoiceHistory.length;
  document.getElementById('stat-total-invoices').textContent = count;
  
  let successCount = 0;
  let taxSum = 0;
  
  invoiceHistory.forEach(inv => {
    successCount++;
    taxSum += inv.totalSalesTax + inv.furtherTaxAmt;
  });
  
  document.getElementById('stat-success-rate').textContent = count > 0 ? "100%" : "100%";
  document.getElementById('stat-total-tax').textContent = `PKR ${taxSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Render active environment status
  const gateStatus = document.getElementById('stat-gateway-status');
  gateStatus.textContent = fbrSettings.fbrEnvMode === 'production' ? "PRODUCTION ACTIVE" : "SANDBOX ONLINE";
  gateStatus.style.color = fbrSettings.fbrEnvMode === 'production' ? "var(--success)" : "var(--warning)";

  // Render recent 3 items inside dashboard table
  const tbody = document.getElementById('dashboard-recent-tbody');
  tbody.innerHTML = '';
  
  if (invoiceHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px 0;">
          No reported invoices yet. Write your first invoice now.
        </td>
      </tr>
    `;
    return;
  }
  
  invoiceHistory.slice(0, 3).forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-bold">${inv.invoiceNumber}</td>
      <td>${inv.invoiceDate}</td>
      <td>${inv.buyerNTN}</td>
      <td class="cell-bold">PKR ${inv.grandTotal.toFixed(2)}</td>
      <td>
        <span class="status-tag success">SUCCESS</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// COMPLIANCE QR CODE & THERMAL PRINT MODAL
// ==========================================
function getHsCodeDescription(hsCode) {
  const code = String(hsCode).replace(/\./g, '');
  const mapping = {
    "84212100": "Filtering or purifying machinery and apparatus for water",
    "85414300": "Photovoltaic cells assembled in modules or made up into panels",
    "99841100": "Telecommunications services",
    "01012100": "Pure-bred breeding horses"
  };
  return mapping[code] || "Standard Commodity Item";
}

function openReceiptModal() {
  if (!activeInvoice) return;
  currentPdfFilename = `Invoice_${activeInvoice.invoiceNumber}`;

  // Reset modal title
  document.querySelector('#receipt-modal .modal-title').textContent = '🖨️ Compliant Invoice Print Preview';
  
  // Restore original modal body HTML in case it was overwritten by report or batch print
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (modalBody && originalReceiptModalBodyHTML) {
    modalBody.innerHTML = originalReceiptModalBodyHTML;
  }
  
  // Populate Seller
  document.getElementById('receipt-seller-name-header').textContent = fbrSettings.sellerName.toUpperCase();
  document.getElementById('receipt-seller-name').textContent = fbrSettings.sellerName.toUpperCase();
  document.getElementById('receipt-seller-ntn').textContent = fbrSettings.sellerNTN;
  document.getElementById('receipt-seller-province').textContent = fbrSettings.sellerProvince.toUpperCase();
  
  // Debit note check for source invoice
  const sourceInvoiceField = document.getElementById('receipt-source-invoice');
  if (sourceInvoiceField) {
    sourceInvoiceField.textContent = activeInvoice.invoiceType === 'Debit Note' ? (activeInvoice.invoiceRefNo || '-') : '-';
  }

  // Populate Invoice metadata
  document.getElementById('receipt-invoice-date').textContent = activeInvoice.invoiceDate;
  document.getElementById('receipt-fbr-invoice-no').textContent = activeInvoice.invoiceNumber;
  document.getElementById('receipt-invoice-type').textContent = activeInvoice.invoiceType;
  
  // Tax period
  const taxPeriodField = document.getElementById('receipt-tax-period');
  if (taxPeriodField) {
    taxPeriodField.textContent = activeInvoice.invoiceDate ? activeInvoice.invoiceDate.substring(0, 7).replace('-', '') : '';
  }
  
  // Insertion date
  const insertionDateField = document.getElementById('receipt-insertion-date');
  if (insertionDateField) {
    insertionDateField.textContent = activeInvoice.timestamp ? activeInvoice.timestamp.split(',')[0] : activeInvoice.invoiceDate;
  }
  
  // Status
  const statusField = document.getElementById('receipt-status');
  if (statusField) {
    statusField.textContent = 'Valid';
  }

  // Populate Buyer
  document.getElementById('receipt-buyer-ntn').textContent = activeInvoice.buyerNTN;
  document.getElementById('receipt-buyer-name').textContent = activeInvoice.buyerName.toUpperCase();
  document.getElementById('receipt-buyer-province').textContent = activeInvoice.buyerProvince.toUpperCase();

  // Populate Items Table
  const tbody = document.getElementById('receipt-items-tbody');
  tbody.innerHTML = '';
  
  let totalSalesValue = 0;
  let totalSalesTax = 0;
  let totalFurtherTax = 0;
  let totalExtraTax = 0;
  let totalDiscount = 0;
  let totalRetail = 0;
  let totalFed = 0;
  let totalWht = 0;
  
  activeInvoice.items.forEach((item, index) => {
    const pr = dbItemsList.find(x => x.id === item.productId) || {};
    const saleType = pr.saleType || "Goods at standard rate (default)";
    const sroSchedule = pr.sroScheduleNo || '';
    const sroSerial = pr.sroItemSerialNo || '';
    
    const qty = parseFloat(item.quantity) || 0;
    const valueExcl = parseFloat(item.valueSalesExcludingST || (item.rateValue * qty)) || 0;
    const salesTax = parseFloat(item.salesTaxApplicable || (valueExcl * (item.taxRatePercent / 100))) || 0;
    const discount = parseFloat(item.discount) || 0;
    const itemExtraTaxTotal = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;
    
    // Per-item Further Tax loaded from DB (or calculated on the fly as fallback)
    const furtherTax = item.furtherTax !== undefined 
      ? parseFloat(item.furtherTax) 
      : (item.furtherTaxAmt !== undefined 
          ? parseFloat(item.furtherTaxAmt) 
          : (activeInvoice.buyerRegistrationType === 'Unregistered' ? Math.max(0, valueExcl - discount) * 0.04 : 0));
      
    const retailPrice = parseFloat(item.retailPrice) || 0;
    const fed = parseFloat(item.fedPayable) || parseFloat(item.fed) || parseFloat(item.fedAmt) || 0;
    const wht = parseFloat(item.salesTaxWithheldAtSource) || parseFloat(item.salesTaxWithheld) || parseFloat(item.wht) || parseFloat(item.whTax) || 0;
    
    totalSalesValue += valueExcl;
    totalSalesTax += salesTax;
    totalFurtherTax += furtherTax;
    totalExtraTax += itemExtraTaxTotal;
    totalDiscount += discount;
    totalRetail += retailPrice * qty;
    totalFed += fed;
    totalWht += wht;
    
    const hsCodeDesc = getHsCodeDescription(item.hsCode);
    let lineRate = '';
    if (saleType.includes('Cement')) {
      lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 2}`;
    } else if (saleType.includes('CNG Sales')) {
      lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 200}`;
    } else if (item.taxRatePercent !== undefined) {
      lineRate = `${item.taxRatePercent}%`;
    } else {
      lineRate = item.rate || '';
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${index + 1}</td>
      <td>${item.hsCode}</td>
      <td style="white-space: normal; max-width: 150px; word-break: break-word;">${hsCodeDesc.toUpperCase()}</td>
      <td>${item.productDescription.toUpperCase()}</td>
      <td>${saleType}</td>
      <td style="text-align: center;">${qty}</td>
      <td>${item.uom}</td>
      <td style="text-align: center;">${lineRate}</td>
      <td style="text-align: right;">${valueExcl.toFixed(2)}</td>
      <td style="text-align: right;">${(retailPrice * qty).toFixed(2)}</td>
      <td style="text-align: right;">${salesTax.toFixed(2)}</td>
      <td style="text-align: right;">${itemExtraTaxTotal.toFixed(2)}</td>
      <td style="text-align: right;">${furtherTax.toFixed(2)}</td>
      <td style="text-align: right;">${fed.toFixed(2)}</td>
      <td style="text-align: right;">${wht.toFixed(2)}</td>
      <td style="text-align: right;">${discount.toFixed(2)}</td>
      <td>${sroSchedule}</td>
      <td>${sroSerial}</td>
      <td></td>
    `;
    tbody.appendChild(tr);
  });
  
  // Populate Totals
  document.getElementById('receipt-total-sales-value').textContent = totalSalesValue.toFixed(2);
  document.getElementById('receipt-total-retail').textContent = totalRetail.toFixed(2);
  document.getElementById('receipt-total-sales-tax').textContent = totalSalesTax.toFixed(2);
  document.getElementById('receipt-total-extra-tax').textContent = totalExtraTax.toFixed(2);
  document.getElementById('receipt-total-further-tax').textContent = totalFurtherTax.toFixed(2);
  document.getElementById('receipt-total-fed').textContent = totalFed.toFixed(2);
  document.getElementById('receipt-total-wht').textContent = totalWht.toFixed(2);
  document.getElementById('receipt-total-discount').textContent = totalDiscount.toFixed(2);
  
  // Generate QR Code pointing to FBR real-time portal
  const qrContainer = document.getElementById('qrcode');
  qrContainer.innerHTML = '';
  
  // DI API V1.12 spec: QR Code 1.0" x 1.0" (76px at 96 DPI in layout), Version 2.0 (25×25)
  new QRCode(qrContainer, {
    text: activeInvoice.invoiceNumber,
    width: 76,
    height: 76,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.M
  });

  // Activate Modal overlay
  document.getElementById('receipt-modal').classList.add('active');
}

function closeReceiptModal() {
  document.getElementById('receipt-modal').classList.remove('active');
}

async function triggerPrint() {
  const result = await window.api.printInvoice();
  if (result && !result.success) {
    alert("Printing encountered an error: " + result.error);
  }
}

async function triggerSavePDF() {
  try {
    const filename = currentPdfFilename || (activeInvoice ? activeInvoice.invoiceNumber : 'Document');
    const result = await window.api.savePDF(filename);
    if (result) {
      if (result.success) {
        alert("PDF successfully saved.");
      } else if (result.error !== 'User canceled') {
        alert("Saving PDF encountered an error: " + result.error);
      }
    }
  } catch (err) {
    alert("An error occurred while generating PDF: " + err.message);
  }
}

// ==========================================
// REPORTS CONTROLLER & ENGINE
// ==========================================
let reportsExpanded = true;
window.toggleReportsSubmenu = function() {
  reportsExpanded = !reportsExpanded;
  const submenu = document.getElementById('reports-submenu');
  const chevron = document.getElementById('reports-chevron');
  if (submenu) submenu.style.display = reportsExpanded ? 'flex' : 'none';
  if (chevron) chevron.style.transform = reportsExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.initReports = async function(prefix = 'print') {
  await refreshDatabaseLists();
  
  // Set default dates if not set
  const fromInput = document.getElementById(`${prefix}-from-date`);
  const toInput = document.getElementById(`${prefix}-to-date`);
  
  if (fromInput && !fromInput.value) {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    fromInput.value = firstDay;
  }
  if (toInput && !toInput.value) {
    toInput.value = new Date().toISOString().split('T')[0];
  }
  
  // Populate Company
  const companySelect = document.getElementById(`${prefix}-company`);
  if (companySelect) {
    companySelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = fbrSettings.sellerNTN || '3653258';
    opt.textContent = fbrSettings.sellerName || 'Vertex Medical (Pvt) Limited';
    companySelect.appendChild(opt);
  }
  
  // Populate Customer
  const customerSelect = document.getElementById(`${prefix}-customer`);
  if (customerSelect) {
    customerSelect.innerHTML = '<option value="">-- All Customers --</option>';
    dbCustomersList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.partyName;
      opt.textContent = c.partyName;
      customerSelect.appendChild(opt);
    });
  }
  
  if (prefix === 'print') {
    await onPrintFilterChange();
  } else {
    await onReportFilterChange();
  }
};

window.onPrintFilterChange = async function() {
  const customerVal = document.getElementById('print-customer').value;
  const fromDate = document.getElementById('print-from-date').value;
  const toDate = document.getElementById('print-to-date').value;
  
  await loadHistory();
  
  const filtered = invoiceHistory.filter(inv => {
    if (customerVal && inv.buyerName !== customerVal) return false;
    const invDateStr = inv.invoiceDate;
    if (fromDate && invDateStr < fromDate) return false;
    if (toDate && invDateStr > toDate) return false;
    return true;
  });
  
  const invSelect = document.getElementById('print-invoice-select');
  const prevVal = invSelect ? invSelect.value : '';
  if (invSelect) {
    invSelect.innerHTML = '<option value="">-- Print All Matching Invoices --</option>';
    filtered.forEach(inv => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = inv.invoiceNumber;
      invSelect.appendChild(opt);
    });
    if (prevVal && filtered.some(x => x.id == prevVal)) {
      invSelect.value = prevVal;
    }
  }
  
  const selectedInvoiceId = invSelect ? invSelect.value : '';
  const finalInvoices = selectedInvoiceId 
    ? filtered.filter(x => x.id == selectedInvoiceId) 
    : filtered;
  
  const tbody = document.getElementById('print-list-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (finalInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
            No matching invoices found.
          </td>
        </tr>
      `;
      return;
    }
    
    finalInvoices.forEach(inv => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${inv.invoiceNumber}</strong></td>
        <td>${inv.invoiceDate}</td>
        <td>${inv.buyerName}</td>
        <td style="text-align: right;">${(inv.subtotalExcl || 0).toFixed(2)}</td>
        <td style="text-align: right;">${(inv.totalSalesTax || 0).toFixed(2)}</td>
        <td style="text-align: right;">${(inv.furtherTaxAmt || 0).toFixed(2)}</td>
        <td style="text-align: right;"><strong>${(inv.grandTotal || 0).toFixed(2)}</strong></td>
        <td style="text-align: center;">
          <span class="status-tag success">Posted</span>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewHistoryInvoice(${inv.id})">👁️ Preview</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
};

window.onReportFilterChange = async function() {
  const customerVal = document.getElementById('report-customer').value;
  const fromDate = document.getElementById('report-from-date').value;
  const toDate = document.getElementById('report-to-date').value;
  const selectedInvoiceId = document.getElementById('report-invoice-select').value;
  
  await loadHistory();
  
  const matchingInvoices = invoiceHistory.filter(inv => {
    if (customerVal && inv.buyerName !== customerVal) return false;
    const invDateStr = inv.invoiceDate;
    if (fromDate && invDateStr < fromDate) return false;
    if (toDate && invDateStr > toDate) return false;
    return true;
  });
  
  const invSelect = document.getElementById('report-invoice-select');
  const prevVal = invSelect ? invSelect.value : '';
  if (invSelect) {
    invSelect.innerHTML = '<option value="">-- All Matching Invoices --</option>';
    matchingInvoices.forEach(inv => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = inv.invoiceNumber;
      invSelect.appendChild(opt);
    });
    if (prevVal && matchingInvoices.some(x => x.id == prevVal)) {
      invSelect.value = prevVal;
    }
  }
  
  const finalInvoices = selectedInvoiceId 
    ? matchingInvoices.filter(x => x.id == selectedInvoiceId) 
    : matchingInvoices;
    
  const fullInvoices = [];
  for (const inv of finalInvoices) {
    const full = await dbGetInvoiceFull(inv.id);
    if (full) {
      fullInvoices.push(full);
    }
  }
  
  const tbody = document.getElementById('report-details-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (fullInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
            No sale details found matching the criteria.
          </td>
        </tr>
      `;
      return;
    }
    
    fullInvoices.forEach(inv => {
      const items = inv.items || [];
      items.forEach(item => {
        let lineRate = '';
        const itemSaleType = item.saleType || '';
        if (itemSaleType.includes('Cement')) {
          lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 2}`;
        } else if (itemSaleType.includes('CNG Sales')) {
          lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 200}`;
        } else if (item.taxRatePercent !== undefined) {
          lineRate = `${item.taxRatePercent}%`;
        } else {
          lineRate = item.rate || '';
        }

        const tr = document.createElement('tr');
        const totalVal = (item.valueSalesExcludingST || 0) + (item.salesTaxApplicable || 0) + (item.furtherTax || 0);
        tr.innerHTML = `
          <td>${inv.invoiceDate}</td>
          <td><strong>${inv.invoiceNumber}</strong></td>
          <td>${inv.buyerName}</td>
          <td>${item.productDescription}</td>
          <td>${item.hsCode}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${(item.valueSalesExcludingST || 0).toFixed(2)}</td>
          <td style="text-align: center;">${lineRate}</td>
          <td style="text-align: right;">${(item.salesTaxApplicable || 0).toFixed(2)}</td>
          <td style="text-align: right;">${(item.furtherTax || 0).toFixed(2)}</td>
          <td style="text-align: right;"><strong>${totalVal.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    });
  }
};

window.printFilteredInvoices = async function() {
  const select = document.getElementById('print-invoice-select');
  const selectedId = select ? select.value : '';
  
  if (selectedId) {
    // Print single invoice
    const full = await dbGetInvoiceFull(selectedId);
    if (full) {
      activeInvoice = full;
      openReceiptModal();
      triggerPrint();
    }
    return;
  }
  
  // Print multiple invoices
  const customerVal = document.getElementById('print-customer').value;
  const fromDate = document.getElementById('print-from-date').value;
  const toDate = document.getElementById('print-to-date').value;
  
  await loadHistory();
  const filtered = invoiceHistory.filter(inv => {
    if (customerVal && inv.buyerName !== customerVal) return false;
    const invDateStr = inv.invoiceDate;
    if (fromDate && invDateStr < fromDate) return false;
    if (toDate && invDateStr > toDate) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    alert("No invoices found to print.");
    return;
  }
  
  currentPdfFilename = `Batch_Invoices_${fromDate || 'Start'}_to_${toDate || 'End'}`;
  
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (!modalBody) return;
  
  modalBody.innerHTML = '<div id="multiple-invoices-print-container" style="background-color: #ffffff; color: #000000; padding: 20px;"></div>';
  const container = document.getElementById('multiple-invoices-print-container');
  
  for (const inv of filtered) {
    const full = await dbGetInvoiceFull(inv.id);
    if (!full) continue;
    
    const card = document.createElement('div');
    card.className = 'fbr-invoice-card';
    card.style.pageBreakAfter = 'always';
    card.style.border = 'none';
    card.style.boxShadow = 'none';
    card.style.marginBottom = '40px';
    card.style.backgroundColor = '#ffffff';
    card.style.color = '#000000';
    
    let itemsHtml = '';
    let totalSalesValue = 0;
    let totalRetail = 0;
    let totalSalesTax = 0;
    let totalExtraTax = 0;
    let totalFurtherTax = 0;
    let totalFed = 0;
    let totalWht = 0;
    let totalDiscount = 0;
    
    (full.items || []).forEach((item, index) => {
      const qty = parseFloat(item.quantity) || 0;
      const valueExcl = parseFloat(item.valueSalesExcludingST) || 0;
      const salesTax = parseFloat(item.salesTaxApplicable) || 0;
      const discount = parseFloat(item.discount) || 0;
      const extraTax = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;
      const furtherTax = parseFloat(item.furtherTax) || 0;
      const fed = parseFloat(item.fedPayable) || 0;
      const wht = parseFloat(item.salesTaxWithheldAtSource) || 0;
      const retailPrice = parseFloat(item.retailPrice) || 0;
      
      totalSalesValue += valueExcl;
      totalSalesTax += salesTax;
      totalFurtherTax += furtherTax;
      totalExtraTax += extraTax;
      totalDiscount += discount;
      totalRetail += retailPrice * qty;
      totalFed += fed;
      totalWht += wht;
      
      const hsCodeDesc = getHsCodeDescription(item.hsCode);
      let lineRate = '';
      const itemSaleType = item.saleType || '';
      if (itemSaleType.includes('Cement')) {
        lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 2}`;
      } else if (itemSaleType.includes('CNG Sales')) {
        lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 200}`;
      } else if (item.taxRatePercent !== undefined) {
        lineRate = `${item.taxRatePercent}%`;
      } else {
        lineRate = item.rate || '';
      }
      
      itemsHtml += `
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 4px;">${index + 1}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.hsCode}</td>
          <td style="border: 1px solid #000; padding: 4px;">${hsCodeDesc.toUpperCase()}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.productDescription.toUpperCase()}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.saleType || ''}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 4px;">${qty}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.uom}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 4px;">${lineRate}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${valueExcl.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${(retailPrice * qty).toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${salesTax.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${extraTax.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${furtherTax.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${fed.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${wht.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${discount.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.sroScheduleNo || ''}</td>
          <td style="border: 1px solid #000; padding: 4px;">${item.sroItemSerialNo || ''}</td>
          <td style="border: 1px solid #000; padding: 4px;">Valid</td>
        </tr>
      `;
    });
    
    card.innerHTML = `
      <div class="invoice-top-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; color: #000;">
        <div class="seller-big-name" style="font-size: 18px; font-weight: bold;">${(fbrSettings.sellerName || 'VERTEX MEDICAL (PVT) LIMITED').toUpperCase()}</div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="fbrdigitalinvoicesystemlogo.png" alt="FBR Digital Invoicing System Logo" width="76" height="76" style="display: block; object-fit: contain;">
          <div id="qrcode-${inv.id}" style="width: 76px; height: 76px; background: #fff;"></div>
        </div>
      </div>
      <div class="info-columns-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; color: #000; font-size: 10px;">
        <div class="info-col" style="border: 1px solid #ddd; padding: 8px; background: #fcfcfc;">
          <h3 style="margin-top: 0; font-size: 11px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Seller Information</h3>
          <div><strong>Business Name:</strong> ${(fbrSettings.sellerName || 'VERTEX MEDICAL (PVT) LIMITED').toUpperCase()}</div>
          <div><strong>Registration No.:</strong> ${fbrSettings.sellerNTN || '3653258'}</div>
          <div><strong>Province:</strong> ${(fbrSettings.sellerProvince || 'Punjab').toUpperCase()}</div>
        </div>
        <div class="info-col" style="border: 1px solid #ddd; padding: 8px; background: #fcfcfc;">
          <h3 style="margin-top: 0; font-size: 11px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Buyer Information</h3>
          <div><strong>Business Name:</strong> ${full.buyerName}</div>
          <div><strong>Registration No.:</strong> ${full.buyerNTN}</div>
          <div><strong>Province:</strong> ${full.buyerProvince}</div>
        </div>
        <div class="info-col" style="border: 1px solid #ddd; padding: 8px; background: #fcfcfc;">
          <h3 style="margin-top: 0; font-size: 11px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Invoice Summary</h3>
          <div><strong>FBR Invoice No.:</strong> <strong>${full.invoiceNumber}</strong></div>
          <div><strong>Invoice Date:</strong> ${full.invoiceDate}</div>
          <div><strong>Invoice Type:</strong> ${full.invoiceType}</div>
          <div><strong>Grand Total:</strong> <strong>PKR ${full.grandTotal.toFixed(2)}</strong></div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 8px; margin: 12px 0; color: #000;">
        <thead>
          <tr style="background: #f1f1f1;">
            <th style="border: 1px solid #000; padding: 4px;">Sr. No.</th>
            <th style="border: 1px solid #000; padding: 4px;">HS Code</th>
            <th style="border: 1px solid #000; padding: 4px;">HS Code Description</th>
            <th style="border: 1px solid #000; padding: 4px;">Product Description</th>
            <th style="border: 1px solid #000; padding: 4px;">Sales Type</th>
            <th style="border: 1px solid #000; padding: 4px;">Qty</th>
            <th style="border: 1px solid #000; padding: 4px;">UoM</th>
            <th style="border: 1px solid #000; padding: 4px;">Rate</th>
            <th style="border: 1px solid #000; padding: 4px;">Sales Value</th>
            <th style="border: 1px solid #000; padding: 4px;">Retail Price</th>
            <th style="border: 1px solid #000; padding: 4px;">Sales Tax</th>
            <th style="border: 1px solid #000; padding: 4px;">Extra Tax</th>
            <th style="border: 1px solid #000; padding: 4px;">Further Tax</th>
            <th style="border: 1px solid #000; padding: 4px;">FED</th>
            <th style="border: 1px solid #000; padding: 4px;">ST WHT</th>
            <th style="border: 1px solid #000; padding: 4px;">Discount</th>
            <th style="border: 1px solid #000; padding: 4px;">SRO No.</th>
            <th style="border: 1px solid #000; padding: 4px;">SRO Sr. No.</th>
            <th style="border: 1px solid #000; padding: 4px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background: #fafafa;">
            <td colspan="8" style="text-align: right; border: 1px solid #000; padding: 4px;">Total:</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalSalesValue.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalRetail.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalSalesTax.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalExtraTax.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalFurtherTax.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalFed.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalWht.toFixed(2)}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px;">${totalDiscount.toFixed(2)}</td>
            <td colspan="3" style="border: 1px solid #000;"></td>
          </tr>
        </tfoot>
      </table>
    `;
    
    container.appendChild(card);
    
    const qrBox = document.getElementById(`qrcode-${inv.id}`);
    if (qrBox) {
      new QRCode(qrBox, {
        text: full.invoiceNumber,
        width: 76,
        height: 76,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
      });
    }
  }
  
  document.querySelector('#receipt-modal .modal-title').textContent = `🖨️ Batch Invoice Print Preview (${filtered.length} Invoices)`;
  document.getElementById('receipt-modal').classList.add('active');
  
  triggerPrint();
};

window.printSalesDetailsReport = async function() {
  const customerVal = document.getElementById('report-customer').value;
  const fromDate = document.getElementById('report-from-date').value;
  const toDate = document.getElementById('report-to-date').value;
  const selectedInvoiceId = document.getElementById('report-invoice-select').value;
  
  await loadHistory();
  const matchingInvoices = invoiceHistory.filter(inv => {
    if (customerVal && inv.buyerName !== customerVal) return false;
    const invDateStr = inv.invoiceDate;
    if (fromDate && invDateStr < fromDate) return false;
    if (toDate && invDateStr > toDate) return false;
    return true;
  });
  
  const finalInvoices = selectedInvoiceId 
    ? matchingInvoices.filter(x => x.id == selectedInvoiceId) 
    : matchingInvoices;
    
  if (finalInvoices.length === 0) {
    alert("No sale details found to print.");
    return;
  }
  
  currentPdfFilename = `Sales_Details_Report_${fromDate || 'Start'}_to_${toDate || 'End'}`;
  
  const fullInvoices = [];
  for (const inv of finalInvoices) {
    const full = await dbGetInvoiceFull(inv.id);
    if (full) {
      fullInvoices.push(full);
    }
  }
  
  let reportRowsHtml = '';
  let grandTotalSalesVal = 0;
  let grandTotalSalesTax = 0;
  let grandTotalFurtherTax = 0;
  let grandTotalAmount = 0;
  
  fullInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const rowValExcl = item.valueSalesExcludingST || 0;
      const salesTax = item.salesTaxApplicable || 0;
      const furtherTax = item.furtherTax || 0;
      const totalVal = rowValExcl + salesTax + furtherTax;
      
      grandTotalSalesVal += rowValExcl;
      grandTotalSalesTax += salesTax;
      grandTotalFurtherTax += furtherTax;
      grandTotalAmount += totalVal;
      
      let lineRate = '';
      const itemSaleType = item.saleType || '';
      if (itemSaleType.includes('Cement')) {
        lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 2}`;
      } else if (itemSaleType.includes('CNG Sales')) {
        lineRate = `Rs.${item.taxRatePercent !== undefined ? item.taxRatePercent : 200}`;
      } else if (item.taxRatePercent !== undefined) {
        lineRate = `${item.taxRatePercent}%`;
      } else {
        lineRate = item.rate || '';
      }

      reportRowsHtml += `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${inv.invoiceDate}</td>
          <td style="border: 1px solid #000; padding: 6px;"><strong>${inv.invoiceNumber}</strong></td>
          <td style="border: 1px solid #000; padding: 6px;">${inv.buyerName}</td>
          <td style="border: 1px solid #000; padding: 6px;">${item.productDescription}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.hsCode}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.quantity}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">${rowValExcl.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${lineRate}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">${salesTax.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">${furtherTax.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${totalVal.toFixed(2)}</td>
        </tr>
      `;
    });
  });
  
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (!modalBody) return;
  
  modalBody.innerHTML = `
    <div style="background-color: #ffffff; color: #000000; padding: 30px; font-family: Arial, sans-serif;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">Detailed Sale Invoice Report</h2>
        <div style="font-size: 13px; margin-top: 6px; color: #555;">
          <strong>Seller:</strong> ${(fbrSettings.sellerName || 'VERTEX MEDICAL (PVT) LIMITED').toUpperCase()} (NTN: ${fbrSettings.sellerNTN || '3653258'})
        </div>
        <div style="font-size: 12px; margin-top: 4px; color: #555;">
          <strong>Date Range:</strong> ${fromDate || 'Start'} to ${toDate || 'End'}
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; color: #000;">
        <thead>
          <tr style="background: #f1f1f1; font-weight: bold;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center;">Date</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Invoice #</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Buyer Name</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">Product Description</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center;">HS Code</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center;">Qty</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: right;">Value Excl. ST (PKR)</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center;">Tax Rate</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: right;">Sales Tax (PKR)</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: right;">Further Tax (PKR)</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: right;">Grand Total (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${reportRowsHtml}
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background: #fafafa; font-size: 11px;">
            <td colspan="6" style="border: 1px solid #000; padding: 8px; text-align: right;">Grand Total:</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${grandTotalSalesVal.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 8px;"></td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${grandTotalSalesTax.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${grandTotalFurtherTax.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${grandTotalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
  
  document.querySelector('#receipt-modal .modal-title').textContent = '🖨️ Detailed Sales Report Print Preview';
  document.getElementById('receipt-modal').classList.add('active');
  
  triggerPrint();
};
