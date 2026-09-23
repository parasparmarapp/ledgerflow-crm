-- LedgerFlow V1 foundation: Decimal money, relations/FKs, settings, numbering, audit,
-- notification log, templates. Hand-edited to backfill existing rows safely.

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "message" TEXT,
ALTER COLUMN "channel" SET DEFAULT 'in-app',
ALTER COLUMN "status" SET DEFAULT 'unread';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "createdById" INTEGER,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "quantityOnHand" SET DEFAULT 0,
ALTER COLUMN "quantityOnHand" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "reorderThreshold" SET DEFAULT 5,
ALTER COLUMN "reorderThreshold" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revisionOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewedAt" TIMESTAMP(3),
ALTER COLUMN "invoiceNumber" DROP NOT NULL,
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCostSnapshot" DECIMAL(14,2),
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "receivedById" INTEGER,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ProductService" ADD COLUMN     "taxRateId" INTEGER,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'pcs',
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "RecurringInvoice" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "maxRepeats" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "repeatEveryDays" INTEGER,
ADD COLUMN     "templateId" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "balanceAfter" DECIMAL(14,3),
ADD COLUMN     "isOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referenceId" INTEGER,
ADD COLUMN     "referenceType" TEXT,
ALTER COLUMN "quantityChange" SET DATA TYPE DECIMAL(14,3),
ALTER COLUMN "previousQuantity" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "SmsLog";

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'LedgerFlow CRM',
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RCT-',
    "quotationPrefix" TEXT NOT NULL DEFAULT 'QT-',
    "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 14,
    "defaultNotes" TEXT,
    "defaultTerms" TEXT,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "notifyInvoiceSentEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyInvoiceSentSms" BOOLEAN NOT NULL DEFAULT true,
    "notifyPaymentEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPaymentSms" BOOLEAN NOT NULL DEFAULT true,
    "notifyRemindersEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyRemindersSms" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "key" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(7,3) NOT NULL,
    "components" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceRevision" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "clientId" INTEGER,
    "invoiceId" INTEGER,
    "paymentId" INTEGER,
    "reminderId" INTEGER,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "sentById" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "InvoiceRevision_invoiceId_idx" ON "InvoiceRevision"("invoiceId");

-- CreateIndex
CREATE INDEX "MessageTemplate_key_channel_idx" ON "MessageTemplate"("key", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_channel_name_key" ON "MessageTemplate"("key", "channel", "name");

-- CreateIndex
CREATE INDEX "NotificationLog_clientId_idx" ON "NotificationLog"("clientId");

-- CreateIndex
CREATE INDEX "NotificationLog_invoiceId_reminderId_channel_idx" ON "NotificationLog"("invoiceId", "reminderId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_status_nextAttemptAt_idx" ON "NotificationLog"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationLog_providerMessageId_idx" ON "NotificationLog"("providerMessageId");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_alertType_inventoryItemId_idx" ON "Alert"("alertType", "inventoryItemId");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_productServiceId_key" ON "InventoryItem"("productServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductService_sku_key" ON "ProductService"("sku");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_createdAt_idx" ON "StockMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductService" ADD CONSTRAINT "ProductService_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productServiceId_fkey" FOREIGN KEY ("productServiceId") REFERENCES "ProductService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_productServiceId_fkey" FOREIGN KEY ("productServiceId") REFERENCES "ProductService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Data backfill for existing rows
-- ---------------------------------------------------------------------------

-- Every invoice gets a public share token.
UPDATE "Invoice" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "publicToken" SET NOT NULL;

-- Denormalized balance and lifecycle timestamps.
UPDATE "Invoice" SET "balanceDue" = GREATEST("totalAmount" - "amountPaid", 0);
UPDATE "Invoice" SET "issuedAt" = COALESCE("sentAt", "issueDate") WHERE status <> 'draft';
UPDATE "Invoice" SET "paidAt" = "updatedAt" WHERE status = 'paid';

-- Stocked products track inventory.
UPDATE "ProductService" p SET "trackInventory" = true
  WHERE p.type = 'product' OR EXISTS (SELECT 1 FROM "InventoryItem" i WHERE i."productServiceId" = p.id);

-- Line tax amounts (legacy rows stored only the rate).
UPDATE "InvoiceLineItem"
  SET "taxAmount" = ROUND(GREATEST(quantity * "unitPrice" - "discountAmount", 0) * "taxRate" / 100, 2);

-- Receipt numbers for existing payments, in payment order per year.
WITH numbered AS (
  SELECT id, EXTRACT(YEAR FROM "paymentDate")::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "paymentDate") ORDER BY "paymentDate", id) AS n
  FROM "Payment"
)
UPDATE "Payment" p SET "receiptNumber" = 'RCT-' || numbered.yr || '-' || LPAD(numbered.n::text, 4, '0')
FROM numbered WHERE numbered.id = p.id AND p."receiptNumber" IS NULL;
UPDATE "Payment" SET "reconciledAt" = "updatedAt" WHERE status = 'reconciled';

-- Seed number sequences from existing documents so new numbers continue after them.
INSERT INTO "NumberSequence" ("key", "lastValue")
SELECT 'invoice:' || (regexp_match("invoiceNumber", '(\d{4})-(\d+)$'))[1],
       MAX(((regexp_match("invoiceNumber", '(\d{4})-(\d+)$'))[2])::int)
FROM "Invoice" WHERE "invoiceNumber" ~ '\d{4}-\d+$'
GROUP BY 1
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "NumberSequence" ("key", "lastValue")
SELECT 'receipt:' || EXTRACT(YEAR FROM "paymentDate")::int, COUNT(*)::int
FROM "Payment" GROUP BY EXTRACT(YEAR FROM "paymentDate")
ON CONFLICT ("key") DO NOTHING;

-- Stock ledger running balances for existing movements.
WITH ordered AS (
  SELECT id, SUM("quantityChange") OVER (PARTITION BY "inventoryItemId" ORDER BY "createdAt", id) AS running
  FROM "StockMovement"
)
UPDATE "StockMovement" m SET "balanceAfter" = ordered.running,
       "previousQuantity" = COALESCE(m."previousQuantity", ordered.running - m."quantityChange")
FROM ordered WHERE ordered.id = m.id;

-- Company settings singleton.
INSERT INTO "CompanySettings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
