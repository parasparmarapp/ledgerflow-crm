import { Prisma, PrismaClient } from '@prisma/client';
import { currentCompanyId } from './company-context';

/**
 * Money and quantity columns are Prisma Decimals. The web client (and CSV/report consumers)
 * expect plain JSON numbers, so Decimals serialize as numbers. All arithmetic stays in
 * Decimal inside the services; this only affects the wire format.
 */
(Prisma.Decimal.prototype as any).toJSON = function toJSON(this: Prisma.Decimal) {
  return this.toNumber();
};

const globalForPrisma = globalThis as unknown as { __ledgerflowPrisma?: any; __ledgerflowPrismaRoot?: PrismaClient };

const TENANT_MODELS = new Set([
  'User', 'CompanySettings', 'TaxRate', 'AuditLog', 'Client', 'ClientContact',
  'ProductService', 'InventoryItem', 'StockMovement', 'Invoice', 'InvoiceLineItem',
  'InvoiceRevision', 'RecurringInvoice', 'Payment', 'Expense', 'MessageTemplate',
  'Reminder', 'NotificationLog', 'Alert', 'NumberSequence',
  'PasswordResetToken',
]);

function stampNestedCreates(model: string, data: any, companyId: number) {
  if (!data || typeof data !== 'object') return;
  const relations: Record<string, string[]> = {
    Client: ['contacts'],
    Invoice: ['lineItems', 'payments'],
    InventoryItem: ['movements'],
  };
  for (const relation of relations[model] ?? []) {
    const operation = data[relation];
    if (!operation || typeof operation !== 'object') continue;
    const createPayload = operation.create;
    if (Array.isArray(createPayload)) {
      for (const row of createPayload) if (row && typeof row === 'object') row.companyId = companyId;
    } else if (createPayload && typeof createPayload === 'object') {
      createPayload.companyId = companyId;
    }
  }
}

function createClient(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const companyId = currentCompanyId();
          if (!companyId) throw new Error(`Company context is required for ${model}.${operation}`);

          const scoped = (args ? { ...args } : {}) as any;
          if (operation === 'create') {
            scoped.data = { ...(scoped.data || {}), companyId };
            stampNestedCreates(model, scoped.data, companyId);
          } else if (operation === 'createMany') {
            const data = Array.isArray(scoped.data) ? scoped.data : [scoped.data];
            scoped.data = data.map((row: any) => ({ ...row, companyId }));
          } else if (operation === 'upsert') {
            scoped.where = { ...(scoped.where || {}), companyId };
            scoped.create = { ...(scoped.create || {}), companyId };
          } else if (operation === 'update' || operation === 'delete' || operation === 'updateMany' || operation === 'deleteMany') {
            scoped.where = { ...(scoped.where || {}), companyId };
            if (operation === 'update') scoped.data = { ...(scoped.data || {}), companyId };
          } else {
            scoped.where = { ...(scoped.where || {}), companyId };
          }
          return query(scoped);
        },
      },
    },
  });
}

/** Single shared client for the whole process (avoids exhausting DB connections). */
export const prismaRoot: PrismaClient = globalForPrisma.__ledgerflowPrismaRoot ?? new PrismaClient();
globalForPrisma.__ledgerflowPrismaRoot = prismaRoot;
export const prisma: PrismaClient = globalForPrisma.__ledgerflowPrisma ?? createClient(prismaRoot);
globalForPrisma.__ledgerflowPrisma = prisma;

export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;

export default prisma;
