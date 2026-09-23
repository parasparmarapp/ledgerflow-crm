import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zBool, zNum, zOptStr } from '../lib/http';
import { badRequest, conflict, notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { invalidateUserCache } from '../auth/permissions';
import { hashPassword } from '../auth/password';
import { audit, actorFrom } from '../services/audit.service';
import { getSettings, updateSettings } from '../services/settings.service';

export const settingsRouter = Router();
export const usersRouter = Router();
export const auditRouter = Router();
export const taxRatesRouter = Router();

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  companyName: z.string().trim().min(1).optional(),
  logoUrl: zOptStr,
  email: zOptStr,
  phone: zOptStr,
  address: zOptStr,
  taxId: zOptStr,
  currency: z.string().trim().optional(),
  invoicePrefix: z.string().trim().optional(),
  receiptPrefix: z.string().trim().optional(),
  quotationPrefix: z.string().trim().optional(),
  defaultPaymentTermsDays: zNum.optional(),
  defaultNotes: zOptStr,
  defaultTerms: zOptStr,
  allowNegativeStock: zBool.optional(),
  notifyInvoiceSentEmail: zBool.optional(),
  notifyInvoiceSentSms: zBool.optional(),
  notifyPaymentEmail: zBool.optional(),
  notifyPaymentSms: zBool.optional(),
  notifyRemindersEmail: zBool.optional(),
  notifyRemindersSms: zBool.optional(),
});

settingsRouter.get('/', requirePermission('settings.manage'), ah(async (_req, res) => res.json(await getSettings())));
settingsRouter.put(
  '/',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const data = parseBody(settingsSchema, req);
    const updated = await updateSettings(data);
    await audit({ action: 'settings.update', entityType: 'companySettings', entityId: 1, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);

// ---------------------------------------------------------------------------
// Tax rates
// ---------------------------------------------------------------------------

const taxRateSchema = z.object({ name: z.string().trim().min(1), rate: zNum, components: z.any().optional(), isDefault: zBool.optional(), isActive: zBool.optional() });

taxRatesRouter.get('/', requirePermission('settings.manage'), ah(async (_req, res) => res.json(await prisma.taxRate.findMany({ orderBy: { name: 'asc' } }))));
taxRatesRouter.post(
  '/',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const data = parseBody(taxRateSchema, req);
    if (data.isDefault) await prisma.taxRate.updateMany({ where: {}, data: { isDefault: false } });
    res.status(201).json(await prisma.taxRate.create({ data }));
  }),
);
taxRatesRouter.patch(
  '/:id',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const data = parseBody(taxRateSchema.partial(), req);
    if (data.isDefault) await prisma.taxRate.updateMany({ where: { id: { not: idParam(req) } }, data: { isDefault: false } });
    res.json(await prisma.taxRate.update({ where: { id: idParam(req) }, data }));
  }),
);
taxRatesRouter.delete(
  '/:id',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    await prisma.taxRate.delete({ where: { id: idParam(req) } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const createUserSchema = z.object({ email: z.string().email(), name: z.string().trim().min(1), password: z.string().min(8, 'Password must be at least 8 characters.'), role: z.enum(['admin', 'staff']).default('staff') });
const updateUserSchema = z.object({ email: z.string().email().optional(), name: z.string().trim().min(1).optional(), role: z.enum(['admin', 'staff']).optional(), isActive: zBool.optional() });

usersRouter.get(
  '/',
  requirePermission('users.manage'),
  ah(async (_req, res) => res.json((await prisma.user.findMany({ orderBy: { name: 'asc' } })).map(({ passwordHash, ...u }) => u))),
);
usersRouter.post(
  '/',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const data = parseBody(createUserSchema, req);
    const created = await prisma.user.create({ data: { email: data.email.toLowerCase(), name: data.name, role: data.role, passwordHash: hashPassword(data.password) } });
    await audit({ action: 'user.create', entityType: 'user', entityId: created.id, summary: `Created ${created.email} (${created.role})`, ...actorFrom(req) });
    const { passwordHash, ...rest } = created;
    res.status(201).json(rest);
  }),
);
usersRouter.patch(
  '/:id',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const id = idParam(req);
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw notFound('User');
    const data = parseBody(updateUserSchema, req);
    if (data.email) {
      data.email = data.email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: { email: data.email, id: { not: id } },
      });
      if (existing) {
        throw conflict('EMAIL_TAKEN', 'A user with this email address already exists.');
      }
    }
    if (data.isActive === false && current.role === 'admin') {
      const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true, id: { not: id } } });
      if (activeAdmins === 0) throw conflict('LAST_ADMIN', 'At least one active admin is required.');
    }
    const updated = await prisma.user.update({ where: { id }, data });
    invalidateUserCache(id);
    await audit({ action: 'user.update', entityType: 'user', entityId: id, before: { ...current, passwordHash: undefined }, after: { ...updated, passwordHash: undefined }, ...actorFrom(req) });
    const { passwordHash, ...rest } = updated;
    res.json(rest);
  }),
);
usersRouter.post(
  '/:id/deactivate',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const id = idParam(req);
    if (id === req.user!.id) throw badRequest('You cannot deactivate your own account.');
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw notFound('User');
    if (current.role === 'admin') {
      const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true, id: { not: id } } });
      if (activeAdmins === 0) throw conflict('LAST_ADMIN', 'At least one active admin is required.');
    }
    const updated = await prisma.user.update({ where: { id }, data: { isActive: false } });
    invalidateUserCache(id);
    await audit({ action: 'user.deactivate', entityType: 'user', entityId: id, ...actorFrom(req) });
    res.json({ ...updated, passwordHash: undefined });
  }),
);
usersRouter.post(
  '/:id/reset-password',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const schema = z.object({ password: z.string().min(8) });
    const { password } = parseBody(schema, req);
    const id = idParam(req);
    await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    invalidateUserCache(id);
    await audit({ action: 'user.reset_password', entityType: 'user', entityId: id, ...actorFrom(req) });
    res.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

auditRouter.get(
  '/',
  requirePermission('audit.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const { entityType, entityId, userId, action } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = Number(entityId);
    if (userId) where.userId = Number(userId);
    if (action) where.action = action;
    if (lq.from || lq.to) where.createdAt = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: lq.skip, take: lq.take ?? 100 }),
      prisma.auditLog.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);
