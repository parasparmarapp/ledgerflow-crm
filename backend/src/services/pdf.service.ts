import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { dec, toNum } from '../lib/money';
import { formatGhs, formatDateShort } from './template.service';
import { getSettings } from './settings.service';
import prisma from '../lib/prisma';
import { notFound } from '../lib/errors';
import { invoiceLabel } from './invoice.service';

function header(doc: PDFKit.PDFDocument, title: string, companyName: string) {
  doc.fontSize(18).fillColor('#0f172a').text(companyName, { continued: false });
  doc.moveDown(0.2);
  doc.fontSize(20).fillColor('#b45309').text(title);
  doc.moveDown();
  doc.strokeColor('#e2e8f0').moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown();
  doc.fillColor('#0f172a');
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(9).fillColor('#64748b').text(label, { continued: true }).fillColor('#0f172a').text(`  ${value}`);
}

export async function streamInvoicePdf(res: Response, invoiceId: number) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true, lineItems: { orderBy: { sortOrder: 'asc' } } } });
  if (!invoice) throw notFound('Invoice');
  const settings = await getSettings();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoiceLabel(invoice)}.pdf"`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  header(doc, `Invoice ${invoiceLabel(invoice)}`, settings.companyName);
  doc.fontSize(10);
  kv(doc, 'Status:', invoice.status.replace(/_/g, ' ').toUpperCase());
  kv(doc, 'Issue date:', formatDateShort(invoice.issueDate));
  kv(doc, 'Due date:', formatDateShort(invoice.dueDate));
  doc.moveDown(0.5);
  kv(doc, 'Bill to:', invoice.client.companyName ? `${invoice.client.name} (${invoice.client.companyName})` : invoice.client.name);
  if (invoice.client.billingAddress) kv(doc, 'Address:', invoice.client.billingAddress);
  doc.moveDown();

  const colX = [50, 280, 340, 410, 480];
  doc.fontSize(9).fillColor('#64748b');
  doc.text('Description', colX[0], doc.y, { width: 220 });
  doc.text('Qty', colX[1], doc.y - doc.currentLineHeight(), { width: 50, align: 'right' });
  doc.text('Unit price', colX[2], doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
  doc.text('Tax', colX[3], doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
  doc.text('Total', colX[4], doc.y - doc.currentLineHeight(), { width: 70, align: 'right' });
  doc.moveDown(0.5);
  doc.strokeColor('#e2e8f0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  doc.fillColor('#0f172a').fontSize(9);
  for (const line of invoice.lineItems) {
    const y = doc.y;
    doc.text(line.description, colX[0], y, { width: 220 });
    doc.text(dec(line.quantity).toString(), colX[1], y, { width: 50, align: 'right' });
    doc.text(formatGhs(line.unitPrice), colX[2], y, { width: 60, align: 'right' });
    doc.text(`${dec(line.taxRate).toFixed(1)}%`, colX[3], y, { width: 60, align: 'right' });
    doc.text(formatGhs(dec(line.lineTotal).plus(line.taxAmount)), colX[4], y, { width: 70, align: 'right' });
    doc.moveDown(0.6);
  }

  doc.moveDown(0.5);
  doc.strokeColor('#e2e8f0').moveTo(320, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  const totalsRow = (label: string, value: string, bold = false) => {
    doc.fontSize(bold ? 11 : 9).fillColor(bold ? '#0f172a' : '#64748b');
    doc.text(label, 320, doc.y, { width: 130, continued: false });
    doc.fontSize(bold ? 11 : 9).fillColor('#0f172a').text(value, 410, doc.y - doc.currentLineHeight(), { width: 135, align: 'right' });
  };
  totalsRow('Subtotal', formatGhs(invoice.subtotal));
  totalsRow('Discount', formatGhs(invoice.discountAmount));
  totalsRow('Tax', formatGhs(invoice.taxAmount));
  totalsRow('Total', formatGhs(invoice.totalAmount), true);
  totalsRow('Paid', formatGhs(invoice.amountPaid));
  totalsRow('Balance due', formatGhs(invoice.balanceDue), true);

  if (invoice.notes) {
    doc.moveDown(1.5).fontSize(9).fillColor('#64748b').text('Notes', 50).fillColor('#0f172a').text(invoice.notes, { width: 495 });
  }
  if (invoice.terms) {
    doc.moveDown(0.8).fontSize(9).fillColor('#64748b').text('Terms & conditions', 50).fillColor('#0f172a').text(invoice.terms, { width: 495 });
  }
  doc.end();
}

export async function streamReceiptPdf(res: Response, paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { client: true, invoice: true } });
  if (!payment) throw notFound('Payment');
  const settings = await getSettings();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payment.receiptNumber || 'receipt'}.pdf"`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  header(doc, `Receipt ${payment.receiptNumber || `#${payment.id}`}`, settings.companyName);
  doc.fontSize(10);
  kv(doc, 'Received from:', payment.client.companyName ? `${payment.client.name} (${payment.client.companyName})` : payment.client.name);
  kv(doc, 'Invoice:', invoiceLabel(payment.invoice));
  kv(doc, 'Date:', formatDateShort(payment.paymentDate));
  kv(doc, 'Method:', payment.method.replace(/_/g, ' '));
  if (payment.reference) kv(doc, 'Reference:', payment.reference);
  doc.moveDown();
  doc.fontSize(16).fillColor('#0f172a').text(`Amount paid: ${formatGhs(payment.amount)}`, { align: 'left' });
  doc.moveDown();
  const balance = toNum(payment.invoice.balanceDue);
  doc.fontSize(10).fillColor('#64748b').text(balance > 0 ? `Remaining balance on this invoice: ${formatGhs(balance)}.` : 'This invoice is fully paid.');
  doc.end();
}
