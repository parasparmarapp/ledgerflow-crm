import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import type { Client, ClientContact, Invoice, Payment } from '../types';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
  AlertCircle,
  BellOff,
  Star,
  Download,
} from 'lucide-react';

interface ClientSummary {
  totalInvoiced: number;
  invoiceCount: number;
  outstandingBalance: number;
  totalPaid: number;
  lastPaymentDate: string | null;
}

interface CommLogItem {
  id: number;
  channel: string;
  recipient: string;
  subject?: string;
  status: string;
  createdAt: string;
}

function formatDate(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClientProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = Number(searchParams.get('id'));

  const [client, setClient] = useState<Client | null>(null);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [comms, setComms] = useState<CommLogItem[]>([]);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'invoices' | 'payments' | 'contacts' | 'comms'
  >('overview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: false,
  });
  const [contactPending, setContactPending] = useState(false);

  const loadClientData = async () => {
    if (!clientId) {
      setError('No client ID specified.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [c, s, inv, pay, cnt, com] = await Promise.all([
        api.get<Client>(`/clients/${clientId}`),
        api.get<ClientSummary>(`/clients/${clientId}/summary`),
        api.get<Invoice[]>(`/clients/${clientId}/invoices`),
        api.get<Payment[]>(`/clients/${clientId}/payments`),
        api.get<ClientContact[]>(`/clients/${clientId}/contacts`),
        api.get<CommLogItem[]>(`/clients/${clientId}/communications`),
      ]);
      setClient(c);
      setSummary(s);
      setInvoices(inv);
      setPayments(pay);
      setContacts(cnt);
      setComms(com);
    } catch (err: any) {
      setError(err?.message || 'Failed to load client profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;

    setContactPending(true);
    try {
      if (editingContact) {
        await api.patch(`/clients/${clientId}/contacts/${editingContact.id}`, contactForm);
      } else {
        await api.post(`/clients/${clientId}/contacts`, contactForm);
      }
      setShowContactModal(false);
      setEditingContact(null);
      // Refresh contacts
      const updated = await api.get<ClientContact[]>(`/clients/${clientId}/contacts`);
      setContacts(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to save contact');
    } finally {
      setContactPending(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await api.delete(`/clients/${clientId}/contacts/${contactId}`);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete contact');
    }
  };

  const openAddContact = () => {
    setEditingContact(null);
    setContactForm({
      name: '',
      email: '',
      phone: '',
      designation: '',
      isPrimary: contacts.length === 0,
    });
    setShowContactModal(true);
  };

  const openEditContact = (c: ClientContact) => {
    setEditingContact(c);
    setContactForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      designation: c.designation || '',
      isPrimary: Boolean(c.isPrimary),
    });
    setShowContactModal(true);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500 font-medium">Loading client profile...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold">Client Not Found</h2>
              <p className="text-sm mt-1 text-rose-700">{error || 'This client does not exist or has been removed.'}</p>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Clients
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="mb-2 inline-flex min-h-[36px] items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              All Clients
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 text-xl font-bold">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {client.name}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      client.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        client.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {client.isActive ? 'Active' : 'Archived'}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {client.companyName ? `${client.companyName} • ` : ''}Client #{client.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/create-invoice?clientId=${client.id}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              <FileText className="h-4 w-4" />
              New Invoice
            </Link>
            <Link
              to={`/edit-client?id=${client.id}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Edit className="h-4 w-4 text-slate-500" />
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-slate-200 bg-white rounded-2xl px-4 shadow-sm">
          <nav className="flex space-x-6 overflow-x-auto">
            {(
              [
                { id: 'overview', label: 'Overview & KPIs' },
                { id: 'invoices', label: `Invoices (${invoices.length})` },
                { id: 'payments', label: `Payments (${payments.length})` },
                { id: 'contacts', label: `Contacts (${contacts.length})` },
                { id: 'comms', label: `Communications (${comms.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`border-b-2 py-4 text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === t.id
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Invoiced
                  </span>
                  <FileText className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.totalInvoiced ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Across {summary?.invoiceCount ?? 0} invoices
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Outstanding Balance
                  </span>
                  <DollarSign className="h-5 w-5 text-rose-500" />
                </div>
                <p
                  className={`mt-3 text-2xl font-bold ${
                    (summary?.outstandingBalance ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(summary?.outstandingBalance ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Current unpaid receivables</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Collected
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-emerald-700">
                  {formatCurrency(summary?.totalPaid ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Completed payments</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Last Payment
                  </span>
                  <Calendar className="h-5 w-5 text-amber-500" />
                </div>
                <p className="mt-3 text-xl font-bold text-slate-900">
                  {formatDate(summary?.lastPaymentDate)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Most recent payment date</p>
              </div>
            </div>

            {/* Info details */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Contact & Identity */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                  Contact Information
                </h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Email
                    </dt>
                    <dd className="mt-1 text-slate-900">{client.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Phone
                    </dt>
                    <dd className="mt-1 text-slate-900">{client.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Segment / Tag
                    </dt>
                    <dd className="mt-1 text-slate-900">{client.segment || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Tax Identifier
                    </dt>
                    <dd className="mt-1 text-slate-900">{client.taxIdentifier || '—'}</dd>
                  </div>
                </dl>

                {/* Opt-out tags */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Notification Preferences
                  </span>
                  <div className="flex gap-2">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        client.smsOptOut
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      SMS: {client.smsOptOut ? 'Opted Out' : 'Active'}
                    </span>
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        client.emailOptOut
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      Email: {client.emailOptOut ? 'Opted Out' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
                  Address Details
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Billing Address
                    </span>
                    <p className="mt-1 text-slate-800 whitespace-pre-line">
                      {client.billingAddress || 'No billing address provided.'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Shipping Address
                    </span>
                    <p className="mt-1 text-slate-800 whitespace-pre-line">
                      {client.shippingAddress || 'No shipping address provided.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">Internal Notes</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {client.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INVOICES */}
        {activeTab === 'invoices' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Client Invoices</h3>
              <Link
                to={`/create-invoice?clientId=${client.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Plus size={14} />
                Create Invoice
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No invoices found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Invoice #</th>
                      <th className="px-5 py-3.5">Issue Date</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5 text-right">Total</th>
                      <th className="px-5 py-3.5 text-right">Balance Due</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          <Link
                            to={`/invoice-details?id=${inv.id}`}
                            className="hover:text-rose-600"
                          >
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(inv.issueDate)}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(inv.dueDate)}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-900">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-rose-600">
                          {formatCurrency(inv.balanceDue ?? 0)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.status === 'overdue'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/invoice-details?id=${inv.id}`}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                          >
                            View &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Payment Receipts</h3>
            </div>
            {payments.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No payments recorded for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Receipt #</th>
                      <th className="px-5 py-3.5">Payment Date</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5">Reference</th>
                      <th className="px-5 py-3.5 text-right">Amount</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {p.receiptNumber || `PAY-${p.id}`}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(p.paymentDate)}</td>
                        <td className="px-5 py-3.5 text-slate-600 capitalize">
                          {p.paymentMethod?.replace('_', ' ') || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">
                          {p.transactionReference || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              p.status === 'completed' || p.status === 'reconciled'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/payments?id=${p.id}`}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                          >
                            Receipt &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONTACTS CRUD */}
        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Client Contacts Directory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Individual stakeholder contacts for this client organization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddContact}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                >
                  <UserPlus size={16} />
                  Add Contact
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  No specific contacts added yet. Click &quot;Add Contact&quot; to register billing or
                  operational representatives.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 bg-white"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-900 text-sm">{c.name}</h4>
                              {c.isPrimary && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  <Star size={10} className="fill-amber-600 text-amber-600" />
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {c.designation || 'Representative'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditContact(c)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        {c.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {!c.email && !c.phone && (
                          <span className="text-slate-400 italic">No direct contact details</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: COMMUNICATIONS */}
        {activeTab === 'comms' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Communication & Notification History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of emails, SMS dispatches, and automated payment reminders sent to this client.
              </p>
            </div>
            {comms.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No communications have been dispatched to this client yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Channel</th>
                      <th className="px-5 py-3.5">Recipient</th>
                      <th className="px-5 py-3.5">Subject / Content</th>
                      <th className="px-5 py-3.5">Dispatched</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comms.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase ${
                              log.channel === 'sms'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {log.channel === 'sms' ? <Phone size={12} /> : <Mail size={12} />}
                            {log.channel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                          {log.recipient}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-800">
                          {log.subject || 'Standard Transaction Notification'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              log.status === 'sent' || log.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  value={contactForm.designation}
                  onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                  placeholder="e.g. Finance Director, Procurement Lead"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="jane@client.com"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+233 24 000 0000"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-slate-700">Set as Primary Contact</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactPending}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {contactPending ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}