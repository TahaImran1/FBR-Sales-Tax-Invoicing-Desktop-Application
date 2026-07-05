# FBR Compliant Digital Invoicing Desktop Suite (Compliance 2026)

A premium, secure, and compliant desktop application built to integrate with the Federal Board of Revenue (FBR) Digital Invoicing system in Pakistan. The application ensures seamless B2B/B2C sales tax invoice reporting, local database persistence, and native PDF exporting capabilities.

## Architecture & Features

- **Direct IPC Routing**: Inter-Process Communication (IPC) handles FBR API requests from the Electron main process, bypassing browser-side CORS limitations completely.
- **Premium dark-themed UI**: A sleek, responsive SaaS dashboard designed using modern styling principles (CSS grid layouts, Slate-dark palette to prevent loading flashes, interactive micro-animations).
- **Automated Validation & Mathematical Engine**: Integrated logic to validate tax computations, transaction types, SROs (Sales Tax Rules), and compliance rules.
- **Database & Offline Resilience**: Local SQLite integration for storing customer directories, transaction history, and offline queues.
- **Native Document Generation**: High-fidelity PDF generation utilizing A4 page scaling and printing options.

---

## Directory Structure

```
├── build/                 # Compilation assets (app icons)
├── docs/                  # Reference material (Technical specifications, FBR SRO pdfs, curl scripts)
├── python_scripts/        # Utilities (FBR API querying tools, rates fetchers)
├── tests/                 # Compliance testing suites (Math validation, scenario testing)
├── db.js                  # Database connection & persistence layer
├── index.html             # Application UI structure
├── main.js                # Electron entry point & IPC handlers
├── preload.js             # Secure API bridging & IPC exports
├── renderer.js            # Frontend logic & tax calculation engine
├── style.css              # Custom styling & UX theme variables
├── package.json           # Project dependencies & build options
└── .gitignore             # Git ignore patterns
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18.x or higher recommended)
- **NPM** (v9.x or higher)
- **Python 3.x** (optional, for running validation test suites)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/TahaImran1/FBR-Sales-Tax-Invoicing-Desktop-Application.git
   cd FBR-Sales-Tax-Invoicing-Desktop-Application
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the application in development mode:
   ```bash
   npm start
   ```

### Packaging / Building

To package the application into a standalone Windows installer (`.exe`):
```bash
npm run build
```
Packaged installers will be compiled inside the `dist/` directory.

---

## Compliance Testing

Python utility and scenario test suites are provided in `tests/` to validate computations before submitting to the FBR Sandbox:
```bash
# Run automated validation for FBR digital invoicing scenarios
python tests/validate_all_28_final.py
```
Check additional tools under `python_scripts/` to query rate tables and SRO configurations directly from the FBR gateway.
