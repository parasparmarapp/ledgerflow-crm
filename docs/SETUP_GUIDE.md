# 🚀 Quick Start & Setup Guide for LedgerFlow CRM

> **Project Overview:** LedgerFlow CRM is an enterprise-grade web-based platform for small and mid-sized businesses to manage clients, products and services, inventory, invoicing, payments, expenses, and financial performance in one place. It provides real-time operational visibility, audit-friendly payment and stock tracking, exportable reports, and automated invoice and payment-reminder communications.

Welcome to your production **LedgerFlow CRM** application! This guide explains how to spin up the PostgreSQL database, start the backend and frontend services, and sign in.

---

## 📋 Table of Contents
1. [Step 1: Install Free Prerequisites](#1-install-free-prerequisites-one-time-setup)
2. [Step 2: Database Setup (PostgreSQL 16 via Docker)](#2-database-setup-postgresql-16-via-docker)
3. [Step 3: Running Your Applications](#3-running-your-applications)
4. [Step 4: Default Production Credentials](#4-default-production-credentials)
5. [Step 5: Business Divisions & Supported Modules](#5-business-divisions--supported-modules)
6. [Step 6: Common Troubleshooting & FAQs](#6-common-troubleshooting--faqs)

---

## 1. Install Free Prerequisites (One-Time Setup)

Make sure you have installed these tools:
- **Node.js (v20+)**: [Download Node.js](https://nodejs.org/)
- **Docker Desktop**: [Download Docker](https://www.docker.com/) (runs the PostgreSQL 16 engine)
- **Visual Studio Code / Cursor**: [Download VS Code](https://code.visualstudio.com/)

---

## 2. Database Setup (PostgreSQL 16 via Docker)

From the project root folder (`crm/`):
```bash
docker compose up -d
```
This launches a dedicated PostgreSQL 16 instance (`crm-postgres`) on port `5432`:
- **Database:** `ledgerflow_crm`
- **User:** `postgres`
- **Password:** `postgres`
- **Port:** `5432`

---

## 3. Running Your Applications

### ⚙️ Backend Service (`backend/`)
1. Open a terminal in `backend/`:
   ```bash
   cd backend
   npm install
   ```
2. Apply Prisma schema migrations to PostgreSQL:
   ```bash
   npx prisma db push
   ```
3. For a fresh demo database only, seed sample catalog, clients, and transactions:
   ```bash
   npm run seed
   ```
   > Skip this step for an existing database; the seed script replaces Brand It demo records.
4. Create the two company workspaces and bootstrap Stoic's first admin from an existing active Brand It admin:
   ```bash
   npm run db:bootstrap-companies
   ```
   > This command is safe to rerun. It does not copy any CRM records; only the initial admin account is provisioned when Stoic has no users.
5. Start the backend dev server:
   ```bash
   npm run dev
   ```
   > The API will be live at **http://localhost:5100** (Health check: `http://localhost:5100/health`).

---

### 🌐 Frontend Web Application (`web/`)
1. Open a terminal in `web/`:
   ```bash
   cd web
   npm install
   ```
2. Start the web portal:
   ```bash
   npm run dev
   ```
   > Access the portal at **http://localhost:5173**.

---

## 4. Default Production Credentials

Use these verified credentials to sign in at `http://localhost:5173/`:

### 🏢 Brand It Company (`brand-it`)
| User Name | Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Brand It Admin** | Admin | `admin@brand-it.com` | `Admin!2026` | Full access across all modules, reports, system users & company settings |
| **Brand It Staff** | Staff | `staff@brand-it.com` | `Staff!2026` | Operational access to invoicing, inventory, clients, payments & catalog |

### 🏢 Stoic Company (`stoic`)
| User Name | Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Stoic Admin** | Admin | `admin@stoic.com` | `Admin!2026` | Full access across all modules, reports, system users & company settings |
| **Stoic Staff** | Staff | `staff@stoic.com` | `Staff!2026` | Operational access to invoicing, inventory, clients, payments & catalog |

---

## 5. Business Divisions & Supported Modules

### 🏢 3 Operating Business Lines
Catalog products and services are strictly grouped under:
1. **Commodities**: High-conductivity copper wire rods, rebar steel 500D, bulk logistics & freight.
2. **CCTV Systems**: 4K IP cameras, PTZ domes, 16-channel NVRs, installation and cabling services.
3. **Folding Partitions**: Acoustic operable walls (STC 50dB), frameless glass sliding partitions, laser alignment services.

### 📦 Production Modules
1. **Executive Dashboard**: Real-time revenue metrics, profit margins, outstanding receivables, sales trends, quick action shortcuts.
2. **Invoicing & Billing**: Auto-sequential numbers (`INV-2026-xxxx`), line items, taxes & discounts, stock decrement, paid invoice revisions.
3. **Inventory & Stock History**: Real-time stock levels, low-stock alerts, and full stock movement history logs.
4. **Client Management & CSV Import**: Contact directory, balance tracking, and interactive CSV bulk importer.
5. **Payments & Cashflow Reconciliation**: Multi-method recording (Bank, Cash, MoMo, Card, Cheque), partial payments, balance reconciliation.
6. **Expense Tracker & Reports**: OPEX vs CAPEX classification, receipt uploads, and category breakdown reports.
7. **Financial Reports Suite**: Profit & Loss, Revenue Breakdown, Expense Reports, Sales, and Payment reconciliation with CSV & PDF export.
8. **Products & Services Catalog**: Division-scoped catalog with pricing, unit metrics, SKU codes, and inventory integration.
9. **System Users & Roles**: RBAC role provisioning (Admin vs Staff), invitation management, password resets, and account deactivation.
10. **Admin & User Profile**: Editable full name, email address, password updates with visibility toggles, and live session sync.
11. **Communication Logs & Reminders**: Automated email and SMS reminder dispatch rules and delivery history.

---

## 6. Common Troubleshooting & FAQs

### ❓ 1. `npm` or `node` is not recognized as a command
- **Fix:** You need to install Node.js from [nodejs.org](https://nodejs.org/). After installing, close and restart your code editor (VS Code) so it detects the newly installed program.

### ❓ 2. Port is already in use (e.g., "Port 5173 or 5100 is in use")
- **Fix:** Another terminal or program is running on that port. Either close the other terminal window or allow Vite/Express to run on the next available port when prompted.

### ❓ 3. Database connection refused (`localhost:5432`)
- **Fix:** Make sure Docker Desktop is open and running, then run `docker compose up -d` in your root folder.

### ❓ 4. Dependency install error (`npm install` fails)
- **Fix:** Run the install command with legacy peer dependencies allowed:
  ```bash
  npm install --legacy-peer-deps
  ```

---

🎉 **Congratulations!** Your **LedgerFlow CRM** project is now running. Enjoy building and testing your app!
