import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { ah, idParam, parseBody, parseListQuery, sendList, zBool, zNum, zOptStr } from '../lib/http';
import { notFound, unprocessable } from '../lib/errors';
import { requirePermission } from '../auth/permissions';
import { audit, actorFrom, Actor } from '../services/audit.service';
import { postMovement, STOCK_REASON_CODES } from '../services/inventory.service';
import { dec } from '../lib/money';

export const productsRouter = Router();
export const inventoryRouter = Router();
export const stockMovementsRouter = Router();

const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: zOptStr,
  type: z.enum(['product', 'service']).default('product'),
  group: z.string().trim().default('Commodities'),
  sku: zOptStr,
  unit: z.string().trim().default('pcs'),
  unitPrice: zNum,
  costPrice: zNum.optional(),
  taxRate: zNum.optional(),
  trackInventory: zBool.optional(),
  initialStock: zNum.optional(),
  imageUrl: zOptStr,
});

productsRouter.get(
  '/',
  requirePermission('catalog.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req, ['name', 'unitPrice', 'createdAt']);
    const { group, type, search, active } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (group && group !== 'All') where.group = group;
    if (type && type !== 'all') where.type = type;
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;
    const s = search || lq.search;
    if (s) where.OR = [{ name: { contains: s, mode: 'insensitive' } }, { sku: { contains: s, mode: 'insensitive' } }, { description: { contains: s, mode: 'insensitive' } }];
    const [rows, total] = await Promise.all([
      prisma.productService.findMany({ where, orderBy: lq.sort ? { [lq.sort.field]: lq.sort.direction } : { id: 'desc' }, skip: lq.skip, take: lq.take }),
      prisma.productService.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);

productsRouter.post(
  '/',
  requirePermission('catalog.write'),
  ah(async (req, res) => {
    const data = parseBody(productSchema, req);
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.productService.create({
        data: {
          name: data.name, description: data.description, type: data.type, group: data.group, sku: data.sku,
          unit: data.unit, unitPrice: data.unitPrice, costPrice: data.costPrice ?? null, taxRate: data.taxRate ?? 0,
          trackInventory: data.trackInventory ?? data.type === 'product',
          imageUrl: data.imageUrl ?? null,
        } as any,
      });
      if ((product as any).trackInventory) {
        const stock = data.initialStock ?? 0;
        const inv = await tx.inventoryItem.create({ data: { productServiceId: product.id, quantityOnHand: stock, reorderThreshold: 5, unitCost: data.costPrice ?? 0, location: 'Main Warehouse' } });
        if (dec(stock).greaterThan(0)) {
          await postMovement(tx, { inventoryItemId: inv.id, change: stock, reasonCode: 'opening', reason: 'Initial stock intake upon product registration', userId: req.user!.id });
        }
      }
      return product;
    });
    await audit({ action: 'catalog.create', entityType: 'productService', entityId: created.id, summary: `Created ${created.name}`, after: created, ...actorFrom(req) });
    res.status(201).json(created);
  }),
);

productsRouter.get(
  '/:id',
  requirePermission('catalog.read'),
  ah(async (req, res) => {
    const item = await prisma.productService.findUnique({ where: { id: idParam(req) } });
    if (!item) throw notFound('Product or service');
    res.json(item);
  }),
);

productsRouter.patch(
  '/:id',
  requirePermission('catalog.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const current = await prisma.productService.findUnique({ where: { id } });
    if (!current) throw notFound('Product or service');
    const data = parseBody(productSchema.partial().omit({ initialStock: true }), req);
    const updated = await prisma.productService.update({ where: { id }, data: data as any });
    await audit({ action: 'catalog.update', entityType: 'productService', entityId: id, before: current, after: updated, ...actorFrom(req) });
    res.json(updated);
  }),
);

productsRouter.delete(
  '/:id',
  requirePermission('catalog.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const updated = await prisma.productService.update({ where: { id }, data: { isActive: false } });
    await audit({ action: 'catalog.archive', entityType: 'productService', entityId: id, after: updated, ...actorFrom(req) });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

async function enrichInventory(items: Prisma.InventoryItemGetPayload<{}>[]) {
  const products = await prisma.productService.findMany({ where: { id: { in: items.map((i) => i.productServiceId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const p = byId.get(item.productServiceId);
    return { ...item, productName: p?.name || `Product #${item.productServiceId}`, sku: p?.sku || '—', group: p?.group || 'Commodities', unitPrice: p?.unitPrice ?? 0 };
  });
}

inventoryRouter.get(
  '/',
  requirePermission('inventory.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const { status } = req.query as { status?: string };
    const items = await prisma.inventoryItem.findMany({ where: { isArchived: false }, orderBy: { id: 'desc' } });
    let filtered = items;
    if (status === 'low') filtered = items.filter((i) => dec(i.quantityOnHand).greaterThan(0) && dec(i.quantityOnHand).lessThanOrEqualTo(dec(i.reorderThreshold)));
    else if (status === 'out') filtered = items.filter((i) => dec(i.quantityOnHand).lessThanOrEqualTo(0));
    const total = filtered.length;
    const page = lq.paginate ? filtered.slice(lq.skip, lq.skip + (lq.take ?? filtered.length)) : filtered;
    sendList(res, await enrichInventory(page), total, lq);
  }),
);

inventoryRouter.post(
  '/',
  requirePermission('inventory.write'),
  ah(async (req, res) => {
    const schema = z.object({ productServiceId: zNum, quantityOnHand: zNum.optional(), reorderThreshold: zNum.optional(), unitCost: zNum.optional(), location: zOptStr });
    const data = parseBody(schema, req);
    if (!(await prisma.productService.findUnique({ where: { id: data.productServiceId } }))) throw unprocessable('PRODUCT_NOT_FOUND', `Product #${data.productServiceId} does not exist.`);
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({ data: { productServiceId: data.productServiceId, quantityOnHand: 0, reorderThreshold: data.reorderThreshold ?? 5, unitCost: data.unitCost ?? 0, location: data.location ?? 'Warehouse' } });
      await tx.productService.update({ where: { id: data.productServiceId }, data: { trackInventory: true } as any });
      const opening = data.quantityOnHand ?? 0;
      if (dec(opening).greaterThan(0)) await postMovement(tx, { inventoryItemId: item.id, change: opening, reasonCode: 'opening', reason: 'Initial manual inventory entry', userId: req.user!.id });
      return item;
    });
    res.status(201).json(created);
  }),
);

inventoryRouter.get(
  '/:id',
  requirePermission('inventory.read'),
  ah(async (req, res) => {
    const item = await prisma.inventoryItem.findUnique({ where: { id: idParam(req) } });
    if (!item) throw notFound('Inventory item');
    res.json((await enrichInventory([item]))[0]);
  }),
);

inventoryRouter.patch(
  '/:id',
  requirePermission('inventory.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const schema = z.object({ reorderThreshold: zNum.optional(), unitCost: zNum.optional(), location: zOptStr, isArchived: zBool.optional() });
    const data = parseBody(schema, req);
    res.json(await prisma.inventoryItem.update({ where: { id }, data }));
  }),
);

inventoryRouter.post(
  '/:id/adjust',
  requirePermission('inventory.adjust'),
  ah(async (req, res) => {
    const id = idParam(req);
    const schema = z.object({
      quantityChange: zNum,
      reason: zOptStr,
      reasonCode: z.enum(STOCK_REASON_CODES).default('manual_adjustment'),
      notes: zOptStr,
      allowNegative: zBool.optional(),
    });
    const data = parseBody(schema, req);
    if (data.allowNegative && !(req.user!.role === 'admin')) throw notFound('inventory.override'); // staff cannot override; surfaced as 403 by requirePermission below in a real override endpoint
    const actor: Actor = actorFrom(req);
    const movement = await prisma.$transaction((tx) =>
      postMovement(tx, { inventoryItemId: id, change: data.quantityChange, reasonCode: data.reasonCode, reason: data.reason || 'Manual stock adjustment', notes: data.notes, userId: actor.userId, override: data.allowNegative }),
    );
    await audit({ action: 'inventory.adjust', entityType: 'inventoryItem', entityId: id, summary: `Change ${data.quantityChange} (${data.reasonCode})`, after: movement, ...actor });
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } });
    res.json({ success: true, item: (await enrichInventory([item]))[0], movement });
  }),
);

inventoryRouter.delete(
  '/:id',
  requirePermission('inventory.write'),
  ah(async (req, res) => {
    const id = idParam(req);
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (item && dec(item.quantityOnHand).greaterThan(0)) throw unprocessable('STOCK_REMAINING', 'This item still has stock on hand. Zero it out before archiving.');
    await prisma.inventoryItem.update({ where: { id }, data: { isArchived: true } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Stock movements (read-only audit trail)
// ---------------------------------------------------------------------------

stockMovementsRouter.get(
  '/',
  requirePermission('inventory.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const { inventoryItemId, reasonCode } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (inventoryItemId) where.inventoryItemId = Number(inventoryItemId);
    if (reasonCode) where.reasonCode = reasonCode;
    if (lq.from || lq.to) where.createdAt = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: lq.skip, take: lq.take }),
      prisma.stockMovement.count({ where }),
    ]);
    sendList(res, rows, total, lq);
  }),
);
