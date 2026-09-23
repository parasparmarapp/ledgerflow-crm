# LedgerFlow CRM — V1 Product & Technical Architecture

**Scope:** 11 V1 modules for SMB sales, finance, customers, inventory, invoicing and payments. No AI modules.
**Stack (existing):** React 18 + Vite + Tailwind (`web/`), Express 4 + TypeScript + Prisma 5 + PostgreSQL (`backend/`).
**Currency / locale:** GHS (GH₵), Ghana phone numbers (`233…`), SMS via Arkesel, email via SMTP.

Status legend used throughout: ✅ built · 🟡 partial / needs rework · ❌ missing

---

## 0. Current-state summary (gap analysis)

| Area | Status | Notes |
|---|---|---|
| Page coverage | 🟡 | 33 pages exist for most modules. Missing: Dashboard, Quotations, Settings, Users, Message Templates, Audit Log, CSV import. Home route is the invoice list. |
| API layering | 🟡 | Three overlapping routers: `productionRouter` (hooks with business logic) → `canonicalApiRouter` (generic CRUD, no side effects) → `modules/*` (shadowed, mostly dead). A `PATCH` to an invoice or payment bypasses all business rules. |
| Data integrity | 🟡 | No foreign keys or relations in Prisma. Money is `Float`. Invoice numbers come from `count()+1`, which gives duplicates after a delete and races under concurrency. |
| Invoicing | 🟡 | Create, send and status work. Missing: duplicate, void (with a reason), revision lock on paid invoices, "viewed" tracking, quotations, PDF. |
| Recurring invoices | 🟡 | Model stores only `amount` (no line items). No scheduler generates invoices. |
| Inventory | 🟡 | Stock is deducted on invoice create only. No zero floor. Adjust endpoint exists. Stock history exists (`StockMovement`). |
| Payments | 🟡 | Record payment and auto status work. No void or refund. Deleting via canonical CRUD does not recalculate the invoice. |
| Reports | 🟡 | Endpoints return raw rows without date filters. CSV export is client-side on some pages. No PDF. |
| Email | ✅ | SMTP service with simulated fallback: invoice email, receipt email. The reminder email is never triggered. |
| SMS | 🟡 | Arkesel service is built: invoice sent and payment received. No templates, no reminders. |
| Reminders | ❌ | CRUD only. No scheduler processes them. |
| Audit log | ❌ | Only `StockMovement` exists. |
| RBAC | 🟡 | `admin` and `staff` roles. `requireRole('admin')` is applied to reports only. No user management UI. |
| Pagination | ❌ | All list endpoints return everything. |
| PDF | ❌ | No server-side PDF generation. |

---

## 1. Screen / page list

Legend: **A** = Admin/Owner only. Everything else is Admin + Staff, subject to the permissions in §2.

### Auth & account
| # | Screen | Route | Status |
|---|---|---|---|
| 1 | Login | `/login` | ✅ |
| 2 | Forgot / reset password | `/forgot-password`, `/reset-password/:token` | ❌ |
| 3 | My profile & change password | `/settings/profile` | ✅ |

### Dashboard
| 4 | Dashboard (role-aware widgets) | `/` | ❌ (home is the invoice list today) |

### Invoicing
| 5 | Invoice list (filters: status, client, date, overdue; bulk send/export) | `/invoices` | ✅ |
| 6 | Create invoice | `/invoices/new` | ✅ |
| 7 | Edit invoice (draft/sent only; paid invoices need a revision) | `/invoices/:id/edit` | 🟡 |
| 8 | Invoice details (timeline, payments, notifications, PDF, actions) | `/invoices/:id` | 🟡 |
| 9 | Quotation / estimate list | `/quotations` | ❌ |
| 10 | Create / edit quotation | `/quotations/new`, `/quotations/:id/edit` | ❌ |
| 11 | Quotation details (convert to invoice) | `/quotations/:id` | ❌ |
| 12 | Recurring invoice list | `/recurring-invoices` | 🟡 |
| 13 | Create / edit recurring schedule | `/recurring-invoices/new`, `/:id/edit` | ❌ |
| 14 | Public invoice view (customer link, marks as Viewed) | `/i/:publicToken` (no auth) | ❌ |

### Payments
| 15 | Payments list | `/payments` | ✅ |
| 16 | Record payment (optionally pre-selected invoice) | `/payments/new?invoiceId=` | 🟡 |
| 17 | Payment details / receipt (void) | `/payments/:id` | 🟡 |
| 18 | Payment reconciliation **A** | `/payments/reconciliation` | ✅ |

### Clients
| 19 | Client list (search, tags, archive filter, export) | `/clients` | ✅ |
| 20 | Create / edit client (duplicate warning) | `/clients/new`, `/clients/:id/edit` | ✅ |
| 21 | Client profile (tabs: overview, invoices, payments, contacts, communication, activity) | `/clients/:id` | 🟡 |
| 22 | Client CSV import (upload → map → preview → confirm) | `/clients/import` | ❌ |

### Products, Services & Inventory
| 23 | Products & services catalog | `/products-services` | ✅ |
| 24 | Create / edit product or service | `/products-services/new`, `/:id/edit` | ✅ |
| 25 | Product / service details | `/products-services/:id` | ✅ |
| 26 | Inventory list (low / out-of-stock filters) | `/inventory` | ✅ |
| 27 | Create / edit inventory item | `/inventory/new`, `/:id/edit` | ✅ |
| 28 | Inventory item details plus adjust stock | `/inventory/:id` | ✅ |
| 29 | Stock history / audit | `/inventory/history` | ✅ |

### Expenses
| 30 | Expense list | `/expenses` | ✅ |
| 31 | Create / edit expense (receipt upload) | `/expenses/new`, `/:id/edit` | ✅ |

### Reports (all **A**, with PDF and CSV export)
| 32 | Sales report | `/reports/sales` | 🟡 |
| 33 | Revenue report | `/reports/revenue` | 🟡 |
| 34 | Profit report | `/reports/profit` | 🟡 |
| 35 | Expense report | `/reports/expenses` | 🟡 |
| 36 | Payments report | `/reports/payments` | 🟡 |
| 37 | Inventory valuation / stock report | `/reports/inventory` | ❌ (optional V1) |

### Communication
| 38 | Invoice alerts (in-app notification centre) | `/alerts` | ✅ |
| 39 | Reminder rules (before due / on due / overdue × email/SMS) | `/reminders` | 🟡 |
| 40 | Message templates (email + SMS, placeholders, preview) **A** | `/settings/templates` | ❌ |
| 41 | Communication log (email and SMS delivery status) | `/communications` | ❌ |

### Settings & administration (all **A**)
| 42 | Company settings (name, logo, address, tax ID, currency, invoice prefix, default terms and notes) | `/settings/company` | ❌ |
| 43 | Tax settings (tax rates, GST/VAT components) | `/settings/taxes` | ❌ |
| 44 | Notification settings (SMTP/SMS status, test send, per-event toggles) | `/settings/notifications` | ❌ |
| 45 | Users & roles (invite, deactivate, reset password) | `/settings/users` | ❌ |
| 46 | Audit log (filter by entity, user, action, date) | `/settings/audit-log` | ❌ |

---

## 2. User roles & permissions

V1 ships two fixed roles. Permissions are checked server-side through `requirePermission('invoice.void')` rather than hard-coded role names, so custom roles can be added later without code changes.

| Permission | Admin/Owner | Staff |
|---|:-:|:-:|
| Dashboard: financial KPIs (revenue, profit, expenses) | ✅ | ❌ (operational widgets only) |
| Clients: view / create / edit | ✅ | ✅ |
| Clients: archive, CSV import/export, merge duplicates | ✅ | ❌ |
| Products & services: view | ✅ | ✅ |
| Products & services: create / edit / archive, change prices | ✅ | ❌ |
| Inventory: view, stock history | ✅ | ✅ |
| Inventory: manual adjustment | ✅ | ✅ (reason required, audited) |
| Inventory: negative-stock override | ✅ | ❌ |
| Invoices: create / edit draft / send / duplicate | ✅ | ✅ |
| Invoices: edit sent invoice | ✅ | ✅ (audited) |
| Invoices: void / cancel, revise paid invoice, delete draft | ✅ | ❌ |
| Quotations: all | ✅ | ✅ |
| Recurring invoices: manage | ✅ | ❌ |
| Payments: record | ✅ | ✅ |
| Payments: void / refund, reconcile | ✅ | ❌ |
| Expenses: create / edit own | ✅ | ✅ |
| Expenses: edit / delete any | ✅ | ❌ |
| Reports and exports (all 5) | ✅ | ❌ |
| Reminders & templates: manage | ✅ | ❌ |
| Send manual email/SMS to a client | ✅ | ✅ |
| Settings, users, audit log | ✅ | ❌ |

**Rules**
- There must always be at least one active Admin.
- An Admin cannot deactivate themselves.
- Deactivated users' tokens are rejected immediately: `isActive` is checked on every request.
- Staff see the list pages. The UI hides actions they aren't allowed to perform, **and** the API returns 403. The API check is the source of truth.

---

## 3. Database schema (target)

Principles:
- Prisma **relations with real foreign keys**.
- **`Decimal(12,2)`** for all money and **`Decimal(12,3)`** for quantities.
- Soft-delete by archiving (`archivedAt`) for master data.
- Financial documents are never hard-deleted after they leave draft.
- `createdById` / `updatedById` on business records.
- Indexes on every FK plus common filters (`status`, dates).

Enums are shown as Prisma enums. `NEW` / `CHANGED` mark differences from today's schema.

```prisma
// ---------- Identity & settings ----------
enum Role { ADMIN STAFF }

model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  name          String
  passwordHash  String
  role          Role      @default(STAFF)          // CHANGED: enum
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?                          // NEW
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model PasswordResetToken {                         // NEW
  id        Int      @id @default(autoincrement())
  userId    Int
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User     @relation(fields: [userId], references: [id])
}

model CompanySettings {                            // NEW (singleton, id = 1)
  id                 Int     @id @default(1)
  companyName        String
  logoUrl            String?
  email              String?
  phone              String?
  address            String?
  taxId              String?                       // GSTIN / TIN
  currency           String  @default("GHS")
  invoicePrefix      String  @default("INV-")
  quotationPrefix    String  @default("QT-")
  receiptPrefix      String  @default("RCT-")
  defaultPaymentTermsDays Int @default(14)
  defaultNotes       String?
  defaultTerms       String?
  allowNegativeStock Boolean @default(false)
  notifyInvoiceSentEmail   Boolean @default(true)
  notifyInvoiceSentSms     Boolean @default(true)
  notifyPaymentEmail       Boolean @default(true)
  notifyPaymentSms         Boolean @default(true)
  updatedAt          DateTime @updatedAt
}

model NumberSequence {                             // NEW: gap-free, concurrency-safe numbering
  key       String @id                             // "invoice:2026", "quotation:2026", "receipt:2026"
  lastValue Int    @default(0)
}

model TaxRate {                                    // NEW
  id         Int     @id @default(autoincrement())
  name       String                                // "VAT 15%", "GST 18%"
  rate       Decimal @db.Decimal(6,3)              // total percentage
  components Json?                                 // [{name:"CGST",rate:9},{name:"SGST",rate:9}] or NHIL/GETFund/VAT
  isDefault  Boolean @default(false)
  isActive   Boolean @default(true)
}

// ---------- Clients ----------
model Client {
  id              Int       @id @default(autoincrement())
  name            String
  companyName     String?
  email           String?   // indexed, used for duplicate detection
  phone           String?   // stored normalized (233XXXXXXXXX), used for duplicate detection
  billingAddress  String?
  shippingAddress String?
  taxIdentifier   String?
  notes           String?
  smsOptOut       Boolean   @default(false)       // NEW
  emailOptOut     Boolean   @default(false)       // NEW
  archivedAt      DateTime?                       // CHANGED: replaces isActive
  createdById     Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  contacts        ClientContact[]
  tags            ClientTagOnClient[]
  invoices        Invoice[]
  payments        Payment[]
  @@index([email]) @@index([phone]) @@index([name])
}

model ClientContact {
  id          Int     @id @default(autoincrement())
  clientId    Int
  name        String
  email       String?
  phone       String?
  designation String?
  isPrimary   Boolean @default(false)
  client      Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)
}

model ClientTag {                                   // NEW: replaces single `segment`
  id      Int    @id @default(autoincrement())
  name    String @unique
  color   String?
  clients ClientTagOnClient[]
}
model ClientTagOnClient {
  clientId Int
  tagId    Int
  client   Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  tag      ClientTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([clientId, tagId])
}

// ---------- Catalog & inventory ----------
enum ItemType { PRODUCT SERVICE }

model ProductService {
  id           Int      @id @default(autoincrement())
  name         String
  description  String?
  type         ItemType
  category     String?                              // CHANGED: was `group`
  sku          String?  @unique
  unit         String   @default("pcs")             // NEW
  sellingPrice Decimal  @db.Decimal(12,2)           // CHANGED: was unitPrice Float
  costPrice    Decimal? @db.Decimal(12,2)
  taxRateId    Int?                                 // CHANGED: FK instead of raw taxRate
  trackInventory Boolean @default(false)            // NEW: true for stocked products
  archivedAt   DateTime?
  inventoryItem InventoryItem?
}

model InventoryItem {
  id               Int      @id @default(autoincrement())
  productServiceId Int      @unique                  // 1:1 with a PRODUCT
  quantityOnHand   Decimal  @db.Decimal(12,3) @default(0)
  reorderLevel     Decimal  @db.Decimal(12,3) @default(5)
  unitCost         Decimal  @db.Decimal(12,2) @default(0)   // weighted average cost
  location         String?
  archivedAt       DateTime?
  product          ProductService @relation(fields: [productServiceId], references: [id])
  movements        StockMovement[]
}

enum StockReason { OPENING RESTOCK INVOICE_ISSUED INVOICE_VOIDED RETURN DAMAGE CORRECTION OVERRIDE }

model StockMovement {                              // append-only ledger: this is the stock history
  id              Int         @id @default(autoincrement())
  inventoryItemId Int
  quantityChange  Decimal     @db.Decimal(12,3)
  balanceAfter    Decimal     @db.Decimal(12,3)   // NEW
  reason          StockReason                     // CHANGED: enum
  notes           String?
  referenceType   String?                         // NEW: "invoice" | "adjustment"
  referenceId     Int?                            // NEW
  isOverride      Boolean     @default(false)     // NEW: went below zero with permission
  userId          Int?
  createdAt       DateTime    @default(now())
  item            InventoryItem @relation(fields: [inventoryItemId], references: [id])
  @@index([inventoryItemId, createdAt])
}

// ---------- Sales documents ----------
enum QuotationStatus { DRAFT SENT ACCEPTED DECLINED EXPIRED CONVERTED }
enum InvoiceStatus   { DRAFT SENT VIEWED PARTIALLY_PAID PAID OVERDUE CANCELLED }

model Quotation {                                  // NEW
  id              Int      @id @default(autoincrement())
  quotationNumber String   @unique
  clientId        Int
  issueDate       DateTime
  expiryDate      DateTime
  status          QuotationStatus @default(DRAFT)
  subtotal        Decimal  @db.Decimal(12,2)
  discountTotal   Decimal  @db.Decimal(12,2)
  taxTotal        Decimal  @db.Decimal(12,2)
  total           Decimal  @db.Decimal(12,2)
  notes           String?
  terms           String?
  convertedInvoiceId Int?  @unique
  lineItems       DocumentLineItem[] @relation("QuotationLines")
}

model Invoice {
  id              Int           @id @default(autoincrement())
  invoiceNumber   String        @unique
  clientId        Int
  quotationId     Int?          @unique              // NEW
  recurringInvoiceId Int?                            // NEW
  issueDate       DateTime
  dueDate         DateTime
  status          InvoiceStatus @default(DRAFT)
  subtotal        Decimal       @db.Decimal(12,2)
  discountTotal   Decimal       @db.Decimal(12,2)
  taxTotal        Decimal       @db.Decimal(12,2)
  total           Decimal       @db.Decimal(12,2)
  amountPaid      Decimal       @db.Decimal(12,2) @default(0)
  balanceDue      Decimal       @db.Decimal(12,2)   // NEW: denormalized, maintained in the service
  notes           String?
  terms           String?
  revision        Int           @default(0)         // NEW: bumped by the "Revise" action
  publicToken     String        @unique @default(uuid()) // NEW: customer view link
  sentAt          DateTime?
  viewedAt        DateTime?                           // NEW
  paidAt          DateTime?                           // NEW
  cancelledAt     DateTime?                           // NEW
  cancelReason    String?                             // NEW
  createdById     Int?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  client          Client        @relation(fields: [clientId], references: [id])
  lineItems       DocumentLineItem[] @relation("InvoiceLines")
  payments        Payment[]
  @@index([status, dueDate]) @@index([clientId]) @@index([issueDate])
}

model DocumentLineItem {                           // CHANGED: shared by invoice, quotation and recurring template
  id               Int      @id @default(autoincrement())
  invoiceId        Int?
  quotationId      Int?
  recurringInvoiceId Int?
  productServiceId Int?                            // null = manual line
  description      String
  quantity         Decimal  @db.Decimal(12,3)
  unitPrice        Decimal  @db.Decimal(12,2)
  discountType     String   @default("amount")    // "amount" | "percent"
  discountValue    Decimal  @db.Decimal(12,2) @default(0)
  taxRateId        Int?
  taxRate          Decimal  @db.Decimal(6,3) @default(0)  // snapshot at issue time
  taxAmount        Decimal  @db.Decimal(12,2) @default(0)
  lineTotal        Decimal  @db.Decimal(12,2)
  unitCostSnapshot Decimal? @db.Decimal(12,2)     // NEW: COGS for the profit report
  sortOrder        Int      @default(0)
}

model InvoiceRevision {                            // NEW: snapshot before a paid or sent invoice is revised
  id         Int      @id @default(autoincrement())
  invoiceId  Int
  revision   Int
  snapshot   Json
  reason     String
  userId     Int
  createdAt  DateTime @default(now())
}

enum Frequency { WEEKLY MONTHLY QUARTERLY YEARLY }
model RecurringInvoice {
  id           Int       @id @default(autoincrement())
  clientId     Int
  frequency    Frequency
  interval     Int       @default(1)               // every N periods
  startDate    DateTime
  endDate      DateTime?
  nextRunAt    DateTime
  paymentTermsDays Int   @default(14)
  autoSend     Boolean   @default(false)            // create as SENT and notify, or DRAFT
  isActive     Boolean   @default(true)
  lastRunAt    DateTime?
  lineItems    DocumentLineItem[] @relation("RecurringLines")   // CHANGED: replaces `amount`
}

// ---------- Payments ----------
enum PaymentMethod { CASH MOBILE_MONEY BANK_TRANSFER CARD CHEQUE OTHER }
enum PaymentStatus { COMPLETED PENDING VOIDED }

model Payment {
  id            Int           @id @default(autoincrement())
  receiptNumber String        @unique              // NEW
  invoiceId     Int
  clientId      Int
  amount        Decimal       @db.Decimal(12,2)
  paymentDate   DateTime
  method        PaymentMethod
  channel       String?                              // "e-payment" | "cash" (derived from method, for reports)
  reference     String?                              // MoMo / bank reference
  status        PaymentStatus @default(COMPLETED)
  reconciledAt  DateTime?                            // CHANGED: reconciliation is a flag, not a status
  voidedAt      DateTime?
  voidReason    String?
  notes         String?
  receivedById  Int?
  invoice       Invoice       @relation(fields: [invoiceId], references: [id])
  client        Client        @relation(fields: [clientId], references: [id])
  @@index([paymentDate]) @@index([invoiceId])
}

// ---------- Expenses ----------
model ExpenseCategory { id Int @id @default(autoincrement()) name String @unique  isActive Boolean @default(true) }
model Expense {
  id          Int      @id @default(autoincrement())
  description String
  categoryId  Int                                   // CHANGED: FK
  amount      Decimal  @db.Decimal(12,2)
  taxAmount   Decimal  @db.Decimal(12,2) @default(0)
  expenseDate DateTime
  vendor      String?
  paymentMethod PaymentMethod?
  receiptUrl  String?
  notes       String?
  createdById Int?
  @@index([expenseDate])
}

// ---------- Communication ----------
enum Channel { EMAIL SMS }

model MessageTemplate {                            // NEW
  id        Int     @id @default(autoincrement())
  key       String                                 // "invoice_sent" | "payment_received" | "reminder_before_due" | "reminder_on_due" | "reminder_overdue" | "quotation_sent"
  channel   Channel
  name      String
  subject   String?                                // email only
  body      String                                 // placeholders: {{client.name}} {{invoice.number}} {{invoice.balanceDue}} {{invoice.dueDate}} {{invoice.link}} {{company.name}} ...
  isDefault Boolean @default(false)
  isActive  Boolean @default(true)
  @@unique([key, channel, name])
}

model ReminderRule {                               // CHANGED: replaces Reminder
  id          Int     @id @default(autoincrement())
  name        String
  trigger     String                               // "before_due" | "on_due" | "after_due"
  daysOffset  Int     @default(0)
  channels    Channel[]
  templateEmailId Int?
  templateSmsId   Int?
  repeatEveryDays Int?                             // for after_due: e.g. every 7 days
  maxRepeats      Int?  @default(3)
  isActive    Boolean @default(true)
}

model NotificationLog {                            // CHANGED: generalizes today's SmsLog (email + SMS)
  id                Int      @id @default(autoincrement())
  channel           Channel
  event             String                        // template key or "manual" | "test"
  recipient         String
  subject           String?
  body              String
  clientId          Int?
  invoiceId         Int?
  paymentId         Int?
  reminderRuleId    Int?
  status            String                        // queued | sent | delivered | failed | simulated | skipped
  providerMessageId String?
  error             String?
  sentById          Int?                          // null = system
  createdAt         DateTime @default(now())
  @@index([clientId]) @@index([invoiceId]) @@index([invoiceId, reminderRuleId])
}

model Alert {                                      // in-app notifications (low stock, overdue, payment received)
  id              Int      @id @default(autoincrement())
  type            String
  title           String
  invoiceId       Int?
  inventoryItemId Int?
  status          String   @default("unread")   // unread | read | resolved
  createdAt       DateTime @default(now())
}

// ---------- Audit ----------
model AuditLog {                                   // NEW: append-only
  id         Int      @id @default(autoincrement())
  userId     Int?
  action     String                                // "invoice.void", "payment.create", "stock.adjust", "settings.update" ...
  entityType String
  entityId   Int?
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId]) @@index([createdAt])
}

model FileUpload { id Int @id @default(autoincrement())  path String  mimeType String  size Int  createdAt DateTime @default(now()) }  // logo, receipts, CSV imports
```

**Migration notes**
- Switch from `db push` to `prisma migrate`: financial data needs versioned migrations.
- Float → Decimal needs a data migration.
- Rename `SmsLog` to `NotificationLog`, and backfill `Alert(channel=email|sms)` rows into it.

---

## 4. API structure

### Conventions
- **Base path:** `/api/v1`. All routes need auth except `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/public/invoices/:token` and `/webhooks/*`.
- **One router per module:** `modules/<name>/{routes,controller,service,schema}.ts`. Remove `canonical-api.routes.ts` and the duplicate `productionRouter`. Business logic lives **only** in services, so every write path enforces the same rules.
- **Validation:** zod schemas per endpoint.
- **Error shape:** `{ error: { code, message, details? } }` with status codes 400, 401, 403, 404, 409 (conflict/state), 422 (business rule) and 500.
- **Lists:** `?page=1&pageSize=25&sort=-issueDate&search=&<filters>` returns `{ data, meta: { page, pageSize, total } }`.
- **Dates:** `?from=YYYY-MM-DD&to=YYYY-MM-DD`, interpreted in the company timezone (Africa/Accra).
- **Exports:** `GET …/export?format=csv|pdf&<same filters>` streams a file.
- **Idempotency:** `Idempotency-Key` header on `POST /payments` and `POST /invoices/:id/send`.
- **State changes are explicit actions** (`POST /invoices/:id/void`), never a generic `PATCH { status }`.

### Endpoints

```
AUTH           POST /auth/login | POST /auth/logout | GET /auth/me
               POST /auth/change-password | POST /auth/forgot-password | POST /auth/reset-password

USERS (A)      GET/POST /users | GET/PATCH /users/:id | POST /users/:id/deactivate | POST /users/:id/reset-password

SETTINGS (A)   GET/PUT /settings/company | POST /settings/company/logo
               GET/POST/PATCH /settings/tax-rates[/:id]
               GET/PUT /settings/notifications
               GET /settings/notifications/status        (SMTP + Arkesel status and balance)
               POST /settings/notifications/test         { channel, to }

DASHBOARD      GET /dashboard/summary?from&to             (role-filtered payload)

CLIENTS        GET/POST /clients | GET/PATCH /clients/:id
               POST /clients/:id/archive | POST /clients/:id/restore
               GET /clients/:id/summary                   (totals, outstanding, last payment)
               GET /clients/:id/invoices | /payments | /communications | /activity
               GET/POST /clients/:id/contacts | PATCH/DELETE /clients/:id/contacts/:contactId
               GET /clients/duplicates?email&phone        (pre-save check)
               POST /clients/import (multipart) → preview  | POST /clients/import/:jobId/commit
               GET /clients/export?format=csv
               GET/POST/DELETE /client-tags

PRODUCTS       GET/POST /products-services | GET/PATCH /products-services/:id
               POST /products-services/:id/archive

INVENTORY      GET /inventory?status=low|out|ok | POST /inventory | GET/PATCH /inventory/:id
               POST /inventory/:id/adjust                 { quantityChange, reason, notes, override? }
               POST /inventory/:id/archive
               GET /inventory/movements?itemId&from&to&reason   (stock history)

QUOTATIONS     GET/POST /quotations | GET/PATCH /quotations/:id
               POST /quotations/:id/send | /accept | /decline | /convert → { invoiceId }
               GET /quotations/:id/pdf

INVOICES       GET/POST /invoices | GET/PATCH /invoices/:id   (PATCH only while DRAFT, or SENT without payments)
               DELETE /invoices/:id                        (DRAFT only)
               POST /invoices/:id/send      { channels: ["email","sms"] }
               POST /invoices/:id/duplicate → new DRAFT
               POST /invoices/:id/void      { reason }
               POST /invoices/:id/revise    { reason } → unlocks editing, snapshots revision
               GET  /invoices/:id/pdf
               GET  /invoices/:id/timeline                 (audit + notifications + payments)
               POST /invoices/:id/notify    { channel, templateId? }   (manual reminder)
               GET  /invoices/next-number                   (preview only, not reserved)

PUBLIC         GET /public/invoices/:token      (marks VIEWED) | GET /public/invoices/:token/pdf

RECURRING      GET/POST /recurring-invoices | GET/PATCH /recurring-invoices/:id
               POST /recurring-invoices/:id/pause | /resume | /run-now

PAYMENTS       GET/POST /payments | GET /payments/:id
               POST /payments/:id/void { reason }
               POST /payments/reconcile { paymentIds[] }
               GET  /payments/:id/receipt.pdf

EXPENSES       GET/POST /expenses | GET/PATCH/DELETE /expenses/:id
               GET/POST /expense-categories

COMMUNICATION  GET/POST/PATCH /message-templates[/:id] | POST /message-templates/:id/preview
               GET/POST/PATCH/DELETE /reminder-rules[/:id]
               GET /notifications/log?channel&status&clientId&invoiceId
               GET/PATCH /alerts | POST /alerts/mark-all-read

REPORTS (A)    GET /reports/{sales|revenue|profit|expenses|payments}?from&to&groupBy&...
               GET /reports/{name}/export?format=csv|pdf&...

AUDIT (A)      GET /audit-logs?entityType&entityId&userId&action&from&to

WEBHOOKS       POST /webhooks/arkesel/delivery              (SMS delivery reports, verified by secret token)
```

### Backend internals
- **Services:** `InvoiceService`, `PaymentService`, `InventoryService`, `NumberingService`, `NotificationService` (channel-agnostic; renders templates, then calls `EmailService` / `SmsService`), `PdfService` (pdfkit), `ReportService`, `AuditService`.
- **Transactions:** every multi-table write runs in `prisma.$transaction`. Examples are payment plus invoice recalculation, and invoice issue plus stock deduction.
- **Scheduler:** `node-cron`, with a Postgres advisory lock so only one instance runs each job.

| Job | Schedule | Action |
|---|---|---|
| `markOverdue` | daily 00:15 | SENT/VIEWED/PARTIALLY_PAID with dueDate < today → OVERDUE, plus an in-app alert |
| `sendReminders` | daily 09:00 | Evaluate ReminderRules and send via NotificationService |
| `generateRecurring` | hourly | RecurringInvoice with nextRunAt ≤ now → invoice, advance nextRunAt |
| `expireQuotations` | daily | SENT past expiryDate → EXPIRED |
| `lowStockDigest` | daily 08:00 | Email the admin a list of items at or below reorder level |

- **Notification sends are asynchronous.** V1 uses an in-process queue plus `NotificationLog(status=queued)` rows, with a retry job that picks up failed or queued rows (max 3 attempts). This can move to BullMQ/Redis later without changing call sites.

---

## 5. Module-wise workflows

### 5.1 Invoice lifecycle
```
            ┌────────── duplicate ───────────┐
Quotation ─convert─► DRAFT ──send──► SENT ──customer opens link──► VIEWED
                       │               │  \                          │
                    delete          payment  due date passes      payment
                       ▼               ▼       ▼                     ▼
                    (gone)     PARTIALLY_PAID ─► OVERDUE ◄─── (unpaid past due)
                                       │            │
                                  full payment  full payment
                                       ▼            ▼
                                      PAID ──revise──► back to SENT/PARTIALLY_PAID (editable, audited)
Any non-PAID status ──void (Admin, reason)──► CANCELLED   (payments must be voided first)
```

**Create:**
1. Pick a client.
2. Add lines from the catalog (price, tax and cost are snapshotted) or as manual lines.
3. The server recalculates all totals; client-supplied totals are ignored.
4. Save as DRAFT (no number consumed yet; shown as "Draft #id") or **Issue**.

**Issue / Send** runs in one transaction:
1. Assign the next number from `NumberSequence`.
2. Set status to SENT and set `sentAt`.
3. Deduct stock for `trackInventory` lines (see §6).
4. Write an audit record.
5. After commit, queue notifications on the chosen channels: an email with the PDF attached and the public link, and an SMS with the amount, due date and short link.

**Payment received:** see §5.4. Status is recalculated automatically.

**Revise paid invoice:** Admin clicks "Revise" and enters a reason. The system snapshots the invoice to `InvoiceRevision`, increments `revision` and makes it editable. On save, totals are recalculated, the status is recomputed from payments, and stock differences are posted as movements.

**Void:** only when there are no active payments. Status becomes CANCELLED, stock is returned (`INVOICE_VOIDED` movements), and the action is audited. The number is never reused.

### 5.2 Quotation → invoice
DRAFT → SENT → ACCEPTED/DECLINED/EXPIRED.

`convert` copies the lines into a new DRAFT invoice (it links `quotationId` and sets the quotation to CONVERTED). It can happen only once.

### 5.3 Recurring invoices
1. Admin defines the client, lines, frequency, start and end dates and `autoSend`.
2. The `generateRecurring` job creates the invoice (DRAFT, or issued and sent if `autoSend`) and advances `nextRunAt`.
3. After `endDate`, the schedule is deactivated.
4. If generation fails, the error goes to the log and an admin alert is raised. That schedule is skipped and the others continue.

### 5.4 Payments
The user records a payment by selecting an invoice (pre-filled from the invoice page), amount, method, date and reference. All of this runs in one transaction:
1. Validate the amount against the balance due (see rules).
2. Create the Payment with a receipt number.
3. Recalculate the invoice: `amountPaid`, `balanceDue`, status, and `paidAt`.
4. Write an audit record.

After commit, queue the receipt notifications (email with receipt PDF, and SMS) and an in-app alert.

**Void payment** (Admin, with a reason) runs the same recalculation in reverse. The invoice can go back to PARTIALLY_PAID, SENT or OVERDUE.

### 5.5 Inventory
- **Create:** a product with `trackInventory` gets an InventoryItem and an OPENING movement.
- **Deduct on issue, return on void or revision.** The balance can never drop below zero without an override.
- **Manual adjust:** enter a delta, a reason from the enum and notes. A result below zero requires the `inventory.override` permission and a confirmation.
- **Alerts:** after any movement, if `onHand ≤ reorderLevel`, raise a LOW_STOCK alert. If `onHand ≤ 0`, raise OUT_OF_STOCK. The alert auto-resolves when restocked.

### 5.6 Clients
- **Create / edit:** on blur of email or phone, call `/clients/duplicates` and show "possible duplicate: open / continue anyway".
- **Import:**
  1. Upload the CSV.
  2. Map columns.
  3. Server validation gives a preview with valid, invalid and duplicate rows.
  4. Choose how to handle duplicates: skip or update.
  5. Commit and get a summary report.
- **Archive:** hidden from pickers but remains on historical documents. A client with outstanding invoices can't be archived without confirmation.

### 5.7 Reminders
The daily job evaluates each active ReminderRule against every open invoice (SENT, VIEWED, PARTIALLY_PAID, OVERDUE):
- `before_due` fires when `dueDate − daysOffset == today`.
- `on_due` fires when `dueDate == today`.
- `after_due` fires when `today − dueDate == daysOffset`, then every `repeatEveryDays` up to `maxRepeats`.

Idempotency: a reminder is skipped if a `NotificationLog` row already exists for (invoiceId, ruleId, channel) today. Opted-out clients and missing contact details are logged as `skipped`.

### 5.8 Expenses
Create an expense with category, amount, date, vendor, method and an optional receipt upload. Staff edit their own entries; Admin can edit any. Changes are audited.

---

## 6. Business rules

### Numbering
1. Invoice, quotation and receipt numbers are sequential per year (`INV-2026-0001`). They are assigned on **issue**, not on draft, inside the same transaction, using `NumberSequence` with row locking. Numbers are never reused, including for cancelled documents.

### Invoice maths (server-side, Decimal, rounded half-up to 2 dp per line)
2. `lineGross = qty × unitPrice`. `lineDiscount` is a fixed amount or a percent of gross, capped at gross. `lineNet = gross − discount`. `lineTax = lineNet × taxRate`. `lineTotal = lineNet + lineTax`.
3. An invoice-level discount, if used, is allocated to lines proportionally before tax.
4. `total = Σ lineTotal`. `balanceDue = total − amountPaid`.
5. Tax components such as CGST/SGST or VAT/NHIL/GETFund are stored as a snapshot, so later rate changes don't alter issued invoices.
6. Quantity must be > 0 and unit price ≥ 0. An invoice needs at least one line to be issued. `dueDate ≥ issueDate`.

### Status
7. Status is **derived**; it is never set directly by the client, except for the actions void, revise and send:
   - CANCELLED if voided.
   - Otherwise PAID if `balanceDue ≤ 0`.
   - Otherwise PARTIALLY_PAID if `amountPaid > 0`, but OVERDUE if past due.
   - Otherwise OVERDUE if `dueDate < today` and the invoice has been issued.
   - Otherwise VIEWED if `viewedAt` is set.
   - Otherwise SENT if issued.
   - Otherwise DRAFT.
8. **Editing:** DRAFT is freely editable. SENT/VIEWED/OVERDUE without payments is editable and audited. PARTIALLY_PAID and PAID need the **Revise** action (Admin). CANCELLED is read-only.
9. A DRAFT can be deleted. Any issued invoice can only be voided, and only when it has no active payments.

### Payments
10. Payment amount > 0. By default it must be ≤ `balanceDue`; overpayment is rejected in V1 (client credit is out of scope).
11. No payments on DRAFT or CANCELLED invoices.
12. `paymentDate` can't be in the future.
13. Payments are never deleted; they are voided with a reason (Admin). Every create or void recalculates the invoice in the same transaction.
14. Methods map to report channels: CASH → *cash*; everything else → *e-payment*.

### Inventory
15. Stock moves only through `StockMovement`. `quantityOnHand` is never edited directly, and `balanceAfter` must equal the previous balance plus the change.
16. Stock is deducted when an invoice is **issued**, not on payment. This keeps availability accurate: goods are committed when billed. Void and revision post the reversing movements.
17. A movement that would make stock negative is rejected with 422, unless `CompanySettings.allowNegativeStock` is true or the user has the override permission and passes `override: true`. That movement is flagged `isOverride` and audited.
18. Services and products with `trackInventory = false` never touch stock.
19. Inventory items with stock remaining can't be archived without a zeroing adjustment.

### Clients
20. Duplicate check: case-insensitive exact email match, **or** normalized phone match (`233…`). Staff get a warning and can proceed; the import step asks how to handle each duplicate.
21. Phone numbers are stored normalized, and the display format is applied in the UI.

### Notifications
22. Sends never block or roll back a business transaction. They are queued after commit.
23. Respect `smsOptOut` and `emailOptOut` and the per-event toggles in CompanySettings.
24. SMS bodies are GSM-7 safe (GHS rather than ₵) and at most 160 characters per default template. The template editor shows a live character and segment count.
25. Every attempt is logged in `NotificationLog`, and failures are retried up to 3 times.

### Audit (always recorded)
26. The following actions always write an AuditLog entry:
    - Invoice issue, edit after issue, revise, void, and delete of a draft.
    - Payment create, void and reconcile.
    - Stock adjust and override.
    - Price changes on products.
    - Client archive, merge and import.
    - Settings, tax rate and template changes.
    - User and role changes, and logins (success and failure).

### Security
27. Passwords use bcrypt (cost 12). Auth is by JWT (15-minute access token) with a refresh token in an httpOnly cookie. Failed logins are rate-limited.
28. Every endpoint enforces its permission on the server. Secrets (SMTP, Arkesel key) live only in the environment and are never returned by the API.

---

## 7. Dashboard structure

Default range is **this month**, with presets (Today, 7d, This month, Last month, This quarter, YTD, custom). Each KPI shows the change against the previous period.

**Admin/Owner**

| Row | Widgets |
|---|---|
| KPI cards | Sales (invoiced) · Revenue collected · Expenses · Net profit · Outstanding receivables · Overdue amount (count) |
| Charts | Revenue vs Expenses (monthly bars, 12 months) · Collections by method (cash vs e-payment donut) |
| Receivables | Aging buckets: Current / 1–30 / 31–60 / 61–90 / 90+ days (click through to the filtered invoice list) |
| Lists | Top 5 clients by revenue · Top 5 products by sales · Recent payments (5) |
| Action panels | Overdue invoices (top 5 with "Send reminder") · Low / out-of-stock items · Drafts awaiting send · Failed notifications |

**Staff**

| Row | Widgets |
|---|---|
| Operational | My drafts · Invoices due this week · Overdue invoices (count, no totals across the business) |
| Inventory | Low / out-of-stock items |
| Quick actions | New invoice · Record payment · New client · New quotation |

**Implementation:** a single endpoint, `GET /dashboard/summary`, computed with SQL aggregates and trimmed by role on the server.

---

## 8. Reporting structure

All reports share:
- The same filter bar: date range, client, product, category, method, status.
- A summary header (KPIs).
- A chart.
- A detail table (paginated, sortable).
- **CSV** export (raw detail rows) and **PDF** export (company header and logo, filters applied, summary, table, generated-by and timestamp).
- Exports are generated server-side and match what's on screen.

**Metric definitions** (fixed, so the reports always agree):
- **Sales** = value **invoiced**: issued invoices only, excluding DRAFT and CANCELLED, by `issueDate`.
- **Revenue** = money **collected**: COMPLETED payments, excluding VOIDED, by `paymentDate`.
- **Profit** = accrual basis: net sales (excluding tax) − COGS (`qty × unitCostSnapshot`) − expenses, by date.

| Report | Summary KPIs | Group by | Detail rows |
|---|---|---|---|
| **Sales** | Gross sales, discounts, tax, net sales, # invoices, avg invoice value | day/week/month · client · product/service · status | Invoice #, date, client, status, subtotal, discount, tax, total, paid, balance |
| **Revenue** | Total collected, cash vs e-payment, outstanding receivables, collection rate % | month · method · client | Receipt #, date, invoice #, client, method, amount |
| **Profit** | Net sales, COGS, gross profit and margin %, expenses, net profit and margin % | month · product (gross margin per product) | Period / product, sales, COGS, gross profit, expenses, net profit |
| **Expenses** | Total, # entries, top category, vs previous period | category · month · vendor | Date, category, vendor, description, method, amount, tax |
| **Payments** | Total received, # payments, by method, voided count/amount, unreconciled | method · day · client · status | Receipt #, date, client, invoice #, method, reference, amount, status, reconciled |

**Implementation:**
- `ReportService` holds one query builder per report. The API endpoint and both exporters call the same function.
- CSV is streamed. PDF is built with pdfkit, row count is capped at 5,000, and the UI asks the user to narrow the date range above that.

---

## 9. Navigation / menu structure

Sidebar (collapses to a bottom sheet or hamburger on mobile). Items hidden by role are marked **A**.

```
Dashboard
Sales
  ├ Invoices
  ├ Quotations
  └ Recurring Invoices                 (A)
Payments
  ├ All Payments
  ├ Record Payment
  └ Reconciliation                     (A)
Clients
  ├ All Clients
  └ Import Clients                     (A)
Catalog & Stock
  ├ Products & Services
  ├ Inventory
  └ Stock History
Expenses
Communication
  ├ Alerts            (badge: unread count)
  ├ Reminder Rules                     (A)
  ├ Message Templates                  (A)
  └ Communication Log
Reports                                (A)
  ├ Sales · Revenue · Profit · Expenses · Payments
Settings
  ├ My Profile
  ├ Company                            (A)
  ├ Taxes                              (A)
  ├ Notifications (Email & SMS)        (A)
  ├ Users & Roles                      (A)
  └ Audit Log                          (A)
```

- **Top bar:** global search across clients, invoice numbers and products; a "+ New" menu (Invoice, Quotation, Payment, Client, Expense); the alerts bell; the user menu.
- **Current `StorefrontLayout.tsx`:** the `NAV_SECTIONS` need regrouping to match this structure.

---

## 10. Recommended development phases

Each phase ends deployable, with tests for its business rules.

### Phase 0: Foundation hardening (prerequisite, ~1–1.5 weeks)
- Consolidate the routers into `modules/*` services and delete the canonical CRUD router, so there's no rule bypass.
- Move to `prisma migrate`. Add relations and FKs. Convert Float to Decimal. Add indexes.
- Add zod validation, a standard error shape, and pagination and sorting helpers.
- Implement `requirePermission`, an `isActive` check per request and refresh tokens.
- Add the `AuditService` and the `AuditLog` table.
- Add `CompanySettings`, `NumberSequence`, `TaxRate` and the settings pages.
- Fix the hard-coded login URL in `AuthContext.tsx`.

### Phase 1: Invoicing, payments and inventory core (~2 weeks)
- `InvoiceService`: totals engine, issue with numbering, derived status, duplicate, void, revise, edit locks.
- `PaymentService`: transactional record and void, receipt numbers, invoice recalculation.
- `InventoryService`: movement ledger, zero floor and override, deduct and return on issue, void and revise, low- and out-of-stock alerts.
- `PdfService`: invoice PDF and receipt PDF with the logo.
- Public invoice link with "viewed" tracking.
- UI: invoice actions (duplicate, void, revise, PDF), "Record payment" from the invoice page, stock override dialog.

### Phase 2: Communication (Email & SMS) (~1–1.5 weeks)
- `NotificationService` plus a `MessageTemplate` store with placeholders and seeded defaults for both channels.
- Refactor the existing email service and the Arkesel SMS service to render through templates. `SmsLog` becomes `NotificationLog`.
- `ReminderRule` model and UI, plus the scheduler (overdue marking, reminders) with an advisory lock.
- Retry for failed sends. Arkesel delivery-report webhook.
- Notification settings page (status, test send, toggles), template editor with SMS segment counter, communication log, client opt-out.

### Phase 3: Clients and catalog completion (~1 week)
- Tags. Duplicate detection. CSV import (preview and commit) and export.
- Client profile tabs: summary, invoices, payments, communication, activity.
- Catalog linked to taxes and `trackInventory`. Archive flows.

### Phase 4: Quotations and recurring invoices (~1 week)
- Quotation CRUD, send, accept or decline, convert to invoice, expiry job.
- Recurring invoices with line-item templates and a generation job (`autoSend`).

### Phase 5: Reports and dashboard (~1.5 weeks)
- `ReportService` with the 5 reports using the fixed metric definitions, and server-side CSV and PDF export.
- Dashboard summary endpoint and role-aware dashboard UI with the aging report.
- Expense categories and receipt uploads.

### Phase 6: Production readiness (~1 week)
- User management UI, password reset, login rate limiting, CORS lock-down, helmet, structured logging (pino).
- Test suite:
  - Unit tests for the maths, status, stock and reminder rules.
  - API integration tests per module, including permission checks.
  - E2E tests for the main flows (quote → invoice → send → partial pay → full pay → report).
- Docker production image, DB backups, health checks, seed script for a fresh tenant.
- Responsive QA pass across all screens.

**Critical path:** Phase 0 → Phase 1 → Phase 2 and Phase 5. Phases 3 and 4 can run in parallel with Phase 2 if two developers are available.
