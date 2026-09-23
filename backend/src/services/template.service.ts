import prisma from '../lib/prisma';
import { toNum } from '../lib/money';
import { currentCompanyId } from '../lib/company-context';

type Channel = 'email' | 'sms';
type Template = { key: string; channel: Channel; name: string; subject?: string; body: string };
type Theme = { accent: string; dark: string; pale: string; label: string };

const THEMES: Record<string, Theme> = {
  'brand-it': { accent: '#B45309', dark: '#172033', pale: '#FFF7ED', label: 'BRAND IT COMPANY' },
  stoic: { accent: '#365A79', dark: '#162A3A', pale: '#F0F5F8', label: 'STOIC COMPANY' },
};

const LEGACY_DEFAULTS: Template[] = [
  { key: 'invoice_sent', channel: 'email', name: 'Default', subject: 'Invoice {{invoice.number}} from {{company.name}}', body: '<p>Dear {{client.name}},</p><p>Please find invoice <strong>{{invoice.number}}</strong> for <strong>{{invoice.total}}</strong>, due {{invoice.dueDate}}.</p><p>View it online: {{invoice.link}}</p><p>Thank you for your business.</p><p>{{company.name}}</p>' },
  { key: 'invoice_sent', channel: 'sms', name: 'Default', body: 'Dear {{client.firstName}}, invoice {{invoice.number}} of {{invoice.total}} has been issued. Amount due: {{invoice.balance}} by {{invoice.dueDate}}. Thank you.' },
  { key: 'payment_received', channel: 'email', name: 'Default', subject: 'Payment received — {{invoice.number}}', body: '<p>Dear {{client.name}},</p><p>We received your payment of <strong>{{payment.amount}}</strong> for invoice {{invoice.number}}.</p><p>{{payment.balanceLine}}</p><p>Thank you.</p>' },
  { key: 'payment_received', channel: 'sms', name: 'Default', body: 'Dear {{client.firstName}}, we received your payment of {{payment.amount}} for invoice {{invoice.number}}. {{payment.balanceLine}} Thank you.' },
  { key: 'reminder_before_due', channel: 'email', name: 'Default', subject: 'Upcoming payment — {{invoice.number}}', body: '<p>Dear {{client.name}},</p><p>Invoice {{invoice.number}} for {{invoice.balance}} is due on {{invoice.dueDate}}.</p><p>{{invoice.link}}</p>' },
  { key: 'reminder_before_due', channel: 'sms', name: 'Default', body: 'Reminder: invoice {{invoice.number}} of {{invoice.balance}} is due {{invoice.dueDate}}. Please arrange payment. Thank you.' },
  { key: 'reminder_on_due', channel: 'email', name: 'Default', subject: 'Payment due today — {{invoice.number}}', body: '<p>Dear {{client.name}},</p><p>Invoice {{invoice.number}} for {{invoice.balance}} is due today.</p><p>{{invoice.link}}</p>' },
  { key: 'reminder_on_due', channel: 'sms', name: 'Default', body: 'Invoice {{invoice.number}} of {{invoice.balance}} is due today. Please arrange payment. Thank you.' },
  { key: 'reminder_overdue', channel: 'email', name: 'Default', subject: 'Overdue: {{invoice.number}}', body: '<p>Dear {{client.name}},</p><p>Invoice {{invoice.number}} for {{invoice.balance}} was due {{invoice.dueDate}} and is now overdue.</p><p>{{invoice.link}}</p>' },
  { key: 'reminder_overdue', channel: 'sms', name: 'Default', body: 'Invoice {{invoice.number}} of {{invoice.balance}} was due {{invoice.dueDate}} and is now OVERDUE. Please settle urgently.' },
];

const OLD_FOOTER = 'This message concerns your invoice. If you have already paid, please contact us so we can reconcile your account.';
const CURRENT_FOOTER = 'Questions about this message? Please contact our team and reference the invoice number above.';

function emailLayout(theme: Theme, details: {
  category: string; title: string; intro: string; amountLabel: string; amount: string;
  referenceLabel: string; reference: string; dateLabel?: string; date?: string;
  note: string; cta?: string;
}): string {
  const cell = (label: string, value: string) => `<td style="padding:16px 20px;border-top:1px solid #E6EAF0;vertical-align:top"><div style="color:#66758A;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase">${label}</div><div style="color:${theme.dark};font-size:15px;font-weight:700;margin-top:6px">${value}</div></td>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F5F8;color:${theme.dark};font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${details.title} · ${details.reference}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F3F5F8;padding:28px 12px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#FFFFFF;border:1px solid #E4E9EF;border-radius:16px;overflow:hidden">
<tr><td style="height:7px;background:${theme.accent}"></td></tr>
<tr><td style="padding:28px 32px 17px"><div style="font-size:12px;font-weight:800;letter-spacing:.15em;color:${theme.accent}">${theme.label}</div><div style="font-size:11px;color:#718096;margin-top:7px">A message from {{company.name}}</div></td></tr>
<tr><td style="padding:12px 32px 24px"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:${theme.accent};text-transform:uppercase">${details.category}</div><h1 style="font-size:28px;line-height:1.25;margin:10px 0 16px;color:${theme.dark}">${details.title}</h1><p style="font-size:15px;line-height:1.7;color:#405168;margin:0">Hello {{client.name}},<br>${details.intro}</p></td></tr>
<tr><td style="padding:0 32px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E6EAF0;border-radius:12px;background:${theme.pale}"><tr><td style="padding:19px 20px 17px"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#66758A;text-transform:uppercase">${details.amountLabel}</div><div style="font-size:27px;font-weight:800;color:${theme.dark};margin-top:5px">${details.amount}</div></td></tr><tr>${cell(details.referenceLabel, details.reference)}${details.dateLabel && details.date ? cell(details.dateLabel, details.date) : ''}</tr></table></td></tr>
<tr><td style="padding:23px 32px 27px"><p style="font-size:14px;line-height:1.7;color:#405168;margin:0 0 22px">${details.note}</p>${details.cta ? `<a href="{{invoice.link}}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:${theme.accent};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700">${details.cta}</a><p style="font-size:11px;line-height:1.6;color:#66758A;margin:16px 0 0">Button not working? Open this link: <a href="{{invoice.link}}" style="color:${theme.accent}">{{invoice.link}}</a></p>` : ''}</td></tr>
<tr><td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E6EAF0"><div style="font-size:12px;font-weight:700;color:${theme.dark}">{{company.name}}</div><div style="font-size:11px;line-height:1.6;color:#66758A;margin-top:5px">Questions about this message? Please contact our team and reference the invoice number above.</div></td></tr>
</table></td></tr></table></body></html>`;
}

export function defaultTemplatesForCompany(slug: string): Template[] {
  const theme = THEMES[slug] ?? THEMES['brand-it'];
  const brand = slug === 'brand-it';
  const copy = brand ? {
    invoice: 'Your invoice is ready', invoiceIntro: 'Thanks for working with us. Your invoice is ready to review.',
    paid: 'Payment received', paidIntro: 'Thank you. We have recorded your payment and updated your invoice.',
    before: 'A payment date is coming up', beforeIntro: 'A quick reminder that the following invoice is due soon.',
    due: 'Your payment is due today', dueIntro: 'The following invoice reaches its payment date today.',
    overdue: 'Your invoice needs attention', overdueIntro: 'Our records show that the following invoice remains unpaid after its due date.',
  } : {
    invoice: 'Invoice issued', invoiceIntro: 'We have issued the invoice below for your records and review.',
    paid: 'Payment confirmed', paidIntro: 'Your payment has been recorded against the invoice below.',
    before: 'Upcoming invoice due date', beforeIntro: 'Please review the invoice below ahead of its scheduled due date.',
    due: 'Invoice due today', dueIntro: 'The payment date for the invoice below is today.',
    overdue: 'Outstanding invoice notice', overdueIntro: 'The invoice below remains outstanding after its scheduled due date.',
  };
  const email = (key: string, name: string, subject: string, details: Parameters<typeof emailLayout>[1]): Template => ({
    key, channel: 'email', name, subject, body: emailLayout(theme, details),
  });
  const sms = (key: string, name: string, body: string): Template => ({ key, channel: 'sms', name, body });
  return [
    email('invoice_sent', 'Standard Invoice Email', 'Invoice {{invoice.number}} | {{company.name}}', { category: 'Invoice issued', title: copy.invoice, intro: copy.invoiceIntro, amountLabel: 'Invoice total', amount: '{{invoice.total}}', referenceLabel: 'Invoice number', reference: '{{invoice.number}}', dateLabel: 'Due date', date: '{{invoice.dueDate}}', note: 'You can view the full invoice, including its line items and payment details, using the button below.', cta: 'View invoice' }),
    sms('invoice_sent', 'Invoice Notification SMS', '{{company.name}}: Invoice {{invoice.number}} for {{invoice.total}} is ready. Due {{invoice.dueDate}}. View: {{invoice.link}}'),
    email('payment_received', 'Payment Receipt Email', 'Payment received for {{invoice.number}} | {{company.name}}', { category: 'Payment confirmation', title: copy.paid, intro: copy.paidIntro, amountLabel: 'Payment received', amount: '{{payment.amount}}', referenceLabel: 'Invoice number', reference: '{{invoice.number}}', note: '{{payment.balanceLine}} Please keep this message for your records.', cta: 'View invoice' }),
    sms('payment_received', 'Payment Receipt SMS', '{{company.name}}: Payment of {{payment.amount}} received for {{invoice.number}}. {{payment.balanceLine}}'),
    email('reminder_before_due', 'Upcoming Payment Reminder Email', 'Upcoming payment for {{invoice.number}} | {{company.name}}', { category: 'Payment reminder', title: copy.before, intro: copy.beforeIntro, amountLabel: 'Amount outstanding', amount: '{{invoice.balance}}', referenceLabel: 'Invoice number', reference: '{{invoice.number}}', dateLabel: 'Due date', date: '{{invoice.dueDate}}', note: 'Please review the invoice and arrange payment by the due date. If payment is already on its way, thank you.', cta: 'Review invoice' }),
    sms('reminder_before_due', 'Upcoming Payment Reminder SMS', '{{company.name}} reminder: {{invoice.number}} has {{invoice.balance}} due {{invoice.dueDate}}. View: {{invoice.link}}'),
    email('reminder_on_due', 'Payment Due Today Email', 'Payment due today: {{invoice.number}} | {{company.name}}', { category: 'Due today', title: copy.due, intro: copy.dueIntro, amountLabel: 'Amount due', amount: '{{invoice.balance}}', referenceLabel: 'Invoice number', reference: '{{invoice.number}}', dateLabel: 'Due date', date: '{{invoice.dueDate}}', note: 'Please arrange payment today. If you have already paid, you can disregard this reminder.', cta: 'View invoice' }),
    sms('reminder_on_due', 'Payment Due Today SMS', '{{company.name}}: {{invoice.number}} for {{invoice.balance}} is due today. View: {{invoice.link}}'),
    email('reminder_overdue', 'Overdue Notice Email', 'Action requested: overdue invoice {{invoice.number}} | {{company.name}}', { category: 'Overdue notice', title: copy.overdue, intro: copy.overdueIntro, amountLabel: 'Amount outstanding', amount: '{{invoice.balance}}', referenceLabel: 'Invoice number', reference: '{{invoice.number}}', dateLabel: 'Original due date', date: '{{invoice.dueDate}}', note: 'Please arrange payment or contact us if there is a problem with this invoice. If you have already paid, please send us the payment details.', cta: 'Review invoice' }),
    sms('reminder_overdue', 'Overdue Notice SMS', '{{company.name}}: {{invoice.number}} for {{invoice.balance}} was due {{invoice.dueDate}}. Please arrange payment or contact us. {{invoice.link}}'),
  ];
}

/** Seed each company's design and upgrade only untouched legacy defaults. */
export async function ensureDefaultTemplates() {
  const companyId = currentCompanyId();
  if (!companyId) throw new Error('Company context is required to initialize message templates.');
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  if (!company) throw new Error('Company not found.');
  
  const defaults = defaultTemplatesForCompany(company.slug);

  // Upgrade any existing generic names ("Default", "Invoice send", "Invoice Sent")
  for (const next of defaults) {
    const genericExisting = await prisma.messageTemplate.findFirst({
      where: {
        companyId,
        key: next.key,
        channel: next.channel,
        name: { in: ['Default', 'Invoice send', 'Invoice Sent'] },
      },
    });
    if (genericExisting) {
      await prisma.messageTemplate.update({
        where: { id: genericExisting.id },
        data: { name: next.name },
      });
    }

    const key = { companyId, key: next.key, channel: next.channel, name: next.name };
    const existing = await prisma.messageTemplate.findUnique({ where: { companyId_key_channel_name: key } });
    if (!existing) {
      await prisma.messageTemplate.create({ data: { ...next, isDefault: true } });
      continue;
    }
    const legacy = LEGACY_DEFAULTS.find((item) => item.key === next.key && item.channel === next.channel);
    const untouchedLegacy = legacy && existing.body === legacy.body && existing.subject === (legacy.subject ?? null);
    const untouchedPreviousDesign = existing.body === next.body.replace(CURRENT_FOOTER, OLD_FOOTER) && existing.subject === (next.subject ?? null);
    if (untouchedLegacy || untouchedPreviousDesign) {
      await prisma.messageTemplate.update({ where: { id: existing.id }, data: { body: next.body, subject: next.subject ?? null } });
    }
  }
  // A legacy duplicate from the original demo seed is preserved but no longer wins delivery.
  await prisma.messageTemplate.updateMany({
    where: {
      key: 'invoice_sent', channel: 'email', name: 'Invoice Issued', isDefault: true,
      body: 'Dear {{client.name}}, Please find invoice {{invoice.number}} for {{invoice.total}}, due {{invoice.dueDate}}.View it online: {{invoice.link}}. \nThank you for your business.{{company.name}}',
    },
    data: { isDefault: false },
  });
}

/** {{a.b}} substitution; unknown keys resolve to ''. */
export function renderTemplate(text: string, data: Record<string, unknown>, escapeHtml = false): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const value = path.split('.').reduce<any>((acc: any, key: string) => (acc && typeof acc === 'object' ? acc[key] : undefined), data);
    const result = value === undefined || value === null ? '' : String(value);
    return escapeHtml ? result.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!) : result;
  });
}

export function formatGhs(value: unknown): string {
  return `GHS ${toNum(value as any).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
