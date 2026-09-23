# LedgerFlow CRM

LedgerFlow CRM is an enterprise-grade, multi-tenant financial operations and customer relationship management platform built for modern businesses. It unifies client relationships, multi-division product and service catalogs, real-time inventory management, invoicing workflows, payment processing, expense tracking, and comprehensive financial reporting into a fast, responsive interface.

---

## ✨ Key Features & Capabilities

### 1. 📊 Executive Dashboard & Analytics
- **Live Financial Health**: Real-time Gross Revenue, Net Profit, Operating Expenses, Outstanding Receivables, and Collection Rates.
- **Sales & Cashflow Charts**: Revenue trends and payment velocity breakdowns.
- **Urgent Action Alerts**: Instant indicators for overdue invoices, low-stock inventory items, and pending reconciliations.

### 2. 👥 Client Management & Bulk Importer
- **Client Directory**: Manage customer records, multiple contact persons, billing & shipping addresses, payment terms, and credit limits.
- **Interactive CSV Importer**: Bulk import clients with drag-and-drop file upload, automatic column header mapping, preview validation, and duplicate conflict resolution.
- **Client Profile & History**: 360-degree client ledger detailing invoice history, payment records, outstanding balance, and communication logs.

### 3. 📦 Products, Services & Inventory Stock Control
- **Multi-Division Catalog**: Organize physical goods, professional services, and custom packages across business divisions:
  - **Commodities**: Raw materials, metals, freight & logistics.
  - **CCTV Systems**: Cameras, NVRs, cabling, installation & maintenance.
  - **Folding Partitions**: Operable walls, sliding glass systems, structural acoustic panels.
- **Live Inventory Management**: Real-time stock levels, SKU tracking, reorder point alerts, and direct stock adjustments.
- **Stock Movement History**: Full transactional history recording quantity changes, movement types (invoice deduction, restock, manual adjustment), and timestamps.

### 4. 🧾 Invoicing Lifecycle & Official Revisions
- **Flexible Invoicing**: Auto-sequential invoice numbering (`INV-2026-XXXX`), line items, itemized taxes, discounts, and payment terms.
- **Lifecycle Management**: Status tracking across `Draft`, `Sent`, `Partially Paid`, `Paid`, `Overdue`, and `Cancelled`.
- **Automated Stock Decrement**: Automatic inventory deduction upon invoice issuance.
- **Audit-Compliant Revisions**: Paid or issued invoice revisions capture immutable snapshot logs before applying modifications.
- **Export & Print**: Professional invoice PDF generation and printable layouts.

### 5. 💳 Payment Processing & Cashflow Reconciliation
- **Multi-Method Support**: Record transactions via **Bank Transfer**, **Cash**, **Mobile Money (MoMo)**, **Credit/Debit Card**, and **Cheque**.
- **Partial Payments & Overpayments**: Automatic invoice balance recalculation and customer ledger updating.
- **Payment Reconciliation**: Match recorded receipts against bank settlement statements.

### 6. 💸 Expense Tracker & Cost Management
- **Expense Categorization**: Operating (OPEX) vs Capital (CAPEX) classification, project tagging, and vendor tracking.
- **Receipt Attachments**: Store digital receipts and documentation for financial audits.
- **Expense Reports**: Breakdown expenses by division, category, and date range.

### 7. 📈 Financial & Executive Reports Suite
- **Profit & Loss (P&L)**: Gross profit, COGS, operating expenditures, net margin, and profit percentages.
- **Revenue Analytics**: Monthly Recurring Revenue (MRR), Average Revenue Per User (ARPU), and division performance.
- **Expense Breakdown**: Visual distributions by expense category and vendor.
- **Sales & Payment Reports**: Exportable data grids with custom date range filtering (CSV and PDF exports).

### 8. 🛡️ System Users & Roles (RBAC)
- **Role-Based Access Control**:
  - **Admin**: Full system access, company settings, financial reports, user invitations, and role management.
  - **Staff**: Operational access restricted to catalog, clients, invoices, payments, and inventory.
- **User Administration**: Invite team members, update RBAC roles, reset passwords, and activate/deactivate accounts.

### 9. 🔐 Admin & User Profile Management
- **Profile Customization**: Edit Full Name and Email Address with live session and storage synchronization.
- **Account Security**: Secure password changes with visibility toggles, strength validation, and verification checks.

### 10. 🏢 Multi-Tenant Company Workspaces & Communications
- **Company Workspaces**: Isolated company contexts (e.g., *Brand It*, *Stoic*) with dedicated databases and records.
- **Automated Reminders**: Automated email and SMS reminder dispatch rules for upcoming and overdue invoices.
- **Communication Log**: Comprehensive audit trail of all notifications, emails, and SMS alerts sent to clients.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Ultra-fast single page application with modern component architecture |
| **Styling** | Tailwind CSS, Lucide React | Clean, responsive light/dark UI with dense data tables and micro-interactions |
| **Backend** | Node.js, Express, TypeScript | RESTful API service with modular routing and RBAC middleware |
| **ORM & Database** | Prisma ORM, PostgreSQL 16 | Relational data schema with transactional consistency and migrations |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs | Secure token-based authentication and hashed password storage |
| **Infrastructure** | Docker, Docker Compose | Containerized PostgreSQL database for local development and production deployment |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20.x or later ([Download Node.js](https://nodejs.org/))
- **Docker Desktop**: ([Download Docker](https://www.docker.com/))
- **Git**

---

### Step 1: Clone and Start the Database
Start the PostgreSQL 16 container:
```bash
docker compose up -d
```
*Database runs on `localhost:5432` (`database: ledgerflow_crm`, `user: postgres`, `password: postgres`).*

---

### Step 2: Set Up & Run the Backend
```bash
cd backend
npm install

# Push database schema
npx prisma db push

# (Optional) Seed demo catalog, sample clients, and invoices
npm run seed

# Start the backend server
npm run dev
```
> The API server will be live at `http://localhost:5100` (Health check: `http://localhost:5100/health`).

---

### Step 3: Set Up & Run the Web Application
Open a new terminal window:
```bash
cd web
npm install
npm run dev
```
> The web portal will be accessible at `http://localhost:5173`.

---

## 🔑 Default Sign-in Credentials

### 🏢 Brand It Company (`brand-it`)
| User Name | Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Brand It Admin** | Admin | `admin@brand-it.com` | `Admin!2026` | Full access across all modules, reports, system users & company settings |
| **Brand It Staff** | Staff | `staff@brand-it.com` | `Staff!2026` | Operational access to invoicing, inventory, clients, payments & catalog |

### 🏢 Stoic Company (`stoic`)
| User Name | Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Stoic Admin** | Admin | `admin@stoic.com` | `Admin!2026` | Full access across all modules, reports, system users & company settings |
| **Stoic Staff** | Staff | `staff@stoic.com` | `Staff!2026` | Operational access to invoicing, inventory, clients, payments & catalog |

---

## 📁 Project Structure

```text
crm/
├── backend/                  # Node.js Express + TypeScript backend
│   ├── prisma/
│   │   └── schema.prisma     # Prisma database schema definition
│   └── src/
│       ├── auth/             # Authentication & RBAC permission logic
│       ├── lib/              # Database clients, company context & utilities
│       ├── modules/          # Auth & system controllers
│       ├── routes/           # REST API route handlers (invoices, clients, catalog, etc.)
│       ├── services/         # Business logic services (invoicing, stock control, reports)
│       └── server.ts         # Express server entry point
├── web/                      # React + TypeScript + Vite frontend
│   └── src/
│       ├── components/       # Reusable UI components (Select, DatePicker, Pagination, etc.)
│       ├── layouts/          # StorefrontLayout sidebar navigation & page wrappers
│       ├── lib/              # API clients, currency formatters, session management
│       ├── pages/            # Application views (Dashboard, Invoices, Clients, Reports, etc.)
│       ├── App.tsx           # Router configuration & protected routes
│       └── AuthContext.tsx   # React authentication context & active user state
├── docker-compose.yml        # PostgreSQL 16 container definition
├── SETUP_GUIDE.md            # Detailed setup instructions & troubleshooting
└── README.md                 # Project overview and documentation
```

---

## 📖 Additional Documentation
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — Step-by-step setup manual with troubleshooting and environment guides.

