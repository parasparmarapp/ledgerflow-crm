import { Router } from 'express';
import prisma from '../lib/prisma';
import { ah, parseListQuery } from '../lib/http';
import { requirePermission } from '../auth/permissions';
import { dec, toNum } from '../lib/money';
import { sendCsv } from '../lib/csv';

const router = Router();

/** "Sales" = invoiced value (issued invoices, excludes draft/cancelled), by issueDate. */
router.get(
  '/sales',
  requirePermission('report.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const where: any = { issuedAt: { not: null }, cancelledAt: null };
    if (lq.from || lq.to) where.issueDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const invoices = await prisma.invoice.findMany({ where, orderBy: { issueDate: 'desc' }, include: { client: { select: { name: true } } } });
    if (req.query.format === 'csv') {
      return sendCsv(res, 'sales-report.csv', invoices, [
        ['Invoice #', (r) => r.invoiceNumber], ['Client', (r) => r.client?.name], ['Issue date', (r) => r.issueDate], ['Status', (r) => r.status],
        ['Subtotal', (r) => r.subtotal], ['Discount', (r) => r.discountAmount], ['Tax', (r) => r.taxAmount], ['Total', (r) => r.totalAmount], ['Paid', (r) => r.amountPaid],
      ]);
    }
    res.json(invoices);
  }),
);

/** "Revenue" = cash actually collected (completed/reconciled payments), by paymentDate. */
router.get(
  '/revenue',
  requirePermission('report.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const where: any = { status: { in: ['completed', 'reconciled'] } };
    if (lq.from || lq.to) where.paymentDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const payments = await prisma.payment.findMany({ where, orderBy: { paymentDate: 'desc' }, include: { invoice: { select: { invoiceNumber: true } }, client: { select: { name: true } } } });
    if (req.query.format === 'csv') {
      return sendCsv(res, 'revenue-report.csv', payments, [
        ['Receipt #', (r) => r.receiptNumber], ['Date', (r) => r.paymentDate], ['Client', (r) => r.client?.name], ['Invoice #', (r) => r.invoice?.invoiceNumber], ['Method', (r) => r.method], ['Amount', (r) => r.amount],
      ]);
    }
    // Legacy shape (Invoice[]) for the current chart; totalAmount here is the payment amount.
    res.json(payments.map((p) => ({ id: p.id, invoiceNumber: p.invoice?.invoiceNumber, clientId: p.clientId, issueDate: p.paymentDate, status: p.status, totalAmount: p.amount, method: p.method })));
  }),
);

/** "Profit" = net sales (excl. tax) − COGS − expenses, accrual basis, for the period. */
router.get(
  '/profit',
  requirePermission('report.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const invoiceWhere: any = { issuedAt: { not: null }, cancelledAt: null };
    const expenseWhere: any = {};
    if (lq.from || lq.to) {
      invoiceWhere.issueDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
      expenseWhere.expenseDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    }
    const [lineItems, expenses] = await Promise.all([
      prisma.invoiceLineItem.findMany({ where: { invoice: invoiceWhere }, select: { lineTotal: true, quantity: true, unitCostSnapshot: true } }),
      prisma.expense.findMany({ where: expenseWhere }),
    ]);
    const netSales = lineItems.reduce((sum, l) => sum.plus(l.lineTotal), dec(0));
    const cogs = lineItems.reduce((sum, l) => (l.unitCostSnapshot ? sum.plus(dec(l.unitCostSnapshot).times(l.quantity)) : sum), dec(0));
    const totalExpenses = expenses.reduce((sum, e) => sum.plus(e.amount), dec(0));
    const grossProfit = netSales.minus(cogs);
    const netProfit = grossProfit.minus(totalExpenses);
    const margin = netSales.greaterThan(0) ? netProfit.dividedBy(netSales).times(100).toDecimalPlaces(1).toNumber() : 0;
    const row = { period: lq.from || lq.to ? `${lq.from?.toISOString().slice(0, 10) ?? ''} – ${lq.to?.toISOString().slice(0, 10) ?? ''}` : 'All time', revenue: toNum(netSales), costOfGoods: toNum(cogs), grossProfit: toNum(grossProfit), expenses: toNum(totalExpenses), netProfit: toNum(netProfit), margin };
    res.json({ revenue: row.revenue, costOfGoods: row.costOfGoods, grossProfit: row.grossProfit, expenses: row.expenses, netProfit: row.netProfit, margin, rows: [row], data: [row] });
  }),
);

router.get(
  '/expenses',
  requirePermission('report.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const where: any = {};
    if (lq.from || lq.to) where.expenseDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const expenses = await prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' } });
    if (req.query.format === 'csv') return sendCsv(res, 'expense-report.csv', expenses, [['Date', (r) => r.expenseDate], ['Category', (r) => r.category], ['Vendor', (r) => r.vendor], ['Description', (r) => r.description], ['Amount', (r) => r.amount]]);
    res.json(expenses);
  }),
);

router.get(
  '/payments',
  requirePermission('report.read'),
  ah(async (req, res) => {
    const lq = parseListQuery(req);
    const where: any = {};
    if (lq.from || lq.to) where.paymentDate = { ...(lq.from ? { gte: lq.from } : {}), ...(lq.to ? { lte: lq.to } : {}) };
    const payments = await prisma.payment.findMany({ where, orderBy: { paymentDate: 'desc' } });
    if (req.query.format === 'csv') return sendCsv(res, 'payments-report.csv', payments, [['Receipt #', (r) => r.receiptNumber], ['Date', (r) => r.paymentDate], ['Invoice ID', (r) => r.invoiceId], ['Method', (r) => r.method], ['Amount', (r) => r.amount], ['Status', (r) => r.status]]);
    res.json(payments);
  }),
);

export default router;
