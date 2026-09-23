import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Select } from '../components';
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Edit2,
  Eye,
  RefreshCw,
  X,
  Server,
  Zap,
  Info,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface SmtpStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  host: string;
  port: number;
  fromAddress: string;
}

interface SmsStatus {
  provider: string;
  configured: boolean;
  connected: boolean;
  message: string;
  enabled: boolean;
  sandbox: boolean;
  senderId: string;
  balance: any;
}

interface MessageTemplate {
  id: number;
  key: string;
  channel: 'email' | 'sms';
  name: string;
  subject?: string | null;
  body: string;
  isDefault: boolean;
  isActive: boolean;
}

const TEMPLATE_KEYS = [
  { key: 'invoice_sent', label: 'Invoice Issued & Sent' },
  { key: 'payment_received', label: 'Payment Receipt' },
  { key: 'reminder_before_due', label: 'Reminder: Before Due' },
  { key: 'reminder_on_due', label: 'Reminder: On Due Date' },
  { key: 'reminder_overdue', label: 'Reminder: Overdue Notice' },
  { key: 'quotation_sent', label: 'Quotation Dispatched' },
];

export const PROPER_TEMPLATE_NAMES: Record<string, { email: string; sms: string }> = {
  invoice_sent: {
    email: 'Standard Invoice Email',
    sms: 'Invoice Notification SMS',
  },
  payment_received: {
    email: 'Payment Confirmation Email',
    sms: 'Payment Receipt SMS',
  },
  reminder_before_due: {
    email: 'Upcoming Payment Reminder Email',
    sms: 'Upcoming Due Date SMS',
  },
  reminder_on_due: {
    email: 'Payment Due Today Email',
    sms: 'Payment Due Today SMS',
  },
  reminder_overdue: {
    email: 'Overdue Invoice Notice Email',
    sms: 'Overdue Notice SMS',
  },
  quotation_sent: {
    email: 'Quotation Dispatched Email',
    sms: 'Quotation Notification SMS',
  },
};

export function formatTemplateName(t: { key?: string; channel?: string; name?: string }): string {
  const name = (t.name || '').trim();
  const lower = name.toLowerCase();
  if (!name || lower === 'default' || lower === 'invoice send' || lower === 'invoice sent') {
    const channel = (t.channel || 'email') as 'email' | 'sms';
    const key = t.key || 'invoice_sent';
    const byKey = PROPER_TEMPLATE_NAMES[key];
    if (byKey && byKey[channel]) {
      return byKey[channel];
    }
    const cleanKey = key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `${cleanKey} ${channel.toUpperCase()}`;
  }
  return name;
}

const PLACEHOLDERS = [
  '{{client.name}}',
  '{{invoice.number}}',
  '{{invoice.total}}',
  '{{invoice.balance}}',
  '{{invoice.dueDate}}',
  '{{invoice.link}}',
  '{{payment.amount}}',
  '{{payment.balanceLine}}',
  '{{company.name}}',
];

// Check GSM-7 compatibility
const GSM7_EXTENDED_REGEX = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡¿\^{}\\\[~\]|€]*$/;

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [smtp, setSmtp] = useState<SmtpStatus | null>(null);
  const [sms, setSms] = useState<SmsStatus | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms'>('all');

  // Test modals
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false);

  const [testSmsModal, setTestSmsModal] = useState(false);
  const [testSmsTo, setTestSmsTo] = useState('');
  const [isSendingSmsTest, setIsSendingSmsTest] = useState(false);

  // Template editor modal
  const [editingTemplate, setEditingTemplate] = useState<Partial<MessageTemplate> | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Template preview modal
  const [previewData, setPreviewData] = useState<{ channel: 'email' | 'sms'; subject?: string; body: string } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [smtpRes, smsRes, tmplRes] = await Promise.all([
        api.get<SmtpStatus>('/notifications/smtp-status'),
        api.get<SmsStatus>('/notifications/sms-status'),
        api.get<MessageTemplate[]>('/message-templates'),
      ]);
      setSmtp(smtpRes);
      setSms(smsRes);
      setTemplates(tmplRes);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmailTest(true);
    try {
      const res = await api.post<any>('/notifications/test-email', { to: testEmailTo.trim() || undefined });
      showToast(res.message || 'Test email dispatched successfully.');
      setTestEmailModal(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to dispatch test email.', 'error');
    } finally {
      setIsSendingEmailTest(false);
    }
  };

  const handleTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSmsTo.trim()) {
      showToast('Recipient phone number is required.', 'error');
      return;
    }
    setIsSendingSmsTest(true);
    try {
      const res = await api.post<any>('/notifications/test-sms', { to: testSmsTo.trim() });
      showToast(res.message || 'Test SMS dispatched successfully.');
      setTestSmsModal(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to dispatch test SMS.', 'error');
    } finally {
      setIsSendingSmsTest(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate?.key || !editingTemplate?.name || !editingTemplate?.body) {
      showToast('Please fill all required template fields.', 'error');
      return;
    }
    setIsSavingTemplate(true);
    try {
      if (editingTemplate.id) {
        await api.patch(`/message-templates/${editingTemplate.id}`, editingTemplate);
        showToast('Template updated successfully.');
      } else {
        await api.post('/message-templates', editingTemplate);
        showToast('Template created successfully.');
      }
      setEditingTemplate(null);
      void loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save template.', 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handlePreview = async (templateId: number) => {
    try {
      const res = await api.post<any>(`/message-templates/${templateId}/preview`, {});
      setPreviewData(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate preview.', 'error');
    }
  };

  const handlePreviewDraft = async () => {
    if (!editingTemplate?.body?.trim()) return showToast('Add a message body before previewing.', 'error');
    try {
      const result = await api.post<{ channel: 'email' | 'sms'; subject?: string; body: string }>('/message-templates/preview', {
        channel: editingTemplate.channel || 'email', subject: editingTemplate.subject || undefined, body: editingTemplate.body,
      });
      setPreviewData(result);
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate preview.', 'error');
    }
  };

  const handleMakeDefault = async (template: MessageTemplate) => {
    try {
      await api.post(`/message-templates/${template.id}/default`, {});
      showToast(`${template.name} is now used for ${template.channel.toUpperCase()} ${template.key.replaceAll('_', ' ')} messages.`);
      void loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to select template.', 'error');
    }
  };

  const filteredTemplates = useMemo(() => {
    if (channelFilter === 'all') return templates;
    return templates.filter((t) => t.channel === channelFilter);
  }, [templates, channelFilter]);

  // SMS character analysis
  const smsBody = editingTemplate?.channel === 'sms' ? (editingTemplate?.body || '') : '';
  const isGsm7 = useMemo(() => GSM7_EXTENDED_REGEX.test(smsBody), [smsBody]);
  const maxSegmentLen = isGsm7 ? 160 : 70;
  const segments = Math.ceil(smsBody.length / maxSegmentLen) || 1;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 mr-2" />
        <span>Loading notification services & templates…</span>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Message Templates</h1>
            <p className="text-xs text-slate-500 mt-1">
              Customize and manage email & SMS templates for invoices, payment receipts, and reminders.
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw size={14} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Upper Gateway Status Cards (Commented out per user request)
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">SMTP Email Gateway</h2>
                    <p className="text-[11px] text-slate-400">PDF invoices, receipts, and reminder emails</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    smtp?.connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${smtp?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {smtp?.connected ? 'Connected' : smtp?.configured ? 'Configured' : 'Simulated'}
                </span>
              </div>

              <div className="space-y-2 text-xs rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Relay Host:</span>
                  <span className="font-mono font-bold text-slate-800">{smtp?.host || 'smtp.gmail.com'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Port:</span>
                  <span className="font-mono font-bold text-slate-800">{smtp?.port || 587}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">From Address:</span>
                  <span className="font-mono text-slate-800">{smtp?.fromAddress || 'Not set'}</span>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-1">{smtp?.message}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setTestEmailTo(smtp?.fromAddress || '');
                setTestEmailModal(true);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs flex items-center justify-center gap-1.5"
            >
              <Send size={13} />
              <span>Send Test Email</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Arkesel SMS Gateway</h2>
                    <p className="text-[11px] text-slate-400">Ghanaian mobile SMS alerts & payment receipts</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    sms?.connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${sms?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {sms?.connected ? 'Live' : sms?.configured ? 'Configured' : 'Simulated'}
                </span>
              </div>

              <div className="space-y-2 text-xs rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider:</span>
                  <span className="font-bold text-slate-800 capitalize">{sms?.provider || 'Arkesel'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sender ID:</span>
                  <span className="font-mono font-bold text-slate-800">{sms?.senderId || 'LedgerFlow'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SMS Balance:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {sms?.balance ? `${sms.balance.balance ?? sms.balance} units` : 'Simulated mode'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic mt-1">{sms?.message}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setTestSmsTo('');
                setTestSmsModal(true);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs flex items-center justify-center gap-1.5"
            >
              <Send size={13} />
              <span>Send Test SMS</span>
            </button>
          </div>
        </div>
        */}

        {/* Message Templates Section */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Message Templates</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize the messages sent by {user?.companyName || 'your company'}. Each company has its own templates.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
                <button
                  onClick={() => setChannelFilter('all')}
                  className={`px-3 py-1 rounded-lg transition ${channelFilter === 'all' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setChannelFilter('email')}
                  className={`px-3 py-1 rounded-lg transition ${channelFilter === 'email' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'}`}
                >
                  Email
                </button>
                <button
                  onClick={() => setChannelFilter('sms')}
                  className={`px-3 py-1 rounded-lg transition ${channelFilter === 'sms' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'}`}
                >
                  SMS
                </button>
              </div>

              <button
                onClick={() =>
                  setEditingTemplate({
                    key: 'invoice_sent',
                    channel: 'email',
                    name: 'Standard Invoice Email',
                    subject: 'Invoice {{invoice.number}} | {{company.name}}',
                    body: '<p>Hello {{client.name}},</p><p>Your invoice {{invoice.number}} is ready.</p><p><a href="{{invoice.link}}">View invoice</a></p>',
                    isActive: true,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs"
              >
                <Plus size={14} />
                <span>New Template</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTemplates.map((t) => (
              <div key={t.id} className="p-5 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        t.channel === 'email' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.channel}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{formatTemplateName(t)}</span>
                    <span className="font-mono text-[11px] text-slate-400">({t.key.replaceAll('_', ' ')})</span>
                    {t.isDefault && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                        Sending
                      </span>
                    )}
                    {!t.isActive && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">Inactive</span>}
                  </div>
                  {t.subject && <p className="text-xs font-semibold text-slate-600 mt-1 truncate">Subject: {t.subject}</p>}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {t.channel === 'email' ? t.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) : t.body}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!t.isDefault && t.isActive && (
                    <button onClick={() => handleMakeDefault(t)} className="text-[11px] font-semibold text-slate-600 hover:text-amber-700">
                      Use for sending
                    </button>
                  )}
                  <button
                    onClick={() => handlePreview(t.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setEditingTemplate({ ...t, name: formatTemplateName(t) })}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 shadow-xs"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EDIT TEMPLATE MODAL */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingTemplate(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-900">
              {editingTemplate.id ? 'Edit Message Template' : 'Create Message Template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Email bodies use HTML. SMS bodies use plain text. Preview a draft before saving.</p>

            <form onSubmit={handleSaveTemplate} className="my-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Event Key *"
                    value={editingTemplate.key || 'invoice_sent'}
                    onChange={(val) => setEditingTemplate((prev) => ({ ...prev, key: val }))}
                    disabled={Boolean(editingTemplate.id)}
                    searchable
                    options={TEMPLATE_KEYS.map((k) => ({
                      value: k.key,
                      label: `${k.label} (${k.key})`,
                    }))}
                  />
                </div>

                <div>
                  <Select
                    label="Delivery Channel *"
                    value={editingTemplate.channel || 'email'}
                    onChange={(val) =>
                      setEditingTemplate((prev) => ({ ...prev, channel: val as 'email' | 'sms' }))
                    }
                    disabled={Boolean(editingTemplate.id)}
                    options={[
                      { value: 'email', label: 'Email' },
                      { value: 'sms', label: 'SMS' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={editingTemplate.name || ''}
                  onChange={(e) => setEditingTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Default Invoice Email"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={editingTemplate.isActive ?? true} disabled={Boolean(editingTemplate.isDefault)} onChange={(e) => setEditingTemplate((prev) => ({ ...prev, isActive: e.target.checked }))} />
                Active for sending
              </label>
              {editingTemplate.isDefault && <p className="text-[11px] text-slate-500">Choose another sending template before deactivating this one.</p>}

              {editingTemplate.channel === 'email' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={editingTemplate.subject || ''}
                    onChange={(e) => setEditingTemplate((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g. Invoice {{invoice.number}} from {{company.name}}"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Body Content *</label>
                  {editingTemplate.channel === 'sms' && (
                    <span className="font-mono text-[11px] font-bold text-slate-500">
                      {smsBody.length} chars • {segments} SMS ({maxSegmentLen} chars/seg)
                    </span>
                  )}
                </div>

                <textarea
                  required
                  rows={editingTemplate.channel === 'email' ? 16 : 6}
                  value={editingTemplate.body || ''}
                  onChange={(e) => setEditingTemplate((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Type message content..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 font-mono leading-relaxed"
                />

                {/* GSM-7 Safety Warning */}
                {editingTemplate.channel === 'sms' && !isGsm7 && (
                  <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Non-GSM Characters Detected:</span> Using symbols such as the Cedi symbol ('₵') triggers UCS-2 encoding, reducing segment capacity to 70 chars. Consider using 'GHS' instead.
                    </div>
                  </div>
                )}

                {/* Placeholder Helper Pills */}
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Click to insert placeholder
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((ph) => (
                      <button
                        type="button"
                        key={ph}
                        onClick={() =>
                          setEditingTemplate((prev) => ({
                            ...prev,
                            body: (prev?.body || '') + ' ' + ph,
                          }))
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={handlePreviewDraft} className="mr-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Eye size={13} /> Preview draft
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSavingTemplate && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setPreviewData(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Eye size={18} className="text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Rendered Sample Preview</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Sample content for {user?.companyName || 'your company'}; no message will be sent.</p>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              {previewData.subject && (
                <div>
                  <span className="font-bold text-slate-700 block">Subject:</span>
                  <p className="font-medium text-slate-900 mt-0.5">{previewData.subject}</p>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-700 block mb-2">{previewData.channel === 'email' ? 'Email preview' : 'SMS preview'}</span>
                {previewData.channel === 'email' ? (
                  <iframe title="Email template preview" sandbox="" srcDoc={previewData.body} className="h-[520px] w-full rounded-lg border border-slate-200 bg-white" />
                ) : (
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 leading-relaxed">{previewData.body}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setPreviewData(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEST EMAIL MODAL */}
      {testEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setTestEmailModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3">
              <Mail size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Send Test Email</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dispatches a test diagnostic email via configured SMTP relay.</p>

            <form onSubmit={handleTestEmail} className="my-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recipient Email Address</label>
                <input
                  type="email"
                  required
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestEmailModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmailTest}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSendingEmailTest && <Loader2 size={13} className="animate-spin" />}
                  <span>Send Test</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST SMS MODAL */}
      {testSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setTestSmsModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3">
              <MessageSquare size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Send Test SMS</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dispatches a test SMS via Arkesel gateway.</p>

            <form onSubmit={handleTestSms} className="my-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recipient Phone Number *</label>
                <input
                  type="text"
                  required
                  value={testSmsTo}
                  onChange={(e) => setTestSmsTo(e.target.value)}
                  placeholder="233241234567 or 0241234567"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Accepts standard or Ghana local phone format.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestSmsModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingSmsTest}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSendingSmsTest && <Loader2 size={13} className="animate-spin" />}
                  <span>Send Test SMS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
