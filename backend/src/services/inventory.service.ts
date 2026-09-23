import { Prisma } from '@prisma/client';
import type { Tx } from '../lib/prisma';
import { dec } from '../lib/money';
import { unprocessable } from '../lib/errors';
import { getSettings } from './settings.service';
import { raiseAlert, resolveAlerts } from './alert.service';
import { currentCompanyId } from '../lib/company-context';

export const STOCK_REASON_CODES = [
  'opening',
  'restock',
  'invoice_issued',
  'invoice_voided',
  'invoice_revised',
  'return',
  'damage',
  'correction',
  'manual_adjustment',
] as const;
export type StockReasonCode = (typeof STOCK_REASON_CODES)[number];

export interface MovementInput {
  inventoryItemId: number;
  change: Prisma.Decimal.Value;
  reasonCode: StockReasonCode;
  reason: string;
  notes?: string | null;
  referenceType?: 'invoice' | 'adjustment' | null;
  referenceId?: number | null;
  userId?: number | null;
  /** Caller has the inventory.override permission AND explicitly asked to go below zero. */
  override?: boolean;
}

export interface StockShortage {
  inventoryItemId: number;
  productServiceId: number;
  productName: string;
  available: number;
  requested: number;
}

/**
 * The only way stock changes. Locks the item row, enforces the zero floor, appends the
 * ledger row with previous/after balances and raises or resolves low/out-of-stock alerts.
 */
export async function postMovement(tx: Tx, input: MovementInput) {
  const change = dec(input.change);
  if (change.isZero()) return null;

  const companyId = currentCompanyId();
  const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "InventoryItem" WHERE id = ${input.inventoryItemId} AND "companyId" = ${companyId} FOR UPDATE`;
  if (locked.length === 0) throw unprocessable('INVENTORY_ITEM_NOT_FOUND', `Inventory item #${input.inventoryItemId} not found.`);
  const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: input.inventoryItemId }, include: { product: true } });

  const previous = dec(item.quantityOnHand);
  const next = previous.plus(change);
  let isOverride = false;
  if (next.isNegative()) {
    const settings = await getSettings(tx);
    if (!settings.allowNegativeStock && !input.override) {
      throw unprocessable('INSUFFICIENT_STOCK', `Insufficient stock for ${item.product.name}: ${previous.toNumber()} available, ${change.negated().toNumber()} requested.`, {
        shortages: [
          {
            inventoryItemId: item.id,
            productServiceId: item.productServiceId,
            productName: item.product.name,
            available: previous.toNumber(),
            requested: change.negated().toNumber(),
          } satisfies StockShortage,
        ],
      });
    }
    isOverride = true;
  }

  await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: next } });
  const movement = await tx.stockMovement.create({
    data: {
      inventoryItemId: item.id,
      quantityChange: change,
      previousQuantity: previous,
      balanceAfter: next,
      reason: input.reason,
      reasonCode: input.reasonCode,
      notes: input.notes ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      userId: input.userId ?? null,
      isOverride,
    },
  });

  await evaluateStockAlerts(tx, item.id, item.product.name, next, dec(item.reorderThreshold));
  return movement;
}

export async function evaluateStockAlerts(tx: Tx, inventoryItemId: number, productName: string, onHand: Prisma.Decimal, reorderLevel: Prisma.Decimal) {
  if (onHand.lessThanOrEqualTo(0)) {
    await resolveAlerts({ alertTypes: ['low_stock'], inventoryItemId }, tx);
    await raiseAlert({ alertType: 'out_of_stock', inventoryItemId, message: `${productName} is out of stock (${onHand.toNumber()} on hand).` }, tx);
  } else if (onHand.lessThanOrEqualTo(reorderLevel)) {
    await resolveAlerts({ alertTypes: ['out_of_stock'], inventoryItemId }, tx);
    await raiseAlert({ alertType: 'low_stock', inventoryItemId, message: `${productName} is low on stock: ${onHand.toNumber()} left (reorder level ${reorderLevel.toNumber()}).` }, tx);
  } else {
    await resolveAlerts({ alertTypes: ['low_stock', 'out_of_stock'], inventoryItemId }, tx);
  }
}

interface StockLine {
  productServiceId: number | null;
  quantity: Prisma.Decimal.Value;
}

/** Aggregates line quantities per stocked inventory item (untracked products and services are skipped). */
export async function stockQuantities(tx: Tx, lines: StockLine[]): Promise<Map<number, { item: { id: number; productServiceId: number }; name: string; qty: Prisma.Decimal }>> {
  const productIds = [...new Set(lines.map((l) => l.productServiceId).filter((id): id is number => typeof id === 'number'))];
  const result = new Map<number, { item: { id: number; productServiceId: number }; name: string; qty: Prisma.Decimal }>();
  if (productIds.length === 0) return result;
  const products = await tx.productService.findMany({ where: { id: { in: productIds }, trackInventory: true }, include: { inventoryItem: true } });
  const byProduct = new Map(products.map((p) => [p.id, p]));
  for (const line of lines) {
    const product = line.productServiceId ? byProduct.get(line.productServiceId) : undefined;
    if (!product?.inventoryItem || product.inventoryItem.isArchived) continue;
    const key = product.inventoryItem.id;
    const entry = result.get(key) ?? { item: product.inventoryItem, name: product.name, qty: new Prisma.Decimal(0) };
    entry.qty = entry.qty.plus(dec(line.quantity));
    result.set(key, entry);
  }
  return result;
}

/**
 * Posts the stock difference between two versions of an invoice's lines.
 * direction examples: issue = (before: [], after: lines); void = (before: lines, after: []).
 * All shortages are collected first so the user sees every problem line at once.
 */
export async function applyInvoiceStockDelta(
  tx: Tx,
  params: {
    invoiceId: number;
    invoiceLabel: string;
    before: StockLine[];
    after: StockLine[];
    reasonCode: Extract<StockReasonCode, 'invoice_issued' | 'invoice_voided' | 'invoice_revised'>;
    userId?: number | null;
    override?: boolean;
  },
) {
  const before = await stockQuantities(tx, params.before);
  const after = await stockQuantities(tx, params.after);
  const itemIds = new Set([...before.keys(), ...after.keys()]);

  const deltas: { itemId: number; name: string; productServiceId: number; change: Prisma.Decimal }[] = [];
  for (const itemId of itemIds) {
    const b = before.get(itemId);
    const a = after.get(itemId);
    // Selling more (after > before) removes stock.
    const change = (b?.qty ?? new Prisma.Decimal(0)).minus(a?.qty ?? new Prisma.Decimal(0));
    if (!change.isZero()) deltas.push({ itemId, name: (a ?? b)!.name, productServiceId: (a ?? b)!.item.productServiceId, change });
  }
  if (deltas.length === 0) return;

  if (!params.override) {
    const settings = await getSettings(tx);
    if (!settings.allowNegativeStock) {
      const items = await tx.inventoryItem.findMany({ where: { id: { in: deltas.map((d) => d.itemId) } } });
      const onHand = new Map(items.map((i) => [i.id, dec(i.quantityOnHand)]));
      const shortages: StockShortage[] = deltas
        .filter((d) => d.change.isNegative() && (onHand.get(d.itemId) ?? new Prisma.Decimal(0)).plus(d.change).isNegative())
        .map((d) => ({
          inventoryItemId: d.itemId,
          productServiceId: d.productServiceId,
          productName: d.name,
          available: (onHand.get(d.itemId) ?? new Prisma.Decimal(0)).toNumber(),
          requested: d.change.negated().toNumber(),
        }));
      if (shortages.length > 0) {
        throw unprocessable(
          'INSUFFICIENT_STOCK',
          `Insufficient stock: ${shortages.map((s) => `${s.productName} (${s.available} available, ${s.requested} needed)`).join('; ')}.`,
          { shortages },
        );
      }
    }
  }

  const verb = params.reasonCode === 'invoice_issued' ? 'Issued' : params.reasonCode === 'invoice_voided' ? 'Voided' : 'Revised';
  for (const d of deltas) {
    await postMovement(tx, {
      inventoryItemId: d.itemId,
      change: d.change,
      reasonCode: params.reasonCode,
      reason: `${verb} invoice ${params.invoiceLabel}`,
      referenceType: 'invoice',
      referenceId: params.invoiceId,
      userId: params.userId,
      override: params.override,
    });
  }
}
