import prisma from '../lib/prisma';
import { dec, max0 } from '../lib/money';
import emailService from './email.service';
import smsService from './sms.service';
import { getSettings } from './settings.service';
import { renderTemplate, formatGhs, formatDateShort, ensureDefaultTemplates } from './template.service';
import { raiseAlert } from './alert.service';
import { events } from './events';
import { invoiceLabel } from './invoice.service';

export const MAX_ATTEMPTS = 3;

function publicLink(token: string): string {
  const base = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/i/${token}`;
}

interface DispatchArgs {
  channel: 'email' | 'sms';
  event: string;
  recipient: string | null;
  subject?: string;
  body: string;
  clientId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  reminderId?: number | null;
  sentById?: number | null;
}

/** Sends (or simulates) one message and always records a NotificationLog row. */
async function dispatch(args: DispatchArgs) {
  const base = {
    channel: args.channel,
    event: args.event,
    recipient: args.recipient ?? '',
    subject: args.subject ?? null,
    body: args.body,
    clientId: args.clientId ?? null,
    invoiceId: args.invoiceId ?? null,
    paymentId: args.paymentId ?? null,
    reminderId: args.reminderId ?? null,
    sentById: args.sentById ?? null,
  };

  if (!args.recipient) {
    return prisma.notificationLog.create({ data: { ...base, status: 'skipped', error: `No ${args.channel === 'email' ? 'email address' : 'phone number'} on file.`, attempts: 1 } });
  }

  if (args.channel === 'email') {
    const settings = await getSettings();
    const result = await emailService.sendEmail({ to: args.recipient, subject: args.subject || '(no subject)', html: args.body, fromName: settings.companyName, replyTo: settings.email || undefined });
    return prisma.notificationLog.create({
      data: { ...base, status: result.simulated ? 'simulated' : result.success ? 'sent' : 'failed', providerMessageId: result.messageId, error: result.error ?? null, attempts: 1, deliveredAt: result.success ? new Date() : null },
    });
  }

  const result = await smsService.sendRaw(args.recipient, args.body);
  const log = await prisma.notificationLog.create({
    data: {
      ...base,
      recipient: result.recipient || base.recipient,
      status: result.status,
      providerMessageId: result.messageId,
      error: result.error ?? null,
      attempts: 1,
      nextAttemptAt: result.status === 'failed' ? new Date(Date.now() + 5 * 60_000) : null,
      deliveredAt: result.success && result.status === 'sent' ? new Date() : null,
    },
  });
  if (result.status === 'failed') await raiseAlert({ alertType: 'notification_failed', invoiceId: args.invoiceId ?? null, message: `SMS to ${result.recipient} failed: ${result.error}`, dedupe: false });
  return log;
}

async function resolveTemplate(key: string, channel: 'email' | 'sms', overrideBody?: string | null) {
  const template = await prisma.messageTemplate.findFirst({ where: { key, channel, isActive: true }, orderBy: [{ isDefault: 'desc' }, { id: 'desc' }] });
  return { subject: template?.subject ?? undefined, body: overrideBody ?? template?.body ?? '' };
}

function clientContext(client: { name: string; email?: string | null; phone?: string | null }) {
  return { name: client.name, firstName: client.name.trim().split(/\s+/)[0] || 'Customer', email: client.email ?? '', phone: client.phone ?? '' };
}

export const notificationService = {
  ensureDefaultTemplates,

  /** Renders and sends a manual/test message through a template key, for the notification-settings test button. */
  async sendTest(channel: 'email' | 'sms', to: string) {
    const settings = await getSettings();
    const body = channel === 'email' ? `<p>This is a test notification from ${settings.companyName}.</p>` : `${settings.companyName}: test SMS at ${new Date().toISOString()}`;
    return dispatch({ channel, event: 'test', recipient: to, subject: `${settings.companyName} — Test notification`, body });
  },

  /** invoice.issued event handler: emails/SMS the client the invoice, respecting settings and opt-outs. */
  async notifyInvoiceIssued(invoiceId: number, channels: ('email' | 'sms')[] | undefined, sentById: number | null) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true, lineItems: true } });
    if (!invoice || !invoice.client) return;
    const settings = await getSettings();
    const wantEmail = (channels?.includes('email') ?? settings.notifyInvoiceSentEmail) && !invoice.client.emailOptOut;
    const wantSms = (channels?.includes('sms') ?? settings.notifyInvoiceSentSms) && !invoice.client.smsOptOut;
    const ctx = {
      client: clientContext(invoice.client),
      company: { name: settings.companyName },
      invoice: {
        number: invoiceLabel(invoice),
        total: formatGhs(invoice.totalAmount),
        balance: formatGhs(max0(dec(invoice.totalAmount).minus(invoice.amountPaid))),
        dueDate: formatDateShort(invoice.dueDate),
        link: publicLink(invoice.publicToken),
      },
    };

    if (wantEmail && invoice.client.email) {
      const t = await resolveTemplate('invoice_sent', 'email');
      await dispatch({ channel: 'email', event: 'invoice_sent', recipient: invoice.client.email, subject: renderTemplate(t.subject || '', ctx), body: renderTemplate(t.body, ctx, true), clientId: invoice.clientId, invoiceId: invoice.id, sentById });
    }
    if (wantSms && invoice.client.phone) {
      const t = await resolveTemplate('invoice_sent', 'sms');
      await dispatch({ channel: 'sms', event: 'invoice_sent', recipient: invoice.client.phone, body: renderTemplate(t.body, ctx), clientId: invoice.clientId, invoiceId: invoice.id, sentById });
    }
    await raiseAlert({ alertType: 'invoice_sent', invoiceId: invoice.id, message: `${invoiceLabel(invoice)} sent to ${invoice.client.name}.` });
  },

  /** payment.recorded event handler: sends a receipt with the remaining balance. */
  async notifyPaymentReceived(paymentId: number, sentById: number | null) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { client: true, invoice: true } });
    if (!payment || !payment.client || !payment.invoice) return;
    const settings = await getSettings();
    const balance = max0(dec(payment.invoice.totalAmount).minus(payment.invoice.amountPaid));
    const ctx = {
      client: clientContext(payment.client),
      company: { name: settings.companyName },
      invoice: { number: invoiceLabel(payment.invoice), link: publicLink(payment.invoice.publicToken) },
      payment: { amount: formatGhs(payment.amount), balanceLine: balance.greaterThan(0) ? `Outstanding balance: ${formatGhs(balance)}.` : 'This invoice is now fully paid.' },
    };

    if (settings.notifyPaymentEmail && !payment.client.emailOptOut && payment.client.email) {
      const t = await resolveTemplate('payment_received', 'email');
      await dispatch({ channel: 'email', event: 'payment_received', recipient: payment.client.email, subject: renderTemplate(t.subject || '', ctx), body: renderTemplate(t.body, ctx, true), clientId: payment.clientId, invoiceId: payment.invoiceId, paymentId: payment.id, sentById });
    }
    if (settings.notifyPaymentSms && !payment.client.smsOptOut && payment.client.phone) {
      const t = await resolveTemplate('payment_received', 'sms');
      await dispatch({ channel: 'sms', event: 'payment_received', recipient: payment.client.phone, body: renderTemplate(t.body, ctx), clientId: payment.clientId, invoiceId: payment.invoiceId, paymentId: payment.id, sentById });
    }
    await raiseAlert({ alertType: 'payment_received', invoiceId: payment.invoiceId, message: `Payment of ${formatGhs(payment.amount)} received from ${payment.client.name}.`, dedupe: false });
  },

  /** Sends one reminder (before_due / on_due / overdue) for an invoice through a rule, on the rule's channels. */
  async sendReminder(reminderId: number, invoiceId: number) {
    const [reminder, invoice] = await Promise.all([
      prisma.reminder.findUnique({ where: { id: reminderId }, include: { template: true } }),
      prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } }),
    ]);
    if (!reminder || !invoice?.client) return;
    const settings = await getSettings();
    const key = reminder.triggerType === 'before_due' ? 'reminder_before_due' : reminder.triggerType === 'on_due' ? 'reminder_on_due' : 'reminder_overdue';
    const ctx = {
      client: clientContext(invoice.client),
      company: { name: settings.companyName },
      invoice: { number: invoiceLabel(invoice), balance: formatGhs(max0(dec(invoice.totalAmount).minus(invoice.amountPaid))), dueDate: formatDateShort(invoice.dueDate), link: publicLink(invoice.publicToken) },
    };

    if (reminder.channel === 'email' && settings.notifyRemindersEmail && !invoice.client.emailOptOut && invoice.client.email) {
      const t = await resolveTemplate(key, 'email', reminder.message);
      await dispatch({ channel: 'email', event: key, recipient: invoice.client.email, subject: renderTemplate(t.subject || '', ctx), body: renderTemplate(t.body, ctx, true), clientId: invoice.clientId, invoiceId: invoice.id, reminderId: reminder.id });
    }
    if (reminder.channel === 'sms' && settings.notifyRemindersSms && !invoice.client.smsOptOut && invoice.client.phone) {
      const t = await resolveTemplate(key, 'sms', reminder.message);
      await dispatch({ channel: 'sms', event: key, recipient: invoice.client.phone, body: renderTemplate(t.body, ctx), clientId: invoice.clientId, invoiceId: invoice.id, reminderId: reminder.id });
    }
  },

  /** Retries queued/failed sends whose nextAttemptAt has passed, up to MAX_ATTEMPTS. */
  async retryFailed(limit = 50) {
    const due = await prisma.notificationLog.findMany({
      where: { status: 'failed', attempts: { lt: MAX_ATTEMPTS }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
      take: limit,
    });
    let retried = 0;
    for (const log of due) {
      const settings = log.channel === 'email' ? await getSettings() : null;
      const result = log.channel === 'email' ? await emailService.sendEmail({ to: log.recipient, subject: log.subject || '', html: log.body, fromName: settings!.companyName, replyTo: settings!.email || undefined }) : await smsService.sendRaw(log.recipient, log.body);
      const success = result.success && (result as any).status !== 'failed';
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: success ? ((result as any).simulated ? 'simulated' : 'sent') : 'failed',
          providerMessageId: result.messageId ?? log.providerMessageId,
          error: (result as any).error ?? null,
          attempts: { increment: 1 },
          nextAttemptAt: success ? null : new Date(Date.now() + Math.min(60, 5 * 2 ** log.attempts) * 60_000),
          deliveredAt: success ? new Date() : null,
        },
      });
      retried += 1;
    }
    return retried;
  },
};

events.onEvent('invoice.issued', async (e) => {
  if (e.notify) await notificationService.notifyInvoiceIssued(e.invoiceId, e.channels, e.userId);
});
events.onEvent('payment.recorded', async (e) => {
  if (e.notify) await notificationService.notifyPaymentReceived(e.paymentId, e.userId);
});

export default notificationService;
