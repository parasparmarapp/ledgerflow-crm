import { Prisma } from '@prisma/client';
import prisma, { Tx } from '../lib/prisma';
import { dec, max0 } from '../lib/money';
import { conflict, notFound, unprocessable, badRequest } from '../lib/errors';
import { audit, Actor } from './audit.service';
import { nextNumber } from './numbering.service';
import { getSettings } from './settings.service';
import { calculateInvoice, deriveStatus, startOfDay } from './invoice.calc';
import { applyInvoiceStockDelta } from './inventory.service';
import { raiseAlert, resolveAlerts } from './alert.service';
import { currentCompanyId } from '../lib/company-context';
import { events } from './events';

export interface LineInput {
  productServiceId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface InvoiceInput {
  clientId: number;
  issueDate?: Date;
  dueDate?: Date;
  notes?: string | null;
  terms?: string | null;
  /** Invoice-level discount (absolute amount). */
  discountAmount?: number;
  lineItems: LineInput[];
}

export interface IssueOptions {
  /** Send invoice email/SMS to the client after issuing (default true). */
  notify?: boolean;
  channels?: ('email' | 'sms')[];
  /** Caller holds inventory.override and confirmed selling below zero stock. */
  overrideStock?: boolean;
}

/** Payment statuses that count towards an invoice's amountPaid. */
export const COUNTED_PAYMENT_STATUSES = ['completed', 'reconciled'];

const invoiceInclude = {
  lineItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  client: { select: { id: true, name: true, companyName: true, email: true, phone: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithLines = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export const invoiceLabel = (inv: { id: number; invoiceNumber: string | null }) => inv.invoiceNumber ?? `Draft #${inv.id}`;

/** API representation: keeps the legacy field names the web client uses. */
export function presentInvoice<T extends { id: number; invoiceNumber: string | null; issuedAt: Date | null; status: string }>(inv: T) {
  const { client, ...rest } = inv as any;
  return {
    ...rest,
    invoiceNumber: inv.invoiceNumber ?? `Draft #${inv.id}`,
    isDraft: !inv.issuedAt,
    ...(client ? { client, clientName: client.name } : {}),
  };
}

async function loadInvoice(db: Tx | typeof prisma, id: number): Promise<InvoiceWithLines> {
  const invoice = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw notFound('Invoice');
  return invoice;
}

async function lockInvoice(tx: Tx, id: number) {
  const companyId = currentCompanyId();
  const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Invoice" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
  if (rows.length === 0) throw notFound('Invoice');
}

/** Validates lines, snapshots cost prices from the catalog and computes totals. */
async function buildLines(tx: Tx, input: InvoiceInput) {
  if (!input.lineItems || input.lineItems.length === 0) throw badRequest('An invoice needs at least one line item.');
  const productIds = [...new Set(input.lineItems.map((l) => l.productServiceId).filter((v): v is number => typeof v === 'number'))];
  const products = productIds.length
    ? await tx.productService.findMany({ where: { id: { in: productIds } }, include: { inventoryItem: true } })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) if (!byId.has(id)) throw badRequest(`Product/service #${id} does not exist.`);

  const calc = calculateInvoice(input.lineItems, input.discountAmount ?? 0);
  const lines = input.lineItems.map((line, i) => {
    const product = line.productServiceId ? byId.get(line.productServiceId) : undefined;
    const cost = product?.costPrice ?? product?.inventoryItem?.unitCost ?? null;
    const c = calc.lines[i];
    return {
      productServiceId: line.productServiceId ?? null,
      description: line.description.trim() || product?.name || 'Item',
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      discountAmount: c.discountAmount,
      taxRate: c.taxRate,
      taxAmount: c.taxAmount,
      lineTotal: c.lineTotal,
      unitCostSnapshot: cost,
      sortOrder: i,
    };
  });
  return { calc, lines };
}

async function assertClientUsable(tx: Tx, clientId: number) {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) throw badRequest(`Client #${clientId} does not exist.`);
  if (!client.isActive) throw unprocessable('CLIENT_ARCHIVED', `${client.name} is archived. Restore the client before invoicing.`);
  return client;
}

function validateDates(issueDate: Date, dueDate: Date) {
  if (startOfDay(dueDate) < startOfDay(issueDate)) throw badRequest('Due date cannot be before the issue date.');
}

/** Recomputes paid amount, balance, status and paidAt from the invoice's payments. */
export async function recalcInvoice(tx: Tx, invoiceId: number) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const agg = await tx.payment.aggregate({
    where: { invoiceId, status: { in: COUNTED_PAYMENT_STATUSES } },
    _sum: { amount: true },
  });
  const amountPaid = dec(agg._sum.amount);
  const status = deriveStatus({ ...invoice, amountPaid });
  const balanceDue = max0(dec(invoice.totalAmount).minus(amountPaid));
  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid,
      balanceDue,
      status,
      paidAt: status === 'paid' ? invoice.paidAt ?? new Date() : null,
    },
  });
  if (status === 'paid' || status === 'cancelled') await resolveAlerts({ alertTypes: ['invoice_overdue'], invoiceId }, tx);
  return updated;
}

async function issueInTx(tx: Tx, invoice: InvoiceWithLines, actor: Actor, opts: IssueOptions) {
  const invoiceNumber = await nextNumber(tx, 'invoice', invoice.issueDate);
  await applyInvoiceStockDelta(tx, {
    invoiceId: invoice.id,
    invoiceLabel: invoiceNumber,
    before: [],
    after: invoice.lineItems,
    reasonCode: 'invoice_issued',
    userId: actor.userId,
    override: opts.overrideStock,
  });
  const now = new Date();
  await tx.invoice.update({ where: { id: invoice.id }, data: { invoiceNumber, issuedAt: now, sentAt: now } });
  const updated = await recalcInvoice(tx, invoice.id);
  await audit(
    { action: 'invoice.issue', entityType: 'invoice', entityId: invoice.id, summary: `Issued ${invoiceNumber} for ${dec(invoice.totalAmount).toFixed(2)}`, after: updated, ...actor },
    tx,
  );
  return updated;
}

export const invoiceService = {
  include: invoiceInclude,

  async get(id: number) {
    const invoice = await loadInvoice(prisma, id);
    const payments = await prisma.payment.findMany({ where: { invoiceId: id }, orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }] });
    return { ...presentInvoice(invoice), payments };
  },

  async create(input: InvoiceInput & { issue: boolean; markPaid?: { method: string; reference?: string | null } }, actor: Actor, opts: IssueOptions = {}) {
    const settings = await getSettings();
    const issueDate = input.issueDate ?? new Date();
    const dueDate = input.dueDate ?? new Date(issueDate.getTime() + settings.defaultPaymentTermsDays * 86_400_000);
    validateDates(issueDate, dueDate);

    const result = await prisma.$transaction(async (tx) => {
      await assertClientUsable(tx, input.clientId);
      const { calc, lines } = await buildLines(tx, input);
      const created = await tx.invoice.create({
        data: {
          clientId: input.clientId,
          issueDate,
          dueDate,
          status: 'draft',
          subtotal: calc.subtotal,
          discountAmount: calc.discountAmount,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          amountPaid: 0,
          balanceDue: calc.totalAmount,
          notes: input.notes ?? settings.defaultNotes ?? null,
          terms: input.terms ?? settings.defaultTerms ?? null,
          createdById: actor.userId,
          lineItems: { create: lines },
        },
        include: invoiceInclude,
      });
      await audit({ action: 'invoice.create', entityType: 'invoice', entityId: created.id, summary: `Created draft for client #${input.clientId}`, ...actor }, tx);
      if (!input.issue) return created;

      await issueInTx(tx, created, actor, opts);
      if (input.markPaid && dec(created.totalAmount).greaterThan(0)) {
        // "Issue & mark paid": record the full amount as a payment so status stays derived from payments.
        const receiptNumber = await nextNumber(tx, 'receipt', issueDate);
        const payment = await tx.payment.create({
          data: {
            receiptNumber,
            invoiceId: created.id,
            clientId: created.clientId,
            amount: created.totalAmount,
            paymentDate: new Date(),
            method: input.markPaid.method,
            reference: input.markPaid.reference ?? null,
            status: 'completed',
            receivedById: actor.userId,
          },
        });
        await recalcInvoice(tx, created.id);
        await audit({ action: 'payment.create', entityType: 'payment', entityId: payment.id, summary: `Full payment recorded on issue`, after: payment, ...actor }, tx);
        return { ...created, _paymentId: payment.id };
      }
      return created;
    });

    const invoice = await loadInvoice(prisma, result.id);
    if (input.issue) {
      events.emitEvent('invoice.issued', { invoiceId: invoice.id, notify: opts.notify !== false, channels: opts.channels, userId: actor.userId });
      const paymentId = (result as any)._paymentId as number | undefined;
      if (paymentId) events.emitEvent('payment.recorded', { paymentId, invoiceId: invoice.id, notify: false, userId: actor.userId });
    }
    return presentInvoice(invoice);
  },

  /**
   * Edit rules:
   *  - draft: freely editable
   *  - issued, nothing paid: editable (snapshot + audit, stock re-balanced)
   *  - part/fully paid: requires an open revision (see revise())
   *  - cancelled: read-only
   */
  async update(id: number, input: Partial<InvoiceInput>, actor: Actor, opts: IssueOptions & { issue?: boolean } = {}) {
    let issuedNow = false;
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const current = await loadInvoice(tx, id);
      if (current.cancelledAt) throw conflict('INVOICE_LOCKED', 'Cancelled invoices cannot be edited.');
      const hasPayments = dec(current.amountPaid).greaterThan(0);
      if (hasPayments && !current.revisionOpen) {
        throw conflict('REVISION_REQUIRED', 'This invoice has payments recorded. Start a revision before editing it.');
      }

      const merged: InvoiceInput = {
        clientId: input.clientId ?? current.clientId,
        issueDate: input.issueDate ?? current.issueDate,
        dueDate: input.dueDate ?? current.dueDate,
        notes: input.notes !== undefined ? input.notes : current.notes,
        terms: input.terms !== undefined ? input.terms : current.terms,
        discountAmount: input.discountAmount ?? dec(current.discountAmount).toNumber(),
        lineItems:
          input.lineItems ??
          current.lineItems.map((l) => ({
            productServiceId: l.productServiceId,
            description: l.description,
            quantity: dec(l.quantity).toNumber(),
            unitPrice: dec(l.unitPrice).toNumber(),
            discountAmount: dec(l.discountAmount).toNumber(),
            taxRate: dec(l.taxRate).toNumber(),
          })),
      };
      validateDates(merged.issueDate!, merged.dueDate!);
      if (current.issuedAt && merged.clientId !== current.clientId && hasPayments) {
        throw unprocessable('CLIENT_CHANGE_BLOCKED', 'The client of an invoice with payments cannot be changed.');
      }
      if (merged.clientId !== current.clientId) await assertClientUsable(tx, merged.clientId);

      const { calc, lines } = await buildLines(tx, merged);
      if (calc.totalAmount.lessThan(dec(current.amountPaid))) {
        throw unprocessable('TOTAL_BELOW_PAID', `The new total (${calc.totalAmount.toFixed(2)}) is less than the amount already paid (${dec(current.amountPaid).toFixed(2)}). Void a payment first.`);
      }

      if (current.issuedAt) {
        // Snapshot before changing an issued document.
        await tx.invoiceRevision.create({
          data: {
            invoiceId: id,
            revision: current.revision,
            reason: current.revisionOpen ? 'Revision' : 'Edited after issue',
            snapshot: JSON.parse(JSON.stringify(current)),
            userId: actor.userId,
          },
        });
        await applyInvoiceStockDelta(tx, {
          invoiceId: id,
          invoiceLabel: invoiceLabel(current),
          before: current.lineItems,
          after: lines,
          reasonCode: 'invoice_revised',
          userId: actor.userId,
          override: opts.overrideStock,
        });
      }

      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          clientId: merged.clientId,
          issueDate: merged.issueDate,
          dueDate: merged.dueDate,
          notes: merged.notes ?? null,
          terms: merged.terms ?? null,
          subtotal: calc.subtotal,
          discountAmount: calc.discountAmount,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          revisionOpen: false,
          lineItems: { create: lines },
        },
      });
      const updated = await recalcInvoice(tx, id);
      await audit(
        {
          action: current.issuedAt ? (current.revisionOpen ? 'invoice.revise_save' : 'invoice.edit_issued') : 'invoice.edit_draft',
          entityType: 'invoice',
          entityId: id,
          summary: `Total ${dec(current.totalAmount).toFixed(2)} → ${calc.totalAmount.toFixed(2)}`,
          before: current,
          after: updated,
          ...actor,
        },
        tx,
      );

      if (!current.issuedAt && opts.issue) {
        await issueInTx(tx, await loadInvoice(tx, id), actor, opts);
        issuedNow = true;
      }
    });

    if (issuedNow) events.emitEvent('invoice.issued', { invoiceId: id, notify: opts.notify !== false, channels: opts.channels, userId: actor.userId });
    return presentInvoice(await loadInvoice(prisma, id));
  },

  /** Issues a draft (assigns number, deducts stock). Re-sending an issued invoice only re-notifies. */
  async issueOrSend(id: number, actor: Actor, opts: IssueOptions = {}) {
    let wasDraft = false;
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const invoice = await loadInvoice(tx, id);
      if (invoice.cancelledAt) throw conflict('INVOICE_LOCKED', 'Cancelled invoices cannot be sent.');
      if (!invoice.issuedAt) {
        wasDraft = true;
        await issueInTx(tx, invoice, actor, opts);
      } else {
        await tx.invoice.update({ where: { id }, data: { sentAt: new Date() } });
        await audit({ action: 'invoice.resend', entityType: 'invoice', entityId: id, summary: `Re-sent ${invoiceLabel(invoice)}`, ...actor }, tx);
      }
    });
    events.emitEvent('invoice.issued', { invoiceId: id, notify: opts.notify !== false, channels: opts.channels, userId: actor.userId });
    return { invoice: presentInvoice(await loadInvoice(prisma, id)), issued: wasDraft };
  },

  async duplicate(id: number, actor: Actor) {
    const source = await loadInvoice(prisma, id);
    const settings = await getSettings();
    const issueDate = new Date();
    return this.create(
      {
        clientId: source.clientId,
        issueDate,
        dueDate: new Date(issueDate.getTime() + settings.defaultPaymentTermsDays * 86_400_000),
        notes: source.notes,
        terms: source.terms,
        discountAmount: dec(source.discountAmount).toNumber(),
        lineItems: source.lineItems.map((l) => ({
          productServiceId: l.productServiceId,
          description: l.description,
          quantity: dec(l.quantity).toNumber(),
          unitPrice: dec(l.unitPrice).toNumber(),
          discountAmount: dec(l.discountAmount).toNumber(),
          taxRate: dec(l.taxRate).toNumber(),
        })),
        issue: false,
      },
      actor,
    ).then(async (copy) => {
      await audit({ action: 'invoice.duplicate', entityType: 'invoice', entityId: copy.id, summary: `Duplicated from ${invoiceLabel(source)}`, ...actor });
      return copy;
    });
  },

  async void(id: number, reason: string, actor: Actor) {
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const invoice = await loadInvoice(tx, id);
      if (invoice.cancelledAt) throw conflict('ALREADY_CANCELLED', 'This invoice is already cancelled.');
      if (!invoice.issuedAt) throw conflict('DRAFT_DELETE_INSTEAD', 'Drafts are deleted, not voided.');
      const activePayments = await tx.payment.count({ where: { invoiceId: id, status: { in: [...COUNTED_PAYMENT_STATUSES, 'pending'] } } });
      if (activePayments > 0) throw conflict('HAS_PAYMENTS', 'Void the payments recorded against this invoice before cancelling it.');

      await applyInvoiceStockDelta(tx, {
        invoiceId: id,
        invoiceLabel: invoiceLabel(invoice),
        before: invoice.lineItems,
        after: [],
        reasonCode: 'invoice_voided',
        userId: actor.userId,
      });
      await tx.invoice.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason, revisionOpen: false } });
      const updated = await recalcInvoice(tx, id);
      await audit({ action: 'invoice.void', entityType: 'invoice', entityId: id, summary: `Voided ${invoiceLabel(invoice)}: ${reason}`, before: invoice, after: updated, ...actor }, tx);
    });
    events.emitEvent('invoice.voided', { invoiceId: id, userId: actor.userId });
    return presentInvoice(await loadInvoice(prisma, id));
  },

  /** Opens a revision on an invoice with payments so it can be edited once (audited, snapshotted). */
  async revise(id: number, reason: string, actor: Actor) {
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const invoice = await loadInvoice(tx, id);
      if (invoice.cancelledAt) throw conflict('INVOICE_LOCKED', 'Cancelled invoices cannot be revised.');
      if (!dec(invoice.amountPaid).greaterThan(0)) throw conflict('REVISION_NOT_NEEDED', 'Only invoices with payments need a revision; edit this invoice directly.');
      if (invoice.revisionOpen) return;
      await tx.invoiceRevision.create({
        data: { invoiceId: id, revision: invoice.revision, reason, snapshot: JSON.parse(JSON.stringify(invoice)), userId: actor.userId },
      });
      await tx.invoice.update({ where: { id }, data: { revisionOpen: true, revision: { increment: 1 } } });
      await audit({ action: 'invoice.revise', entityType: 'invoice', entityId: id, summary: `Revision opened: ${reason}`, ...actor }, tx);
    });
    return presentInvoice(await loadInvoice(prisma, id));
  },

  async deleteDraft(id: number, actor: Actor) {
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const invoice = await loadInvoice(tx, id);
      if (invoice.issuedAt) throw conflict('ISSUED_INVOICE', 'Issued invoices cannot be deleted. Void the invoice instead.');
      await tx.invoice.delete({ where: { id } });
      await audit({ action: 'invoice.delete_draft', entityType: 'invoice', entityId: id, summary: `Deleted draft #${id}`, before: invoice, ...actor }, tx);
    });
  },

  async markViewedByToken(token: string) {
    const invoice = await prisma.invoice.findUnique({ where: { publicToken: token }, include: invoiceInclude });
    if (!invoice || !invoice.issuedAt || invoice.cancelledAt) throw notFound('Invoice');
    if (!invoice.viewedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id: invoice.id }, data: { viewedAt: new Date() } });
        await recalcInvoice(tx, invoice.id);
      });
    }
    return loadInvoice(prisma, invoice.id);
  },

  /** Moves issued, unpaid invoices past their due date to "overdue" and raises alerts. */
  async refreshOverdue(now = new Date()) {
    const candidates = await prisma.invoice.findMany({
      where: {
        issuedAt: { not: null },
        cancelledAt: null,
        status: { notIn: ['paid', 'cancelled', 'overdue'] },
        dueDate: { lt: startOfDay(now) },
        balanceDue: { gt: 0 },
      },
      select: { id: true },
    });
    for (const { id } of candidates) {
      const updated = await prisma.$transaction((tx) => recalcInvoice(tx, id));
      if (updated.status === 'overdue') {
        await raiseAlert({ alertType: 'invoice_overdue', invoiceId: id, message: `${invoiceLabel(updated)} is overdue with ${dec(updated.balanceDue).toFixed(2)} outstanding.` });
        events.emitEvent('invoice.overdue', { invoiceId: id });
      }
    }
    return candidates.length;
  },
};
