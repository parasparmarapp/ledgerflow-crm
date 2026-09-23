import { Prisma } from '@prisma/client';
import { dec, max0, round2 } from '../lib/money';

type D = Prisma.Decimal;

export interface CalcLineInput {
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  /** Line-level discount (absolute amount). */
  discountAmount?: Prisma.Decimal.Value;
  /** Tax rate in percent, e.g. 15 for 15%. */
  taxRate?: Prisma.Decimal.Value;
}

export interface CalcLineResult {
  quantity: D;
  unitPrice: D;
  discountAmount: D;
  taxRate: D;
  /** Net line amount after line discount, before invoice discount and tax. */
  lineTotal: D;
  taxAmount: D;
}

export interface CalcResult {
  lines: CalcLineResult[];
  /** Σ lineTotal */
  subtotal: D;
  /** Invoice-level discount actually applied (capped at subtotal). */
  discountAmount: D;
  taxAmount: D;
  totalAmount: D;
}

/**
 * Invoice totals engine. All maths in Decimal, currency rounded half-up to 2 dp.
 *
 *   gross      = qty × unitPrice
 *   lineTotal  = gross − min(lineDiscount, gross)
 *   subtotal   = Σ lineTotal
 *   invoice discount is capped at subtotal and allocated to lines pro rata (last line takes
 *   the rounding remainder), so tax is charged on the discounted amount:
 *   lineTax    = (lineTotal − allocatedDiscount) × taxRate%
 *   total      = subtotal − invoiceDiscount + Σ lineTax
 */
export function calculateInvoice(lines: CalcLineInput[], invoiceDiscount: Prisma.Decimal.Value = 0): CalcResult {
  const prepared = lines.map((line) => {
    const quantity = dec(line.quantity).toDecimalPlaces(3);
    const unitPrice = round2(dec(line.unitPrice));
    const gross = quantity.times(unitPrice);
    const discountAmount = round2(Prisma.Decimal.min(max0(dec(line.discountAmount)), gross));
    const lineTotal = round2(max0(gross.minus(discountAmount)));
    const taxRate = max0(dec(line.taxRate)).toDecimalPlaces(3);
    return { quantity, unitPrice, discountAmount, taxRate, lineTotal };
  });

  const subtotal = prepared.reduce((acc, l) => acc.plus(l.lineTotal), new Prisma.Decimal(0));
  const discount = round2(Prisma.Decimal.min(max0(dec(invoiceDiscount)), subtotal));

  let allocatedSoFar = new Prisma.Decimal(0);
  const lastNonZero = prepared.map((l) => !l.lineTotal.isZero()).lastIndexOf(true);
  const results: CalcLineResult[] = prepared.map((l, i) => {
    let allocated = new Prisma.Decimal(0);
    if (!discount.isZero() && !subtotal.isZero() && !l.lineTotal.isZero()) {
      allocated = i === lastNonZero ? discount.minus(allocatedSoFar) : round2(discount.times(l.lineTotal).dividedBy(subtotal));
      allocatedSoFar = allocatedSoFar.plus(allocated);
    }
    const taxable = max0(l.lineTotal.minus(allocated));
    const taxAmount = round2(taxable.times(l.taxRate).dividedBy(100));
    return { ...l, taxAmount };
  });

  const taxAmount = results.reduce((acc, l) => acc.plus(l.taxAmount), new Prisma.Decimal(0));
  const totalAmount = round2(subtotal.minus(discount).plus(taxAmount));
  return { lines: results, subtotal, discountAmount: discount, taxAmount, totalAmount };
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface StatusInput {
  cancelledAt?: Date | null;
  issuedAt?: Date | null;
  totalAmount: Prisma.Decimal.Value;
  amountPaid: Prisma.Decimal.Value;
  dueDate: Date;
  viewedAt?: Date | null;
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Invoice status is derived, never set directly:
 * cancelled → draft (not issued) → paid (nothing left to pay) → overdue (past due with a
 * balance, even if part-paid) → partially_paid → viewed → sent.
 */
export function deriveStatus(inv: StatusInput, now = new Date()): InvoiceStatus {
  if (inv.cancelledAt) return 'cancelled';
  if (!inv.issuedAt) return 'draft';
  const total = dec(inv.totalAmount);
  const paid = dec(inv.amountPaid);
  if (paid.greaterThanOrEqualTo(total)) return 'paid';
  if (startOfDay(inv.dueDate) < startOfDay(now)) return 'overdue';
  if (paid.greaterThan(0)) return 'partially_paid';
  if (inv.viewedAt) return 'viewed';
  return 'sent';
}
