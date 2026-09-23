# LedgerFlow CRM — Handoff Prompt (Phase 3+)

Paste this into the other agent as the task brief.

---

## Context

LedgerFlow CRM is a SMB CRM (invoicing, payments, inventory, expenses, reports) built with:
- **Backend:** Node 20, Express 4, TypeScript, Prisma 5 + PostgreSQL, at `backend/`
- **Frontend:** React 18 + Vite + TypeScript + Tailwind, at `web/`

A prior pass (Phase 0–2) rebuilt the backend's data model and business logic from a generic scaffold into a real system. That work is **done and verified live** (not just typechecked — every flow below was exercised against the running server and database). Full details in [docs/ARCHITECTURE.md](ARCHITECTURE.md) (screen list, roles/permissions, schema, API structure, business rules, reporting/dashboard spec, dev phases).

Your job is **Phase 3 onward**: build the frontend screens and remaining backend pieces that the Phase 0–2 backend already supports but has no UI for, plus the features architecture.md marks as still missing (quotations, dashboard, recurring line items, etc.).

**Do not modify `backend/src/services/*`, `backend/src/routes/*`, or `backend/prisma/schema.prisma` business logic without re-reading them first** — they encode real business rules (see "Business rules to respect" below) that are easy to accidentally break.

---

## What's implemented (Phase 0–2) — build on this, don't rebuild it

### Backend (`backend/src/`)
- **Schema** (`prisma/schema.prisma`): full relational schema with `Decimal` money, `CompanySettings`, `NumberSequence`, `TaxRate`, `AuditLog`, `MessageTemplate`, `NotificationLog`, `InvoiceRevision`, `Reminder`. Migrated via `prisma migrate` (history in `prisma/migrations/`) — **use `npx prisma migrate dev` for new schema changes, never `db push`.**
- **Services** (`src/services/`):
  - `invoice.service.ts` — full lifecycle: create, issue, edit (with revision lock), void, duplicate, revise, `refreshOverdue()`. Status is **derived**, never set directly.
  - `payment.service.ts` — record (blocks overpayment), void, reconcile.
  - `inventory.service.ts` — stock ledger, zero-floor enforcement, override support.
  - `invoice.calc.ts` — the totals engine (tax/discount math) and status-derivation function.
  - `notification.service.ts` — channel-agnostic email+SMS dispatch, template rendering, retry.
  - `reminder.service.ts` — evaluates `Reminder` rules against open invoices.
  - `numbering.service.ts` — gap-free sequential invoice/receipt numbers.
  - `pdf.service.ts` — invoice and receipt PDFs (pdfkit).
  - `audit.service.ts`, `settings.service.ts`, `alert.service.ts`, `template.service.ts`.
- **Routers** (`src/routes/`): `clients`, `catalog` (products/inventory/stock-movements), `invoices`, `payments`, `expenses`, `reports`, `communications` (alerts/reminders/templates/notifications), `settings` (company/tax-rates/users/audit), `recurring`. All mounted in `src/server.ts`.
- **Auth/RBAC** (`src/auth/permissions.ts`): `requireAuth` + `requirePermission('invoice.void')` etc. Two roles (`admin`, `staff`) mapped to a permission set — see `PERMISSIONS`/`ROLE_PERMISSIONS` in that file. **Always check permissions, never `role === 'admin'` directly**, so custom roles can be added later.
- **Scheduler** (`src/jobs/scheduler.ts`): cron jobs for mark-overdue, reminder sweep, recurring-invoice generation, notification retry. Runs on boot (`NODE_ENV !== 'test'`).
- **SMS**: Arkesel integration in `sms.service.ts` (low-level transport only — templating/logging lives in `notification.service.ts`).

### Frontend (`web/src/`)
Existing pages (list/create/edit/detail for invoices, clients, products/services, inventory, expenses, payments, reports) still work unmodified — the backend maps their legacy payload shapes onto the new validated engine. No changes needed there unless you're adding new fields.

---

## What needs to be implemented

Go through these roughly in order; each references the backend endpoints that already exist and need a UI, or backend+UI both needed together. Full endpoint list is in [docs/ARCHITECTURE.md § 4](ARCHITECTURE.md).

### 1. Invoice actions UI (backend done, UI missing)
`InvoiceDetailsPage.tsx` currently shows only totals — no line items, no payment history, no actions beyond "Send". Add:
- Line items table, payment history list, notification/audit timeline (`GET /invoices/:id/timeline`)
- **Void** button → modal asking for a reason → `POST /invoices/:id/void { reason }`
- **Revise** button (shown only when the invoice has payments) → reason modal → `POST /invoices/:id/revise { reason }`, then unlock the edit form
- **Duplicate** button → `POST /invoices/:id/duplicate`
- **Download PDF** → `GET /invoices/:id/pdf`
- Show `balanceDue`, `revision`, `isDraft` (all already in the API response)

`EditInvoicePage.tsx` currently sends `status`/`subtotal`/`taxAmount`/`totalAmount` directly — **the backend now ignores all of these and recomputes them**, and blocks the edit with `409 REVISION_REQUIRED` if the invoice has payments and no open revision. Rework this page to: edit line items (not raw totals), and surface the `REVISION_REQUIRED` error with a link to start a revision.

### 2. Payment actions UI
- Payment details page: add a **Void** button (reason modal) → `POST /payments/:id/void { reason }`. The current delete button silently voids via `DELETE /payments/:id` — replace it with the real void flow so a reason is captured.
- **Download receipt PDF** → `GET /payments/:id/receipt.pdf`

### 3. Company Settings page (new, backend done)
`/settings/company` — form bound to `GET/PUT /api/v1/settings/company`: company name/logo/address/tax ID, currency, invoice/receipt/quotation prefixes, default payment terms, default notes/terms, `allowNegativeStock` toggle, and the six `notify*` toggles (email/SMS × invoice-sent/payment/reminders).

### 4. Notification settings + template editor (new, backend done)
- `/settings/notifications`: SMTP status (`GET /notifications/smtp-status`) and Arkesel status+balance (`GET /notifications/sms-status`), a "send test" button for each (`POST /notifications/test-email`, `POST /notifications/test-sms`).
- `/settings/templates`: CRUD over `GET/POST/PATCH /message-templates`, with a live preview (`POST /message-templates/:id/preview`) and a character/segment counter for SMS bodies (GSM-7, 160 chars/segment — see `formatGhs`/`renderTemplate` in `template.service.ts` for the placeholder syntax: `{{client.name}}`, `{{invoice.number}}`, etc.)
- Communication log page: `GET /notifications/log?channel&status&clientId&invoiceId` (paginated).

### 5. Users & roles page (new, backend done)
`/settings/users`: list (`GET /users`), create (`POST /users`), edit role/name (`PATCH /users/:id`), deactivate (`POST /users/:id/deactivate` — blocked server-side if it's the last admin), reset password (`POST /users/:id/reset-password`).

### 6. Audit log viewer (new, backend done)
`/settings/audit-log`: `GET /audit-logs?entityType&entityId&userId&action&from&to`, paginated (`X-Total-Count` header).

### 7. Tax rates (new, backend done)
Simple CRUD screen (probably a sub-tab of Company Settings) over `GET/POST/PATCH/DELETE /settings/tax-rates`.

### 8. Reminder rules UI cleanup
`InvoicePaymentRemindersPage.tsx` currently sends `channel: "Email"` / `triggerType: "Before due date"` as display strings — the backend normalizes these to `email`/`before_due` etc. as a compatibility shim, but the UI should send/display the real enum values directly instead of relying on the shim. Also expose the new fields: `repeatEveryDays`, `maxRepeats` (for overdue rules), `templateId` (link to a MessageTemplate instead of a free-text message).

### 9. Client-facing features (backend done, UI missing)
- Duplicate detection on the client form: call `GET /clients/duplicates?email&phone` on blur, warn before saving.
- Archive/restore (`POST /clients/:id/archive` — returns 409 if the client has open invoices unless `?force=true`; `POST /clients/:id/restore`).
- CSV import: `POST /clients/import { rows, onDuplicate }` — build an upload → column-map → preview → confirm flow.
- CSV export button → `GET /clients/export`.
- Client profile tabs: invoices/payments/communications/summary are all already separate endpoints (`GET /clients/:id/invoices`, `/payments`, `/communications`, `/summary`) — wire them into `ClientProfilePage.tsx`.
- `smsOptOut`/`emailOptOut` toggles on the client form.

### 10. Dashboard (new, backend AND frontend missing)
No `/dashboard/summary` endpoint exists yet — build it (role-aware: staff gets operational widgets only, admin gets financial KPIs) per [docs/ARCHITECTURE.md § 7](ARCHITECTURE.md). The route `/` currently redirects straight to the invoice list; make it a real dashboard.

### 11. Quotations (new, backend AND frontend missing)
Not started at all. Needs a `Quotation` model (see the schema sketch in architecture.md §3), a router, and CRUD + send/accept/decline/convert-to-invoice UI. Lower priority than 1–9.

### 12. Recurring invoices — line items (backend model limitation)
`RecurringInvoice` currently stores a single `amount`, not a line-item template, so the generation job creates a one-line "Recurring charge" invoice. If you need multi-line recurring invoices, this needs a schema change (a `DocumentLineItem` shared table, as sketched in architecture.md) — bigger lift, hold until the simpler items above are done.

### 13. Seed script
`backend/src/seed.ts` inserts invoices directly via `prisma.invoice.create` rather than through `invoiceService`, so re-seeding produces rows missing `issuedAt`/`balanceDue`/proper numbering. Fix by routing seed data through the real service calls, or backfilling those fields explicitly.

---

## Business rules to respect (don't regress these)

- Invoice/payment status is **always derived**, never set by a client request. See `deriveStatus()` in `invoice.calc.ts`.
- An issued invoice with payments **cannot be edited** without going through `POST /invoices/:id/revise` first (409 `REVISION_REQUIRED` otherwise).
- An invoice **cannot be voided** while it has active (non-voided) payments — void the payments first.
- Stock cannot go negative without `allowNegativeStock` (company setting) or an explicit `override: true` + `inventory.override` permission.
- Overpayment is rejected (payment amount capped at `balanceDue`).
- Every permission check goes through `requirePermission('<permission>')`, never a raw role string comparison — see the catalogue in `backend/src/auth/permissions.ts`.
- Every financial/inventory/admin write should call `audit(...)` (see `audit.service.ts`) so it shows up in the audit log.
- SMS bodies should stay GSM-7 safe — write "GHS" not "₵" in any new template text.

## Verification

- `cd backend && npx tsc --noEmit -p .` and `npx vitest run` must stay clean.
- `cd web && npx tsc --noEmit -p .` must stay clean.
- Manually smoke-test new endpoints against the running dev server before considering a feature done — curl examples for the existing endpoints are in the Phase 0-2 completion notes; follow the same pattern (login → get a token → call the endpoint → check status codes and the audit/notification log).
