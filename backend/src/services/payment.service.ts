import prisma, { Tx } from '../lib/prisma';
import { dec } from '../lib/money';
import { conflict, notFound, unprocessable, badRequest } from '../lib/errors';
import { audit, Actor } from './audit.service';
import { nextNumber } from './numbering.service';
import { recalcInvoice, invoiceLabel } from './invoice.service';
import { events } from './events';
import { currentCompanyId } from '../lib/company-context';

export const PAYMENT_METHODS = ['cash', 'e-payment', 'mobile_money', 'bank_transfer', 'credit_card', 'cheque', 'other'] as const;

export interface PaymentInput {
  invoiceId: number;
  amount: number;
  paymentDate?: Date;
  method: string;
  reference?: string | null;
  notes?: string | null;
}

async function lockInvoice(tx: Tx, id: number) {
  const companyId = currentCompanyId();
  const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Invoice" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
  if (rows.length === 0) throw notFound('Invoice');
}

export const paymentService = {
  async record(input: PaymentInput, actor: Actor, opts: { notify?: boolean } = {}) {
    if (!(dec(input.amount).greaterThan(0))) throw badRequest('Payment amount must be greater than zero.');
    const paymentDate = input.paymentDate ?? new Date();
    if (paymentDate.getTime() > Date.now() + 60_000) throw badRequest('Payment date cannot be in the future.');

    const payment = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, input.invoiceId);
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      if (!invoice.issuedAt) throw conflict('INVOICE_NOT_ISSUED', 'Payments cannot be recorded against a draft invoice.');
      if (invoice.cancelledAt) throw conflict('INVOICE_CANCELLED', 'This invoice was cancelled.');

      const balance = dec(invoice.totalAmount).minus(dec(invoice.amountPaid));
      if (dec(input.amount).greaterThan(balance)) {
        throw unprocessable('OVERPAYMENT', `Payment of ${dec(input.amount).toFixed(2)} exceeds the balance due (${balance.toFixed(2)}).`, { balanceDue: balance.toNumber() });
      }

      const receiptNumber = await nextNumber(tx, 'receipt', paymentDate);
      const created = await tx.payment.create({
        data: {
          receiptNumber,
          invoiceId: input.invoiceId,
          clientId: invoice.clientId,
          amount: input.amount,
          paymentDate,
          method: input.method,
          reference: input.reference ?? null,
          status: 'completed',
          notes: input.notes ?? null,
          receivedById: actor.userId,
        },
      });
      await recalcInvoice(tx, input.invoiceId);
      await audit({ action: 'payment.create', entityType: 'payment', entityId: created.id, summary: `${receiptNumber}: ${dec(input.amount).toFixed(2)} on ${invoiceLabel(invoice)}`, after: created, ...actor }, tx);
      return created;
    });

    events.emitEvent('payment.recorded', { paymentId: payment.id, invoiceId: input.invoiceId, notify: opts.notify !== false, userId: actor.userId });
    return payment;
  },

  async void(id: number, reason: string, actor: Actor) {
    const payment = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, (await tx.payment.findUniqueOrThrow({ where: { id } })).invoiceId);
      const current = await tx.payment.findUnique({ where: { id } });
      if (!current) throw notFound('Payment');
      if (current.status === 'voided') throw conflict('ALREADY_VOIDED', 'This payment is already voided.');
      const updated = await tx.payment.update({ where: { id }, data: { status: 'voided', voidedAt: new Date(), voidReason: reason } });
      await recalcInvoice(tx, current.invoiceId);
      await audit({ action: 'payment.void', entityType: 'payment', entityId: id, summary: `Voided ${current.receiptNumber ?? id}: ${reason}`, before: current, after: updated, ...actor }, tx);
      return updated;
    });
    events.emitEvent('payment.voided', { paymentId: id, invoiceId: payment.invoiceId, userId: actor.userId });
    return payment;
  },

  async reconcile(paymentIds: number[], actor: Actor) {
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) throw badRequest('paymentIds must be a non-empty array.');
    return prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({ where: { id: { in: paymentIds } } });
      const invalid = payments.filter((p) => p.status === 'voided');
      if (invalid.length > 0) throw conflict('CANNOT_RECONCILE_VOIDED', `Payment(s) ${invalid.map((p) => p.id).join(', ')} are voided and cannot be reconciled.`);
      const updated = await tx.payment.updateMany({ where: { id: { in: paymentIds } }, data: { status: 'reconciled', reconciledAt: new Date() } });
      await audit({ action: 'payment.reconcile', entityType: 'payment', summary: `Reconciled ${paymentIds.length} payment(s)`, after: { paymentIds }, ...actor }, tx);
      return { reconciled: updated.count };
    });
  },
};
