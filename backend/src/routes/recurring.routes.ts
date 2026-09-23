import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zBool, zDate, zNum, zOptStr } from '../lib/http';
import { badRequest, notFound } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { audit, actorFrom } from '../services/audit.service';

const router = Router();

const schema = z.object({
  clientId: zNum,
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'custom']),
  nextRunAt: zDate,
  amount: zNum,
  isActive: zBool.optional(),
  notes: zOptStr,
});

router.get(
  '/',
  requirePermission('recurring.manage'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const [rows, total] = await Promise.all([prisma.recurringInvoice.findMany({ orderBy: { nextRunAt: 'asc' }, skip: lq.skip, take: lq.take }), prisma.recurringInvoice.count()]);
    sendList(res, rows, total, lq);
  }),
);

router.post(
  '/',
  requirePermission('recurring.manage'),
  ah(async (req, res) => {
    const data = parseBody(schema, req);
    if (!(await prisma.client.findUnique({ where: { id: data.clientId } }))) throw badRequest(`Client #${data.clientId} does not exist.`);
    const created = await prisma.recurringInvoice.create({ data: { ...data, isActive: data.isActive ?? true } });
    await audit({ action: 'recurring.create', entityType: 'recurringInvoice', entityId: created.id, after: created, ...actorFrom(req) });
    res.status(201).json(created);
  }),
);

router.get(
  '/:id',
  requirePermission('recurring.manage'),
  ah(async (req, res) => {
    const item = await prisma.recurringInvoice.findUnique({ where: { id: idParam(req) } });
    if (!item) throw notFound('Recurring invoice');
    res.json(item);
  }),
);

router.patch(
  '/:id',
  requirePermission('recurring.manage'),
  ah(async (req, res) => res.json(await prisma.recurringInvoice.update({ where: { id: idParam(req) }, data: parseBody(schema.partial(), req) }))),
);

router.delete(
  '/:id',
  requirePermission('recurring.manage'),
  ah(async (req, res) => {
    await prisma.recurringInvoice.delete({ where: { id: idParam(req) } });
    res.status(204).send();
  }),
);

router.post(
  '/:id/pause',
  requirePermission('recurring.manage'),
  ah(async (req, res) => res.json(await prisma.recurringInvoice.update({ where: { id: idParam(req) }, data: { isActive: false } }))),
);
router.post(
  '/:id/resume',
  requirePermission('recurring.manage'),
  ah(async (req, res) => res.json(await prisma.recurringInvoice.update({ where: { id: idParam(req) }, data: { isActive: true } }))),
);

export default router;
