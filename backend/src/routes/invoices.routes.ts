import { Router } from 'express';
import { z } from 'zod';
import prisma, { prismaRoot } from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zDate, zNum, zOptStr } from '../lib/http';
import { badRequest, notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { actorFrom } from '../services/audit.service';
import { invoiceService, presentInvoice } from '../services/invoice.service';
import { streamInvoicePdf } from '../services/pdf.service';
import { runWithCompany } from '../lib/company-context';

const router = Router();
const publicRouter = Router();

const lineItemSchema = z.object({
  productServiceId: zNum.optional(),
  description: z.string().trim().default(''),
  quantity: zNum,
  unitPrice: zNum,
  discountAmount: zNum.optional(),
  taxRate: zNum.optional(),
  // Accepted but ignored: the server always recomputes the line total.
  lineTotal: zNum.optional(),
});

/**
 * Accepts the legacy payload shape the web client already sends (status, subtotal, taxAmount,
 * totalAmount as client-computed hints) and maps it onto the validated invoice service input.
 * Totals are always recomputed server-side; only `status` and `discountAmount` are meaningful.
 */
const invoiceBodySchema = z.object({
  clientId: zNum,
  issueDate: zDate.optional(),
  dueDate: zDate.optional(),
  status: z.string().optional(),
  discountAmount: zNum.optional(),
  notes: zOptStr,
  terms: zOptStr,
  lineItems: z.array(lineItemSchema).optional(),
  markPaid: z.object({ method: z.string().default('cash'), reference: zOptStr }).optional(),
  channels: z.array(z.enum(['email', 'sms'])).optional(),
  notify: z.boolean().optional(),
});

function toLines(items?: z.infer<typeof lineItemSchema>[]) {
  return items?.map((l) => ({ productServiceId: l.productServiceId ?? null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount, taxRate: l.taxRate }));
}

router.get(
  '/',
  requirePermission('invoice.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req, ['issueDate', 'dueDate', 'totalAmount', 'createdAt']);
    const { status, clientId, overdue, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = Number(clientId);
    if (overdue === 'true') where.status = 'overdue';
    if (lq.from || lq.to) where.issueDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const s = search || lq.search;
    if (s) where.OR = [{ invoiceNumber: { contains: s, mode: 'insensitive' } }, { client: { name: { contains: s, mode: 'insensitive' } } }, { client: { companyName: { contains: s, mode: 'insensitive' } } }];

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: lq.sort ? { [lq.sort.field]: lq.sort.direction } : { issueDate: 'desc' }, skip: lq.skip, take: lq.take, include: { client: { select: { id: true, name: true } } } }),
      prisma.invoice.count({ where }),
    ]);
    sendList(res, rows.map(presentInvoice), total, lq);
  }),
);

router.post(
  '/',
  requirePermission('invoice.write'),
  ah(async (req, res) => {
    const body = parseBody(invoiceBodySchema, req);
    if (!body.lineItems || body.lineItems.length === 0) throw badRequest('An invoice needs at least one line item.');
    const status = (body.status || 'draft').toLowerCase();
    const created = await invoiceService.create(
      { clientId: body.clientId, issueDate: body.issueDate, dueDate: body.dueDate, notes: body.notes, terms: body.terms, discountAmount: body.discountAmount, lineItems: toLines(body.lineItems)!, issue: status !== 'draft', markPaid: status === 'paid' ? body.markPaid ?? { method: 'cash' } : undefined },
      actorFrom(req),
      { channels: body.channels, notify: body.notify },
    );
    res.status(201).json(created);
  }),
);

router.get(
  '/:id',
  requirePermission('invoice.read'),
  ah(async (req, res) => res.json(await invoiceService.get(idParam(req)))),
);

router.patch(
  '/:id',
  requirePermission('invoice.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const body = parseBody(invoiceBodySchema.partial(), req);
    const status = body.status?.toLowerCase();
    const updated = await invoiceService.update(
      id,
      { clientId: body.clientId, issueDate: body.issueDate, dueDate: body.dueDate, notes: body.notes, terms: body.terms, discountAmount: body.discountAmount, lineItems: toLines(body.lineItems) },
      actorFrom(req),
      { issue: status && status !== 'draft' ? true : undefined },
    );
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  requirePermission('invoice.delete'),
  ah(async (req, res) => {
    await invoiceService.deleteDraft(idParam(req), actorFrom(req));
    res.status(204).send();
  }),
);

router.post(
  '/:id/send',
  requirePermission('invoice.send'),
  ah(async (req, res) => {
    const schema = z.object({ channels: z.array(z.enum(['email', 'sms'])).optional() });
    const body = parseBody(schema, req);
    const { invoice } = await invoiceService.issueOrSend(idParam(req), actorFrom(req), { channels: body.channels });
    res.json(invoice);
  }),
);

router.post(
  '/:id/duplicate',
  requirePermission('invoice.write'),
  ah(async (req, res) => res.status(201).json(await invoiceService.duplicate(idParam(req), actorFrom(req)))),
);

router.post(
  '/:id/void',
  requirePermission('invoice.void'),
  ah(async (req, res) => {
    const schema = z.object({ reason: z.string().trim().min(1, 'A reason is required to void an invoice.') });
    const body = parseBody(schema, req);
    res.json(await invoiceService.void(idParam(req), body.reason, actorFrom(req)));
  }),
);

router.post(
  '/:id/revise',
  requirePermission('invoice.revise'),
  ah(async (req, res) => {
    const schema = z.object({ reason: z.string().trim().min(1, 'A reason is required to revise an invoice.') });
    const body = parseBody(schema, req);
    res.json(await invoiceService.revise(idParam(req), body.reason, actorFrom(req)));
  }),
);

router.get(
  '/:id/pdf',
  requirePermission('invoice.read'),
  ah(async (req, res) => streamInvoicePdf(res, idParam(req))),
);

router.get(
  '/:id/timeline',
  requirePermission('invoice.read'),
  ah(async (req, res) => {
    const id = idParam(req);
    const [payments, notifications, audit, revisions] = await Promise.all([
      prisma.payment.findMany({ where: { invoiceId: id }, orderBy: { paymentDate: 'desc' } }),
      prisma.notificationLog.findMany({ where: { invoiceId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.findMany({ where: { entityType: 'invoice', entityId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.invoiceRevision.findMany({ where: { invoiceId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ payments, notifications, audit, revisions });
  }),
);

// ---------------------------------------------------------------------------
// Public (unauthenticated) invoice view
// ---------------------------------------------------------------------------

publicRouter.get(
  '/:token',
  ah(async (req, res) => {
    const found = await prismaRoot.invoice.findUnique({ where: { publicToken: req.params.token }, select: { companyId: true } });
    if (!found) throw notFound('Invoice');
    const invoice = await runWithCompany(found.companyId, () => invoiceService.markViewedByToken(req.params.token));
    res.json(presentInvoice(invoice));
  }),
);
publicRouter.get(
  '/:token/pdf',
  ah(async (req, res) => {
    const invoice = await prismaRoot.invoice.findUnique({ where: { publicToken: req.params.token } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    await runWithCompany(invoice.companyId, () => streamInvoicePdf(res, invoice.id));
  }),
);

export default router;
export { publicRouter as publicInvoiceRouter };
