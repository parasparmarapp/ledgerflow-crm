import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zDate, zNum, zOptStr } from '../lib/http';
import { forbidden, notFound } from '../lib/errors';
import { can, requirePermission } from '../auth/permissions';
import { audit, actorFrom } from '../services/audit.service';

const router = Router();

const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  category: z.string().trim().min(1, 'Category is required.'),
  item: zOptStr,
  amount: zNum,
  expenseDate: zDate.optional(),
  vendor: zOptStr,
  notes: zOptStr,
});

router.get(
  '/categories',
  requirePermission('expense.read'),
  ah(async (_req, res) => {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    res.json(categories);
  }),
);

router.get(
  '/items',
  requirePermission('expense.read'),
  ah(async (req, res) => {
    const { category, categoryId } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (categoryId) {
      where.categoryId = Number(categoryId);
    } else if (category && category !== 'All') {
      where.category = { name: category };
    }
    const items = await prisma.expenseItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, group: true },
        },
      },
    });
    res.json(items);
  }),
);

router.get(
  '/',
  requirePermission('expense.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req, ['expenseDate', 'amount', 'createdAt']);
    const { category, item, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (category && category !== 'All') where.category = category;
    if (item && item !== 'All') where.item = item;
    if (lq.from || lq.to) where.expenseDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const s = search || lq.search;
    if (s) {
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        { vendor: { contains: s, mode: 'insensitive' } },
        { item: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: lq.sort ? { [lq.sort.field]: lq.sort.direction } : { expenseDate: 'desc' }, skip: lq.skip, take: lq.take }),
      prisma.expense.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);

router.post(
  '/',
  requirePermission('expense.write'),
  ah(async (req, res) => {
    const data = parseBody(expenseSchema, req);
    const created = await prisma.expense.create({ data: { ...data, expenseDate: data.expenseDate ?? new Date(), createdById: req.user!.id } });
    await audit({ action: 'expense.create', entityType: 'expense', entityId: created.id, summary: `${created.description}: ${created.amount}`, after: created, ...actorFrom(req) });
    res.status(201).json(created);
  }),
);

router.get(
  '/:id',
  requirePermission('expense.read'),
  ah(async (req, res) => {
    const item = await prisma.expense.findUnique({ where: { id: idParam(req) } });
    if (!item) throw notFound('Expense');
    res.json(item);
  }),
);

router.patch(
  '/:id',
  requirePermission('expense.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const current = await prisma.expense.findUnique({ where: { id } });
    if (!current) throw notFound('Expense');
    if (current.createdById && current.createdById !== req.user!.id && !can(req.user, 'expense.manage_all')) throw forbidden('You can only edit expenses you created.');
    const data = parseBody(expenseSchema.partial(), req);
    const updated = await prisma.expense.update({ where: { id }, data });
    await audit({ action: 'expense.update', entityType: 'expense', entityId: id, before: current, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  requirePermission('expense.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const current = await prisma.expense.findUnique({ where: { id } });
    if (!current) throw notFound('Expense');
    if (current.createdById && current.createdById !== req.user!.id && !can(req.user, 'expense.manage_all')) throw forbidden('You can only delete expenses you created.');
    await prisma.expense.delete({ where: { id } });
    await audit({ action: 'expense.delete', entityType: 'expense', entityId: id, before: current, ...actorFrom(req) });
    res.status(204).send();
  }),
);

export default router;
