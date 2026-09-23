-- Existing records are dummy data; assign them to Brand It Company.
CREATE TABLE "Company" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
INSERT INTO "Company" ("id", "slug", "name") VALUES
  (1, 'brand-it', 'Brand It Company'),
  (2, 'stoic', 'Stoic Company');
SELECT setval(pg_get_serial_sequence('"Company"', 'id'), GREATEST((SELECT MAX("id") FROM "Company"), 1));

-- Users are company-local accounts. Existing demo admins are copied to Stoic so
-- both demo workspaces have an initial administrator; ordinary staff remain Brand It only.
ALTER TABLE "User" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
CREATE INDEX "User_companyId_isActive_idx" ON "User"("companyId", "isActive");
INSERT INTO "User" ("companyId", "email", "name", "passwordHash", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt")
SELECT 2, "email", "name", "passwordHash", 'admin', "isActive", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "companyId" = 1 AND "role" = 'admin';

ALTER TABLE "CompanySettings" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");
CREATE SEQUENCE "CompanySettings_id_seq";
SELECT setval('"CompanySettings_id_seq"', GREATEST(COALESCE((SELECT MAX("id") FROM "CompanySettings"), 0), 1));
ALTER TABLE "CompanySettings" ALTER COLUMN "id" SET DEFAULT nextval('"CompanySettings_id_seq"');
ALTER SEQUENCE "CompanySettings_id_seq" OWNED BY "CompanySettings"."id";
ALTER TABLE "TaxRate" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AuditLog" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Client" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClientContact" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProductService" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "ProductService_sku_key";
CREATE UNIQUE INDEX "ProductService_companyId_sku_key" ON "ProductService"("companyId", "sku");
ALTER TABLE "InventoryItem" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StockMovement" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "Invoice_invoiceNumber_key";
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");
ALTER TABLE "InvoiceLineItem" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InvoiceRevision" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RecurringInvoice" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Payment" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "Payment_receiptNumber_key";
CREATE UNIQUE INDEX "Payment_companyId_receiptNumber_key" ON "Payment"("companyId", "receiptNumber");
ALTER TABLE "Expense" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MessageTemplate" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reminder" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NotificationLog" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Alert" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NumberSequence" ADD COLUMN "companyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NumberSequence" DROP CONSTRAINT "NumberSequence_pkey";
ALTER TABLE "NumberSequence" ADD CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("companyId", "key");

DROP INDEX "MessageTemplate_key_channel_name_key";
CREATE UNIQUE INDEX "MessageTemplate_companyId_key_channel_name_key" ON "MessageTemplate"("companyId", "key", "channel", "name");

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','CompanySettings','TaxRate','AuditLog','Client','ClientContact','ProductService','InventoryItem','StockMovement','Invoice','InvoiceLineItem','InvoiceRevision','RecurringInvoice','Payment','Expense','MessageTemplate','Reminder','NotificationLog','Alert','NumberSequence'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_companyId_fkey');
    EXECUTE format('CREATE INDEX %I ON %I("companyId")', t || '_companyId_idx', t);
  END LOOP;
END $$;
