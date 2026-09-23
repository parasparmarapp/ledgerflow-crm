import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zDate, zId, zNum, zOptStr } from '../lib/http';
import { notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { actorFrom } from '../services/audit.service';
import { paymentService, PAYMENT_METHODS } from '../services/payment.service';
import { streamReceiptPdf } from '../services/pdf.service';

const router = Router();

const paymentSchema = z.object({
  invoiceId: zId,
  amount: zNum,
  paymentDate: zDate.optional(),
  method: z.string().trim().default('cash'),
  reference: zOptStr,
  notes: zOptStr,
  // Accepted for backward compatibility with the web client; the server derives payment status.
  clientId: zNum.optional(),
  status: zOptStr,
});

router.get(
  '/',
  requirePermission('payment.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req, ['paymentDate', 'amount', 'createdAt']);
    const { invoiceId, clientId, method, status, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (invoiceId) where.invoiceId = Number(invoiceId);
    if (clientId) where.clientId = Number(clientId);
    if (method) where.method = method;
    if (status) where.status = status;
    if (lq.from || lq.to) where.paymentDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const s = search || lq.search;
    if (s) {
      where.OR = [
        { client: { name: { contains: s, mode: 'insensitive' } } },
        { client: { companyName: { contains: s, mode: 'insensitive' } } },
        { invoice: { invoiceNumber: { contains: s, mode: 'insensitive' } } },
        { reference: { contains: s, mode: 'insensitive' } },
        { receiptNumber: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { method: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: lq.sort ? { [lq.sort.field]: lq.sort.direction } : { paymentDate: 'desc' },
        skip: lq.skip,
        take: lq.take,
        include: {
          client: { select: { id: true, name: true, companyName: true, email: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);

router.post(
  '/',
  requirePermission('payment.record'),
  ah(async (req, res) => {
    const body = parseBody(paymentSchema, req);
    const created = await paymentService.record({ invoiceId: body.invoiceId, amount: body.amount, paymentDate: body.paymentDate, method: body.method, reference: body.reference, notes: body.notes }, actorFrom(req));
    res.status(201).json(created);
  }),
);

router.get(
  '/:id',
  requirePermission('payment.read'),
  ah(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: idParam(req) } });
    if (!payment) throw notFound('Payment');
    res.json(payment);
  }),
);

router.post(
  '/:id/void',
  requirePermission('payment.void'),
  ah(async (req, res) => {
    const schema = z.object({ reason: z.string().trim().min(1, 'A reason is required to void a payment.') });
    const body = parseBody(schema, req);
    res.json(await paymentService.void(idParam(req), body.reason, actorFrom(req)));
  }),
);

// Kept for compatibility with the existing "delete payment" button: voids rather than
// hard-deleting, since a recorded payment is part of the financial record.
router.delete(
  '/:id',
  requirePermission('payment.void'),
  ah(async (req, res) => {
    await paymentService.void(idParam(req), 'Deleted via UI', actorFrom(req));
    res.status(204).send();
  }),
);

router.post(
  '/reconcile',
  requirePermission('payment.reconcile'),
  ah(async (req, res) => {
    const schema = z.object({ paymentIds: z.array(zId) });
    const body = parseBody(schema, req);
    res.json(await paymentService.reconcile(body.paymentIds, actorFrom(req)));
  }),
);

router.get(
  '/:id/receipt.pdf',
  requirePermission('payment.read'),
  ah(async (req, res) => streamReceiptPdf(res, idParam(req))),
);

export { PAYMENT_METHODS };
export default router;
