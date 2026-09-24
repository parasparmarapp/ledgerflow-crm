import cron from 'node-cron';
import prisma from '../lib/prisma';
import { invoiceService } from '../services/invoice.service';
import { runReminderSweep } from '../services/reminder.service';
import { notificationService } from '../services/notification.service';
import { calculateInvoice } from '../services/invoice.calc';
import { audit, SYSTEM_ACTOR } from '../services/audit.service';
import { runWithCompany } from '../lib/company-context';

/**
 * Postgres advisory lock so only one process instance runs a given job at a time
 * (safe to run this scheduler on multiple app instances).
 */
async function withLock(key: number, fn: () => Promise<void>) {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${key}) AS locked`;
  if (!locked) return;
  try {
    await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${key})`;
  }
}

async function generateRecurringInvoices() {
  const due = await prisma.recurringInvoice.findMany({ where: { isActive: true, nextRunAt: { lte: new Date() } } });
  for (const schedule of due) {
    try {
      const calc = calculateInvoice([{ quantity: 1, unitPrice: schedule.amount }]);
      const invoice = await invoiceService.create(
        {
          clientId: schedule.clientId,
          lineItems: [{ description: `Recurring charge (${schedule.frequency})`, quantity: 1, unitPrice: calc.subtotal.toNumber() }],
          issue: true,
        },
        SYSTEM_ACTOR,
      );
      const next = new Date(schedule.nextRunAt);
      const step = schedule.frequency === 'weekly' ? 7 : schedule.frequency === 'quarterly' ? 90 : 30;
      next.setDate(next.getDate() + step);
      await prisma.recurringInvoice.update({ where: { id: schedule.id }, data: { nextRunAt: next } });
      await audit({ action: 'recurring.generate', entityType: 'invoice', entityId: invoice.id, summary: `Generated from recurring schedule #${schedule.id}`, ...SYSTEM_ACTOR });
    } catch (err: any) {
      console.error(`[scheduler] recurring invoice #${schedule.id} failed:`, err?.message || err);
    }
  }
}

async function forEachCompany(job: (companyId: number) => Promise<void>) {
  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
  for (const company of companies) {
    await runWithCompany(company.id, () => job(company.id));
  }
}

let started = false;

/** Registers all cron jobs. Call once at boot; a no-op outside NODE_ENV=production/development. */
export function startScheduler() {
  if (started || process.env.LEGERCRM_NODE_ENV === 'test') return;
  started = true;

  // Mark overdue invoices daily just after midnight.
  cron.schedule('15 0 * * *', () => withLock(9001, async () => {
    await forEachCompany(async (companyId) => {
      const n = await invoiceService.refreshOverdue();
      if (n) console.log(`[scheduler] markOverdue: checked ${n} invoice(s) for company ${companyId}`);
    });
  }));

  // Send due/overdue reminders every morning.
  cron.schedule('0 9 * * *', () => withLock(9002, async () => {
    await forEachCompany(async (companyId) => {
      const { evaluated, sent } = await runReminderSweep();
      if (evaluated) console.log(`[scheduler] reminders: ${sent}/${evaluated} sent for company ${companyId}`);
    });
  }));

  // Generate recurring invoices hourly.
  cron.schedule('5 * * * *', () => withLock(9003, async () => forEachCompany(() => generateRecurringInvoices())));

  // Retry failed notification sends every 5 minutes.
  cron.schedule('*/5 * * * *', () => withLock(9004, async () => {
    await forEachCompany(async (companyId) => {
      const n = await notificationService.retryFailed();
      if (n) console.log(`[scheduler] retried ${n} notification(s) for company ${companyId}`);
    });
  }));

  console.log('[scheduler] cron jobs registered (overdue, reminders, recurring invoices, notification retry)');
}
