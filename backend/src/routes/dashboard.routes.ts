import { Router } from 'express';
import prisma from '../lib/prisma';
import { ah, parseListQuery } from '../lib/http';
import { dec, toNum } from '../lib/money';

const router = Router();

router.get(
  '/summary',
  ah(async (req, res) => {
    const userRole = (req.user?.role || 'staff') as string;
    const isAdmin = userRole === 'admin';

    const now = new Date();
    const lq = parseListQuery(req);

    // Date filters if provided
    const invDateFilter: any = {};
    const payDateFilter: any = {};
    if (lq.from || lq.to) {
      invDateFilter.issueDate = {
        ...(lq.from ? { gte: lq.from } : {}),
        ...(lq.to ? { lte: lq.to } : {}),
      };
      payDateFilter.paymentDate = {
        ...(lq.from ? { gte: lq.from } : {}),
        ...(lq.to ? { lte: lq.to } : {}),
      };
    }

    // 1. Financial aggregations
    const salesAgg = await prisma.invoice.aggregate({
      where: {
        issuedAt: { not: null },
        cancelledAt: null,
        ...invDateFilter,
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const paymentsAgg = await prisma.payment.aggregate({
      where: {
        status: { in: ['completed', 'reconciled'] },
        ...payDateFilter,
      },
      _sum: { amount: true },
      _count: true,
    });

    // 2. Open / outstanding invoices for aging buckets
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        issuedAt: { not: null },
        cancelledAt: null,
        balanceDue: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        balanceDue: true,
        totalAmount: true,
        status: true,
      },
    });

    // 3. Low stock inventory items
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { isArchived: false },
      include: { product: true },
    });

    const lowStockItems = inventoryItems
      .filter((item) => dec(item.quantityOnHand).lte(dec(item.reorderThreshold)))
      .map((item) => ({
        id: item.id,
        productId: item.productServiceId,
        name: item.product.name,
        sku: item.product.sku,
        quantityOnHand: toNum(item.quantityOnHand),
        reorderThreshold: toNum(item.reorderThreshold),
        unitCost: toNum(item.unitCost),
      }));

    // 4. Recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true } } },
    });

    // 5. Recent payments
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });

    // 6. Active clients count
    const activeClientsCount = await prisma.client.count({ where: { isActive: true } });

    // 7. Compute Aging Buckets
    const aging = {
      current: { count: 0, total: dec(0) }, // 0 to 30 days overdue
      days31to60: { count: 0, total: dec(0) },
      days61to90: { count: 0, total: dec(0) },
      days90plus: { count: 0, total: dec(0) },
    };

    let totalOutstanding = dec(0);
    let totalOverdue = dec(0);

    for (const inv of outstandingInvoices) {
      const bal = dec(inv.balanceDue);
      totalOutstanding = totalOutstanding.plus(bal);

      const due = new Date(inv.dueDate);
      const diffTime = now.getTime() - due.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        totalOverdue = totalOverdue.plus(bal);
      }

      if (diffDays <= 30) {
        aging.current.count += 1;
        aging.current.total = aging.current.total.plus(bal);
      } else if (diffDays <= 60) {
        aging.days31to60.count += 1;
        aging.days31to60.total = aging.days31to60.total.plus(bal);
      } else if (diffDays <= 90) {
        aging.days61to90.count += 1;
        aging.days61to90.total = aging.days61to90.total.plus(bal);
      } else {
        aging.days90plus.count += 1;
        aging.days90plus.total = aging.days90plus.total.plus(bal);
      }
    }

    const summaryData = {
      role: userRole,
      isAdmin,
      financials: {
        totalSales: toNum(salesAgg._sum.totalAmount ?? 0),
        invoicesCount: salesAgg._count,
        cashCollected: toNum(paymentsAgg._sum.amount ?? 0),
        paymentsCount: paymentsAgg._count,
        totalOutstanding: toNum(totalOutstanding),
        totalOverdue: toNum(totalOverdue),
        activeClientsCount,
      },
      aging: {
        current: { count: aging.current.count, total: toNum(aging.current.total) },
        days31to60: { count: aging.days31to60.count, total: toNum(aging.days31to60.total) },
        days61to90: { count: aging.days61to90.count, total: toNum(aging.days61to90.total) },
        days90plus: { count: aging.days90plus.count, total: toNum(aging.days90plus.total) },
      },
      lowStockItems,
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv.id}`,
        clientName: inv.client?.name || 'Unknown Client',
        clientId: inv.clientId,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        totalAmount: toNum(inv.totalAmount),
        balanceDue: toNum(inv.balanceDue ?? 0),
        status: inv.status,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber || `PAY-${p.id}`,
        clientName: p.client?.name || 'Unknown Client',
        clientId: p.clientId,
        invoiceNumber: p.invoice?.invoiceNumber,
        paymentDate: p.paymentDate,
        amount: toNum(p.amount),
        method: p.method,
        status: p.status,
      })),
    };

    res.json(summaryData);
  })
);

export default router;
