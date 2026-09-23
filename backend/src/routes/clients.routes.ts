import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zBool, zOptStr } from '../lib/http';
import { badRequest, conflict, notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { audit, actorFrom } from '../services/audit.service';
import { normalizePhone } from '../services/sms.service';

const router = Router();

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required.'),
  companyName: zOptStr,
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional().transform((v) => (v ? v : null)),
  phone: zOptStr,
  billingAddress: zOptStr,
  shippingAddress: zOptStr,
  taxIdentifier: zOptStr,
  notes: zOptStr,
  segment: zOptStr,
  smsOptOut: zBool.optional(),
  emailOptOut: zBool.optional(),
});

async function findDuplicate(email?: string | null, phone?: string | null, excludeId?: number) {
  const normalizedPhone = normalizePhone(phone || undefined) || phone || undefined;
  const or: any[] = [];
  if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
  if (normalizedPhone) or.push({ phone: normalizedPhone });
  if (or.length === 0) return null;
  return prisma.client.findFirst({ where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

router.get(
  '/duplicates',
  requirePermission('client.read'),
  ah(async (req, res) => {
    const { email, phone } = req.query as { email?: string; phone?: string };
    res.json(await findDuplicate(email, phone));
  }),
);

router.get(
  '/',
  requirePermission('client.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req, ['name', 'createdAt']);
    const { search, tag, active } = req.query as { search?: string; tag?: string; active?: string };
    const where: any = {};
    if (search || lq.search) {
      const s = search || lq.search;
      where.OR = [{ name: { contains: s, mode: 'insensitive' } }, { companyName: { contains: s, mode: 'insensitive' } }, { email: { contains: s, mode: 'insensitive' } }, { phone: { contains: s } }];
    }
    if (tag) where.segment = tag;
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;

    const [rows, total] = await Promise.all([
      prisma.client.findMany({ where, orderBy: lq.sort ? { [lq.sort.field]: lq.sort.direction } : { createdAt: 'desc' }, skip: lq.skip, take: lq.take }),
      prisma.client.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);

router.post(
  '/',
  requirePermission('client.write'),
  ah(async (req, res) => {
    const data = parseBody(clientSchema, req);
    const created = await prisma.client.create({ data: { ...data, createdById: req.user!.id } });
    await audit({ action: 'client.create', entityType: 'client', entityId: created.id, summary: `Created ${created.name}`, after: created, ...actorFrom(req) });
    res.status(201).json(created);
  }),
);

router.get(
  '/export',
  requirePermission('client.read'),
  ah(async (req, res) => {
    const { sendCsv } = await import('../lib/csv');
    const rows = await prisma.client.findMany({ orderBy: { name: 'asc' } });
    sendCsv(res, 'clients.csv', rows, [
      ['Name', (r) => r.name], ['Company', (r) => r.companyName], ['Email', (r) => r.email], ['Phone', (r) => r.phone],
      ['Billing address', (r) => r.billingAddress], ['Tax ID', (r) => r.taxIdentifier], ['Segment', (r) => r.segment], ['Active', (r) => r.isActive],
    ]);
  }),
);

router.get(
  '/:id',
  requirePermission('client.read'),
  ah(async (req, res) => {
    const id = idParam(req);
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw notFound('Client');
    res.json(client);
  }),
);

router.get(
  '/:id/summary',
  requirePermission('client.read'),
  ah(async (req, res) => {
    const id = idParam(req);
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw notFound('Client');
    const [invoiceAgg, outstandingAgg, paymentAgg, lastPayment] = await Promise.all([
      prisma.invoice.aggregate({ where: { clientId: id, issuedAt: { not: null } }, _sum: { totalAmount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { clientId: id, cancelledAt: null }, _sum: { balanceDue: true } }),
      prisma.payment.aggregate({ where: { clientId: id, status: { in: ['completed', 'reconciled'] } }, _sum: { amount: true } }),
      prisma.payment.findFirst({ where: { clientId: id }, orderBy: { paymentDate: 'desc' } }),
    ]);
    res.json({
      totalInvoiced: invoiceAgg._sum.totalAmount ?? 0,
      invoiceCount: invoiceAgg._count,
      outstandingBalance: outstandingAgg._sum.balanceDue ?? 0,
      totalPaid: paymentAgg._sum.amount ?? 0,
      lastPaymentDate: lastPayment?.paymentDate ?? null,
    });
  }),
);

router.get(
  '/:id/invoices',
  requirePermission('client.read'),
  ah(async (req, res) => res.json(await prisma.invoice.findMany({ where: { clientId: idParam(req) }, orderBy: { issueDate: 'desc' } }))),
);
router.get(
  '/:id/payments',
  requirePermission('client.read'),
  ah(async (req, res) => res.json(await prisma.payment.findMany({ where: { clientId: idParam(req) }, orderBy: { paymentDate: 'desc' } }))),
);
router.get(
  '/:id/communications',
  requirePermission('client.read'),
  ah(async (req, res) => res.json(await prisma.notificationLog.findMany({ where: { clientId: idParam(req) }, orderBy: { createdAt: 'desc' }, take: 100 }))),
);

router.patch(
  '/:id',
  requirePermission('client.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const current = await prisma.client.findUnique({ where: { id } });
    if (!current) throw notFound('Client');
    const data = parseBody(clientSchema.partial(), req);
    const updated = await prisma.client.update({ where: { id }, data });
    await audit({ action: 'client.update', entityType: 'client', entityId: id, before: current, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);

router.post(
  '/:id/archive',
  requirePermission('client.archive'),
  ah(async (req, res) => {
    const id = idParam(req);
    const outstanding = await prisma.invoice.count({ where: { clientId: id, cancelledAt: null, status: { notIn: ['paid'] }, issuedAt: { not: null } } });
    if (outstanding > 0 && req.query.force !== 'true') {
      throw conflict('CLIENT_HAS_OPEN_INVOICES', `This client has ${outstanding} open invoice(s). Pass ?force=true to archive anyway.`);
    }
    const updated = await prisma.client.update({ where: { id }, data: { isActive: false } });
    await audit({ action: 'client.archive', entityType: 'client', entityId: id, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);
router.post(
  '/:id/restore',
  requirePermission('client.archive'),
  ah(async (req, res) => {
    const id = idParam(req);
    const updated = await prisma.client.update({ where: { id }, data: { isActive: true } });
    await audit({ action: 'client.restore', entityType: 'client', entityId: id, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);

// Kept for compatibility with the existing client list/detail delete button: archives rather
// than hard-deleting, so invoice/payment history referencing this client is preserved.
router.delete(
  '/:id',
  requirePermission('client.archive'),
  ah(async (req, res) => {
    const id = idParam(req);
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    await audit({ action: 'client.archive', entityType: 'client', entityId: id, summary: 'Archived via delete', ...actorFrom(req) });
    res.status(204).send();
  }),
);

const contactSchema = z.object({ name: z.string().trim().min(1), email: zOptStr, phone: zOptStr, designation: zOptStr, isPrimary: zBool.optional() });

router.get(
  '/:id/contacts',
  requirePermission('client.read'),
  ah(async (req, res) => res.json(await prisma.clientContact.findMany({ where: { clientId: idParam(req) }, orderBy: { isPrimary: 'desc' } }))),
);
router.post(
  '/:id/contacts',
  requirePermission('client.write'),
  ah(async (req, res) => {
    const clientId = idParam(req);
    if (!(await prisma.client.findUnique({ where: { id: clientId } }))) throw notFound('Client');
    const data = parseBody(contactSchema, req);
    if (data.isPrimary) await prisma.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    const created = await prisma.clientContact.create({ data: { ...data, clientId } });
    res.status(201).json(created);
  }),
);
router.patch(
  '/:id/contacts/:contactId',
  requirePermission('client.write'),
  ah(async (req, res) => {
    const clientId = idParam(req);
    const contactId = idParam(req, 'contactId');
    const data = parseBody(contactSchema.partial(), req);
    if (data.isPrimary) await prisma.clientContact.updateMany({ where: { clientId, id: { not: contactId } }, data: { isPrimary: false } });
    res.json(await prisma.clientContact.update({ where: { id: contactId }, data }));
  }),
);
router.delete(
  '/:id/contacts/:contactId',
  requirePermission('client.write'),
  ah(async (req, res) => {
    await prisma.clientContact.delete({ where: { id: idParam(req, 'contactId') } });
    res.status(204).send();
  }),
);

const importRowSchema = clientSchema.extend({ name: z.string().trim().min(1) });
router.post(
  '/import',
  requirePermission('client.import'),
  ah(async (req, res) => {
    const rows = z.array(z.record(z.string(), z.any())).parse(req.body?.rows ?? []);
    if (rows.length === 0) throw badRequest('No rows to import.');
    const onDuplicate = req.body?.onDuplicate === 'update' ? 'update' : 'skip';
    const summary = { created: 0, updated: 0, skipped: 0, errors: [] as { row: number; error: string }[] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const data = importRowSchema.parse(rows[i]);
        const dup = await findDuplicate(data.email, data.phone);
        if (dup) {
          if (onDuplicate === 'update') {
            await prisma.client.update({ where: { id: dup.id }, data });
            summary.updated += 1;
          } else summary.skipped += 1;
          continue;
        }
        await prisma.client.create({ data: { ...data, createdById: req.user!.id } });
        summary.created += 1;
      } catch (err: any) {
        summary.errors.push({ row: i + 1, error: err?.message || 'Invalid row' });
      }
    }
    await audit({ action: 'client.import', entityType: 'client', summary: `Imported ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`, after: summary, ...actorFrom(req) });
    res.json(summary);
  }),
);

export default router;
