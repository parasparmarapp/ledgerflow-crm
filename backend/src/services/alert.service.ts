import prisma, { Db } from '../lib/prisma';

export type AlertType =
  | 'low_stock'
  | 'out_of_stock'
  | 'invoice_overdue'
  | 'invoice_sent'
  | 'payment_received'
  | 'notification_failed';

/** Creates an in-app alert unless an unresolved one of the same type already exists for the entity. */
export async function raiseAlert(
  data: { alertType: AlertType; message: string; invoiceId?: number | null; inventoryItemId?: number | null; dedupe?: boolean },
  db: Db = prisma,
) {
  if (data.dedupe !== false) {
    const existing = await db.alert.findFirst({
      where: {
        alertType: data.alertType,
        invoiceId: data.invoiceId ?? null,
        inventoryItemId: data.inventoryItemId ?? null,
        status: { in: ['unread', 'read'] },
      },
    });
    if (existing) return existing;
  }
  return db.alert.create({
    data: {
      alertType: data.alertType,
      message: data.message,
      invoiceId: data.invoiceId ?? null,
      inventoryItemId: data.inventoryItemId ?? null,
      channel: 'in-app',
      status: 'unread',
      sentAt: new Date(),
    },
  });
}

/** Marks open alerts of the given types as resolved (e.g. stock replenished, invoice paid). */
export async function resolveAlerts(where: { alertTypes: AlertType[]; invoiceId?: number; inventoryItemId?: number }, db: Db = prisma) {
  await db.alert.updateMany({
    where: {
      alertType: { in: where.alertTypes },
      ...(where.invoiceId !== undefined ? { invoiceId: where.invoiceId } : {}),
      ...(where.inventoryItemId !== undefined ? { inventoryItemId: where.inventoryItemId } : {}),
      status: { in: ['unread', 'read'] },
    },
    data: { status: 'resolved' },
  });
}
