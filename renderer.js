// ==========================================
// CORE FRONTEND CONTROLLER (FBR INVOICING)
// ==========================================

// Global state variables
let currentPanel = 'dashboard';
let invoiceItems = [];
let invoiceTaxes = [];
let activeCompanyId = Number(localStorage.getItem('active-company-id')) || 1;
let editingCompanyId = activeCompanyId;
let allCompanies = [];
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
let activeDraftId = null;  // Track currently active draft ID (if editing a draft)

// Replace native thread-blocking alert with custom premium non-blocking toast notifications
window.alert = function (message) {
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

window.showConfirm = function (message, title = "⚠️ Confirm Action", confirmText = "Delete") {
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

window.confirmModalCallback = function (value) {
  document.getElementById('confirm-modal').classList.remove('active');
  if (confirmResolve) {
    confirmResolve(value);
    confirmResolve = null;
  }
};

window.closeConfirmModal = function () {
  window.confirmModalCallback(false);
};

let originalReceiptModalBodyHTML = '';
let currentPdfFilename = '';
let selectedTemplate = 'Standard';

// ==========================================
// LICENSE & SUBSCRIPTION ENGINE (SUPABASE)
// ==========================================
const SUPABASE_URL = "https://tfzrgknjxldxtoqfhxql.supabase.co"; // Replace with your project URL
const SUPABASE_ANON_KEY = "sb_publishable_HZm68QWmeNT5g8DHsgX1vQ_NuaJ1QSh"; // Replace with your anon key

async function supabaseFetch(endpoint, method = 'GET', body = null, token = null) {
  const url = `${SUPABASE_URL}${endpoint}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP Error ${response.status}`);
  }
  return await response.json();
}

async function loginLicenseUser(email, password) {
  try {
    const data = await supabaseFetch('/auth/v1/token?grant_type=password', 'POST', {
      email,
      password
    });

    if (data && data.access_token) {
      localStorage.setItem('license_token', data.access_token);
      localStorage.setItem('license_email', email);
      return data;
    }
    throw new Error("Invalid response from server");
  } catch (err) {
    console.error("Login failed:", err);
    throw err;
  }
}

async function fetchLicenseProfile(token, userId) {
  try {
    const profiles = await supabaseFetch(`/rest/v1/profiles?id=eq.${userId}&select=*`, 'GET', null, token);
    if (profiles && profiles.length > 0) {
      return profiles[0];
    }
    throw new Error("No client profile found");
  } catch (err) {
    console.error("Fetch profile failed:", err);
    throw err;
  }
}

async function checkLicenseStatus() {
  console.log("checkLicenseStatus() checking local license state. Email:", localStorage.getItem('license_email'));
  const email = localStorage.getItem('license_email');
  const token = localStorage.getItem('license_token');
  const cachedExpiry = localStorage.getItem('license_cached_expiry');
  const cachedActive = localStorage.getItem('license_cached_active') === 'true';

  const lockOverlay = document.getElementById('license-lock-overlay');
  const lockMessage = document.getElementById('license-lock-message');

  const licenseEmailField = document.getElementById('license-email');
  const licenseStatusField = document.getElementById('license-status');
  const licenseExpiryField = document.getElementById('license-expiry');
  const btnActivate = document.getElementById('btn-license-activate');
  const btnLogout = document.getElementById('btn-license-logout');

  const updateSettingsFields = (emailVal, statusVal, expiryVal, active) => {
    if (licenseEmailField) licenseEmailField.value = emailVal || 'Not Activated';
    if (licenseStatusField) {
      licenseStatusField.value = statusVal;
      if (active) {
        licenseStatusField.className = "form-control license-active-text";
      } else {
        licenseStatusField.className = "form-control license-expired-text";
      }
    }
    if (licenseExpiryField) licenseExpiryField.value = expiryVal || 'N/A';
    if (btnActivate) btnActivate.style.display = active ? 'none' : 'inline-block';
    if (btnLogout) btnLogout.style.display = active ? 'inline-block' : 'none';
  };

  // Developer bypass check if settings are defaults
  if (SUPABASE_URL.includes("your-project-id") || SUPABASE_ANON_KEY.includes("your-anon-key")) {
    console.warn("Developer bypass check: Default Supabase URL or Anon key detected. Running in Demo Mode.");
    if (lockOverlay) {
      lockOverlay.style.display = 'none';
    }
    updateSettingsFields('developer@demo.com', 'ACTIVE (BYPASS DEMO)', '2030-12-31', true);
    return true;
  }

  // 1. Auth credentials check
  if (!email || !token || !cachedExpiry) {
    console.log("checkLicenseStatus() credentials missing. Showing lockOverlay.");
    if (lockOverlay) {
      lockOverlay.style.display = 'flex';
      if (lockMessage) {
        lockMessage.textContent = 'Please activate your client license to use the Pakistan FBR Digital Invoicing application.';
      }
    }
    updateSettingsFields('', 'Not Activated', '', false);
    return false;
  }

  // 2. Active subscription check
  if (!cachedActive) {
    if (lockOverlay) {
      lockOverlay.style.display = 'flex';
      if (lockMessage) {
        lockMessage.textContent = 'Your subscription is currently inactive. Please contact your system administrator to activate it.';
      }
    }
    updateSettingsFields(email, 'INACTIVE', cachedExpiry, false);
    return false;
  }

  // 3. Expiry date check (strictly local check: is cached date in the future?)
  const now = new Date();
  const expiryDate = new Date(cachedExpiry);
  expiryDate.setHours(23, 59, 59, 999);

  if (now > expiryDate) {
    if (lockOverlay) {
      lockOverlay.style.display = 'flex';
      if (lockMessage) {
        lockMessage.innerHTML = `Your application license has expired on <strong style="color: #ef4444;">${cachedExpiry}</strong>. Please renew your subscription.`;
      }
    }
    updateSettingsFields(email, 'EXPIRED', cachedExpiry, false);
    return false;
  }

  // License is active and valid
  if (lockOverlay) {
    lockOverlay.style.display = 'none';
  }
  updateSettingsFields(email, 'ACTIVE', cachedExpiry, true);
  return true;
}

window.openLoginModal = function () {
  console.log("openLoginModal() called");
  const modal = document.getElementById('license-login-modal');
  if (modal) {
    modal.classList.add('active');
  }
  const errorMsg = document.getElementById('login-error-msg');
  if (errorMsg) errorMsg.style.display = 'none';
};

window.closeLoginModal = function () {
  console.log("closeLoginModal() called");
  const modal = document.getElementById('license-login-modal');
  if (modal) {
    modal.classList.remove('active');
  }
};

window.submitLicenseLogin = async function () {
  const emailInput = document.getElementById('login-email');
  const keyInput = document.getElementById('login-key');
  const errorMsg = document.getElementById('login-error-msg');
  const submitBtn = document.getElementById('btn-submit-login');

  const email = emailInput.value.trim();
  const password = keyInput.value.trim();

  if (!email || !password) {
    alert("Please fill in both fields.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Verifying...";
  errorMsg.style.display = 'none';

  try {
    // 1. Authenticate with Supabase once to acquire access token
    const authData = await loginLicenseUser(email, password);
    const token = authData.access_token;

    // 2. Decode user id from JWT token payload
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join('')));

    const userId = payload.sub;

    // 3. Fetch client profile from Supabase
    const profile = await fetchLicenseProfile(token, userId);

    if (!profile || !profile.expiry_date) {
      throw new Error("Invalid license profile or missing expiry date.");
    }

    // 4. Save license state in localStorage for fast local offline validation
    localStorage.setItem('license_token', token);
    localStorage.setItem('license_email', email);
    localStorage.setItem('license_cached_active', (profile.is_active === true).toString());
    localStorage.setItem('license_cached_expiry', profile.expiry_date || '');

    // 5. Evaluate license status locally
    const checkPassed = await checkLicenseStatus();

    if (checkPassed) {
      alert("License activated successfully!");
      closeLoginModal();
      emailInput.value = '';
      keyInput.value = '';

      // Immediately refresh settings, database lists, and dashboard data
      await loadSettings();
      await refreshDatabaseLists();
      await loadHistory();
      renderDashboard();
    } else {
      errorMsg.textContent = "Your license is inactive or expired.";
      errorMsg.style.display = 'block';
      localStorage.removeItem('license_token');
      localStorage.removeItem('license_email');
      localStorage.removeItem('license_cached_active');
      localStorage.removeItem('license_cached_expiry');
    }
  } catch (err) {
    console.error("Activation error:", err);
    errorMsg.textContent = "Incorrect email or password. Please try again.";
    errorMsg.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Activate License";
  }
};

window.logoutLicense = async function () {
  if (await showConfirm("Are you sure you want to log out and deactivate this client license?", "Confirm License Deactivation", "Deactivate")) {
    localStorage.removeItem('license_token');
    localStorage.removeItem('license_email');
    localStorage.removeItem('license_cached_active');
    localStorage.removeItem('license_cached_expiry');
    alert("License deactivated.");
    await checkLicenseStatus();
  }
};

// Default values on load
document.addEventListener('DOMContentLoaded', async () => {
  // Store receipt modal body HTML to restore it when rendering single invoices
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (modalBody) {
    originalReceiptModalBodyHTML = modalBody.innerHTML;
  }

  // Bind logo input listeners
  const sellerLogoInput = document.getElementById('seller-logo-input');
  if (sellerLogoInput) {
    sellerLogoInput.addEventListener('change', handleCompanyLogoSelect);
  }
  const custLogoInput = document.getElementById('cust-logo-input');
  if (custLogoInput) {
    custLogoInput.addEventListener('change', handleCustomerLogoSelect);
  }

  // Wait for IndexedDB database and seed data initialization to complete
  if (window.dbInitializationPromise) {
    await window.dbInitializationPromise;
  }

  // 1. Load local database data first and render immediately (0ms delay)
  await loadSettings();
  await refreshDatabaseLists();
  await loadHistory();

  // Initialize dynamic item table with one default row
  resetInvoiceForm();

  // Set default invoice date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('invoice-date').value = today;

  // Load saved column visibilities from localStorage or set defaults on launch
  const defaultVisibilities = {
    'hscode': true,
    'saletype': true,
    'retail': false,
    'discount': true,
    'furthertax': false,
    'extratax': false,
    'whtax': false,
    'fedtax': false,
    'fixedtax': false
  };

  Object.keys(defaultVisibilities).forEach(k => {
    const saved = localStorage.getItem(`col_visible_${k}`);
    if (saved !== null) {
      setColumnVisibility(k, saved === 'true', false);
    } else {
      setColumnVisibility(k, defaultVisibilities[k], true);
    }
  });

  // Render dashboard stats immediately
  renderDashboard();

  // 2. Run local subscription license verification checks (instant local date comparison)
  await checkLicenseStatus();

  // Disable scroll wheel changing numeric inputs
  document.addEventListener('wheel', (e) => {
    if (document.activeElement && document.activeElement.type === 'number') {
      e.preventDefault();
    }
  }, { passive: false });

  // Initialize auto-updater UI listeners
  initUpdaterUI();
});

// ==========================================
// LIST DATA REFRESHERS
// ==========================================
async function refreshDatabaseLists() {
  try {
    const rawItems = await dbGetItems();
    const rawCustomers = await dbGetCustomers();
    const rawTaxes = await dbGetTaxes();
    
    dbItemsList = rawItems.filter(i => i.companyId === activeCompanyId || (!i.companyId && activeCompanyId === 1));
    dbCustomersList = rawCustomers.filter(c => c.companyId === activeCompanyId || (!c.companyId && activeCompanyId === 1));
    dbTaxesList = rawTaxes.filter(t => t.companyId === activeCompanyId || (!t.companyId && activeCompanyId === 1));
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

  // Handle sidebar highlight matching
  let activeNavId = panelId;
  if (panelId === 'invoice' || panelId === 'drafts') {
    activeNavId = 'history';
  }
  const navBtn = document.getElementById(`nav-${activeNavId}`);
  if (navBtn) {
    navBtn.classList.add('active');
  }

  currentPanel = panelId;

  // Refresh data on specific panels
  if (panelId === 'dashboard') {
    loadHistory().then(() => renderDashboard());
  } else if (panelId === 'history') {
    clearHistoryFilters(true);
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
  } else if (panelId === 'sandbox-test') {
    initSandboxTestPanel();
  } else if (panelId === 'settings') {
    checkLicenseStatus();
  } else if (panelId === 'drafts') {
    renderDrafts();
  }

  // Inject Active Company Selector inside panel header (except settings/setup panel)
  injectHeaderCompanySelector(panelId);
}

// ==========================================
// LOGO MANAGER HELPERS
// ==========================================
let currentCompanyLogoBase64 = '';
let currentCustomerLogoBase64 = '';

function handleCompanyLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    currentCompanyLogoBase64 = evt.target.result;
    const previewContainer = document.getElementById('seller-logo-preview-container');
    const previewImg = document.getElementById('seller-logo-preview');
    if (previewImg && previewContainer) {
      previewImg.src = currentCompanyLogoBase64;
      previewContainer.style.display = 'flex';
    }
  };
  reader.readAsDataURL(file);
}

function removeSellerLogo() {
  currentCompanyLogoBase64 = '';
  const sellerLogoInput = document.getElementById('seller-logo-input');
  if (sellerLogoInput) sellerLogoInput.value = '';
  const previewContainer = document.getElementById('seller-logo-preview-container');
  if (previewContainer) {
    previewContainer.style.display = 'none';
  }
}

function handleCustomerLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    currentCustomerLogoBase64 = evt.target.result;
    const previewContainer = document.getElementById('cust-logo-preview-container');
    const previewImg = document.getElementById('cust-logo-preview');
    if (previewImg && previewContainer) {
      previewImg.src = currentCustomerLogoBase64;
      previewContainer.style.display = 'flex';
    }
  };
  reader.readAsDataURL(file);
}

function removeCustLogo() {
  currentCustomerLogoBase64 = '';
  const custLogoInput = document.getElementById('cust-logo-input');
  if (custLogoInput) custLogoInput.value = '';
  const previewContainer = document.getElementById('cust-logo-preview-container');
  if (previewContainer) {
    previewContainer.style.display = 'none';
  }
}

// ==========================================
// SETTINGS CONTROLLER (PERSISTENCE)
// ==========================================
async function saveSettings() {
  const companyToSave = {
    id: editingCompanyId || undefined,
    sellerNTN: document.getElementById('seller-ntn').value.trim(),
    sellerSTRN: document.getElementById('seller-strn').value.trim(),
    sellerName: document.getElementById('seller-name').value.trim(),
    sellerProvince: document.getElementById('seller-province').value,
    sellerAddress: document.getElementById('seller-address').value.trim(),
    fbrEnvMode: document.getElementById('fbr-env-mode').value,
    sendTotalVal: document.getElementById('seller-send-totalval').checked,
    theme: document.getElementById('app-theme-val').value,
    logoBase64: currentCompanyLogoBase64 || ''
  };

  let tokenVal = document.getElementById('fbr-token').value.trim();
  if (tokenVal.toLowerCase().startsWith('bearer ')) {
    tokenVal = tokenVal.slice(7).trim();
  }
  companyToSave.fbrToken = tokenVal;

  // Validate fields
  if (!companyToSave.sellerNTN || !companyToSave.sellerName || !companyToSave.sellerAddress || !companyToSave.fbrToken) {
    alert("Please fill in all mandatory seller settings and credentials.");
    return;
  }

  const isNew = !companyToSave.id;

  try {
    const saved = await dbSaveCompany(companyToSave);

    // Seed default taxes if it was a new company
    if (isNew) {
      await dbSeedDefaultTaxesForCompany(saved.id);
      activeCompanyId = saved.id;
      localStorage.setItem('active-company-id', activeCompanyId);
    }

    // Reload settings
    await loadSettings();

    // If it was active, reload theme and lists
    if (activeCompanyId === saved.id) {
      localStorage.setItem('app-theme', saved.theme);
      applyAndSetTheme(saved.theme);
      updateEnvironmentBadge();

      // Reset invoice form and refresh database lists
      resetInvoiceForm();
      await refreshDatabaseLists();
      await loadHistory();
      renderDashboard();
    }

    alert("Company settings saved successfully.");
    switchPanel('dashboard');
  } catch (err) {
    alert("Error saving settings to DB: " + err.message);
  }
}

async function loadSettings() {
  try {
    // 1. Load all company profiles
    allCompanies = await dbGetAllCompanies();

    // 2. If no company profiles exist, create a default one
    if (allCompanies.length === 0) {
      const defaultCompany = {
        id: 1,
        sellerNTN: '',
        sellerName: 'Default Company',
        sellerProvince: 'Sindh',
        sellerAddress: '',
        fbrEnvMode: 'sandbox',
        fbrToken: '',
        sendTotalVal: false,
        theme: 'midnight-abyss'
      };
      await dbSaveCompany(defaultCompany);
      allCompanies = [defaultCompany];
    }

    // 3. Make sure activeCompanyId exists in the list
    let activeCompany = allCompanies.find(c => c.id === activeCompanyId);
    if (!activeCompany) {
      activeCompany = allCompanies[0];
      activeCompanyId = activeCompany.id;
      localStorage.setItem('active-company-id', activeCompanyId);
    }

    fbrSettings = activeCompany;
    if (!fbrSettings.theme) {
      fbrSettings.theme = 'midnight-abyss';
    }
    if (fbrSettings.sendTotalVal === undefined) {
      fbrSettings.sendTotalVal = false;
    }

    // 4. Update selectors in UI
    populateCompanySelectors();

    // 5. Populate settings panel fields
    editingCompanyId = activeCompanyId;
    populateCompanyFields(fbrSettings);

    // Apply theme
    applyAndSetTheme(fbrSettings.theme);
    updateEnvironmentBadge();
  } catch (e) {
    console.error("Error loading settings from DB", e);
  }
}

function populateCompanySelectors() {
  const editSelect = document.getElementById('edit-company-select');

  if (editSelect) {
    editSelect.innerHTML = allCompanies.map(c =>
      `<option value="${c.id}" ${c.id === editingCompanyId ? 'selected' : ''}>${c.sellerName || 'Company #' + c.id}</option>`
    ).join('');
  }

  // Also update any visible header selectors
  document.querySelectorAll('.header-company-container select').forEach(sel => {
    sel.innerHTML = allCompanies.map(c => 
      `<option value="${c.id}" ${c.id === activeCompanyId ? 'selected' : ''}>${c.sellerName || 'Company #' + c.id}</option>`
    ).join('');
  });
}

function populateCompanyFields(company) {
  document.getElementById('seller-ntn').value = company.sellerNTN || '';
  document.getElementById('seller-strn').value = company.sellerSTRN || '';
  document.getElementById('seller-name').value = company.sellerName || '';
  document.getElementById('seller-province').value = company.sellerProvince || 'Sindh';
  document.getElementById('seller-address').value = company.sellerAddress || '';
  document.getElementById('fbr-env-mode').value = company.fbrEnvMode || 'sandbox';
  
  let displayToken = company.fbrToken || '';
  if (displayToken.toLowerCase().startsWith('bearer ')) {
    displayToken = displayToken.slice(7).trim();
  }
  document.getElementById('fbr-token').value = displayToken;
  document.getElementById('seller-send-totalval').checked = !!company.sendTotalVal;
  document.getElementById('app-theme-val').value = company.theme || 'midnight-abyss';

  // Load and preview company logo
  currentCompanyLogoBase64 = company.logoBase64 || '';
  const sellerPreviewContainer = document.getElementById('seller-logo-preview-container');
  const sellerPreviewImg = document.getElementById('seller-logo-preview');
  if (sellerPreviewImg && sellerPreviewContainer) {
    if (currentCompanyLogoBase64) {
      sellerPreviewImg.src = currentCompanyLogoBase64;
      sellerPreviewContainer.style.display = 'flex';
    } else {
      sellerPreviewImg.src = '';
      sellerPreviewContainer.style.display = 'none';
    }
  }
  const sellerLogoInput = document.getElementById('seller-logo-input');
  if (sellerLogoInput) sellerLogoInput.value = '';

  // Highlight theme card in UI
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  const activeThemeCard = document.getElementById(`theme-${company.theme || 'midnight-abyss'}`);
  if (activeThemeCard) {
    activeThemeCard.classList.add('active');
  }
  const themeNameDisp = document.getElementById('current-theme-name-display');
  if (themeNameDisp) {
    themeNameDisp.textContent = company.theme ? company.theme.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Midnight Abyss';
  }

  const badge = document.getElementById('editing-company-badge');
  const btnCreate = document.getElementById('btn-create-company');
  const btnCancel = document.getElementById('btn-cancel-create-company');
  const editSelect = document.getElementById('edit-company-select');

  if (badge) {
    if (company.id) {
      badge.textContent = `Editing: ${company.sellerName || 'Company #' + company.id}`;
      badge.style.backgroundColor = 'var(--accent-primary)';
      if (btnCreate) btnCreate.style.display = 'inline-block';
      if (btnCancel) btnCancel.style.display = 'none';
      if (editSelect) {
        editSelect.disabled = false;
        editSelect.value = company.id;
      }
    } else {
      badge.textContent = `Creating New Company`;
      badge.style.backgroundColor = 'var(--warning)';
      if (btnCreate) btnCreate.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'inline-block';
      if (editSelect) editSelect.disabled = true;
    }
  }
}

async function handleActiveCompanyChange() {
  // Load active company settings
  const company = allCompanies.find(c => c.id === activeCompanyId);
  if (company) {
    fbrSettings = company;
    editingCompanyId = activeCompanyId;
    populateCompanyFields(company);
    applyAndSetTheme(company.theme || 'midnight-abyss');
    updateEnvironmentBadge();
  }

  // Clear invoicing screen details to prevent leakage of item grid data
  resetInvoiceForm();

  // Refresh databases lists & reload views
  await refreshDatabaseLists();

  // Re-run log / history loads
  await loadHistory();

  // Re-draw panel details
  switchPanel(currentPanel);
  renderDashboard();
}

function injectHeaderCompanySelector(panelId) {
  // Remove any existing header selectors from all panels to prevent duplication
  document.querySelectorAll('.header-company-container').forEach(el => el.remove());

  if (panelId === 'settings') {
    return; // Skip settings panel (Company Setup)
  }

  const panel = document.getElementById('panel-' + panelId);
  if (!panel) return;

  const header = panel.querySelector('.panel-header');
  if (!header) return;

  // Make sure header has relative positioning context
  header.style.position = 'relative';

  // Create selector HTML
  const container = document.createElement('div');
  container.className = 'header-company-container';
  container.style.position = 'absolute';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';
  container.style.zIndex = '5';

  const label = document.createElement('span');
  label.style.fontSize = '13px';
  label.style.fontWeight = '600';
  label.style.color = 'var(--text-secondary)';
  label.style.whiteSpace = 'nowrap';
  label.textContent = 'Active Company:';

  const select = document.createElement('select');
  select.className = 'form-control';
  select.style.width = '240px';
  select.style.height = '38px';
  select.style.cursor = 'pointer';
  select.style.padding = '6px 12px';
  select.style.fontSize = '13px';
  select.style.fontWeight = '500';

  select.innerHTML = allCompanies.map(c => 
    `<option value="${c.id}" ${c.id === activeCompanyId ? 'selected' : ''}>${c.sellerName || 'Company #' + c.id}</option>`
  ).join('');

  select.onchange = async (e) => {
    activeCompanyId = Number(e.target.value);
    localStorage.setItem('active-company-id', activeCompanyId);
    
    // Sync the other header selectors
    document.querySelectorAll('.header-company-container select').forEach(sel => {
      sel.value = activeCompanyId;
    });
    
    // Trigger company select change
    await handleActiveCompanyChange();
  };

  container.appendChild(label);
  container.appendChild(select);

  // Append centered selector to the panel header
  header.appendChild(container);
}

async function onEditCompanySelectChange() {
  const select = document.getElementById('edit-company-select');
  if (!select) return;
  editingCompanyId = Number(select.value);

  const company = allCompanies.find(c => c.id === editingCompanyId);
  if (company) {
    populateCompanyFields(company);
  }
}

function startNewCompanyForm() {
  editingCompanyId = null; // Mark as creating new company

  const newCompanySkeleton = {
    sellerNTN: '',
    sellerSTRN: '',
    sellerName: '',
    sellerProvince: 'Sindh',
    sellerAddress: '',
    fbrEnvMode: 'sandbox',
    fbrToken: '',
    sendTotalVal: false,
    theme: 'midnight-abyss',
    logoBase64: ''
  };

  populateCompanyFields(newCompanySkeleton);
}

function cancelNewCompanyForm() {
  editingCompanyId = activeCompanyId;
  const company = allCompanies.find(c => c.id === editingCompanyId);
  if (company) {
    populateCompanyFields(company);
    // Restore selector value to active editing id
    const editSelect = document.getElementById('edit-company-select');
    if (editSelect) {
      editSelect.value = editingCompanyId;
    }
  }
}

function updateEnvironmentBadge() {
  const badge = document.getElementById('sidebar-env-badge');
  const text = document.getElementById('sidebar-env-text');
  const sandboxSuite = document.getElementById('nav-sandbox-test');

  if (fbrSettings.fbrEnvMode === 'production') {
    badge.className = 'env-badge production';
    text.textContent = 'FBR Production';
    if (sandboxSuite) sandboxSuite.style.display = 'none';
    if (currentPanel === 'sandbox-test') {
      switchPanel('dashboard');
    }
  } else {
    badge.className = 'env-badge';
    text.textContent = 'FBR Sandbox';
    if (sandboxSuite) sandboxSuite.style.display = 'flex';
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
  const finalTheme = themeName || 'midnight-abyss';
  // Apply data attribute to root HTML tag
  document.documentElement.setAttribute('data-theme', finalTheme);

  // Store theme preference in localStorage for instant retrieval on startup
  localStorage.setItem('app-theme', finalTheme);

  // Keep hidden settings field in sync
  const themeInput = document.getElementById('app-theme-val');
  if (themeInput) {
    themeInput.value = finalTheme;
  }

  // Update text label display
  const themeLabels = {
    'midnight-abyss': 'Midnight Abyss',
    'ocean-breeze': 'Ocean Breeze',
    'emerald-forest': 'Emerald Forest',
    'sunset-crimson': 'Sunset Crimson',
    'amethyst-purple': 'Amethyst Purple',
    'obsidian-onyx': 'Obsidian Onyx',
    'crystal-light': 'Crystal Light',
    'ice-breeze': 'Ice Breeze',
    'mint-cream': 'Mint Cream',
    'sand-dune': 'Sand Dune'
  };
  const displayLabel = document.getElementById('current-theme-name-display');
  if (displayLabel) {
    displayLabel.textContent = themeLabels[finalTheme] || finalTheme;
  }

  // Toggle card highlighting borders in Settings panel
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.remove('active');
    card.style.borderColor = 'var(--border-color)';
  });

  const activeCard = document.getElementById(`theme-${finalTheme}`);
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
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px 0;">
          No customers registered in local database. Click "+ Add Customer" to create one.
        </td>
      </tr>
    `;
    return;
  }

  dbCustomersList.forEach(c => {
    const taxCount = (c.linkedTaxes || []).length;
    const itemCount = (c.linkedItems || []).length;
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
      <td>
        <span style="font-size: 11px; color: var(--text-secondary);">
          ${taxCount > 0 ? `🏷️ ${taxCount} Tax${taxCount > 1 ? 'es' : ''}` : ''}
          ${taxCount > 0 && itemCount > 0 ? ' · ' : ''}
          ${itemCount > 0 ? `📦 ${itemCount} Item${itemCount > 1 ? 's' : ''}` : ''}
          ${taxCount === 0 && itemCount === 0 ? '-' : ''}
        </span>
      </td>
      <td style="text-align: center; display: flex; justify-content: center; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick="openCustomerModal(${c.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function openCustomerModal(id = null) {
  await refreshDatabaseLists();
  const modal = document.getElementById('customer-modal');
  const title = document.getElementById('customer-modal-title');
  title.textContent = 'Customers Entry';

  // Clear inputs
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-id-display').value = 'Auto';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-ntn').value = '';
  document.getElementById('cust-strn').value = '';
  document.getElementById('cust-reg-type').value = 'Registered';
  document.getElementById('cust-province').value = 'SINDH';
  document.getElementById('cust-mobile').value = '';
  document.getElementById('cust-email').value = '';
  document.getElementById('cust-address').value = '';
  document.getElementById('cust-party-type').value = 'LOCAL';
  document.getElementById('cust-submit-btn').textContent = 'Create';

  // Clear customer logo inputs & previews
  currentCustomerLogoBase64 = '';
  const custLogoInput = document.getElementById('cust-logo-input');
  if (custLogoInput) custLogoInput.value = '';
  const custPreviewContainer = document.getElementById('cust-logo-preview-container');
  if (custPreviewContainer) custPreviewContainer.style.display = 'none';
  const custPreviewImg = document.getElementById('cust-logo-preview');
  if (custPreviewImg) custPreviewImg.src = '';

  // Clear linked taxes and items mini-tables
  document.getElementById('cust-linked-taxes-tbody').innerHTML = '';
  document.getElementById('cust-linked-items-tbody').innerHTML = '';

  if (id) {
    const c = dbCustomersList.find(x => x.id === id);
    if (c) {
      document.getElementById('cust-id').value = c.id;
      document.getElementById('cust-id-display').value = c.id;
      document.getElementById('cust-name').value = c.partyName;
      document.getElementById('cust-ntn').value = c.ntn || '';
      document.getElementById('cust-strn').value = c.strn || '';
      document.getElementById('cust-reg-type').value = c.registrationType;
      document.getElementById('cust-province').value = (c.province || '').toUpperCase();
      document.getElementById('cust-mobile').value = c.mobileNo || '';
      document.getElementById('cust-email').value = c.email || '';
      document.getElementById('cust-address').value = c.address;
      document.getElementById('cust-party-type').value = c.partyType || 'LOCAL';
      document.getElementById('cust-submit-btn').textContent = 'Save';

      // Load customer logo preview
      currentCustomerLogoBase64 = c.logoBase64 || '';
      const custPreviewContainer = document.getElementById('cust-logo-preview-container');
      const custPreviewImg = document.getElementById('cust-logo-preview');
      if (custPreviewImg && custPreviewContainer) {
        if (currentCustomerLogoBase64) {
          custPreviewImg.src = currentCustomerLogoBase64;
          custPreviewContainer.style.display = 'flex';
        } else {
          custPreviewImg.src = '';
          custPreviewContainer.style.display = 'none';
        }
      }

      // Populate linked taxes
      if (c.linkedTaxes && c.linkedTaxes.length > 0) {
        c.linkedTaxes.forEach(lt => addCustomerLinkedTaxRow(lt));
      }

      // Populate linked items
      if (c.linkedItems && c.linkedItems.length > 0) {
        c.linkedItems.forEach(li => addCustomerLinkedItemRow(li));
      }
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
    strn: document.getElementById('cust-strn').value.trim(),
    registrationType: document.getElementById('cust-reg-type').value,
    province: document.getElementById('cust-province').value,
    mobileNo: document.getElementById('cust-mobile').value.trim(),
    email: document.getElementById('cust-email').value.trim(),
    address: document.getElementById('cust-address').value.trim(),
    partyType: document.getElementById('cust-party-type').value,
    logoBase64: currentCustomerLogoBase64 || ''
  };

  if (!cust.partyName || !cust.address) {
    alert("Customer Name and Address are mandatory.");
    return;
  }
  if (cust.registrationType === 'Registered' && !cust.ntn) {
    alert("NTN/CNIC is mandatory for Registered buyers.");
    return;
  }

  // Collect linked taxes from mini-table
  const linkedTaxes = [];
  const taxRows = document.getElementById('cust-linked-taxes-tbody').querySelectorAll('tr');
  taxRows.forEach(row => {
    const taxSelect = row.querySelector('.cust-link-tax-select');
    const rateInput = row.querySelector('.cust-link-tax-rate');
    if (taxSelect && rateInput && taxSelect.value) {
      const taxId = Number(taxSelect.value);
      const taxType = taxSelect.options[taxSelect.selectedIndex]?.text || '';
      const rate = parseFloat(rateInput.value) || 0;
      linkedTaxes.push({ taxId, taxType, rate });
    }
  });
  cust.linkedTaxes = linkedTaxes;

  // Collect linked items from mini-table
  const linkedItems = [];
  const itemRows = document.getElementById('cust-linked-items-tbody').querySelectorAll('tr');
  itemRows.forEach(row => {
    const itemSelect = row.querySelector('.cust-link-item-select');
    const rateInput = row.querySelector('.cust-link-item-rate');
    if (itemSelect && rateInput && itemSelect.value) {
      const itemId = Number(itemSelect.value);
      const description = itemSelect.options[itemSelect.selectedIndex]?.text || '';
      const rate = parseFloat(rateInput.value) || 0;
      linkedItems.push({ itemId, description, rate });
    }
  });
  cust.linkedItems = linkedItems;

  if (id) {
    cust.id = Number(id);
    const existing = dbCustomersList.find(x => x.id === cust.id);
    if (existing) {
      cust.companyId = existing.companyId || 1;
    } else {
      cust.companyId = activeCompanyId;
    }
  } else {
    cust.companyId = activeCompanyId;
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
// 1b. CUSTOMER LINKED TAXES & ITEMS HELPERS
// ==========================================

function addCustomerLinkedTaxRow(taxData = null) {
  const tbody = document.getElementById('cust-linked-taxes-tbody');
  const tr = document.createElement('tr');

  let taxOptionsHtml = '<option value="">-- Select Tax --</option>';
  dbTaxesList.forEach(t => {
    taxOptionsHtml += `<option value="${t.id}" data-rate="${t.rate}" data-nature="${t.type || 'Sales Tax'}">${t.taxType}</option>`;
  });

  const rowId = `cust-lt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  tr.id = rowId;
  tr.innerHTML = `
    <td>
      <select class="form-control cust-link-tax-select" onchange="onCustLinkedTaxSelect('${rowId}')" style="font-size: 12px; padding: 4px 8px;">
        ${taxOptionsHtml}
      </select>
    </td>
    <td>
      <input class="form-control cust-link-tax-rate" type="number" step="0.01" min="0" value="0" style="font-size: 12px; padding: 4px 8px; text-align: right;">
    </td>
    <td style="text-align: center;">
      <button class="btn-remove-row" onclick="removeCustomerLinkedRow('${rowId}')" title="Remove">&times;</button>
    </td>
  `;
  tbody.appendChild(tr);

  // If populating from saved data, set values
  if (taxData) {
    const select = tr.querySelector('.cust-link-tax-select');
    const rateInput = tr.querySelector('.cust-link-tax-rate');
    if (taxData.taxId) select.value = taxData.taxId;
    if (taxData.rate !== undefined) rateInput.value = taxData.rate;
  }
}

function onCustLinkedTaxSelect(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const select = row.querySelector('.cust-link-tax-select');
  const rateInput = row.querySelector('.cust-link-tax-rate');
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption && selectedOption.dataset.rate) {
    rateInput.value = parseFloat(selectedOption.dataset.rate) || 0;
  }
}

function addCustomerLinkedItemRow(itemData = null) {
  const tbody = document.getElementById('cust-linked-items-tbody');
  const tr = document.createElement('tr');

  let itemOptionsHtml = '<option value="">-- Select Item --</option>';
  dbItemsList.forEach(i => {
    if (i.isActive !== false) {
      itemOptionsHtml += `<option value="${i.id}">${i.itemDesc}</option>`;
    }
  });

  const rowId = `cust-li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  tr.id = rowId;
  tr.innerHTML = `
    <td>
      <select class="form-control cust-link-item-select" style="font-size: 12px; padding: 4px 8px;">
        ${itemOptionsHtml}
      </select>
    </td>
    <td>
      <input class="form-control cust-link-item-rate" type="number" step="0.01" min="0" value="0" style="font-size: 12px; padding: 4px 8px; text-align: right;">
    </td>
    <td style="text-align: center;">
      <button class="btn-remove-row" onclick="removeCustomerLinkedRow('${rowId}')" title="Remove">&times;</button>
    </td>
  `;
  tbody.appendChild(tr);

  // If populating from saved data, set values
  if (itemData) {
    const select = tr.querySelector('.cust-link-item-select');
    const rateInput = tr.querySelector('.cust-link-item-rate');
    if (itemData.itemId) select.value = itemData.itemId;
    if (itemData.rate !== undefined) rateInput.value = itemData.rate;
  }
}

function removeCustomerLinkedRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
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
  document.getElementById('item-box-qty').value = '';
  document.getElementById('item-barcode').value = '';
  document.getElementById('item-code').value = '';
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
      document.getElementById('item-box-qty').value = item.boxQty !== undefined ? item.boxQty : '';
      document.getElementById('item-barcode').value = item.barcode || '';
      document.getElementById('item-code').value = item.itemCode || '';
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
    boxQty: parseInt(document.getElementById('item-box-qty').value) || 0,
    barcode: document.getElementById('item-barcode').value.trim(),
    itemCode: document.getElementById('item-code').value.trim(),
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
    const existing = dbItemsList.find(x => x.id === item.id);
    if (existing) {
      item.companyId = existing.companyId || 1;
    } else {
      item.companyId = activeCompanyId;
    }
  } else {
    item.companyId = activeCompanyId;
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
    whTax: document.getElementById('tax-category').value === 'Sales With Held Tax'
  };

  if (!tax.taxType || isNaN(tax.rate)) {
    alert("Tax label name and percentage rate are required.");
    return;
  }

  if (id) {
    tax.id = Number(id);
    const existing = dbTaxesList.find(x => x.id === tax.id);
    if (existing) {
      tax.companyId = existing.companyId || 1;
    } else {
      tax.companyId = activeCompanyId;
    }
  } else {
    tax.companyId = activeCompanyId;
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

async function onInvoicePartySelectChange() {
  await refreshDatabaseLists();
  const select = document.getElementById('invoice-party-select');
  const custId = Number(select.value);
  const prevCustId = Number(select.dataset.prevVal || 0);

  if (!custId) {
    document.getElementById('buyer-name').value = '';
    document.getElementById('buyer-ntn').value = '';
    document.getElementById('buyer-reg-type').value = '';
    document.getElementById('buyer-province').value = '';
    document.getElementById('buyer-address').value = '';
    select.dataset.prevVal = '';
    recalculateInvoice();
    return;
  }

  const c = dbCustomersList.find(x => x.id === custId);
  if (!c) return;

  const hasLinkedTaxes = c.linkedTaxes && c.linkedTaxes.length > 0;
  const hasLinkedItems = c.linkedItems && c.linkedItems.length > 0;

  select.dataset.prevVal = custId;

  document.getElementById('buyer-name').value = c.partyName;
  document.getElementById('buyer-ntn').value = c.ntn || '9999997'; // default unregistered placeholder
  document.getElementById('buyer-reg-type').value = c.registrationType;
  document.getElementById('buyer-province').value = c.province;
  document.getElementById('buyer-address').value = c.address;

  // Auto-populate taxes
  if (hasLinkedTaxes) {
    const taxTbody = document.getElementById('taxes-grid-tbody');
    if (taxTbody) taxTbody.innerHTML = '';
    invoiceTaxes = [];
    for (const lt of c.linkedTaxes) {
      const dbTax = dbTaxesList.find(x => x.id === Number(lt.taxId));
      const taxNature = dbTax ? dbTax.type : (lt.taxNature || 'Sales Tax');
      
      await addTaxRow({
        taxTypeId: lt.taxId,
        ratePercent: lt.rate,
        type: taxNature
      });
    }
  }

  // Auto-populate items
  if (hasLinkedItems) {
    const tbody = document.getElementById('items-grid-tbody');
    tbody.innerHTML = '';
    invoiceItems = [];
    for (const li of c.linkedItems) {
      await addInvoiceItemRow({
        productId: li.itemId,
        quantity: 1,
        rateValue: li.rate
      });
    }
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
    <td class="col-hscode">
      <input class="form-control-cell" type="text" id="hscode-${rowId}" value="" readonly disabled placeholder="Auto-populated">
    </td>
    <td class="col-saletype">
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
      <input class="form-control-cell cell-right" type="number" step="1" min="1" id="qty-${rowId}" value="1" oninput="onQtyInput('${rowId}')">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="valexcl-${rowId}" value="0.00" oninput="onPriceInput('${rowId}')">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="totalval-${rowId}" value="0.00" oninput="onTotalPriceInput('${rowId}')" placeholder="0.00">
    </td>
    <td class="col-retail">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="retailprice-${rowId}" value="0.00" oninput="recalculateInvoice()" disabled style="background-color: var(--bg-secondary); color: var(--text-muted);" placeholder="N/A">
    </td>
    <td class="col-retail">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="totalretail-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-discount">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" max="100" id="discpercent-${rowId}" value="0.00" oninput="onDiscountPercentInput('${rowId}')">
    </td>
    <td class="col-discount">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="discamount-${rowId}" value="0.00" oninput="onDiscountAmountInput('${rowId}')">
    </td>
    <td>
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="salestax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-furthertax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="furthertax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-extratax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="extratax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-whtax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="whtax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-fedtax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="fedtax-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
    </td>
    <td class="col-fixedtax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="fixedtax-${rowId}" value="0.00" oninput="recalculateInvoice()">
    </td>
    <td class="col-fixedtax">
      <input class="form-control-cell cell-right" type="number" step="0.01" min="0" id="totallevy-${rowId}" value="0.00" readonly disabled style="background-color: var(--bg-secondary); color: var(--text-secondary);" placeholder="0.00">
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
    salesTaxInput: `salestax-${rowId}`,
    furtherTaxInput: `furthertax-${rowId}`,
    extraTaxInput: `extratax-${rowId}`,
    whTaxInput: `whtax-${rowId}`,
    fedTaxInput: `fedtax-${rowId}`,
    fixedTaxInput: `fixedtax-${rowId}`,
    totalLevyInput: `totallevy-${rowId}`
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
    if (item.fixedTax !== undefined) {
      document.getElementById(`fixedtax-${rowId}`).value = item.fixedTax.toFixed(2);
    } else {
      document.getElementById(`fixedtax-${rowId}`).value = '0.00';
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

  // Ensure new row cells sync with column settings checkboxes
  syncGridColumnVisibilities();
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
    const fixedTaxInput = document.getElementById(row.fixedTaxInput);
    if (fixedTaxInput) fixedTaxInput.value = '0.00';

    recalculateInvoice();
    return;
  }

  const i = dbItemsList.find(x => x.id === prodId);
  if (i) {
    // Constraint: All items in a single invoice must have the same Sale Type
    let activeSaleType = null;
    for (const itemRow of invoiceItems) {
      if (itemRow.rowId === rowId) continue;
      const otherSel = document.getElementById(itemRow.productSelect);
      if (otherSel && otherSel.value) {
        const otherProd = dbItemsList.find(x => x.id === Number(otherSel.value));
        if (otherProd && otherProd.saleType) {
          activeSaleType = otherProd.saleType;
          break;
        }
      }
    }

    if (activeSaleType && i.saleType !== activeSaleType) {
      alert(`Validation Error:\nAll items in a single invoice must share the same Sale Type.\n\nExisting items use: "${activeSaleType}"\nThis item uses: "${i.saleType}"`);
      prodSel.value = "";
      document.getElementById(row.hscodeInput).value = "";
      document.getElementById(row.saleTypeInput).value = "";
      document.getElementById(row.sroScheduleInput).value = "";
      document.getElementById(row.sroItemSerialInput).value = "";
      document.getElementById(row.uomInput).value = "";

      const fixedTaxInput = document.getElementById(row.fixedTaxInput);
      if (fixedTaxInput) fixedTaxInput.value = '0.00';

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

    const fixedTaxInput = document.getElementById(row.fixedTaxInput);
    if (fixedTaxInput) {
      if (i.saleType && i.saleType.includes('Potassium')) {
        fixedTaxInput.value = '60.00';
      } else {
        fixedTaxInput.value = '0.00';
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

function onTotalPriceInput(rowId) {
  const tr = document.getElementById(rowId);
  if (tr) {
    tr.dataset.lastEdited = 'totalPrice';
  }

  const qty = parseFloat(document.getElementById(`qty-${rowId}`).value) || 0;
  const totalVal = parseFloat(document.getElementById(`totalval-${rowId}`).value) || 0;

  if (qty > 0) {
    document.getElementById(`valexcl-${rowId}`).value = (totalVal / qty).toFixed(2);
  } else {
    document.getElementById(`valexcl-${rowId}`).value = "0.00";
  }
  recalculateInvoice();
}

function onPriceInput(rowId) {
  const tr = document.getElementById(rowId);
  if (tr) {
    tr.dataset.lastEdited = 'price';
  }
  recalculateInvoice();
}

function onQtyInput(rowId) {
  const tr = document.getElementById(rowId);
  const qtyInput = document.getElementById(`qty-${rowId}`);
  const valInput = document.getElementById(`valexcl-${rowId}`);
  const totalValInput = document.getElementById(`totalval-${rowId}`);

  if (tr && qtyInput && valInput && totalValInput) {
    const qty = parseFloat(qtyInput.value) || 0;
    if (tr.dataset.lastEdited === 'totalPrice') {
      const totalVal = parseFloat(totalValInput.value) || 0;
      if (qty > 0) {
        valInput.value = (totalVal / qty).toFixed(2);
      } else {
        valInput.value = "0.00";
      }
    }
  }
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
    taxOptionsHtml += `<option value="${t.id}" data-rate="${t.rate}" data-nature="${t.type || 'Sales Tax'}" data-tax-nature="${t.taxNature || 'Exclusive Taxes'}" data-fixed-rate="${t.fixedRate || 0}">${t.taxType}</option>`;
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
    const taxTypeId = tax.taxTypeId || '';
    document.getElementById(`taxtype-${rowId}`).value = taxTypeId;

    const dbTax = (taxTypeId && taxTypeId !== 'custom')
      ? dbTaxesList.find(x => x.id === Number(taxTypeId))
      : null;

    let rateVal = tax.ratePercent;
    if (rateVal === undefined && dbTax) {
      rateVal = dbTax.rate;
    }
    if (rateVal === undefined) {
      rateVal = 0;
    }
    document.getElementById(`taxrate-${rowId}`).value = rateVal.toFixed(2);

    let natureVal = tax.type;
    if (!natureVal && dbTax) {
      natureVal = dbTax.type;
    }
    if (!natureVal) {
      natureVal = 'Sales Tax';
    }
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
  // Check if we have petroleum products in items
  let hasPetroleum = false;
  invoiceItems.forEach(item => {
    const prodSelect = document.getElementById(item.productSelect);
    if (prodSelect) {
      const prodId = Number(prodSelect.value);
      if (prodId) {
        const pr = dbItemsList.find(x => x.id === prodId);
        if (pr && pr.saleType === 'Petroleum Products') {
          hasPetroleum = true;
        }
      }
    }
  });

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

  // Get active rates and properties from invoiceTaxes
  const activeSalesTaxes = [];
  let furtherTaxRateVal = 0;
  let hasFurtherTaxRow = false;
  let whTaxRateVal = 0;
  let hasWhTaxRow = false;
  let extraTaxRateVal = 0;
  let fedTaxRateVal = 0;

  invoiceTaxes.forEach(t => {
    const tSelect = document.getElementById(t.typeSelect);
    const tRateInput = document.getElementById(t.rateInput);
    const tNatureSelect = document.getElementById(t.natureSelect);
    if (!tSelect || !tRateInput || !tNatureSelect) return;

    const rate = parseFloat(tRateInput.value) || 0;
    const nature = tNatureSelect.value;
    const typeText = tSelect.value === 'custom'
      ? 'Custom Tax'
      : tSelect.options[tSelect.selectedIndex]?.text || 'Tax';

    if (nature === 'Sales Tax') {
      activeSalesTaxes.push({
        rate: rate,
        fixedRate: t.fixedRate || 0,
        typeText: typeText
      });
    } else if (nature === 'Further Tax') {
      furtherTaxRateVal = rate;
      hasFurtherTaxRow = true;
    } else if (nature === 'Withholding Tax') {
      whTaxRateVal = rate;
      hasWhTaxRow = true;
    } else if (nature === 'Extra Tax') {
      extraTaxRateVal = rate;
    } else if (nature === 'FED Tax') {
      fedTaxRateVal = rate;
    }
  });

  const itemSalesTaxes = [];
  const itemFurtherTaxes = [];
  const itemWhTaxes = [];
  const itemExtraTaxes = [];
  const itemFedTaxes = [];

  invoiceItems.forEach((item, itemIdx) => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discountInput = document.getElementById(item.discountInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);

    if (!qtyInput || !valInput || !prodSelect) {
      itemSalesTaxes[itemIdx] = 0;
      itemFurtherTaxes[itemIdx] = 0;
      itemWhTaxes[itemIdx] = 0;
      itemExtraTaxes[itemIdx] = 0;
      itemFedTaxes[itemIdx] = 0;
      return;
    }

    const qty = parseFloat(qtyInput.value) || 0;
    const val = parseFloat(valInput.value) || 0;
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const rowValExcl = val * qty;
    const rowNetValue = Math.max(0, rowValExcl - discount);

    const prodId = Number(prodSelect.value);
    const pr = dbItemsList.find(x => x.id === prodId);
    const st = pr ? (pr.saleType || '') : '';

    let itemBaseExcl = rowNetValue;
    if (st.includes('3rd Schedule Goods')) {
      const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
      itemBaseExcl = retailPrice * qty;
    } else if (st.includes('Exempt') || st.includes('zero-rate')) {
      itemBaseExcl = 0;
    }

    // 1. Calculate Sales Tax
    let appliedSalesTax = 0;
    activeSalesTaxes.forEach(t => {
      let applies = false;
      const typeTextUpper = t.typeText.toUpperCase();
      if (st.includes('Exempt') || st.includes('zero-rate')) {
        applies = false;
      } else if (typeTextUpper.includes('CEMENT') || typeTextUpper.includes('CONCRETE')) {
        applies = st.includes('Cement');
      } else if (typeTextUpper.includes('CNG')) {
        applies = st.includes('CNG');
      } else if (isPotassiumTaxType(t.typeText)) {
        applies = st.includes('Potassium');
      } else {
        applies = !st.includes('Cement') && !st.includes('CNG');
      }

      if (applies) {
        if (st.includes('Cement')) {
          appliedSalesTax += qty * t.rate;
        } else if (st.includes('CNG Sales')) {
          appliedSalesTax += qty * t.rate;
        } else if (st.includes('Potassium')) {
          appliedSalesTax += rowNetValue * (t.rate / 100) + qty * t.fixedRate;
        } else {
          appliedSalesTax += itemBaseExcl * (t.rate / 100);
        }
      }
    });
    itemSalesTaxes[itemIdx] = appliedSalesTax;

    // 2. Calculate Further Tax
    let appliedFurtherTax = 0;
    if (hasFurtherTaxRow && !st.includes('Exempt') && !st.includes('zero-rate')) {
      appliedFurtherTax = itemBaseExcl * (furtherTaxRateVal / 100);
    }
    itemFurtherTaxes[itemIdx] = appliedFurtherTax;

    // 3. Calculate Extra Tax and FED Tax
    let appliedExtraTax = 0;
    if (extraTaxRateVal > 0 && !st.includes('Exempt') && !st.includes('zero-rate')) {
      appliedExtraTax = itemBaseExcl * (extraTaxRateVal / 100);
    }
    itemExtraTaxes[itemIdx] = appliedExtraTax;

    let appliedFedTax = 0;
    if (fedTaxRateVal > 0 && !st.includes('Exempt') && !st.includes('zero-rate')) {
      appliedFedTax = itemBaseExcl * (fedTaxRateVal / 100);
    }
    itemFedTaxes[itemIdx] = appliedFedTax;

    // 4. Calculate Withholding Tax (applied on net value + sales tax + further tax)
    let appliedWhTax = 0;
    if (hasWhTaxRow && !st.includes('Exempt') && !st.includes('zero-rate')) {
      const withholdingBase = itemBaseExcl + appliedSalesTax + appliedFurtherTax;
      appliedWhTax = withholdingBase * (whTaxRateVal / 100);
    }
    itemWhTaxes[itemIdx] = appliedWhTax;
  });

  // Calculate totals and populate the tax grid rows
  invoiceTaxes.forEach(tax => {
    const typeSelect = document.getElementById(tax.typeSelect);
    const rateInput = document.getElementById(tax.rateInput);
    const natureSelect = document.getElementById(tax.natureSelect);
    const valExclInput = document.getElementById(tax.valExclInput);
    const amtInput = document.getElementById(tax.amtInput);

    if (!typeSelect || !rateInput || !natureSelect || !valExclInput || !amtInput) return;

    const rate = parseFloat(rateInput.value) || 0;
    const nature = natureSelect.value;

    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const dbTaxNature = selectedOption ? (selectedOption.dataset.taxNature || '') : '';
    const isInclusive = (nature === 'Withholding Tax' || dbTaxNature.toLowerCase().includes('inclusive'));

    const typeText = typeSelect.value === 'custom'
      ? 'Custom Tax'
      : typeSelect.options[typeSelect.selectedIndex]?.text || 'Tax';

    let rowAmt = 0;
    let rowBaseVal = 0;

    invoiceItems.forEach((item, itemIdx) => {
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
      const st = pr.saleType || '';

      let itemBaseExcl = rowNetValue;
      if (st.includes('3rd Schedule Goods')) {
        const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
        itemBaseExcl = retailPrice * qty;
      } else if (st.includes('Exempt') || st.includes('zero-rate')) {
        itemBaseExcl = 0;
      }

      let applies = false;
      if (nature === 'Sales Tax') {
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
          applies = !st.includes('Cement') && !st.includes('CNG');
        }
      } else {
        // Further Tax, Withholding, Extra Tax, FED Tax apply to all taxable items
        applies = !st.includes('Exempt') && !st.includes('zero-rate');
      }

      if (applies) {
        let itemTaxBase = itemBaseExcl;
        if (nature === 'Withholding Tax') {
          itemTaxBase = itemBaseExcl + itemSalesTaxes[itemIdx] + itemFurtherTaxes[itemIdx];
        } else if (isInclusive) {
          itemTaxBase = itemBaseExcl + itemSalesTaxes[itemIdx];
        }
        rowBaseVal += itemTaxBase;

        if (nature === 'Sales Tax') {
          if (st.includes('Cement')) {
            rowAmt += qty * rate;
          } else if (st.includes('CNG Sales')) {
            rowAmt += qty * rate;
          } else if (st.includes('Potassium')) {
            rowAmt += rowNetValue * (rate / 100) + qty * tax.fixedRate;
          } else {
            rowAmt += itemBaseExcl * (rate / 100);
          }
        } else if (nature === 'Further Tax') {
          rowAmt += itemFurtherTaxes[itemIdx];
        } else if (nature === 'Withholding Tax') {
          rowAmt += itemWhTaxes[itemIdx];
        } else if (nature === 'Extra Tax') {
          rowAmt += itemExtraTaxes[itemIdx];
        } else if (nature === 'FED Tax') {
          rowAmt += itemFedTaxes[itemIdx];
        }
      }
    });

    valExclInput.value = rowBaseVal.toFixed(2);

    let amt = 0;
    if (document.activeElement !== amtInput) {
      amt = rowAmt;
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
    taxesGroup[typeText].invoiceValueExcl += rowBaseVal;
    taxesGroup[typeText].taxAmount += amt;
  });

  let totalRetailPrice = 0;
  let hasRetailTaxed = false;
  let totalFixedNotifiedAmt = 0;
  invoiceItems.forEach(item => {
    const qtyInput = document.getElementById(item.qtyInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);
    const fixedTaxInput = document.getElementById(item.fixedTaxInput);
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

    const fixedTax = fixedTaxInput ? parseFloat(fixedTaxInput.value) || 0 : 0;
    totalFixedNotifiedAmt += qty * fixedTax;
  });

  const grandTotal = netExclValue + totalSalesTax + furtherTaxAmt + totalExtraTax + totalFedAmt + totalFixedNotifiedAmt + totalWhTax;

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

  const fixedTaxRow = document.getElementById('summary-fixedtax-row');
  if (fixedTaxRow) {
    if (totalFixedNotifiedAmt > 0) {
      fixedTaxRow.style.display = 'flex';
      document.getElementById('summary-fixedtax-label').textContent = hasPetroleum ? 'Total Levy:' : 'Total Fixed Notified Value:';
      document.getElementById('summary-fixedtax').textContent = `PKR ${totalFixedNotifiedAmt.toFixed(2)}`;
    } else {
      fixedTaxRow.style.display = 'none';
    }
  }

  // Show sales tax amount (from manual inputs)
  document.getElementById('summary-sales-tax').textContent = `PKR ${totalSalesTax.toFixed(2)}`;

  // Show Further Tax (always visible)
  const furtherTaxRow = document.getElementById('summary-further-tax-row');
  if (furtherTaxRow) {
    furtherTaxRow.style.display = 'flex';
    document.getElementById('summary-further-tax').textContent = `PKR ${furtherTaxAmt.toFixed(2)}`;
  }

  // Show Total Inclusive Sales Tax (always visible)
  const inclTaxRow = document.getElementById('summary-incl-tax-row');
  if (inclTaxRow) {
    inclTaxRow.style.display = 'flex';
    const inclSalesTax = subtotalExcl + totalSalesTax + furtherTaxAmt;
    document.getElementById('summary-incl-tax').textContent = `PKR ${inclSalesTax.toFixed(2)}`;
  }

  // Show Withholding Tax (always visible)
  const whTaxRow = document.getElementById('summary-whtax-row');
  if (whTaxRow) {
    whTaxRow.style.display = 'flex';
    document.getElementById('summary-whtax').textContent = `PKR ${totalWhTax.toFixed(2)}`;
  }

  const extraTaxRow = document.getElementById('summary-extra-tax-row');
  if (extraTaxRow) {
    if (totalExtraTax > 0) {
      extraTaxRow.style.display = 'flex';
      document.getElementById('summary-extra-tax').textContent = `PKR ${totalExtraTax.toFixed(2)}`;
    } else {
      extraTaxRow.style.display = 'none';
    }
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
  let furtherTaxIsInclusive = false;
  let extraTaxRate = 0;
  let extraTaxIsInclusive = false;
  let whTaxRate = 0;
  let whTaxIsInclusive = true;
  let fedTaxRate = 0;
  let fedTaxIsInclusive = false;
  invoiceTaxes.forEach(t => {
    const natureSelect = document.getElementById(t.natureSelect);
    const rateInput = document.getElementById(t.rateInput);
    const typeSelect = document.getElementById(t.typeSelect);
    if (!natureSelect || !rateInput) return;
    const rateVal = parseFloat(rateInput.value) || 0;
    const natureVal = natureSelect.value;

    const selectedOption = typeSelect ? typeSelect.options[typeSelect.selectedIndex] : null;
    const dbTaxNature = selectedOption ? (selectedOption.dataset.taxNature || '') : '';
    const isInclusive = (natureVal === 'Withholding Tax' || dbTaxNature.toLowerCase().includes('inclusive'));

    if (natureVal === 'Further Tax') {
      furtherTaxRate = rateVal;
      furtherTaxIsInclusive = isInclusive;
    } else if (natureVal === 'Extra Tax') {
      extraTaxRate = rateVal;
      extraTaxIsInclusive = isInclusive;
    } else if (natureVal === 'Withholding Tax') {
      whTaxRate = rateVal;
      whTaxIsInclusive = isInclusive;
    } else if (natureVal === 'FED Tax') {
      fedTaxRate = rateVal;
      fedTaxIsInclusive = isInclusive;
    }
  });

  invoiceItems.forEach((item, itemIdx) => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const discountInput = document.getElementById(item.discountInput);
    const prodSelect = document.getElementById(item.productSelect);
    const retailInput = document.getElementById(item.retailPriceInput);
    const totalValInput = document.getElementById(item.totalValInput);
    const totalRetailInput = document.getElementById(item.totalRetailInput);

    if (!qtyInput || !valInput || !prodSelect || !totalValInput || !document.getElementById(item.fixedTaxInput)) return;

    const qty = parseFloat(qtyInput.value) || 0;
    const val = parseFloat(valInput.value) || 0;
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const rowValExcl = val * qty;
    const rowNetValue = Math.max(0, rowValExcl - discount);

    // Display the Total Notified Value (row value excluding ST) in the cell
    if (document.activeElement !== totalValInput) {
      totalValInput.value = rowValExcl.toFixed(2);
    }

    const prodId = Number(prodSelect.value);
    if (!prodId) {
      const salesTaxInput = document.getElementById(item.salesTaxInput);
      if (salesTaxInput) salesTaxInput.value = '0.00';
      const furtherTaxInput = document.getElementById(item.furtherTaxInput);
      if (furtherTaxInput) furtherTaxInput.value = '0.00';
      if (totalRetailInput) totalRetailInput.value = '0.00';
      return;
    }
    const pr = dbItemsList.find(x => x.id === prodId);
    if (!pr) return;

    const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
    const fixedTaxInput = document.getElementById(item.fixedTaxInput);
    const fixedTax = fixedTaxInput ? parseFloat(fixedTaxInput.value) || 0 : 0;
    const totalLevyInput = document.getElementById(item.totalLevyInput);

    const stAmt = itemSalesTaxes[itemIdx];
    const ftAmt = itemFurtherTaxes[itemIdx];
    const etAmt = itemExtraTaxes[itemIdx];
    const wtAmt = itemWhTaxes[itemIdx];
    const fedAmt = itemFedTaxes[itemIdx];

    if (totalLevyInput) {
      totalLevyInput.value = (qty * fixedTax).toFixed(2);
    }

    const salesTaxInput = document.getElementById(item.salesTaxInput);
    if (salesTaxInput) {
      salesTaxInput.value = stAmt.toFixed(2);
    }

    const furtherTaxInput = document.getElementById(item.furtherTaxInput);
    if (furtherTaxInput) {
      furtherTaxInput.value = ftAmt.toFixed(2);
    }

    const extraTaxInput = document.getElementById(item.extraTaxInput);
    if (extraTaxInput) {
      extraTaxInput.value = etAmt.toFixed(2);
    }

    const whTaxInput = document.getElementById(item.whTaxInput);
    if (whTaxInput) {
      whTaxInput.value = wtAmt.toFixed(2);
    }

    const fedTaxInput = document.getElementById(item.fedTaxInput);
    if (fedTaxInput) {
      fedTaxInput.value = fedAmt.toFixed(2);
    }

    // Display the Total Retail Price in the read-only cell
    if (totalRetailInput) {
      totalRetailInput.value = (retailPrice * qty).toFixed(2);
    }
  });

  // Dynamic sales tax column header text
  let uniqueRates = [];
  invoiceItems.forEach(it => {
    const prodSelect = document.getElementById(it.productSelect);
    if (prodSelect && prodSelect.value) {
      const pr = dbItemsList.find(x => x.id === Number(prodSelect.value));
      if (pr) {
        const rate = getSalesTaxRateForItem(pr, invoiceTaxes);
        if (!uniqueRates.includes(rate)) {
          uniqueRates.push(rate);
        }
      }
    }
  });
  const thSalesTax = document.getElementById('th-sales-tax');
  if (thSalesTax) {
    if (uniqueRates.length === 1) {
      thSalesTax.textContent = `Sales Tax (${uniqueRates[0]}%)`;
    } else if (uniqueRates.length > 1) {
      thSalesTax.textContent = `Sales Tax (${uniqueRates.join('/')}%)`;
    } else {
      thSalesTax.textContent = 'Sales Tax';
    }
  }

  // Dynamic further tax column header text
  const thFurtherTax = document.getElementById('th-further-tax');
  if (thFurtherTax) {
    if (furtherTaxRate > 0) {
      thFurtherTax.textContent = `Further Tax (${furtherTaxRate}%)`;
    } else {
      thFurtherTax.textContent = 'Further Tax';
    }
  }

  // Dynamic Extra Tax header
  const thExtraTax = document.getElementById('th-extra-tax');
  if (thExtraTax) {
    thExtraTax.textContent = extraTaxRate > 0 ? `Extra Tax (${extraTaxRate}%)` : 'Extra Tax';
  }

  // Dynamic Withholding Tax header
  const thWhTax = document.getElementById('th-wh-tax');
  if (thWhTax) {
    thWhTax.textContent = whTaxRate > 0 ? `Withholding Tax (${whTaxRate}%)` : 'Withholding Tax';
  }

  // Dynamic FED Tax header
  const thFedTax = document.getElementById('th-fed-tax');
  if (thFedTax) {
    thFedTax.textContent = fedTaxRate > 0 ? `FED Tax (${fedTaxRate}%)` : 'FED Tax';
  }

  const thFixedTax = document.getElementById('th-fixed-tax');
  if (thFixedTax) {
    thFixedTax.textContent = hasPetroleum ? 'Petroleum Levy' : 'Fixed Notified Value';
  }

  const thTotalLevy = document.getElementById('th-total-levy');
  if (thTotalLevy) {
    thTotalLevy.textContent = hasPetroleum ? 'Total Levy' : 'Total Fixed Notified Value';
  }

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
function clearAndAddDefaultTaxRow(ratePercent, taxNature, preferredTaxType = '') {
  const tbody = document.getElementById('taxes-grid-tbody');
  if (tbody) tbody.innerHTML = '';
  invoiceTaxes = [];

  let matchingTax;
  if (preferredTaxType) {
    matchingTax = dbTaxesList.find(t => t.taxType.toUpperCase().includes(preferredTaxType.toUpperCase()));
  }
  if (!matchingTax) {
    // Fallback matching rate and type
    matchingTax = dbTaxesList.find(t => t.rate === ratePercent && (t.type === taxNature || t.taxNature === taxNature));
  }
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
      let preferredTax = '';
      if (scenario === 'SN021') preferredTax = 'Cement';
      else if (scenario === 'SN022') preferredTax = 'Potassium';
      else if (scenario === 'SN023') preferredTax = 'CNG';

      clearAndAddDefaultTaxRow(targetTaxRateVal, 'Sales Tax', preferredTax);

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
  activeDraftId = null;
  const draftBanner = document.getElementById('draft-mode-banner');
  if (draftBanner) draftBanner.style.display = 'none';

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
  if (document.getElementById('invoice-manual-no')) {
    document.getElementById('invoice-manual-no').value = '';
  }
  if (document.getElementById('invoice-db-no')) {
    document.getElementById('invoice-db-no').value = 'New';
  }

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
  const refNo = document.getElementById('invoice-manual-no').value.trim() || '0';
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
    const fixedTaxInput = document.getElementById(item.fixedTaxInput);
    const fixedTax = fixedTaxInput ? parseFloat(fixedTaxInput.value) || 0 : 0;
    const itemSalesTaxRate = getSalesTaxRateForItem(prod, invoiceTaxes);

    let stAmt = 0;
    const st = prod.saleType || '';
    if (fixedTax > 0) {
      stAmt = rowNetValue * (itemSalesTaxRate / 100) + qty * fixedTax;
    } else if (st.includes('Exempt') || st.includes('zero-rate')) {
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
    if (fixedTax > 0) {
      const uomVal = (prod.uom || '').toUpperCase();
      const uomText = (uomVal === 'KG' || uomVal === 'KGS') ? 'kilogram' : (prod.uom || 'kilogram');
      rateText = `${itemSalesTaxRate}% along with rupees ${fixedTax} per ${uomText}`;
    } else if (st.includes('Exempt')) {
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

    if (st.includes('Petroleum')) {
      itemPayload.petroleumLevyOn = fixedTax > 0 ? fixedTax : 10.00;
      itemPayload.petroleumLevy = roundTo2(qty * itemPayload.petroleumLevyOn);
    }

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
    const hasCustomFixedTax = invoiceItems.some(it => {
      const ftInput = document.getElementById(it.fixedTaxInput);
      return ftInput && (parseFloat(ftInput.value) || 0) > 0;
    });
    payload.scenarioId = hasCustomFixedTax ? "SN022" : scenarioId;
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
        const fixedTaxInput = document.getElementById(item.fixedTaxInput);
        const fixedTax = fixedTaxInput ? parseFloat(fixedTaxInput.value) || 0 : 0;

        const rowValExcl = val * qty;
        const rowNetValue = Math.max(0, rowValExcl - discountVal);
        const proportion = totalNetValue > 0 ? (rowNetValue / totalNetValue) : 0;

        const retailPrice = document.getElementById(item.retailPriceInput) ? parseFloat(document.getElementById(item.retailPriceInput).value) || 0 : 0;
        const itemSalesTaxRate = getSalesTaxRateForItem(pr, invoiceTaxes);

        let salesTax = 0;
        if (fixedTax > 0) {
          if (pr.saleType === 'Petroleum Products') {
            salesTax = rowNetValue * (itemSalesTaxRate / 100);
          } else {
            salesTax = rowNetValue * (itemSalesTaxRate / 100) + qty * fixedTax;
          }
        } else if (pr.saleType === 'Exempt goods' || pr.saleType === 'Goods at zero-rate') {
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
          itemCode: pr.itemCode || '',
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
          fixedTax: fixedTax,
          petroleumLevy: pr.saleType === 'Petroleum Products' ? (qty * fixedTax) : 0,
          petroleumLevyOn: pr.saleType === 'Petroleum Products' ? fixedTax : 0,
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
        invoiceRefNo: payload.invoiceRefNo || '',
        invoiceDate: payload.invoiceDate,
        invoiceType: payload.invoiceType,
        buyerNTN: customer.ntn || '9999997',
        buyerName: customer.partyName,
        buyerAddress: customer.address || '',
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
        timestamp: res.dated || new Date().toLocaleString(),
        companyId: activeCompanyId
      };

      if (activeDraftId) {
        invoiceMaster.id = activeDraftId;
      }

      // Write master, detail items, and taxes breakdown to local DB!
      const savedId = await dbSaveInvoice(invoiceMaster, itemsToSave, taxesToSave);
      
      // Clear draft mode since it is now posted
      activeDraftId = null;
      const draftBanner = document.getElementById('draft-mode-banner');
      if (draftBanner) draftBanner.style.display = 'none';

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
    const all = await dbGetInvoices();
    invoiceHistory = all.filter(inv => inv.status !== 'Draft' && (inv.companyId === activeCompanyId || (!inv.companyId && activeCompanyId === 1)));
  } catch (err) {
    console.error("Error loading invoice history from DB:", err);
  }
}

function renderHistory(itemsToRender) {
  const list = Array.isArray(itemsToRender) ? itemsToRender : invoiceHistory;
  const tbody = document.getElementById('history-logs-tbody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px 0;">
          No reported invoices match the current filters.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(inv => {
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

function applyHistoryFilters() {
  const customerQuery = document.getElementById('history-filter-customer').value.toLowerCase().trim();
  const startDateVal = document.getElementById('history-filter-start-date').value;
  const endDateVal = document.getElementById('history-filter-end-date').value;

  const filtered = invoiceHistory.filter(inv => {
    // 1. Customer name / NTN match
    if (customerQuery) {
      const nameMatch = (inv.buyerName || '').toLowerCase().includes(customerQuery);
      const ntnMatch = (inv.buyerNTN || '').toLowerCase().includes(customerQuery);
      if (!nameMatch && !ntnMatch) {
        return false;
      }
    }

    // 2. Date match
    const dateStr = inv.invoiceDate; // e.g. "2026-06-27"
    if (startDateVal && dateStr < startDateVal) {
      return false;
    }
    if (endDateVal && dateStr > endDateVal) {
      return false;
    }

    return true;
  });

  renderHistory(filtered);
}

function clearHistoryFilters(skipRender = false) {
  const cust = document.getElementById('history-filter-customer');
  const start = document.getElementById('history-filter-start-date');
  const end = document.getElementById('history-filter-end-date');
  if (cust) cust.value = '';
  if (start) start.value = '';
  if (end) end.value = '';
  if (!skipRender) {
    renderHistory(invoiceHistory);
  }
}

async function viewHistoryInvoice(id) {
  try {
    const fullInv = await dbGetInvoiceFull(id);
    if (fullInv) {
      activeInvoice = fullInv;
      await openReceiptModal();
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

function numberToWords(num) {
  if (num === 0) return 'Zero';

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  function helper(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + helper(n % 100) : '');
  }

  let words = '';
  let i = 0;
  let temp = integerPart;
  while (temp > 0) {
    if (temp % 1000 !== 0) {
      words = helper(temp % 1000) + (thousands[i] ? ' ' + thousands[i] : '') + (words ? ' ' + words : '');
    }
    temp = Math.floor(temp / 1000);
    i++;
  }

  words = words.trim() + ' Only';

  if (decimalPart > 0) {
    words = words.replace(' Only', '') + ' and ' + helper(decimalPart) + ' Paisas Only';
  }

  return words;
}

async function openReceiptModal() {
  if (!activeInvoice) return;
  currentPdfFilename = `Invoice_${activeInvoice.invoiceNumber}`;

  // Helper to dynamically resolve Tax Name configured by user for each nature
  const getTaxNameForNature = (nature) => {
    let resolvedName = '';
    
    // 1. Try to find in activeInvoice.taxesBreakdown
    if (activeInvoice.taxesBreakdown && activeInvoice.taxesBreakdown.length > 0) {
      const match = activeInvoice.taxesBreakdown.find(t => 
        (t.taxNature === nature || t.type === nature) ||
        (nature === 'Sales Tax' && (t.taxNature === 'Sales Tax' || t.type === 'Sales Tax'))
      );
      if (match) {
        resolvedName = match.taxType || '';
        if (!resolvedName && match.taxTypeId && match.taxTypeId !== 'custom') {
          const dbTax = dbTaxesList.find(x => x.id === Number(match.taxTypeId));
          if (dbTax) resolvedName = dbTax.taxType;
        }
      }
    }
    
    // 2. Try to find in current UI grid
    if (!resolvedName) {
      const match = invoiceTaxes.find(t => {
        const natureSelect = document.getElementById(t.natureSelect);
        return natureSelect && natureSelect.value === nature;
      });
      if (match) {
        const typeSelect = document.getElementById(match.typeSelect);
        if (typeSelect && typeSelect.value !== 'custom') {
          const dbTax = dbTaxesList.find(x => x.id === Number(typeSelect.value));
          if (dbTax) resolvedName = dbTax.taxType;
        }
      }
    }

    // 3. Fallbacks
    if (!resolvedName) {
      if (nature === 'Sales Tax') return 'Sales Tax';
      if (nature === 'Further Tax') return 'Further Tax';
      if (nature === 'Withholding Tax') return 'Withholding Tax';
      if (nature === 'Extra Tax') return 'Extra Tax';
      if (nature === 'FED Tax') return 'FED Tax';
    }
    return resolvedName;
  };

  // Populate templates list
  const select = document.getElementById('receipt-template-select');
  if (select) {
    try {
      const templates = await window.api.listTemplates();
      select.innerHTML = '';
      templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t.replace(/-/g, ' ');
        opt.selected = (t.toLowerCase() === selectedTemplate.toLowerCase());
        select.appendChild(opt);
      });
      if (!selectedTemplate && templates.length > 0) {
        selectedTemplate = templates[0];
      }
    } catch (err) {
      console.error("Failed to populate template list:", err);
    }
  }

  // Load and inject template content
  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (modalBody) {
    try {
      const html = await window.api.loadTemplate(selectedTemplate || 'Standard');
      modalBody.innerHTML = html;
    } catch (err) {
      console.error("Failed to load template content:", err);
      if (originalReceiptModalBodyHTML) {
        modalBody.innerHTML = originalReceiptModalBodyHTML;
      }
    }
  }

  // Detect column mode
  const printableCard = document.getElementById('printable-receipt-card');
  const colsMode = printableCard ? printableCard.getAttribute('data-columns-mode') : 'standard';

  // Populate Seller
  const sellerHeader = document.getElementById('receipt-seller-name-header');
  if (sellerHeader) {
    sellerHeader.textContent = fbrSettings.sellerName.toUpperCase();
  }
  const addressField = document.getElementById('receipt-seller-address');
  if (addressField) {
    addressField.textContent = (fbrSettings.sellerAddress || '').toUpperCase();
  }
  const sellerNtn = document.getElementById('receipt-seller-ntn');
  if (sellerNtn) {
    sellerNtn.textContent = fbrSettings.sellerNTN || '';
  }
  const strnField = document.getElementById('receipt-seller-strn');
  if (strnField) {
    strnField.textContent = fbrSettings.sellerSTRN || '-';
  }
  const sellerLogoField = document.getElementById('receipt-seller-logo');
  if (sellerLogoField) {
    const logoSrc = fbrSettings.logoBase64 || '';
    if (logoSrc) {
      sellerLogoField.src = logoSrc;
      sellerLogoField.style.display = 'block';
    } else {
      sellerLogoField.src = '';
      sellerLogoField.style.display = 'none';
    }
  }

  // Populate Invoice metadata
  const invDateField = document.getElementById('receipt-invoice-date');
  if (invDateField) {
    invDateField.textContent = activeInvoice.invoiceDate;
  }
  const fbrNoField = document.getElementById('receipt-fbr-invoice-no');
  if (fbrNoField) {
    fbrNoField.textContent = activeInvoice.invoiceNumber || 'PENDING POSTING';
  }

  // Local sequence number and manual invoice ref
  const localIdField = document.getElementById('receipt-local-invoice-id');
  if (localIdField) {
    localIdField.textContent = activeInvoice.id || '-';
  }
  const manualInvNoField = document.getElementById('receipt-manual-invoice-no');
  if (manualInvNoField) {
    const refNo = String(activeInvoice.invoiceRefNo || '').trim();
    manualInvNoField.textContent = (refNo && refNo !== '0') ? refNo : '-';
  }

  // Populate Buyer
  const buyerNameField = document.getElementById('receipt-buyer-name');
  if (buyerNameField) {
    buyerNameField.textContent = activeInvoice.buyerName.toUpperCase();
  }

  const buyerAddressField = document.getElementById('receipt-buyer-address');
  if (buyerAddressField) {
    const customer = dbCustomersList.find(x => x.ntn === activeInvoice.buyerNTN || x.partyName.toUpperCase() === activeInvoice.buyerName.toUpperCase());
    const buyerAddress = activeInvoice.buyerAddress || (customer ? customer.address : '') || 'N/A';
    buyerAddressField.textContent = buyerAddress.toUpperCase();
  }

  const buyerNtnField = document.getElementById('receipt-buyer-ntn');
  if (buyerNtnField) {
    buyerNtnField.textContent = activeInvoice.buyerNTN;
  }

  const buyerStrnField = document.getElementById('receipt-buyer-strn');
  if (buyerStrnField) {
    const customer = dbCustomersList.find(x => x.ntn === activeInvoice.buyerNTN || x.partyName.toUpperCase() === activeInvoice.buyerName.toUpperCase());
    buyerStrnField.textContent = (customer && customer.strn) ? customer.strn : '-';
  }



  // Extract Tax Nature Rates
  let furtherTaxRateVal = 4;
  let extraTaxRateVal = 2;
  let whTaxRateVal = 0;
  let fedTaxRateVal = 0;

  if (activeInvoice.taxesBreakdown && activeInvoice.taxesBreakdown.length > 0) {
    activeInvoice.taxesBreakdown.forEach(t => {
      const nature = t.taxNature || '';
      const r = parseFloat(t.ratePercent || t.rate) || 0;
      if (nature === 'Further Tax') furtherTaxRateVal = r;
      else if (nature === 'Extra Tax') extraTaxRateVal = r;
      else if (nature === 'Withholding Tax') whTaxRateVal = r;
      else if (nature === 'FED Tax') fedTaxRateVal = r;
    });
  } else {
    invoiceTaxes.forEach(t => {
      const natureSelect = document.getElementById(t.natureSelect);
      const rateInput = document.getElementById(t.rateInput);
      if (!natureSelect || !rateInput) return;
      const rateVal = parseFloat(rateInput.value) || 0;
      if (natureSelect.value === 'Further Tax') furtherTaxRateVal = rateVal;
      else if (natureSelect.value === 'Extra Tax') extraTaxRateVal = rateVal;
      else if (natureSelect.value === 'Withholding Tax') whTaxRateVal = rateVal;
      else if (natureSelect.value === 'FED Tax') fedTaxRateVal = rateVal;
    });
  }

  // Populate Items Table
  const tbody = document.getElementById('receipt-items-tbody');
  if (tbody) {
    tbody.innerHTML = '';

    let totalSalesValue = 0;
    let totalSalesTax = 0;
    let totalFurtherTax = 0;
    let totalExtraTax = 0;
    let totalDiscount = 0;
    let totalRetail = 0;
    let totalFed = 0;
    let totalWht = 0;
    let totalFixedNotified = 0;
    let totalQty = 0;
    let totalCartons = 0;
    let taxSummaries = {};

    // Resolve items list to render dynamically based on template config
    const itemsSource = printableCard ? (printableCard.getAttribute('data-items-source') || 'sold-only') : 'sold-only';
    let itemsToRender = [];
    if (itemsSource === 'customer-linked') {
      const customer = dbCustomersList.find(x => 
        String(x.ntn) === String(activeInvoice.buyerNTN) || 
        x.partyName.toUpperCase() === activeInvoice.buyerName.toUpperCase()
      );
      const linkedItems = (customer && customer.linkedItems) ? customer.linkedItems : [];
      const invoiceTaxRatePercent = activeInvoice.items.find(x => x.taxRatePercent > 0)?.taxRatePercent || 18;
      
      if (linkedItems.length > 0) {
        linkedItems.forEach(li => {
          const soldItem = activeInvoice.items.find(it => String(it.productId) === String(li.itemId));
          const pr = dbItemsList.find(x => String(x.id) === String(li.itemId)) || {};
          
          if (soldItem) {
            itemsToRender.push({
              isSold: true,
              productId: li.itemId,
              productDescription: pr.itemDesc || li.description || soldItem.productDescription,
              itemCode: pr.itemCode || soldItem.itemCode || '',
              hsCode: pr.hsCode || soldItem.hsCode || '',
              quantity: soldItem.quantity,
              rateValue: soldItem.rateValue,
              valueSalesExcludingST: soldItem.valueSalesExcludingST,
              taxRatePercent: soldItem.taxRatePercent,
              salesTaxApplicable: soldItem.salesTaxApplicable,
              furtherTax: soldItem.furtherTax,
              discount: soldItem.discount,
              extraTax: soldItem.extraTax,
              fedPayable: soldItem.fedPayable,
              retailPrice: soldItem.retailPrice,
              fixedTax: soldItem.fixedTax,
              salesTaxWithheldAtSource: soldItem.salesTaxWithheldAtSource
            });
          } else {
            itemsToRender.push({
              isSold: false,
              productId: li.itemId,
              productDescription: pr.itemDesc || li.description || '',
              itemCode: pr.itemCode || '',
              hsCode: pr.hsCode || '',
              quantity: 0,
              rateValue: parseFloat(li.rate) || 0,
              valueSalesExcludingST: 0,
              taxRatePercent: invoiceTaxRatePercent,
              salesTaxApplicable: 0,
              furtherTax: 0,
              discount: 0,
              extraTax: 0,
              fedPayable: 0,
              retailPrice: 0,
              fixedTax: 0,
              salesTaxWithheldAtSource: 0
            });
          }
        });
      } else {
        activeInvoice.items.forEach(it => {
          const pr = dbItemsList.find(x => String(x.id) === String(it.productId)) || {};
          itemsToRender.push({
            isSold: true,
            productId: it.productId,
            productDescription: it.productDescription,
            itemCode: it.itemCode || pr.itemCode || '',
            hsCode: it.hsCode || pr.hsCode || '',
            quantity: it.quantity,
            rateValue: it.rateValue,
            valueSalesExcludingST: it.valueSalesExcludingST,
            taxRatePercent: it.taxRatePercent,
            salesTaxApplicable: it.salesTaxApplicable,
            furtherTax: it.furtherTax,
            discount: it.discount,
            extraTax: it.extraTax,
            fedPayable: it.fedPayable,
            retailPrice: it.retailPrice,
            fixedTax: it.fixedTax,
            salesTaxWithheldAtSource: it.salesTaxWithheldAtSource
          });
        });
      }
    } else {
      activeInvoice.items.forEach(it => {
        const pr = dbItemsList.find(x => String(x.id) === String(it.productId)) || {};
        itemsToRender.push({
          isSold: true,
          boxQty: pr.boxQty,
          ...it
        });
      });
    }

    // Phase 1: Accumulate all totals and group taxes by looping over items
    itemsToRender.forEach((item) => {
      const pr = dbItemsList.find(x => String(x.id) === String(item.productId)) || {};
      const qty = parseFloat(item.quantity) || 0;
      const valueExcl = parseFloat(item.valueSalesExcludingST || (item.rateValue * qty)) || 0;
      const salesTax = parseFloat(item.salesTaxApplicable || (valueExcl * (item.taxRatePercent / 100))) || 0;
      const discount = parseFloat(item.discount) || 0;
      const itemExtraTaxTotal = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;

      const furtherTax = item.furtherTax !== undefined
        ? parseFloat(item.furtherTax)
        : (item.furtherTaxAmt !== undefined
          ? parseFloat(item.furtherTaxAmt)
          : (activeInvoice.buyerRegistrationType === 'Unregistered' ? Math.max(0, valueExcl - discount) * 0.04 : 0));

      const retailPrice = parseFloat(item.retailPrice) || 0;
      const fed = parseFloat(item.fedPayable) || parseFloat(item.fed) || parseFloat(item.fedAmt) || 0;
      const wht = parseFloat(item.salesTaxWithheldAtSource) || parseFloat(item.salesTaxWithheld) || parseFloat(item.wht) || parseFloat(item.whTax) || 0;
      const fixedTax = parseFloat(item.fixedTax) || 0;

      const resolvedBoxQty = item.boxQty || pr.boxQty || 0;

      // Accumulate totals only for items sold
      if (item.isSold) {
        totalSalesValue += valueExcl;
        totalSalesTax += salesTax;
        totalFurtherTax += furtherTax;
        totalExtraTax += itemExtraTaxTotal;
        totalDiscount += discount;
        totalRetail += retailPrice * qty;
        totalFed += fed;
        totalWht += wht;
        totalFixedNotified += qty * fixedTax;
        totalQty += qty;
        if (resolvedBoxQty > 0) {
          totalCartons += (qty / resolvedBoxQty);
        }
      }

      // Group taxes for summaries
      if (salesTax > 0) {
        const key = `${item.taxRatePercent}%`;
        taxSummaries[key] = (taxSummaries[key] || 0) + salesTax;
      }
      if (furtherTax > 0) {
        const key = `Further Tax (4%)`;
        taxSummaries[key] = (taxSummaries[key] || 0) + furtherTax;
      }
      if (itemExtraTaxTotal > 0) {
        const key = `Extra Tax`;
        taxSummaries[key] = (taxSummaries[key] || 0) + itemExtraTaxTotal;
      }
      if (fed > 0) {
        const key = `FED`;
        taxSummaries[key] = (taxSummaries[key] || 0) + fed;
      }
      if (wht > 0) {
        const key = `WHT`;
        taxSummaries[key] = (taxSummaries[key] || 0) + wht;
      }
    });

    // Phase 2: Perform static layout placeholder replacements on the card's innerHTML
    if (printableCard) {
      const exclNet = totalSalesValue - totalDiscount;
      const inclSalesTaxSum = exclNet + totalSalesTax + totalFurtherTax;
      const grandTotal = inclSalesTaxSum + totalWht + totalExtraTax + totalFed + totalFixedNotified;
      
      const whtRateObj = activeInvoice.taxesBreakdown?.find(t => t.taxNature === 'Withholding Tax' || t.type === 'Withholding Tax');
      const whtPercent = whtRateObj ? (whtRateObj.ratePercent || whtRateObj.taxRatePercent || 0.5) : 0.5;
      const discountPercent = totalSalesValue > 0 ? Math.round(totalDiscount / totalSalesValue * 100) : 0;
      
      const fmt = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      let cardHtml = printableCard.innerHTML;
      cardHtml = cardHtml
        .replace(/\{\{SUBTOTAL_EXCL\}\}/g, fmt(totalSalesValue))
        .replace(/\{\{GROSS_TOTAL\}\}/g, fmt(exclNet + totalSalesTax + totalFurtherTax + totalDiscount))
        .replace(/\{\{TOTAL_DISCOUNT\}\}/g, fmt(totalDiscount))
        .replace(/\{\{DISCOUNT_PERCENT\}\}/g, String(discountPercent))
        .replace(/\{\{NET_INCL\}\}/g, fmt(inclSalesTaxSum))
        .replace(/\{\{TOTAL_SALES_TAX\}\}/g, fmt(totalSalesTax))
        .replace(/\{\{TOTAL_FURTHER_TAX\}\}/g, fmt(totalFurtherTax))
        .replace(/\{\{NET_EXCL\}\}/g, fmt(exclNet))
        .replace(/\{\{TOTAL_WHT\}\}/g, fmt(totalWht))
        .replace(/\{\{WHT_PERCENT\}\}/g, String(whtPercent))
        .replace(/\{\{GRAND_TOTAL\}\}/g, fmt(grandTotal))
        .replace(/\{\{TOTAL_CARTONS\}\}/g, totalCartons.toFixed(2))
        .replace(/\{\{TOTAL_PACKETS\}\}/g, String(totalQty));
      
      printableCard.innerHTML = cardHtml;
    }

    // Phase 3: Fetch the recreated tbody, template elements and generate row items
    const rowTemplateElement = document.getElementById('receipt-row-template');
    const rowTemplateHtml = rowTemplateElement ? rowTemplateElement.innerHTML : '';
    const gstDisplay = printableCard ? (printableCard.getAttribute('data-gst-display') || 'standard') : 'standard';

    const tbodyRecreated = document.getElementById('receipt-items-tbody');
    if (tbodyRecreated) {
      tbodyRecreated.innerHTML = '';

      itemsToRender.forEach((item, index) => {
        const pr = dbItemsList.find(x => String(x.id) === String(item.productId)) || {};
        const qty = parseFloat(item.quantity) || 0;
        const valueExcl = parseFloat(item.valueSalesExcludingST || (item.rateValue * qty)) || 0;
        const salesTax = parseFloat(item.salesTaxApplicable || (valueExcl * (item.taxRatePercent / 100))) || 0;
        const discount = parseFloat(item.discount) || 0;
        const itemExtraTaxTotal = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;

        const furtherTax = item.furtherTax !== undefined
          ? parseFloat(item.furtherTax)
          : (item.furtherTaxAmt !== undefined
            ? parseFloat(item.furtherTaxAmt)
            : (activeInvoice.buyerRegistrationType === 'Unregistered' ? Math.max(0, valueExcl - discount) * 0.04 : 0));

        const retailPrice = parseFloat(item.retailPrice) || 0;
        const fed = parseFloat(item.fedPayable) || parseFloat(item.fed) || parseFloat(item.fedAmt) || 0;
        const wht = parseFloat(item.salesTaxWithheldAtSource) || parseFloat(item.salesTaxWithheld) || parseFloat(item.wht) || parseFloat(item.whTax) || 0;
        const fixedTax = parseFloat(item.fixedTax) || 0;
        const rate = parseFloat(item.rateValue) || 0;

        const resolvedBoxQty = item.boxQty || pr.boxQty || 0;
        const resolvedBoxQtyText = resolvedBoxQty > 0 ? String(resolvedBoxQty) : '';
        const cartonsText = item.isSold && qty > 0 && resolvedBoxQty > 0 ? (qty / resolvedBoxQty).toFixed(2) : '';
        const packetsText = item.isSold && qty > 0 ? qty.toString() : '-';
        const totalAmountText = item.isSold ? valueExcl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

        // Build tax rate & amount lines
        let taxPercentLines = [];
        let taxAmtLines = [];
        if (salesTax > 0) {
          taxPercentLines.push(`${item.taxRatePercent}% ST`);
          taxAmtLines.push(salesTax.toFixed(2));
        }
        if (furtherTax > 0) {
          taxPercentLines.push(`${furtherTaxRateVal}% FT`);
          taxAmtLines.push(furtherTax.toFixed(2));
        }
        if (itemExtraTaxTotal > 0) {
          const itemEtRate = extraTaxRateVal || Math.round(itemExtraTaxTotal / Math.max(1, valueExcl - discount) * 100);
          taxPercentLines.push(`${itemEtRate}% ET`);
          taxAmtLines.push(itemExtraTaxTotal.toFixed(2));
        }
        if (fed > 0) {
          const itemFedRate = fedTaxRateVal || Math.round(fed / Math.max(1, valueExcl - discount) * 100);
          taxPercentLines.push(`${itemFedRate}% FED`);
          taxAmtLines.push(fed.toFixed(2));
        }

        if (taxPercentLines.length === 0) {
          taxPercentLines.push(`${item.taxRatePercent || 0}% ST`);
          taxAmtLines.push(`0.00`);
        }

        const inclAmount = valueExcl - discount + salesTax + furtherTax + itemExtraTaxTotal + fed;

        const tr = document.createElement('tr');
        if (rowTemplateHtml) {
          const rateFormatted = rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const exclAmountFormatted = valueExcl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          let gstRateHtml = `${item.taxRatePercent}%`;
          let gstAmtHtml = item.isSold ? salesTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
          if (item.isSold && furtherTax > 0) {
            gstRateHtml += `<br><div style="font-size: 8px; color: #555; margin-top: 2px;">4% FT</div>`;
            gstAmtHtml += `<br><div style="font-size: 8px; color: #555; margin-top: 2px;">${furtherTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`;
          }

          const gstRateVal = taxPercentLines.join('<br>');
          const gstAmtVal = taxAmtLines.join('<br>');
          let gstRateOutput = (gstDisplay === 'stacked') ? gstRateHtml : gstRateVal;
          let gstAmtOutput = (gstDisplay === 'stacked') ? gstAmtHtml : gstAmtVal;

          if (colsMode === 'classic') {
            gstRateOutput = `${taxPercentLines.join('<br>')} (${taxAmtLines.join('<br>')})`;
            gstAmtOutput = gstRateOutput;
          }

          const resolvedItemCode = item.itemCode || (dbItemsList.find(x => 
            String(x.id) === String(item.productId) || 
            String(x.hsCode).replace(/\s+/g, '') === String(item.hsCode).replace(/\s+/g, '')
          )?.itemCode) || item.hsCode || '-';

          tr.innerHTML = rowTemplateHtml
            .replace(/\{\{INDEX\}\}/g, String(index + 1))
            .replace(/\{\{PRODUCT_DESCRIPTION\}\}/g, item.productDescription.toUpperCase())
            .replace(/\{\{ITEM_CODE\}\}/g, resolvedItemCode)
            .replace(/\{\{HS_CODE\}\}/g, item.hsCode || '-')
            .replace(/\{\{QTY\}\}/g, item.isSold && qty > 0 ? qty.toString() : '')
            .replace(/\{\{RATE\}\}/g, rateFormatted)
            .replace(/\{\{VALUE_EXCL\}\}/g, exclAmountFormatted)
            .replace(/\{\{RETAIL_PRICE\}\}/g, retailPrice > 0 ? retailPrice.toFixed(2) : '')
            .replace(/\{\{FIXED_TAX\}\}/g, fixedTax > 0 ? fixedTax.toFixed(2) : '0.00')
            .replace(/\{\{GST_RATE\}\}/g, gstRateOutput)
            .replace(/\{\{GST_AMOUNT\}\}/g, gstAmtOutput)
            .replace(/\{\{INCL_AMOUNT\}\}/g, item.isSold ? inclAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')
            .replace(/\{\{BOX_QTY\}\}/g, resolvedBoxQtyText)
            .replace(/\{\{CARTONS\}\}/g, cartonsText)
            .replace(/\{\{PACKETS\}\}/g, packetsText)
            .replace(/\{\{TOTAL_AMOUNT\}\}/g, totalAmountText);
        } else {
          // Fallback for legacy hardcoded templates (Standard, Thermal, Classic, Format 1)
          if (colsMode === 'thermal') {
            tr.innerHTML = `
              <td style="padding: 4px 2px; font-size: 10px; border-bottom: 1px dashed #000; text-align: left;">
                <div><strong>${item.productDescription.toUpperCase()}</strong></div>
                <div style="font-size: 8px; color: #555;">HS: ${item.hsCode} | Rate: ${(valueExcl / qty).toFixed(2)} | Tax: ${taxPercentLines.join(', ')}</div>
              </td>
              <td style="padding: 4px 2px; font-size: 10px; border-bottom: 1px dashed #000; text-align: center; vertical-align: middle;">${qty}</td>
              <td style="padding: 4px 2px; font-size: 10px; border-bottom: 1px dashed #000; text-align: right; vertical-align: middle; font-weight: bold;">${inclAmount.toFixed(2)}</td>
            `;
          } else if (colsMode === 'classic') {
            tr.innerHTML = `
              <td style="text-align: center; border: 1px solid #ccc; padding: 6px;">${index + 1}</td>
              <td style="border: 1px solid #ccc; padding: 6px;">${item.hsCode}</td>
              <td style="white-space: normal; text-align: left; border: 1px solid #ccc; padding: 6px;">${item.productDescription.toUpperCase()}</td>
              <td style="text-align: center; border: 1px solid #ccc; padding: 6px;">${qty}</td>
              <td style="text-align: right; border: 1px solid #ccc; padding: 6px;">${parseFloat(valueExcl / qty).toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #ccc; padding: 6px;">${valueExcl.toFixed(2)}</td>
              <td style="text-align: right; line-height: 1.4; border: 1px solid #ccc; padding: 6px; font-size: 9px;">${taxPercentLines.join('<br>')} (${taxAmtLines.join('<br>')})</td>
              <td style="text-align: right; font-weight: bold; border: 1px solid #ccc; padding: 6px;">${inclAmount.toFixed(2)}</td>
            `;
          } else if (colsMode === 'format-1') {
            const unitRate = qty > 0 ? (valueExcl / qty) : 0;
            const rateFormatted = unitRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const inclAmountFormatted = inclAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const resolvedItemCode = item.itemCode || (dbItemsList.find(x => 
              String(x.id) === String(item.productId) || 
              String(x.hsCode).replace(/\s+/g, '') === String(item.hsCode).replace(/\s+/g, '')
            )?.itemCode) || item.hsCode || '-';
            tr.innerHTML = `
              <td style="border: 1px solid #000000; padding: 8px; text-align: left; white-space: nowrap;">${resolvedItemCode}</td>
              <td style="white-space: normal; text-align: left; border: 1px solid #000000; padding: 8px;">${item.productDescription.toUpperCase()}</td>
              <td style="text-align: center; border: 1px solid #000000; padding: 8px;">${qty}</td>
              <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">${rateFormatted}</td>
              <td style="text-align: right; font-weight: bold; border: 1px solid #000000; padding: 8px; white-space: nowrap;">${inclAmountFormatted}T</td>
            `;
          } else if (colsMode === 'format-2') {
            const rateFormatted = (item.rateValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const exclAmountFormatted = valueExcl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            let gstRateHtml = `${item.taxRatePercent}%`;
            let gstAmtHtml = item.isSold ? salesTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
            
            if (item.isSold && furtherTax > 0) {
              gstRateHtml += `<br><div style="font-size: 8px; color: #555; margin-top: 2px;">4% FT</div>`;
              gstAmtHtml += `<br><div style="font-size: 8px; color: #555; margin-top: 2px;">${furtherTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`;
            }
            
            const inclAmountFormatted = item.isSold ? inclAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
            const qtyHtml = item.isSold && qty > 0 ? qty.toString() : '';
            const itemCodeText = item.itemCode || '-';
            
            tr.innerHTML = `
              <td style="border: 1px solid #000000; padding: 8px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span>${item.productDescription.toUpperCase()}</span>
                  <span style="font-family: monospace; font-size: 9px; font-weight: bold; margin-left: 10px; color: #333;">${itemCodeText}</span>
                </div>
              </td>
              <td style="text-align: center; border: 1px solid #000000; padding: 8px;">${qtyHtml}</td>
              <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">${rateFormatted}</td>
              <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap;">${exclAmountFormatted}</td>
              <td style="text-align: center; border: 1px solid #000000; padding: 8px; white-space: nowrap; line-height: 1.2;">${gstRateHtml}</td>
              <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap; line-height: 1.2;">${gstAmtHtml}</td>
              <td style="text-align: right; font-weight: bold; border: 1px solid #000000; padding: 8px; white-space: nowrap;">${inclAmountFormatted}</td>
            `;
          } else {
            // Standard 11 columns
            tr.innerHTML = `
              <td style="text-align: center; border: 1px solid #000; padding: 4px;">${index + 1}</td>
              <td style="border: 1px solid #000; padding: 4px;">${item.hsCode}</td>
              <td style="white-space: normal; text-align: left; border: 1px solid #000; padding: 4px;">${item.productDescription.toUpperCase()}</td>
              <td style="text-align: center; border: 1px solid #000; padding: 4px;">${qty}</td>
              <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">${parseFloat(valueExcl / qty).toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">${valueExcl.toFixed(2)}</td>
              <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">${retailPrice > 0 ? retailPrice.toFixed(2) : ''}</td>
              <td style="text-align: right; border: 1px solid #000; padding: 4px; white-space: nowrap;">${fixedTax > 0 ? fixedTax.toFixed(2) : '0.00'}</td>
              <td style="text-align: center; line-height: 1.4; border: 1px solid #000; padding: 4px; white-space: nowrap;">${taxPercentLines.join('<br>')}</td>
              <td style="text-align: right; line-height: 1.4; border: 1px solid #000; padding: 4px; white-space: nowrap;">${taxAmtLines.join('<br>')}</td>
              <td style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 4px; white-space: nowrap;">${inclAmount.toFixed(2)}</td>
            `;
          }
        }
        tbodyRecreated.appendChild(tr);
      });
    }

    // Append Total Row inside table if specified (e.g. Format 2)
    const appendTotalRow = (colsMode === 'format-2' || (printableCard && printableCard.getAttribute('data-total-row') === 'append'));
    if (appendTotalRow && tbodyRecreated) {
      const fmt = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const trTotal = document.createElement('tr');
      trTotal.style.fontWeight = 'bold';
      trTotal.style.borderTop = '2px double #000000';
      trTotal.style.borderBottom = '2px double #000000';
      
      const totalSalesTaxPlusFurtherTax = totalSalesTax + totalFurtherTax;
      const exclNet = totalSalesValue - totalDiscount;
      const inclSalesTaxSum = exclNet + totalSalesTax + totalFurtherTax;

      trTotal.innerHTML = `
        <td style="border: 1px solid #000000; padding: 8px; text-align: left; font-weight: bold;">Total</td>
        <td style="text-align: center; border: 1px solid #000000; padding: 8px; font-weight: bold;">${totalQty}</td>
        <td style="border: 1px solid #000000; padding: 8px;"></td>
        <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap; font-weight: bold;">${fmt(totalSalesValue)}</td>
        <td style="border: 1px solid #000000; padding: 8px;"></td>
        <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap; font-weight: bold;">${fmt(totalSalesTaxPlusFurtherTax)}</td>
        <td style="text-align: right; border: 1px solid #000000; padding: 8px; white-space: nowrap; font-weight: bold;">${fmt(inclSalesTaxSum)}</td>
      `;
      tbodyRecreated.appendChild(trTotal);
    }

    // Pad empty rows for format-1 layout to maintain A4 corporate structure height
    if (colsMode === 'format-1' && activeInvoice.items.length < 8 && tbodyRecreated) {
      const needed = 8 - activeInvoice.items.length;
      for (let i = 0; i < needed; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="border: 1px solid #000000; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #000000; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #000000; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #000000; padding: 8px;">&nbsp;</td>
          <td style="border: 1px solid #000000; padding: 8px;">&nbsp;</td>
        `;
        tbodyRecreated.appendChild(tr);
      }
    }

    // Render Totals Table
    const totalsTable = document.getElementById('receipt-totals-table');
    if (totalsTable) {
      const salesTaxName = getTaxNameForNature('Sales Tax');
      const furtherTaxName = getTaxNameForNature('Further Tax');
      const whtName = getTaxNameForNature('Withholding Tax');
      const exclNet = totalSalesValue - totalDiscount;
      const inclSalesTaxSum = exclNet + totalSalesTax + totalFurtherTax;
      const grandTotal = inclSalesTaxSum + totalWht + totalExtraTax + totalFed + totalFixedNotified;

      if (colsMode === 'thermal') {
        let summaryRowsHtml = `
          <tr>
            <td style="padding: 4px 0; text-align: right; font-weight: bold;">Sub Total:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold;">${totalSalesValue.toFixed(2)}</td>
          </tr>
        `;
        if (totalDiscount > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #ef4444;">Discount:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #ef4444;">- ${totalDiscount.toFixed(2)}</td>
            </tr>
          `;
        }
        summaryRowsHtml += `
          <tr>
            <td style="padding: 4px 0; text-align: right;">${salesTaxName}:</td>
            <td style="padding: 4px 0; text-align: right;">${totalSalesTax.toFixed(2)}</td>
          </tr>
        `;
        if (totalFurtherTax > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="padding: 4px 0; text-align: right;">${furtherTaxName}:</td>
              <td style="padding: 4px 0; text-align: right;">${totalFurtherTax.toFixed(2)}</td>
            </tr>
          `;
        }
        if (totalWht > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="padding: 4px 0; text-align: right;">${whtName}:</td>
              <td style="padding: 4px 0; text-align: right;">${totalWht.toFixed(2)}</td>
            </tr>
          `;
        }
        if (totalExtraTax > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="padding: 4px 0; text-align: right;">${getTaxNameForNature('Extra Tax')}:</td>
              <td style="padding: 4px 0; text-align: right;">${totalExtraTax.toFixed(2)}</td>
            </tr>
          `;
        }
        if (totalFed > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="padding: 4px 0; text-align: right;">${getTaxNameForNature('FED Tax')}:</td>
              <td style="padding: 4px 0; text-align: right;">${totalFed.toFixed(2)}</td>
            </tr>
          `;
        }
        summaryRowsHtml += `
          <tr style="border-top: 1px dashed #000;">
            <td style="padding: 6px 0; text-align: right; font-weight: bold; font-size: 12px;">GRAND TOTAL:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; font-size: 12px;">${grandTotal.toFixed(2)}</td>
          </tr>
        `;
        totalsTable.innerHTML = summaryRowsHtml;
      } else if (colsMode === 'format-1') {
        const fmtPKR = (val) => "PKR " + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const borderStyle = '1px solid #000000';
        
        let summaryRowsHtml = `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold; width: 60%;">Subtotal</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; width: 40%;">${fmtPKR(totalSalesValue)}</td>
          </tr>
        `;

        if (totalDiscount > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold; color: #ef4444;">Discount</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; color: #ef4444;">- ${fmtPKR(totalDiscount)}</td>
            </tr>
          `;
        }

        summaryRowsHtml += `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold;">Sales Tax Payable</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right;">${fmtPKR(totalSalesTax)}</td>
          </tr>
        `;

        if (totalFurtherTax > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold;">Further Tax Payable</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right;">${fmtPKR(totalFurtherTax)}</td>
            </tr>
          `;
        }

        if (totalWht > 0) {
          const whtRateObj = activeInvoice.taxesBreakdown?.find(t => t.taxNature === 'Withholding Tax' || t.type === 'Withholding Tax');
          const whtPercent = whtRateObj ? (whtRateObj.ratePercent || whtRateObj.taxRatePercent || 0.5) : 0.5;
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold;">WHT ${whtPercent}%</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right;">${fmtPKR(totalWht)}</td>
            </tr>
          `;
        }

        summaryRowsHtml += `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: left; font-weight: bold; background-color: #f1f1f1;">Net Payable</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1;">${fmtPKR(grandTotal)}</td>
          </tr>
        `;

        totalsTable.innerHTML = summaryRowsHtml;
      } else {
        const borderStyle = (colsMode === 'classic') ? '1px solid #cbd5e1' : '1px solid #000';
        const fmt = (val) => val.toFixed(2);
        
        let summaryRowsHtml = `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; width: 60%;">Sub Total:</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; width: 40%;">${fmt(totalSalesValue)}</td>
          </tr>
        `;

        if (totalDiscount > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; color: #ef4444;">Discount:</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; color: #ef4444;">- ${fmt(totalDiscount)}</td>
            </tr>
          `;
        }

        summaryRowsHtml += `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${salesTaxName} :</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fmt(totalSalesTax)}</td>
          </tr>
        `;

        if (totalFurtherTax > 0) {
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${furtherTaxName} :</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fmt(totalFurtherTax)}</td>
            </tr>
          `;
        }

        summaryRowsHtml += `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${whtName} :</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fmt(totalWht)}</td>
          </tr>
        `;

        if (totalExtraTax > 0) {
          const extraTaxName = getTaxNameForNature('Extra Tax');
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${extraTaxName} :</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fmt(totalExtraTax)}</td>
            </tr>
          `;
        }

        if (totalFed > 0) {
          const fedTaxName = getTaxNameForNature('FED Tax');
          summaryRowsHtml += `
            <tr>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fedTaxName} :</td>
              <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold;">${fmt(totalFed)}</td>
            </tr>
          `;
        }

        summaryRowsHtml += `
          <tr>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1;">Grand Total :</td>
            <td style="border: ${borderStyle}; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1;">${fmt(grandTotal)}</td>
          </tr>
        `;

        totalsTable.innerHTML = summaryRowsHtml;
      }
    }

    // Populate vertical totals and withholding summary if the container is present
    const summaryContainer = document.getElementById('receipt-summary-container');
    if (summaryContainer) {
      const fmt = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const exclNet = totalSalesValue - totalDiscount;
      const inclSalesTaxSum = exclNet + totalSalesTax + totalFurtherTax;
      const grandTotal = inclSalesTaxSum + totalWht + totalExtraTax + totalFed + totalFixedNotified;
      
      let summaryHtml = '';
      if (totalWht > 0) {
        const whtRateObj = activeInvoice.taxesBreakdown?.find(t => t.taxNature === 'Withholding Tax' || t.type === 'Withholding Tax');
        const whtPercent = whtRateObj ? (whtRateObj.ratePercent || whtRateObj.taxRatePercent || 0.5) : 0.5;
        summaryHtml += `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding: 4px 0;">
            <span style="font-weight: bold;">WHT ${whtPercent}%</span>
            <span>${fmt(totalWht)}</span>
          </div>
        `;
      }
      summaryHtml += `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; font-weight: bold;">
          <span>Total</span>
          <span>${fmt(grandTotal)}</span>
        </div>
      `;
      summaryContainer.innerHTML = summaryHtml;
    }

    // Amount in words
    const amountWordsField = document.getElementById('receipt-amount-in-words');
    if (amountWordsField) {
      const exclNet = totalSalesValue - totalDiscount;
      const inclSalesTaxSum = exclNet + totalSalesTax + totalFurtherTax;
      const grandTotal = inclSalesTaxSum + totalWht + totalExtraTax + totalFed + totalFixedNotified;
      amountWordsField.textContent = numberToWords(grandTotal);
    }
  }

  // Generate QR Code pointing to FBR real-time portal
  const qrContainer = document.getElementById('qrcode');
  if (qrContainer) {
    qrContainer.innerHTML = '';
    // DI API V1.12 spec: QR Code 1.0" x 1.0" (76px at 96 DPI in layout), Version 2.0 (25×25)
    new QRCode(qrContainer, {
      text: activeInvoice.invoiceNumber || 'PENDING',
      width: colsMode === 'thermal' ? 80 : 76,
      height: colsMode === 'thermal' ? 80 : 76,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // Activate Modal overlay
  document.getElementById('receipt-modal').classList.add('active');
}

window.onTemplateChange = async function () {
  const select = document.getElementById('receipt-template-select');
  if (select) {
    selectedTemplate = select.value;
    await openReceiptModal();
  }
};

window.openTemplatesFolder = async function () {
  try {
    await window.api.openTemplatesFolder();
  } catch (err) {
    alert("Could not open templates folder: " + err.message);
  }
};

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
    const printableCard = document.getElementById('printable-receipt-card');
    const colsMode = printableCard ? printableCard.getAttribute('data-columns-mode') : 'standard';
    const isLandscape = (colsMode === 'standard');
    const result = await window.api.savePDF(filename, isLandscape);
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
window.toggleReportsSubmenu = function () {
  reportsExpanded = !reportsExpanded;
  const submenu = document.getElementById('reports-submenu');
  const chevron = document.getElementById('reports-chevron');
  if (submenu) submenu.style.display = reportsExpanded ? 'flex' : 'none';
  if (chevron) chevron.style.transform = reportsExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.initReports = async function (prefix = 'print') {
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
    opt.value = fbrSettings.sellerNTN || 'YOUR NTN';
    opt.textContent = fbrSettings.sellerName || 'YOUR COMPANY NAME';
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

window.onPrintFilterChange = async function () {
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

window.onReportFilterChange = async function () {
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

window.printFilteredInvoices = async function () {
  const select = document.getElementById('print-invoice-select');
  const selectedId = select ? select.value : '';

  if (selectedId) {
    // Print single invoice
    const full = await dbGetInvoiceFull(selectedId);
    if (full) {
      activeInvoice = full;
      await openReceiptModal();
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
    let totalFixedNotified = 0;
    let taxSummaries = {};

    // Extract Tax Nature Rates for this invoice
    let furtherTaxRateVal = 4;
    let extraTaxRateVal = 2;
    let whTaxRateVal = 0;
    let fedTaxRateVal = 0;

    if (full.taxesBreakdown && full.taxesBreakdown.length > 0) {
      full.taxesBreakdown.forEach(t => {
        const nature = t.taxNature || '';
        const r = parseFloat(t.ratePercent || t.rate) || 0;
        if (nature === 'Further Tax') furtherTaxRateVal = r;
        else if (nature === 'Extra Tax') extraTaxRateVal = r;
        else if (nature === 'Withholding Tax') whTaxRateVal = r;
        else if (nature === 'FED Tax') fedTaxRateVal = r;
      });
    }

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
      const fixedTax = parseFloat(item.fixedTax) || 0;

      totalSalesValue += valueExcl;
      totalSalesTax += salesTax;
      totalFurtherTax += furtherTax;
      totalExtraTax += extraTax;
      totalDiscount += discount;
      totalRetail += retailPrice * qty;
      totalFed += fed;
      totalWht += wht;
      totalFixedNotified += qty * fixedTax;

      // Group taxes
      if (salesTax > 0) {
        const key = `${item.taxRatePercent}%`;
        taxSummaries[key] = (taxSummaries[key] || 0) + salesTax;
      }
      if (furtherTax > 0) {
        const key = `Further Tax (4%)`;
        taxSummaries[key] = (taxSummaries[key] || 0) + furtherTax;
      }
      if (extraTax > 0) {
        const key = `Extra Tax`;
        taxSummaries[key] = (taxSummaries[key] || 0) + extraTax;
      }
      if (fed > 0) {
        const key = `FED`;
        taxSummaries[key] = (taxSummaries[key] || 0) + fed;
      }
      if (wht > 0) {
        const key = `WHT`;
        taxSummaries[key] = (taxSummaries[key] || 0) + wht;
      }

      let taxPercentLines = [];
      let taxAmtLines = [];
      if (salesTax > 0) {
        taxPercentLines.push(`${item.taxRatePercent}% ST`);
        taxAmtLines.push(salesTax.toFixed(2));
      }
      if (furtherTax > 0) {
        taxPercentLines.push(`${furtherTaxRateVal}% FT`);
        taxAmtLines.push(furtherTax.toFixed(2));
      }
      if (extraTax > 0) {
        const itemEtRate = extraTaxRateVal || Math.round(extraTax / Math.max(1, valueExcl - discount) * 100);
        taxPercentLines.push(`${itemEtRate}% ET`);
        taxAmtLines.push(extraTax.toFixed(2));
      }
      if (fed > 0) {
        const itemFedRate = fedTaxRateVal || Math.round(fed / Math.max(1, valueExcl - discount) * 100);
        taxPercentLines.push(`${itemFedRate}% FED`);
        taxAmtLines.push(fed.toFixed(2));
      }
      if (wht > 0) {
        const itemWhtRate = whTaxRateVal || Math.round(wht / Math.max(1, valueExcl - discount) * 100);
        taxPercentLines.push(`${itemWhtRate}% WHT`);
        taxAmtLines.push(wht.toFixed(2));
      }

      if (taxPercentLines.length === 0) {
        taxPercentLines.push(`0% ST`);
        taxAmtLines.push(`0.00`);
      }

      const inclAmount = valueExcl - discount + salesTax + furtherTax + extraTax + fed;

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
          <td style="white-space: normal; text-align: left; border: 1px solid #000; padding: 4px;">${item.productDescription.toUpperCase()}</td>
          <td style="text-align: center; border: 1px solid #000; padding: 4px;">${qty}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${parseFloat(valueExcl / qty).toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${valueExcl.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${retailPrice > 0 ? retailPrice.toFixed(2) : ''}</td>
          <td style="text-align: right; border: 1px solid #000; padding: 4px;">${fixedTax > 0 ? fixedTax.toFixed(2) : '0.00'}</td>
          <td style="text-align: center; line-height: 1.4; border: 1px solid #000; padding: 4px;">${taxPercentLines.join('<br>')}</td>
          <td style="text-align: right; line-height: 1.4; border: 1px solid #000; padding: 4px;">${taxAmtLines.join('<br>')}</td>
          <td style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 4px;">${inclAmount.toFixed(2)}</td>
        </tr>
      `;
    });

    let summaryRowsHtml = '';
    summaryRowsHtml += `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; width: 60%;">Sub Total :</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; width: 40%;">${totalSalesValue.toFixed(2)}</td>
      </tr>
    `;

    if (totalDiscount > 0) {
      summaryRowsHtml += `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; color: #ef4444;">Discount :</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; color: #ef4444;">- ${totalDiscount.toFixed(2)}</td>
        </tr>
      `;
    }

    let totalTaxSum = 0;
    Object.keys(taxSummaries).forEach(k => {
      const amt = taxSummaries[k];
      totalTaxSum += amt;

      let label = k;
      if (k.endsWith('%')) {
        label = `${k} ST`;
      } else if (k === 'Further Tax (4%)') {
        label = `${furtherTaxRateVal}% FT`;
      } else if (k === 'Extra Tax') {
        label = `${extraTaxRateVal}% ET`;
      } else if (k === 'FED') {
        label = `${fedTaxRateVal}% FED`;
      } else if (k === 'WHT') {
        label = `${whTaxRateVal}% WHT`;
      }

      summaryRowsHtml += `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${label} :</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${amt.toFixed(2)}</td>
        </tr>
      `;
    });

    if (totalFixedNotified > 0) {
      summaryRowsHtml += `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">Total Fixed Notified Value :</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${totalFixedNotified.toFixed(2)}</td>
        </tr>
      `;
    }

    summaryRowsHtml += `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1;">Total Tax :</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1;">${totalTaxSum.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1; font-size: 11px;">Incl. Tax Total :</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold; background-color: #f1f1f1; font-size: 11px;">${parseFloat(totalSalesValue - totalDiscount + totalTaxSum + totalFixedNotified).toFixed(2)}</td>
      </tr>
    `;

    card.innerHTML = `
      <!-- FBR Compliance Top Header Banner -->
      <div class="print-fbr-banner" style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #000; padding: 6px 12px; margin-bottom: 12px; background-color: #fff; color: #000;">
        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
          <img src="fbrdigitalinvoicesystemlogo.png" alt="FBR Digital Invoicing System Logo" width="160" height="60" style="object-fit: contain;">
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-weight: bold; font-size: 13px; text-transform: uppercase;">FBR Invoice #</div>
          <div style="font-family: monospace; font-size: 13px; font-weight: bold; margin-top: 4px;">${inv.invoiceNumber || 'PENDING POSTING'}</div>
        </div>
        <div style="flex: 1; display: flex; justify-content: flex-end;">
          <div id="qrcode-${inv.id}" style="width: 76px; height: 76px;"></div>
        </div>
      </div>

      <!-- Seller Information Box -->
      <div style="border: 1px solid #000; padding: 10px; margin-bottom: 12px; color: #000;">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">${(fbrSettings.sellerName || 'YOUR COMPANY NAME').toUpperCase()}</div>
        <div style="margin-bottom: 4px; font-size: 10px;">${(fbrSettings.sellerAddress || '').toUpperCase()}</div>
        <div style="display: flex; gap: 40px; font-size: 10px;">
          <div><strong>NTN : </strong><span>${fbrSettings.sellerNTN || ''}</span></div>
          <div><strong>STRN : </strong><span>-</span></div>
        </div>
      </div>

      <!-- Side-by-Side: Bill To & Sales Invoice Details Table -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 16px; color: #000;">
        <!-- Bill To Box (Bordered) -->
        <div style="flex: 1.5; border: 1px solid #000; padding: 8px;">
          <div style="font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;">BILL TO :</div>
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;">${(inv.buyerName || '').toUpperCase()}</div>
          <div style="margin-bottom: 4px; font-size: 10px;">${(() => {
        const customer = dbCustomersList.find(x => x.ntn === inv.buyerNTN || x.partyName.toUpperCase() === inv.buyerName.toUpperCase());
        const addr = full.buyerAddress || (customer ? customer.address : '') || 'N/A';
        return addr.toUpperCase();
      })()}</div>
          <div style="font-size: 10px;"><strong>NTN : </strong><span>${inv.buyerNTN || ''}</span></div>
        </div>
        
        <!-- Sales Invoice Info Table -->
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
                <td style="border-right: 1px solid #000; padding: 6px;">${inv.invoiceDate}</td>
                <td style="border-right: 1px solid #000; padding: 6px;">${inv.id}</td>
                <td style="padding: 6px;">${(String(inv.invoiceRefNo || '').trim() && String(inv.invoiceRefNo || '').trim() !== '0') ? inv.invoiceRefNo : '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Items Table -->
      <div class="invoice-table-container" style="border: 1px solid #000; margin-bottom: 12px;">
        <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; font-size: 9px; color: #000;">
          <thead>
            <tr style="background-color: #f1f1f1;">
              <th style="border: 1px solid #000; padding: 6px; width: 4%;">Sr #</th>
              <th style="border: 1px solid #000; padding: 6px; width: 10%;">H.S Code</th>
              <th style="border: 1px solid #000; padding: 6px; width: 25%;">Description</th>
              <th style="border: 1px solid #000; padding: 6px; width: 5%;">Qty</th>
              <th style="border: 1px solid #000; padding: 6px; width: 10%;">Rate</th>
              <th style="border: 1px solid #000; padding: 6px; width: 10%;">Excl.Amt</th>
              <th style="border: 1px solid #000; padding: 6px; width: 8%;">Retail</th>
              <th style="border: 1px solid #000; padding: 6px; width: 10%;">Fixed Notify Value</th>
              <th style="border: 1px solid #000; padding: 6px; width: 6%;">Tax %</th>
              <th style="border: 1px solid #000; padding: 6px; width: 8%;">Tax Amt</th>
              <th style="border: 1px solid #000; padding: 6px; width: 12%;">Incl. Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <!-- Bottom Summary block: side-by-side flex layout -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 24px; color: #000;">
        <!-- Left block: Amount in Words -->
        <div style="flex: 1.5; font-size: 11px;">
          <strong>Amount in Words: </strong>
          <span style="text-decoration: underline; margin-left: 8px;">${numberToWords(totalSalesValue - totalDiscount + totalTaxSum + totalFixedNotified)}</span>
        </div>
        <!-- Right block: Totals Box -->
        <div style="flex: 1; border: 1px solid #000;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            ${summaryRowsHtml}
          </table>
        </div>
      </div>

      <!-- Footer/Prepared By section -->
      <div style="margin-top: 60px; color: #000;">
        <div style="display: inline-block; text-align: center; width: 180px; border-top: 1px solid #000; padding-top: 6px; font-weight: bold; font-size: 11px;">
          Prepared By
        </div>
      </div>
    `;

    container.appendChild(card);

    const qrBox = document.getElementById(`qrcode-${inv.id}`);
    if (qrBox) {
      new QRCode(qrBox, {
        text: full.invoiceNumber || 'PENDING',
        width: 76,
        height: 76,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  document.querySelector('#receipt-modal .modal-title').textContent = `🖨️ Batch Invoice Print Preview (${filtered.length} Invoices)`;
  document.getElementById('receipt-modal').classList.add('active');

  triggerPrint();
};

window.printSalesDetailsReport = async function () {
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

  // Determine dynamic columns based on presence of other taxes
  let hasExtraTax = false;
  let hasFED = false;
  let hasWHT = false;

  fullInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const extraTax = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;
      const fed = parseFloat(item.fedPayable) || parseFloat(item.fed) || parseFloat(item.fedAmt) || 0;
      const wht = parseFloat(item.salesTaxWithheldAtSource) || parseFloat(item.salesTaxWithheld) || parseFloat(item.wht) || parseFloat(item.whTax) || 0;
      if (extraTax > 0) hasExtraTax = true;
      if (fed > 0) hasFED = true;
      if (wht > 0) hasWHT = true;
    });
  });

  // Group by Customer
  const grouped = {};
  fullInvoices.forEach(inv => {
    const buyer = (inv.buyerName || 'WALK IN CUSTOMER').toUpperCase();
    if (!grouped[buyer]) grouped[buyer] = [];
    grouped[buyer].push(inv);
  });

  let reportRowsHtml = '';

  // Grand totals
  let grandQty = 0;
  let grandExcl = 0;
  let grandSalesTax = 0;
  let grandFurtherTax = 0;
  let grandExtraTax = 0;
  let grandFED = 0;
  let grandWHT = 0;
  let grandIncl = 0;

  Object.keys(grouped).forEach(buyer => {
    let colspanVal = 11;
    if (hasExtraTax) colspanVal++;
    if (hasFED) colspanVal++;
    if (hasWHT) colspanVal++;

    reportRowsHtml += `
      <tr style="background-color: #f3f4f6; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000;">
        <td colspan="${colspanVal}" style="padding: 6px; color: #1e3a8a; text-align: left; text-transform: uppercase;">
          ${buyer}
        </td>
      </tr>
    `;

    let custQty = 0;
    let custExcl = 0;
    let custSalesTax = 0;
    let custFurtherTax = 0;
    let custExtraTax = 0;
    let custFED = 0;
    let custWHT = 0;
    let custIncl = 0;

    grouped[buyer].forEach(inv => {
      let invQty = 0;
      let invExcl = 0;
      let invSalesTax = 0;
      let invFurtherTax = 0;
      let invExtraTax = 0;
      let invFED = 0;
      let invWHT = 0;
      let invIncl = 0;

      (inv.items || []).forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rowValExcl = parseFloat(item.valueSalesExcludingST || (item.rateValue * qty)) || 0;
        const salesTax = parseFloat(item.salesTaxApplicable) || 0;
        const discount = parseFloat(item.discount) || 0;

        const furtherTax = item.furtherTax !== undefined
          ? parseFloat(item.furtherTax)
          : (inv.buyerRegistrationType === 'Unregistered' ? Math.max(0, rowValExcl - discount) * 0.04 : 0);

        const extraTax = parseFloat(item.extraTax) || parseFloat(item.extraTaxAmt) || parseFloat(item.totalExtraTax) || 0;
        const fed = parseFloat(item.fedPayable) || 0;
        const wht = parseFloat(item.salesTaxWithheldAtSource) || 0;

        const inclAmt = rowValExcl - discount + salesTax + furtherTax + extraTax + fed;

        invQty += qty;
        invExcl += rowValExcl;
        invSalesTax += salesTax;
        invFurtherTax += furtherTax;
        invExtraTax += extraTax;
        invFED += fed;
        invWHT += wht;
        invIncl += inclAmt;

        let rowHtml = `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 6px; text-align: left;">${inv.invoiceDate}</td>
            <td style="padding: 6px; text-align: left;">${inv.id}</td>
            <td style="padding: 6px; text-align: left;">${inv.invoiceNumber || 'PENDING'}</td>
            <td style="padding: 6px; text-align: left;">${item.hsCode || '-'}</td>
            <td style="padding: 6px; text-align: left; white-space: normal; max-width: 250px; word-break: break-word;">${item.productDescription.toUpperCase()}</td>
            <td style="padding: 6px; text-align: center;">${qty.toLocaleString()}</td>
            <td style="padding: 6px; text-align: right;">${parseFloat(rowValExcl / qty).toFixed(2)}</td>
            <td style="padding: 6px; text-align: right;">${rowValExcl.toFixed(2)}</td>
            <td style="padding: 6px; text-align: right;">${salesTax.toFixed(2)}</td>
            <td style="padding: 6px; text-align: right;">${furtherTax.toFixed(2)}</td>
        `;
        if (hasExtraTax) rowHtml += `<td style="padding: 6px; text-align: right;">${extraTax.toFixed(2)}</td>`;
        if (hasFED) rowHtml += `<td style="padding: 6px; text-align: right;">${fed.toFixed(2)}</td>`;
        if (hasWHT) rowHtml += `<td style="padding: 6px; text-align: right;">${wht.toFixed(2)}</td>`;
        rowHtml += `<td style="padding: 6px; text-align: right;">${inclAmt.toFixed(2)}</td>`;
        rowHtml += `</tr>`;

        reportRowsHtml += rowHtml;
      });

      // Invoice Total row
      let invTotalHtml = `
        <tr style="border-bottom: 1px dashed #cccccc; font-weight: bold; background-color: #fafafa;">
          <td></td><td></td><td></td><td></td>
          <td style="padding: 6px; text-align: right; font-weight: bold;">Total :</td>
          <td style="padding: 6px; text-align: center; font-weight: bold;">${invQty.toLocaleString()}</td>
          <td></td>
          <td style="padding: 6px; text-align: right; font-weight: bold;">${invExcl.toFixed(2)}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold;">${invSalesTax.toFixed(2)}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold;">${invFurtherTax.toFixed(2)}</td>
      `;
      if (hasExtraTax) invTotalHtml += `<td style="padding: 6px; text-align: right; font-weight: bold;">${invExtraTax.toFixed(2)}</td>`;
      if (hasFED) invTotalHtml += `<td style="padding: 6px; text-align: right; font-weight: bold;">${invFED.toFixed(2)}</td>`;
      if (hasWHT) invTotalHtml += `<td style="padding: 6px; text-align: right; font-weight: bold;">${invWHT.toFixed(2)}</td>`;
      invTotalHtml += `<td style="padding: 6px; text-align: right; font-weight: bold;">${invIncl.toFixed(2)}</td>`;
      invTotalHtml += `</tr>`;

      reportRowsHtml += invTotalHtml;

      custQty += invQty;
      custExcl += invExcl;
      custSalesTax += invSalesTax;
      custFurtherTax += invFurtherTax;
      custExtraTax += invExtraTax;
      custFED += invFED;
      custWHT += invWHT;
      custIncl += invIncl;
    });

    // Customer level grouped total row
    let custTotalHtml = `
      <tr style="border-bottom: 1px solid #000; font-size: 10px; font-weight: bold; color: #1e3a8a; background-color: #e5f3ff;">
        <td></td><td></td><td></td><td></td>
        <td style="padding: 8px 6px; text-align: right; text-transform: uppercase;">${buyer}</td>
        <td style="padding: 8px 6px; text-align: center;">${custQty.toLocaleString()}</td>
        <td></td>
        <td style="padding: 8px 6px; text-align: right;">${custExcl.toFixed(2)}</td>
        <td style="padding: 8px 6px; text-align: right;">${custSalesTax.toFixed(2)}</td>
        <td style="padding: 8px 6px; text-align: right;">${custFurtherTax.toFixed(2)}</td>
    `;
    if (hasExtraTax) custTotalHtml += `<td style="padding: 8px 6px; text-align: right;">${custExtraTax.toFixed(2)}</td>`;
    if (hasFED) custTotalHtml += `<td style="padding: 8px 6px; text-align: right;">${custFED.toFixed(2)}</td>`;
    if (hasWHT) custTotalHtml += `<td style="padding: 8px 6px; text-align: right;">${custWHT.toFixed(2)}</td>`;
    custTotalHtml += `<td style="padding: 8px 6px; text-align: right;">${custIncl.toFixed(2)}</td>`;
    custTotalHtml += `</tr>`;

    reportRowsHtml += custTotalHtml;

    grandQty += custQty;
    grandExcl += custExcl;
    grandSalesTax += custSalesTax;
    grandFurtherTax += custFurtherTax;
    grandExtraTax += custExtraTax;
    grandFED += custFED;
    grandWHT += custWHT;
    grandIncl += custIncl;
  });

  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    const months = ['Jun', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0].substring(2);
    // Find name of month
    const mIdx = parseInt(parts[1], 10) - 1;
    const monthsFull = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthsFull[mIdx] || parts[1];
    return `${parts[2]}-${month}-${year}`;
  };

  const now = new Date();
  const monthsFull = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reportDateStr = `${String(now.getDate()).padStart(2, '0')}-${monthsFull[now.getMonth()]}-${String(now.getFullYear()).substring(2)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  let headersHtml = `
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: left;">Date</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: left;">Inv#</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: left;">GST Inv #</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: left;">Item Code</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: left;">Description</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: center;">Qty</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Rate</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Excl. Amt</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Sale Tax</th>
    <th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Fur. Tax</th>
  `;
  if (hasExtraTax) headersHtml += `<th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Extra Tax</th>`;
  if (hasFED) headersHtml += `<th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">FED</th>`;
  if (hasWHT) headersHtml += `<th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">WHT</th>`;
  headersHtml += `<th style="border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px; text-align: right;">Incl. Amt</th>`;

  let footerHtml = `
    <tr style="font-weight: bold; background: #e2e8f0; font-size: 10px; border-top: 2px solid #000; border-bottom: 2px solid #000;">
      <td colspan="4" style="padding: 8px 6px; text-align: left;">Grand Total:</td>
      <td></td>
      <td style="padding: 8px 6px; text-align: center;">${grandQty.toLocaleString()}</td>
      <td></td>
      <td style="padding: 8px 6px; text-align: right;">${grandExcl.toFixed(2)}</td>
      <td style="padding: 8px 6px; text-align: right;">${grandSalesTax.toFixed(2)}</td>
      <td style="padding: 8px 6px; text-align: right;">${grandFurtherTax.toFixed(2)}</td>
  `;
  if (hasExtraTax) footerHtml += `<td style="padding: 8px 6px; text-align: right;">${grandExtraTax.toFixed(2)}</td>`;
  if (hasFED) footerHtml += `<td style="padding: 8px 6px; text-align: right;">${grandFED.toFixed(2)}</td>`;
  if (hasWHT) footerHtml += `<td style="padding: 8px 6px; text-align: right;">${grandWHT.toFixed(2)}</td>`;
  footerHtml += `<td style="padding: 8px 6px; text-align: right;">${grandIncl.toFixed(2)}</td>`;
  footerHtml += `</tr>`;

  const modalBody = document.querySelector('#receipt-modal .modal-body');
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="background-color: #ffffff; color: #000000; padding: 20px; font-family: Arial, sans-serif; font-size: 9px; line-height: 1.3;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <h1 style="margin: 0; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${(fbrSettings.sellerName || 'YOUR COMPANY NAME').toUpperCase()}</h1>
          <h2 style="margin: 4px 0 0 0; font-size: 11px; font-weight: bold; color: #374151;">Sale Invoice Detail From ${formatDateStr(fromDate) || 'Start'} To ${formatDateStr(toDate) || 'End'}</h2>
        </div>
        <div style="font-size: 10px; font-weight: bold; color: #374151;">
          Report Date : &nbsp; ${reportDateStr.toUpperCase()}
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; color: #000; margin-top: 12px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            ${headersHtml}
          </tr>
        </thead>
        <tbody>
          ${reportRowsHtml}
        </tbody>
        <tfoot>
          ${footerHtml}
        </tfoot>
      </table>
    </div>
  `;

  document.querySelector('#receipt-modal .modal-title').textContent = '🖨️ Detailed Sales Report Print Preview';
  document.getElementById('receipt-modal').classList.add('active');

  triggerPrint();
};

// ==========================================
// FBR GATEWAY SANDBOX COMPLIANCE TEST SUITE
// ==========================================

const scenarioDescriptions = {
  "SN001": "Goods at standard rate — registered buyer",
  "SN002": "Goods at standard rate — unregistered buyer",
  "SN003": "Steel Melting and Re-Rolling",
  "SN004": "Sale by Ship Breakers",
  "SN005": "Reduced rate sale",
  "SN006": "Exempt goods sale",
  "SN007": "Zero rated sale",
  "SN008": "3rd Schedule Goods",
  "SN009": "Cotton Ginners (Textile Sector)",
  "SN010": "Telecom services",
  "SN011": "Toll Manufacturing (Steel sector)",
  "SN012": "Petroleum Products",
  "SN013": "Electricity Supply to Retailers",
  "SN014": "Gas to CNG Stations",
  "SN015": "Mobile Phones",
  "SN016": "Processing / Conversion of Goods",
  "SN017": "Goods (FED in ST Mode)",
  "SN018": "Services (FED in ST Mode)",
  "SN019": "Services rendered or provided",
  "SN020": "Electric Vehicles",
  "SN021": "Cement / Concrete Block",
  "SN022": "Potassium Chlorate",
  "SN023": "CNG Sales",
  "SN024": "Goods as per SRO.297(I)/2023",
  "SN025": "Non-Adjustable Supplies (Drugs, 8th Schedule)",
  "SN026": "Retail — Goods at Standard Rate",
  "SN027": "Retail — 3rd Schedule Goods",
  "SN028": "Retail — Goods at Reduced Rate"
};

const sandboxBuyers = {
  "SN001": { buyerNTNCNIC: "2046004", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN002": { buyerNTNCNIC: "1234567", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN003": { buyerNTNCNIC: "3710505701479", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN004": { buyerNTNCNIC: "3710505701479", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN005": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN006": { buyerNTNCNIC: "2046004", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN007": { buyerNTNCNIC: "3710505701479", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN008": { buyerNTNCNIC: "3710505701479", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN009": { buyerNTNCNIC: "2046004", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN010": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN011": { buyerNTNCNIC: "3710505701479", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN012": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN013": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN014": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN015": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN016": { buyerNTNCNIC: "1000000000078", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN017": { buyerNTNCNIC: "7000009", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN018": { buyerNTNCNIC: "1000000000056", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN019": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN020": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN021": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN022": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN023": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN024": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN025": { buyerNTNCNIC: "1000000000078", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Unregistered" },
  "SN026": { buyerNTNCNIC: "1000000000078", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN027": { buyerNTNCNIC: "7000006", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" },
  "SN028": { buyerNTNCNIC: "1000000000000", buyerBusinessName: "FERTILIZER MANUFAC IRS NEW", buyerProvince: "Sindh", buyerAddress: "Karachi", buyerRegistrationType: "Registered" }
};

let sandboxTestRunning = false;
let generatedPayloads = {};

function generateSandboxScenarioPayload(sn, seller) {
  let sellerNTN = seller.sellerNTN ? seller.sellerNTN.replace(/-/g, '') : '';
  let sellerName = seller.sellerName || '';
  let sellerProvince = seller.sellerProvince || 'Punjab';
  let sellerAddress = seller.sellerAddress || '';

  const buyer = sandboxBuyers[sn] || {
    buyerNTNCNIC: "9020846",
    buyerBusinessName: "MOMENTUM LOGISTICS (PVT) LIMITED (Alt)",
    buyerProvince: "PUNJAB",
    buyerAddress: "LAHORE",
    buyerRegistrationType: "Registered"
  };

  const payload = {
    invoiceType: "Sale Invoice",
    invoiceDate: new Date().toISOString().split('T')[0],
    sellerNTNCNIC: sellerNTN,
    sellerBusinessName: sellerName,
    sellerProvince: sellerProvince,
    sellerAddress: sellerAddress,
    buyerNTNCNIC: buyer.buyerNTNCNIC,
    buyerBusinessName: buyer.buyerBusinessName,
    buyerProvince: buyer.buyerProvince.toUpperCase(),
    buyerAddress: buyer.buyerAddress.toUpperCase(),
    buyerRegistrationType: buyer.buyerRegistrationType,
    invoiceRefNo: "",
    scenarioId: sn,
    items: []
  };

  const item = {
    hsCode: "8421.2100",
    productDescription: "Standard Product Test",
    rate: "18%",
    uoM: "Numbers, pieces, units",
    quantity: 1,
    totalValues: 0,
    valueSalesExcludingST: 1000,
    fixedNotifiedValueOrRetailPrice: 0,
    salesTaxApplicable: 180,
    salesTaxWithheldAtSource: 0,
    extraTax: "",
    furtherTax: 0,
    sroScheduleNo: "",
    fedPayable: 0,
    discount: 0,
    saleType: "Goods at standard rate (default)",
    sroItemSerialNo: ""
  };

  if (sn === "SN001") {
    // default
  } else if (sn === "SN002") {
    payload.buyerNTNCNIC = "1000000000000";
    payload.buyerRegistrationType = "Unregistered";
    payload.buyerProvince = "SINDH";
    payload.buyerBusinessName = "FERTILIZER MANUFAC IRS NEW";
    item.furtherTax = 40.0;
  } else if (sn === "SN003") {
    item.hsCode = "7214.1010";
    item.uoM = "MT";
    item.saleType = "Steel melting and re-rolling";
    item.valueSalesExcludingST = 250000;
    item.salesTaxApplicable = 45000;
  } else if (sn === "SN004") {
    item.hsCode = "7204.4910";
    item.uoM = "MT";
    item.saleType = "Ship breaking";
    item.valueSalesExcludingST = 175000;
    item.salesTaxApplicable = 31500;
  } else if (sn === "SN005") {
    payload.buyerNTNCNIC = "1000000000000";
    payload.buyerRegistrationType = "Unregistered";
    payload.buyerProvince = "SINDH";
    payload.buyerBusinessName = "FERTILIZER MANUFAC IRS NEW";
    item.hsCode = "0102.2930";
    item.saleType = "Goods at Reduced Rate";
    item.rate = "1%";
    item.sroScheduleNo = "EIGHTH SCHEDULE Table 1";
    item.sroItemSerialNo = "82";
    item.salesTaxApplicable = 10;
  } else if (sn === "SN006") {
    item.saleType = "Exempt goods";
    item.rate = "Exempt";
    item.sroScheduleNo = "6th Schd Table I";
    item.sroItemSerialNo = "100";
    item.salesTaxApplicable = 0;
  } else if (sn === "SN007") {
    item.saleType = "Goods at zero-rate";
    item.rate = "0%";
    item.sroScheduleNo = "FIFTH SCHEDULE";
    item.sroItemSerialNo = "1(i)";
    item.salesTaxApplicable = 0;
  } else if (sn === "SN008") {
    item.saleType = " 3rd Schedule Goods ";
    item.fixedNotifiedValueOrRetailPrice = 2000;
    item.sroScheduleNo = "THIRD SCHEDULE";
    item.salesTaxApplicable = 360;
  } else if (sn === "SN009") {
    item.hsCode = "5201.0090";
    item.uoM = "KG";
    item.saleType = "Cotton Ginners";
    item.salesTaxWithheldAtSource = 180;
  } else if (sn === "SN010") {
    item.hsCode = "9812.1000";
    item.saleType = "Telecommunication services";
    item.rate = "19.5%";
    item.salesTaxApplicable = 195;
  } else if (sn === "SN011") {
    item.hsCode = "7214.1010";
    item.uoM = "MT";
    item.saleType = "Toll Manufacturing";
    item.valueSalesExcludingST = 207000;
    item.salesTaxApplicable = 37260;
  } else if (sn === "SN012") {
    payload.invoiceDate = "2025-05-15";
    payload.buyerNTNCNIC = "1000000000000";
    payload.buyerBusinessName = "FERTILIZER MANUFAC IRS NEW";
    payload.buyerProvince = "Sindh";
    payload.buyerAddress = "Karachi";
    payload.buyerRegistrationType = "Unregistered";

    item.hsCode = "2710.1210";
    item.productDescription = "Motor Spirit";
    item.rate = "1.43%";
    item.uoM = "Liter";
    item.quantity = 123;
    item.valueSalesExcludingST = 100;
    item.salesTaxApplicable = 1.43;
    item.sroScheduleNo = "1450(I)/2021";
    item.sroItemSerialNo = "4";
    item.saleType = "Petroleum Products";
    item.petroleumLevyOn = 10.00;
  } else if (sn === "SN013") {
    item.hsCode = "2716.0000";
    item.uoM = "KWH";
    item.saleType = "Electricity Supply to Retailers";
    item.rate = "7.5%";
    item.salesTaxApplicable = 75;
  } else if (sn === "SN014") {
    item.hsCode = "2711.2100";
    item.uoM = "MMBTU";
    item.saleType = "Gas to CNG stations";
  } else if (sn === "SN015") {
    item.hsCode = "8517.1490";
    item.saleType = "Mobile Phones";
    item.sroScheduleNo = "NINTH SCHEDULE";
    item.sroItemSerialNo = "1(A)";
    item.fixedNotifiedValueOrRetailPrice = 1000;
  } else if (sn === "SN016") {
    item.saleType = "Processing/Conversion of Goods";
  } else if (sn === "SN017") {
    item.saleType = "Goods (FED in ST Mode)";
    item.rate = "17%";
    item.salesTaxApplicable = 170;
  } else if (sn === "SN018") {
    item.hsCode = "9812.1000";
    item.saleType = " Services (FED in ST Mode) ";
    item.rate = "19.5%";
    item.salesTaxApplicable = 195;
  } else if (sn === "SN019") {
    item.hsCode = "9812.1000";
    item.saleType = " Services ";
    item.rate = "16%";
    item.salesTaxApplicable = 160;
  } else if (sn === "SN020") {
    item.hsCode = "8703.8090";
    item.saleType = "Electric Vehicle";
    item.rate = "1%";
    item.sroScheduleNo = "6th Schd Table III";
    item.sroItemSerialNo = "20";
    item.valueSalesExcludingST = 1000000;
    item.salesTaxApplicable = 10000;
  } else if (sn === "SN021") {
    item.hsCode = "2523.2900";
    item.uoM = "KG";
    item.saleType = "Cement /Concrete Block";
    item.rate = "Rs.2";
    item.quantity = 100;
    item.salesTaxApplicable = 200;
  } else if (sn === "SN022") {
    item.hsCode = "2829.1100";
    item.uoM = "KG";
    item.saleType = "Potassium Chlorate";
    item.rate = "18% along with rupees 60 per kilogram";
    item.sroScheduleNo = "EIGHTH SCHEDULE Table 1";
    item.sroItemSerialNo = "56";
    item.quantity = 100;
    item.salesTaxApplicable = 6180;
  } else if (sn === "SN023") {
    item.hsCode = "2711.2100";
    item.uoM = "KG";
    item.saleType = "CNG Sales";
    item.rate = "Rs.200";
    item.sroScheduleNo = "581(1)/2024";
    item.sroItemSerialNo = "Region-I";
    item.quantity = 10;
    item.salesTaxApplicable = 2000;
  } else if (sn === "SN024") {
    item.saleType = "Goods as per SRO.297(|)/2023";
    item.rate = "25%";
    item.sroScheduleNo = "297(I)/2023-Table-I";
    item.sroItemSerialNo = "3";
    item.salesTaxApplicable = 250;
  } else if (sn === "SN025") {
    item.hsCode = "3004.9099";
    item.uoM = "KG";
    item.saleType = "Non-Adjustable Supplies";
    item.rate = "0%";
    item.sroScheduleNo = "Eighth Schedule Table 1";
    item.sroItemSerialNo = "81";
    item.salesTaxApplicable = 0;
  } else if (sn === "SN026") {
    payload.buyerNTNCNIC = "9999997";
    payload.buyerRegistrationType = "Unregistered";
    payload.buyerProvince = "PUNJAB";
    payload.buyerBusinessName = "Infrastructure Lahore";
  } else if (sn === "SN027") {
    payload.buyerNTNCNIC = "9999997";
    payload.buyerRegistrationType = "Unregistered";
    payload.buyerProvince = "PUNJAB";
    payload.buyerBusinessName = "Infrastructure Lahore";
    item.saleType = " 3rd Schedule Goods ";
    item.fixedNotifiedValueOrRetailPrice = 2000;
    item.sroScheduleNo = "THIRD SCHEDULE";
    item.salesTaxApplicable = 360;
  } else if (sn === "SN028") {
    payload.buyerNTNCNIC = "9999997";
    payload.buyerRegistrationType = "Unregistered";
    payload.buyerProvince = "PUNJAB";
    payload.buyerBusinessName = "Infrastructure Lahore";
    item.hsCode = "0102.2930";
    item.saleType = "Goods at Reduced Rate";
    item.rate = "1%";
    item.sroScheduleNo = "EIGHTH SCHEDULE Table 1";
    item.sroItemSerialNo = "82";
    item.salesTaxApplicable = 10;
  }

  payload.items.push(item);
  return payload;
}

function toggleAllScenarios(masterChk) {
  const checkboxes = document.querySelectorAll('.chk-scenario-select');
  checkboxes.forEach(chk => {
    chk.checked = masterChk.checked;
  });
}

function initSandboxTestPanel() {
  const tbody = document.getElementById('sandbox-test-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  generatedPayloads = {};

  for (let i = 1; i <= 28; i++) {
    const sn = "SN" + String(i).padStart(3, '0');
    const desc = scenarioDescriptions[sn] || "Sandbox Scenario";

    // Generate payload sample using current settings
    generatedPayloads[sn] = generateSandboxScenarioPayload(sn, fbrSettings);

    const tr = document.createElement('tr');
    tr.id = `test-row-${sn}`;
    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="chk-scenario-select" data-sn="${sn}" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--btn-primary-bg);">
      </td>
      <td><strong>${sn}</strong></td>
      <td>${desc}</td>
      <td style="text-align: center;"><span class="badge badge-secondary" id="test-status-${sn}">Pending</span></td>
      <td id="test-err-${sn}" style="font-size: 12px; color: var(--text-secondary); max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">-</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="showSandboxPayload('${sn}')" style="padding: 2px 8px; font-size: 11px;">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  const masterChk = document.getElementById('chk-select-all-scenarios');
  if (masterChk) masterChk.checked = true;

  // Hide summary and progress at start
  document.getElementById('sandbox-test-summary').style.display = 'none';
  document.getElementById('sandbox-test-progress-container').style.display = 'none';
}

async function runSandboxTestSuite() {
  if (sandboxTestRunning) return;

  if (!fbrSettings.fbrToken || !fbrSettings.fbrToken.trim()) {
    alert("Mandatory missing config: Please configure your FBR Security Token in the Company Profile first.");
    return;
  }

  const selectedScenarios = [];
  const checkboxes = document.querySelectorAll('.chk-scenario-select:checked');
  checkboxes.forEach(chk => {
    if (chk.dataset.sn) selectedScenarios.push(chk.dataset.sn);
  });

  if (selectedScenarios.length === 0) {
    alert("Please select at least one scenario to test.");
    return;
  }

  sandboxTestRunning = true;
  document.getElementById('btn-run-sandbox-tests').disabled = true;
  document.getElementById('btn-run-sandbox-tests').textContent = "Running...";

  // Show summary and progress
  const summaryContainer = document.getElementById('sandbox-test-summary');
  const progressContainer = document.getElementById('sandbox-test-progress-container');
  summaryContainer.style.display = 'grid';
  progressContainer.style.display = 'block';

  const totalVal = document.getElementById('stat-sandbox-total');
  if (totalVal) totalVal.textContent = String(selectedScenarios.length);

  const passedVal = document.getElementById('stat-sandbox-passed');
  const failedVal = document.getElementById('stat-sandbox-failed');
  const statusVal = document.getElementById('stat-sandbox-status');
  const statusIcon = document.getElementById('stat-sandbox-status-icon');

  passedVal.textContent = '0';
  failedVal.textContent = '0';
  statusVal.textContent = 'Running...';
  statusVal.style.color = 'var(--warning)';
  statusIcon.textContent = '⚡';

  let passedCount = 0;
  let failedCount = 0;

  // Reset all table rows
  for (let i = 1; i <= 28; i++) {
    const sn = "SN" + String(i).padStart(3, '0');
    const statusSpan = document.getElementById(`test-status-${sn}`);
    const errTd = document.getElementById(`test-err-${sn}`);

    if (statusSpan && errTd) {
      if (selectedScenarios.includes(sn)) {
        statusSpan.className = "badge badge-secondary";
        statusSpan.textContent = "Pending";
        errTd.textContent = "-";
        errTd.style.color = "var(--text-secondary)";
      } else {
        statusSpan.className = "badge badge-secondary";
        statusSpan.textContent = "Skipped";
        errTd.textContent = "Scenario deselected by user";
        errTd.style.color = "var(--text-secondary)";
      }
    }
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let idx = 0; idx < selectedScenarios.length; idx++) {
    const sn = selectedScenarios[idx];
    const desc = scenarioDescriptions[sn];

    // Update progress bar
    const progressPercent = Math.round((idx / selectedScenarios.length) * 100);
    document.getElementById('sandbox-test-progress-percent').textContent = `${progressPercent}%`;
    document.getElementById('sandbox-test-progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('sandbox-test-progress-text').textContent = `Testing ${sn} (${idx + 1}/${selectedScenarios.length}): ${desc}...`;

    const statusSpan = document.getElementById(`test-status-${sn}`);
    statusSpan.className = "badge badge-running";
    statusSpan.textContent = "Running";

    // Auto-scroll the table row into view slightly for nice UX
    const tr = document.getElementById(`test-row-${sn}`);
    if (tr) {
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const payload = generatedPayloads[sn];

    let tokenToUse = fbrSettings.fbrToken ? fbrSettings.fbrToken.trim() : "";
    const shouldPost = document.getElementById('chk-sandbox-post')?.checked || false;
    const targetUrl = shouldPost 
      ? "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb"
      : "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb";

    try {
      const response = await window.api.fbrRequest({
        url: targetUrl,
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Accept-Encoding': 'deflate, gzip',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Authorization': tokenToUse.toLowerCase().startsWith('bearer ') ? tokenToUse : `Bearer ${tokenToUse}`
        },
        body: payload
      });

      const res = response.data;
      if (response.success && res && res.validationResponse) {
        const vr = res.validationResponse;
        const status = vr.status || '';

        if (status.toUpperCase() === 'VALID') {
          statusSpan.className = "badge badge-success";
          statusSpan.textContent = "Passed";
          const successMsg = shouldPost ? `Gateway posting succeeded. FBR Ref: ${res.invoiceNumber || 'OK'}` : "Gateway validation succeeded.";
          document.getElementById(`test-err-${sn}`).textContent = successMsg;
          document.getElementById(`test-err-${sn}`).style.color = "var(--success)";
          passedCount++;
        } else {
          statusSpan.className = "badge badge-danger";
          statusSpan.textContent = "Failed";

          const istatuses = vr.invoiceStatuses || [];
          const firstErr = istatuses[0] || {};
          const errCode = firstErr.errorCode || vr.errorCode || 'N/A';
          const errMsg = firstErr.error || vr.error || 'Validation Failed';

          document.getElementById(`test-err-${sn}`).textContent = `[${errCode}] ${errMsg}`;
          document.getElementById(`test-err-${sn}`).style.color = "#ef4444";
          failedCount++;
        }
      } else {
        // HTTP or Parse Error
        statusSpan.className = "badge badge-danger";
        statusSpan.textContent = "Failed";

        let errText = "Invalid response from gateway";
        if (response.error) {
          errText = response.error;
        } else {
          const statusPart = response.status ? `HTTP ${response.status}` : "";
          const parsePart = (res && res.parseError) ? `Parse Error: ${res.parseError}` : "";
          const textPart = (res && res.text) ? res.text : "";
          
          if (statusPart || parsePart || textPart) {
            errText = [statusPart, parsePart || textPart].filter(Boolean).join(": ");
          }
        }
        document.getElementById(`test-err-${sn}`).textContent = errText;
        document.getElementById(`test-err-${sn}`).style.color = "#ef4444";
        failedCount++;
      }
    } catch (err) {
      statusSpan.className = "badge badge-danger";
      statusSpan.textContent = "Failed";
      document.getElementById(`test-err-${sn}`).textContent = err.message;
      document.getElementById(`test-err-${sn}`).style.color = "#ef4444";
      failedCount++;
    }

    // Live update counts
    passedVal.textContent = String(passedCount);
    failedVal.textContent = String(failedCount);

    // Wait to avoid rate-limiting
    await sleep(350);
  }

  // Set progress to 100%
  document.getElementById('sandbox-test-progress-percent').textContent = "100%";
  document.getElementById('sandbox-test-progress-bar').style.width = "100%";
  document.getElementById('sandbox-test-progress-text').textContent = `Compliance suite execution complete (${passedCount} passed, ${failedCount} failed of ${selectedScenarios.length} tested).`;

  // Final summary status
  statusVal.textContent = failedCount === 0 ? "Compliant" : "Non-Compliant";
  statusVal.style.color = failedCount === 0 ? "var(--success)" : "#ef4444";
  statusIcon.textContent = failedCount === 0 ? "🏆" : "⚠️";

  sandboxTestRunning = false;
  document.getElementById('btn-run-sandbox-tests').disabled = false;
  document.getElementById('btn-run-sandbox-tests').textContent = "⚡ Run Test Suite";
}

function showSandboxPayload(sn) {
  const payload = generatedPayloads[sn];
  if (!payload) return;

  document.getElementById('payload-modal-title').textContent = `${sn} JSON Payload Context`;
  document.getElementById('payload-modal-code').textContent = JSON.stringify(payload, null, 2);
  document.getElementById('payload-modal').classList.add('active');
}

function closePayloadModal() {
  document.getElementById('payload-modal').classList.remove('active');
}

// Column Visibility Toggle & Controls
function toggleColumnDropdown() {
  const dd = document.getElementById('column-toggle-dropdown');
  if (dd) {
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  }
}

// Close column dropdown if clicked outside
document.addEventListener('click', (e) => {
  const dd = document.getElementById('column-toggle-dropdown');
  const btn = document.getElementById('btn-col-toggle');
  if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

function setColumnVisibility(colKey, isVisible, saveToStorage = true) {
  const chk = document.getElementById(`col-chk-${colKey}`);
  if (chk) chk.checked = isVisible;

  const elements = document.querySelectorAll(`.col-${colKey}`);
  elements.forEach(el => {
    el.style.display = isVisible ? '' : 'none';
  });

  if (saveToStorage) {
    localStorage.setItem(`col_visible_${colKey}`, isVisible ? 'true' : 'false');
  }
}

function syncGridColumnVisibilities() {
  const keys = ['hscode', 'saletype', 'retail', 'discount', 'furthertax', 'extratax', 'whtax', 'fedtax', 'fixedtax'];
  keys.forEach(k => {
    const chk = document.getElementById(`col-chk-${k}`);
    if (chk) {
      setColumnVisibility(k, chk.checked, false);
    }
  });
}

// ==========================================
// DRAFTS MANAGEMENT CONTROLLER
// ==========================================

async function saveInvoiceDraft() {
  await refreshDatabaseLists();
  
  const calcs = recalculateInvoice();

  const select = document.getElementById('invoice-party-select');
  const custId = select ? Number(select.value) : null;
  const c = dbCustomersList.find(x => x.id === custId);
  const buyerName = c ? c.partyName : (document.getElementById('buyer-name').value.trim() || 'Draft Customer');
  const buyerNTN = c ? c.ntn : (document.getElementById('buyer-ntn').value.trim() || '9999997');

  const itemsToSave = [];
  invoiceItems.forEach((item, itemIdx) => {
    const qtyInput = document.getElementById(item.qtyInput);
    const valInput = document.getElementById(item.valInput);
    const prodSelect = document.getElementById(item.productSelect);
    const discountInput = document.getElementById(item.discountInput);
    const fixedTaxInput = document.getElementById(item.fixedTaxInput);
    const retailInput = document.getElementById(item.retailPriceInput);

    if (!qtyInput || !valInput || !prodSelect) return;

    const productId = Number(prodSelect.value) || 0;
    const quantity = parseFloat(qtyInput.value) || 1;
    const rateValue = parseFloat(valInput.value) || 0;
    const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
    const fixedTax = fixedTaxInput ? parseFloat(fixedTaxInput.value) || 0 : 0;
    const retailPrice = retailInput ? parseFloat(retailInput.value) || 0 : 0;
    const rowValExcl = rateValue * quantity;

    const pr = dbItemsList.find(x => x.id === productId);
    const productDescription = pr ? pr.itemDesc : '';
    const hsCode = pr ? pr.hsCode : '';
    const uom = pr ? pr.uom : '';

    itemsToSave.push({
      productId,
      productDescription,
      hsCode,
      uom,
      quantity,
      rateValue,
      totalValues: rowValExcl,
      discount,
      fixedTax,
      retailPrice,
      salesTaxApplicable: parseFloat(document.getElementById(item.salesTaxInput)?.value) || 0
    });
  });

  const taxesToSave = [];
  invoiceTaxes.forEach(t => {
    const tSelect = document.getElementById(t.typeSelect);
    const tRateInput = document.getElementById(t.rateInput);
    const tNatureSelect = document.getElementById(t.natureSelect);
    const tValExclInput = document.getElementById(t.valExclInput);
    const tAmtInput = document.getElementById(t.amtInput);

    if (!tSelect || !tRateInput || !tNatureSelect) return;

    taxesToSave.push({
      taxTypeId: tSelect.value,
      ratePercent: parseFloat(tRateInput.value) || 0,
      type: tNatureSelect.value,
      valueExcl: tValExclInput ? parseFloat(tValExclInput.value) || 0 : 0,
      taxAmt: tAmtInput ? parseFloat(tAmtInput.value) || 0 : 0
    });
  });

  const invoiceMaster = {
    invoiceNumber: activeDraftId ? ('DRAFT-' + activeDraftId) : ('DRAFT-' + Date.now().toString().slice(-6)),
    invoiceRefNo: document.getElementById('invoice-manual-no').value.trim(),
    invoiceDate: document.getElementById('invoice-date').value || new Date().toISOString().split('T')[0],
    invoiceType: document.getElementById('invoice-type').value,
    buyerNTN: buyerNTN,
    buyerName: buyerName,
    buyerAddress: document.getElementById('buyer-address').value.trim(),
    buyerProvince: document.getElementById('buyer-province').value,
    buyerRegistrationType: document.getElementById('buyer-reg-type').value,
    subtotalExcl: calcs.subtotalExcl || 0,
    totalSalesTax: calcs.totalSalesTax || 0,
    furtherTaxAmt: calcs.furtherTaxAmt || 0,
    totalExtraTax: calcs.totalExtraTax || 0,
    totalDiscount: calcs.totalDiscount || 0,
    grandTotal: calcs.grandTotal || 0,
    envMode: fbrSettings.fbrEnvMode,
    status: 'Draft',
    timestamp: new Date().toLocaleString(),
    companyId: activeCompanyId
  };

  if (activeDraftId) {
    invoiceMaster.id = activeDraftId;
  }

  try {
    const savedId = await dbSaveInvoice(invoiceMaster, itemsToSave, taxesToSave);
    alert("Draft saved successfully.");
    resetInvoiceForm();
    switchPanel('drafts');
  } catch (err) {
    alert("Error saving draft: " + err.message);
  }
}

function cancelDraftMode() {
  resetInvoiceForm();
}

async function renderDrafts() {
  await refreshDatabaseLists();
  const tbody = document.getElementById('drafts-list-tbody');
  tbody.innerHTML = '';

  try {
    const all = await dbGetInvoices();
    const drafts = all.filter(inv => inv.status === 'Draft' && (inv.companyId === activeCompanyId || (!inv.companyId && activeCompanyId === 1)));

    if (drafts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px 0;">
            No draft invoices found.
          </td>
        </tr>
      `;
      return;
    }

    drafts.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.invoiceDate}</td>
        <td>${(String(d.invoiceRefNo || '').trim() && String(d.invoiceRefNo || '').trim() !== '0') ? d.invoiceRefNo : '-'}</td>
        <td><strong>${d.buyerName}</strong></td>
        <td>${d.buyerNTN}</td>
        <td class="cell-bold">PKR ${d.grandTotal.toFixed(2)}</td>
        <td>
          <span class="status-tag sandbox">
            ${d.envMode.toUpperCase()}
          </span>
        </td>
        <td style="text-align: center; display: flex; justify-content: center; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="resumeDraft(${d.id})">✏️ Resume</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDraft(${d.id})">🗑️ Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error rendering drafts:", err);
  }
}

async function resumeDraft(id) {
  try {
    const draft = await dbGetInvoiceFull(id);
    if (!draft) {
      alert("Draft not found.");
      return;
    }

    // Reset invoice form and clear active draft
    resetInvoiceForm();

    // Set draft tracking
    activeDraftId = draft.id;
    document.getElementById('draft-mode-id').textContent = `#${draft.id}`;
    document.getElementById('draft-mode-banner').style.display = 'flex';

    if (document.getElementById('invoice-db-no')) {
      document.getElementById('invoice-db-no').value = `Draft #${draft.id}`;
    }

    // Populate header values
    document.getElementById('invoice-type').value = draft.invoiceType || 'Sale Invoice';
    document.getElementById('invoice-manual-no').value = draft.invoiceRefNo || '';
    document.getElementById('invoice-date').value = draft.invoiceDate;

    // Find and set customer selection
    await refreshDatabaseLists();
    const matchedCust = dbCustomersList.find(x => x.partyName === draft.buyerName);
    if (matchedCust) {
      const partySelect = document.getElementById('invoice-party-select');
      partySelect.value = matchedCust.id;
      partySelect.dataset.prevVal = matchedCust.id;
    } else {
      document.getElementById('invoice-party-select').value = '';
    }

    // Populate manual buyer detail fields
    document.getElementById('buyer-name').value = draft.buyerName;
    document.getElementById('buyer-ntn').value = draft.buyerNTN || '';
    document.getElementById('buyer-reg-type').value = draft.buyerRegistrationType || 'Unregistered';
    document.getElementById('buyer-province').value = draft.buyerProvince || 'SINDH';
    document.getElementById('buyer-address').value = draft.buyerAddress || '';

    // Clear initial default item row from resetInvoiceForm()
    const tbody = document.getElementById('items-grid-tbody');
    tbody.innerHTML = '';
    invoiceItems = [];

    // Load items
    if (draft.items && draft.items.length > 0) {
      for (const item of draft.items) {
        await addInvoiceItemRow({
          productId: item.productId,
          quantity: item.quantity,
          rateValue: item.rateValue,
          totalValues: item.totalValues,
          retailPrice: item.retailPrice,
          salesTaxApplicable: item.salesTaxApplicable,
          fixedTax: item.fixedTax
        });
      }
    } else {
      await addInvoiceItemRow();
    }

    // Load taxes
    const taxTbody = document.getElementById('taxes-grid-tbody');
    if (taxTbody) taxTbody.innerHTML = '';
    invoiceTaxes = [];

    if (draft.taxesBreakdown && draft.taxesBreakdown.length > 0) {
      for (const tax of draft.taxesBreakdown) {
        await addTaxRow({
          taxTypeId: tax.taxTypeId,
          ratePercent: tax.ratePercent,
          type: tax.type,
          valueExcl: tax.valueExcl,
          taxAmt: tax.taxAmt
        });
      }
    }

    switchPanel('invoice');
    recalculateInvoice();

  } catch (err) {
    alert("Error resuming draft: " + err.message);
  }
}

async function deleteDraft(id) {
  if (await showConfirm("Are you sure you want to delete this draft?")) {
    try {
      await dbDeleteInvoice(id);
      await renderDrafts();
    } catch (err) {
      alert("Error deleting draft: " + err.message);
    }
  }
}

// Backup and Restore UI Handlers
async function exportDatabaseBackup() {
  try {
    const backup = await dbExportBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Generate filename based on date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `fbr_invoicing_backup_${dateStr}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Error exporting database backup: " + (err.message || err));
  }
}

function triggerImportFileSelect() {
  document.getElementById('db-import-file-input').click();
}

async function importDatabaseBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const confirmImport = confirm("WARNING: Importing a backup file will completely OVERWRITE all current database profiles, settings, invoices, customers, and items. This action cannot be undone.\n\nAre you sure you want to proceed?");
  if (!confirmImport) {
    event.target.value = ""; // Reset file input
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const backupData = JSON.parse(e.target.result);
      await dbImportBackup(backupData);
      alert("Database restored successfully! The application will now reload to apply changes.");
      window.location.reload();
    } catch (err) {
      alert("Error restoring database backup: " + (err.message || err));
      event.target.value = ""; // Reset
    }
  };
  reader.onerror = () => {
    alert("Error reading backup file.");
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ==========================================
// AUTO-UPDATER UI INTEGRATION
// ==========================================
async function initUpdaterUI() {
  if (!window.api || !window.api.onUpdaterMessage) return;

  try {
    const version = await window.api.getAppVersion();
    const verInput = document.getElementById('app-current-version');
    if (verInput && version) {
      verInput.value = `v${version}`;
    }
  } catch (e) {
    console.warn("Could not retrieve app version:", e);
  }

  window.api.onUpdaterMessage((data) => {
    const statusText = document.getElementById('app-update-status-text');
    const progressContainer = document.getElementById('update-download-progress-container');
    const progressLabel = document.getElementById('update-download-progress-label');
    const progressBar = document.getElementById('update-download-progress-bar');
    const restartBanner = document.getElementById('update-restart-banner');
    const restartText = document.getElementById('update-restart-text');

    if (!data) return;

    switch (data.status) {
      case 'checking':
        if (statusText) statusText.value = "Checking for updates...";
        break;

      case 'available':
        if (statusText) statusText.value = `Update v${data.version} available. Downloading...`;
        if (progressContainer) progressContainer.style.display = 'flex';
        alert(`A new update (v${data.version}) is available. It is being downloaded in the background.`);
        break;

      case 'not-available':
        if (statusText) statusText.value = "Application is up to date.";
        if (progressContainer) progressContainer.style.display = 'none';
        break;

      case 'downloading':
        if (statusText) statusText.value = `Downloading update: ${data.percent}%`;
        if (progressContainer) progressContainer.style.display = 'flex';
        if (progressLabel) progressLabel.textContent = `Downloading Update: ${data.percent}%`;
        if (progressBar) progressBar.style.width = `${data.percent}%`;
        break;

      case 'downloaded':
        if (statusText) statusText.value = `Update v${data.version} ready to install.`;
        if (progressContainer) progressContainer.style.display = 'none';
        if (restartBanner) {
          restartBanner.style.display = 'flex';
          if (restartText) restartText.textContent = `Update v${data.version} is ready to apply!`;
        }
        alert(`Update v${data.version} downloaded! Click "Restart to Apply" in Settings or the update will install automatically on quit.`);
        break;

      case 'error':
        if (statusText) statusText.value = `Update check failed.`;
        if (progressContainer) progressContainer.style.display = 'none';
        console.error("Updater error:", data.error);
        break;
    }
  });
}

window.checkForAppUpdates = async function () {
  const btn = document.getElementById('btn-check-updates');
  const statusText = document.getElementById('app-update-status-text');

  if (!window.api || !window.api.checkForUpdates) {
    alert("Auto-updates are only active in installed desktop builds.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Checking...";
  }
  if (statusText) {
    statusText.value = "Checking for updates...";
  }

  try {
    const res = await window.api.checkForUpdates();
    if (res && !res.success && res.message) {
      alert(res.message);
      if (statusText) statusText.value = res.message;
    }
  } catch (err) {
    console.error("Check for updates failed:", err);
    if (statusText) statusText.value = "Update check failed.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔍 Check for Updates";
    }
  }
};

window.installDownloadedUpdate = function () {
  if (window.api && window.api.installUpdate) {
    window.api.installUpdate();
  }
};
