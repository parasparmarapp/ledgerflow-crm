import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zBool, zNum, zOptStr } from '../lib/http';
import { badRequest, notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { audit, actorFrom } from '../services/audit.service';
import emailService from '../services/email.service';
import smsService, { getSmsConfig } from '../services/sms.service';
import { notificationService } from '../services/notification.service';
import { prismaRoot } from '../lib/prisma';
import { runWithCompany } from '../lib/company-context';
import { currentCompanyId } from '../lib/company-context';
import { getSettings } from '../services/settings.service';
import { renderTemplate } from '../services/template.service';

export const alertsRouter = Router();
export const remindersRouter = Router();
export const templatesRouter = Router();
export const notificationsRouter = Router();

// ---------------------------------------------------------------------------
// Alerts (in-app)
// ---------------------------------------------------------------------------

alertsRouter.get(
  '/',
  requirePermission('communication.read'),
  ah(async (req, res) => {
    const { status } = req.query as { status?: string };
    res.json(await prisma.alert.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, take: 200 }));
  }),
);
alertsRouter.patch(
  '/mark-all-read',
  requirePermission('communication.read'),
  ah(async (req, res) => {
    await prisma.alert.updateMany({ where: { status: 'unread' }, data: { status: 'read' } });
    res.json({ success: true });
  }),
);
alertsRouter.patch(
  '/:id',
  requirePermission('communication.read'),
  ah(async (req, res) => {
    const schema = z.object({ status: z.enum(['unread', 'read', 'resolved']) });
    const data = parseBody(schema, req);
    const updated = await prisma.alert.update({ where: { id: idParam(req) }, data });
    res.json(updated);
  }),
);

// ---------------------------------------------------------------------------
// Reminder rules
// ---------------------------------------------------------------------------

const CHANNEL_MAP: Record<string, string> = { email: 'email', sms: 'sms' };
const TRIGGER_MAP: Record<string, string> = {
  before_due: 'before_due', 'before due date': 'before_due', before: 'before_due',
  on_due: 'on_due', 'on due date': 'on_due', on: 'on_due',
  overdue: 'overdue', 'after due date': 'overdue', after: 'overdue', after_due: 'overdue',
};
const normalize = (map: Record<string, string>, value: string, field: string) => {
  const key = value.trim().toLowerCase();
  const found = map[key];
  if (!found) throw badRequest(`Invalid ${field}: "${value}".`);
  return found;
};

const reminderSchema = z.object({
  invoiceId: zNum.optional(),
  name: zOptStr,
  channel: z.string(),
  triggerType: z.string(),
  daysOffset: zNum.optional(),
  repeatEveryDays: zNum.optional(),
  maxRepeats: zNum.optional(),
  isActive: zBool.optional(),
  message: zOptStr,
});

remindersRouter.get(
  '/',
  requirePermission('communication.manage'),
  ah(async (req, res) => res.json(await prisma.reminder.findMany({ orderBy: { id: 'desc' } }))),
);
remindersRouter.post(
  '/',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const body = parseBody(reminderSchema, req);
    const created = await prisma.reminder.create({
      data: {
        invoiceId: body.invoiceId ?? null, name: body.name, channel: normalize(CHANNEL_MAP, body.channel, 'channel'), triggerType: normalize(TRIGGER_MAP, body.triggerType, 'triggerType'),
        daysOffset: body.daysOffset ?? 3, repeatEveryDays: body.repeatEveryDays, maxRepeats: body.maxRepeats ?? 3, isActive: body.isActive ?? true, message: body.message,
      },
    });
    res.status(201).json(created);
  }),
);
remindersRouter.get(
  '/:id',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const item = await prisma.reminder.findUnique({ where: { id: idParam(req) } });
    if (!item) throw notFound('Reminder');
    res.json(item);
  }),
);
remindersRouter.patch(
  '/:id',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const body = parseBody(reminderSchema.partial(), req);
    const data: any = { ...body };
    if (body.channel) data.channel = normalize(CHANNEL_MAP, body.channel, 'channel');
    if (body.triggerType) data.triggerType = normalize(TRIGGER_MAP, body.triggerType, 'triggerType');
    res.json(await prisma.reminder.update({ where: { id: idParam(req) }, data }));
  }),
);
remindersRouter.delete(
  '/:id',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    await prisma.reminder.delete({ where: { id: idParam(req) } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

const templateSchema = z.object({ key: z.string().trim().min(1), channel: z.enum(['email', 'sms']), name: z.string().trim().min(1), subject: zOptStr, body: z.string().trim().min(1), isActive: zBool.optional() });

async function sampleTemplate(subject: string | null | undefined, body: string, channel: string) {
  const settings = await getSettings();
  const sample = {
    client: { name: 'Jane Doe', firstName: 'Jane' },
    company: { name: settings.companyName },
    invoice: { number: 'INV-2026-0001', total: 'GHS 1,000.00', balance: 'GHS 500.00', dueDate: '30 Oct 2026', link: 'https://example.com/i/sample' },
    payment: { amount: 'GHS 500.00', balanceLine: 'This invoice is now fully paid.' },
  };
  return { channel, subject: subject ? renderTemplate(subject, sample) : undefined, body: renderTemplate(body, sample, channel === 'email') };
}

templatesRouter.get(
  '/',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const { key, channel } = req.query as Record<string, string | undefined>;
    res.json(await prisma.messageTemplate.findMany({ where: { ...(key ? { key } : {}), ...(channel ? { channel } : {}) }, orderBy: [{ key: 'asc' }, { channel: 'asc' }] }));
  }),
);
templatesRouter.post(
  '/',
  requirePermission('communication.manage'),
  ah(async (req, res) => res.status(201).json(await prisma.messageTemplate.create({ data: parseBody(templateSchema, req) }))),
);
templatesRouter.patch(
  '/:id',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const id = idParam(req);
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) throw notFound('Template');
    const changes = parseBody(templateSchema.partial(), req);
    if (changes.isActive === false && existing.isDefault) throw badRequest('Choose another sending template before deactivating this one.');
    res.json(await prisma.messageTemplate.update({ where: { id }, data: changes }));
  }),
);
templatesRouter.post(
  '/:id/default',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const template = await prisma.messageTemplate.findUnique({ where: { id: idParam(req) } });
    if (!template) throw notFound('Template');
    if (!template.isActive) throw badRequest('Activate this template before making it the default.');
    const companyId = currentCompanyId();
    if (!companyId) throw badRequest('Company context is required.');
    await prisma.$transaction(async (tx) => {
      await tx.messageTemplate.updateMany({ where: { companyId, key: template.key, channel: template.channel }, data: { isDefault: false } });
      await tx.messageTemplate.update({ where: { id: template.id }, data: { isDefault: true } });
    });
    res.json(await prisma.messageTemplate.findUnique({ where: { id: template.id } }));
  }),
);
templatesRouter.post(
  '/preview',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const draft = parseBody(templateSchema.pick({ channel: true, subject: true, body: true }), req);
    res.json(await sampleTemplate(draft.subject, draft.body, draft.channel));
  }),
);
templatesRouter.post(
  '/:id/preview',
  requirePermission('communication.manage'),
  ah(async (req, res) => {
    const template = await prisma.messageTemplate.findUnique({ where: { id: idParam(req) } });
    if (!template) throw notFound('Template');
    res.json(await sampleTemplate(template.subject, template.body, template.channel));
  }),
);

// ---------------------------------------------------------------------------
// Notification settings / status / test / log
// ---------------------------------------------------------------------------

notificationsRouter.get(
  '/smtp-status',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const configured = emailService.isSmtpConfigured();
    const connection = await emailService.verifyConnection();
    res.json({ configured, connected: connection.connected, message: connection.message, host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 587, fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || '' });
  }),
);
notificationsRouter.post(
  '/test-email',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const schema = z.object({ to: z.string().email().optional() });
    const body = parseBody(schema, req);
    const to = body.to || process.env.EMAIL_FROM_ADDRESS || 'test@ledgerflow.local';
    const result = await notificationService.sendTest('email', to);
    res.json({ success: result.status !== 'failed' && result.status !== 'skipped', message: `Test email dispatched to ${to}`, result });
  }),
);
notificationsRouter.get(
  '/sms-status',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const configured = smsService.isConfigured();
    let balance: any = null;
    let message = configured ? 'Arkesel API key configured.' : 'ARKESEL_API_KEY not configured (using simulated delivery).';
    if (configured) {
      try {
        balance = await smsService.getBalance();
        message = 'Arkesel API connection established successfully.';
      } catch (err: any) {
        message = err?.message || 'Failed to reach Arkesel API.';
      }
    }
    const cfg = getSmsConfig();
    res.json({ provider: 'arkesel', configured, connected: configured && balance !== null, message, enabled: cfg.enabled, sandbox: cfg.sandbox, senderId: cfg.senderId, balance });
  }),
);
notificationsRouter.post(
  '/test-sms',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const schema = z.object({ to: z.string().min(6) });
    const body = parseBody(schema, req);
    const result = await notificationService.sendTest('sms', body.to);
    res.status(result.status === 'failed' ? 422 : 200).json({ success: result.status !== 'failed' && result.status !== 'skipped', message: `Test SMS dispatched to ${body.to}`, result });
  }),
);
notificationsRouter.get(
  '/sms-logs',
  requirePermission('settings.manage'),
  ah(async (req, res) => res.json(await prisma.notificationLog.findMany({ where: { channel: 'sms' }, orderBy: { id: 'desc' }, take: 100 }))),
);
notificationsRouter.get(
  '/log',
  requirePermission('communication.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const { channel, status, clientId, invoiceId } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (clientId) where.clientId = Number(clientId);
    if (invoiceId) where.invoiceId = Number(invoiceId);
    const [rows, total] = await Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: lq.skip, take: lq.take ?? 100 }),
      prisma.notificationLog.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);

// Arkesel delivery-report webhook. Uses a shared secret query param rather than requireAuth
// (Arkesel cannot send a bearer token), so it is mounted unauthenticated in server.ts.
// Arkesel sends sms_id/status as query params and the HTTP method isn't documented, so accept both.
export const arkeselWebhookRouter = Router();
const handleArkeselDelivery = ah(async (req, res) => {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  const q = req.query as Record<string, string | undefined>;
  const b = req.body || {};
  const id = q.sms_id ?? q.id ?? b.sms_id ?? b.id;
  const status = q.status ?? b.status;
  if (id) {
    const log = await prismaRoot.notificationLog.findFirst({ where: { providerMessageId: String(id) }, select: { companyId: true } });
    if (log) await runWithCompany(log.companyId, () => prisma.notificationLog.updateMany({ where: { providerMessageId: String(id) }, data: { status: String(status || 'delivered').toLowerCase(), deliveredAt: new Date() } }));
  }
  res.json({ received: true });
});
arkeselWebhookRouter.get('/arkesel/delivery', handleArkeselDelivery);
arkeselWebhookRouter.post('/arkesel/delivery', handleArkeselDelivery);
