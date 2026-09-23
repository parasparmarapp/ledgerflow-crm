import type { Client } from '../types';
import React, { useMemo, useState, useEffect } from 'react';
import { useClients } from '../hooks';
import { api } from '../lib/api';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ClientImportModal } from '../components/ClientImportModal';
import { DateRangeFilter, TablePagination } from '../components';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Filter,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
  Activity as ActivityIcon,
  Upload,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function initials(value?: string) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

export default function ClientListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clients, loading, error, refresh } = useClients();

  const [showImportModal, setShowImportModal] = useState(() => searchParams.get('import') === 'true');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveConflictMsg, setArchiveConflictMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const handleCloseImport = () => {
    setShowImportModal(false);
    if (searchParams.get('import')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('import');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const clientList = Array.isArray(clients) ? clients : [];

  // Query backend whenever search or status filter changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh({
        search: search.trim() || undefined,
        active: statusFilter === 'all' ? undefined : String(statusFilter === 'active'),
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter, refresh]);

  const filteredClients = useMemo(() => {
    return clientList.filter((client) => {
      const clientDateStr = client?.createdAt ? String(client.createdAt).slice(0, 10) : '';
      const matchesDate =
        (!startDate || (clientDateStr && clientDateStr >= startDate)) &&
        (!endDate || (clientDateStr && clientDateStr <= endDate));

      return matchesDate;
    });
  }, [clientList, startDate, endDate]);

  const paginatedClients = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredClients.slice(start, start + PAGE_SIZE);
  }, [filteredClients, page]);

  const activeCount = clientList.filter((client) => client?.isActive).length;
  const inactiveCount = clientList.length - activeCount;

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/clients/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Client export downloaded.', 'success');
    } catch {
      showToast('Failed to export clients.', 'error');
    }
  };

  const handleArchive = async (force = false) => {
    if (!selectedClient) return;
    setPending(true);
    try {
      await api.post(`/clients/${selectedClient.id}/archive${force ? '?force=true' : ''}`, {});
      setShowArchiveModal(false);
      setSelectedClient(null);
      setArchiveConflictMsg(null);
      showToast(`Client "${selectedClient.name}" archived.`);
      await refresh();
    } catch (err: any) {
      if (err?.code === 'CLIENT_HAS_OPEN_INVOICES' || err?.message?.includes('open invoice')) {
        setArchiveConflictMsg(err?.message || 'This client has open invoices.');
      } else {
        showToast(err?.message || 'Failed to archive client.', 'error');
      }
    } finally {
      setPending(false);
    }
  };

  const handleRestore = async (client: Client) => {
    setPending(true);
    try {
      await api.post(`/clients/${client.id}/restore`, {});
      showToast(`Client "${client.name}" restored.`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to restore client.', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'error'
                  ? 'bg-rose-600'
                  : 'bg-indigo-600'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md p-1 transition hover:bg-white/10"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <Users size={16} />
                <span>CRM Workspace</span>
                <ChevronRight size={15} />
                <span className="text-slate-700">Clients</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your customer database, communication preferences, and account history.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download size={17} />
                Import CSV
              </button>
              <Link
                to="/create-client"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                <Plus size={18} />
                Add Client
              </Link>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Total Clients</p>
                <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
                  <Users size={18} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900">{clientList.length}</p>
              <p className="mt-1 text-xs text-slate-500">All registered clients</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Active Clients</p>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <ActivityIcon size={18} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900">{activeCount}</p>
              <p className="mt-1 text-xs text-slate-500">Eligible for billing & notifications</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Archived Clients</p>
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                  <Users size={18} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900">{inactiveCount}</p>
              <p className="mt-1 text-xs text-slate-500">Deactivated / archived records</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, company, email, phone..."
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${showFilters
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Filter size={16} />
                  Filters
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  title="Export clients to CSV"
                >
                  <Upload size={16} />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refresh();
                    showToast('Client list refreshed.', 'info');
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">Status</span>
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setStatusFilter(status);
                        setPage(1);
                      }}
                      className={`min-h-[36px] rounded-xl px-3.5 text-sm font-medium capitalize transition ${statusFilter === status
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(from, to) => {
                    setStartDate(from);
                    setEndDate(to);
                    setPage(1);
                  }}
                />
              </div>
            )}

            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <AlertCircle className="text-rose-500" size={30} />
                <h2 className="mt-3 font-semibold text-slate-900">Unable to load clients</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">{String(error)}</p>
                <button
                  type="button"
                  onClick={() => {
                    void refresh();
                  }}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="rounded-2xl bg-rose-50 p-4 text-rose-600">
                  <Users size={28} />
                </div>
                <h2 className="mt-4 font-semibold text-slate-900">
                  {clientList.length === 0 ? 'No clients yet' : 'No matching clients'}
                </h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {clientList.length === 0
                    ? 'Add your first client to start creating invoices and quotes.'
                    : 'Try adjusting your search query or status filter.'}
                </p>
                {clientList.length === 0 && (
                  <Link
                    to="/create-client"
                    className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                  >
                    <Plus size={17} />
                    Add Client
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="border-b border-slate-200/80 bg-slate-50/70">
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Contact
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Segment
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Preferences
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Added
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedClients.map((client) => (
                      <tr key={client.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <Link
                            to={`/client-profile?id=${client.id}`}
                            className="flex items-center gap-3 text-left group"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-sm font-bold text-rose-700">
                              {initials(client?.name)}
                            </span>
                            <div>
                              <span className="block font-semibold text-slate-900 group-hover:text-amber-700">
                                {client?.name || 'Unnamed client'}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {client?.companyName || 'Independent client'}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5 text-xs text-slate-600">
                            {client?.email ? (
                              <div className="flex items-center gap-1.5">
                                <Mail size={13} className="text-slate-400" />
                                <span>{client.email}</span>
                              </div>
                            ) : null}
                            {client?.phone ? (
                              <div className="text-slate-500">{client.phone}</div>
                            ) : null}
                            {!client?.email && !client?.phone && <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {client?.segment ? (
                            <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {client.segment}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {client?.smsOptOut && (
                              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800">
                                SMS Off
                              </span>
                            )}
                            {client?.emailOptOut && (
                              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800">
                                Email Off
                              </span>
                            )}
                            {!client?.smsOptOut && !client?.emailOptOut && (
                              <span className="text-xs text-slate-400">Default</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${client?.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                              }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${client?.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                            />
                            {client?.isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(client?.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/client-profile?id=${client.id}`}
                              title="View Profile"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Eye size={17} />
                            </Link>
                            <Link
                              to={`/edit-client?id=${client.id}`}
                              title="Edit Client"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit size={16} />
                            </Link>
                            {client.isActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClient(client);
                                  setArchiveConflictMsg(null);
                                  setShowArchiveModal(true);
                                }}
                                title="Archive Client"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestore(client)}
                                title="Restore Client"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <TablePagination
              currentPage={page}
              totalItems={filteredClients.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="clients"
            />
          </div>
        </div>
      </div>

      {/* Archive Modal with conflict resolution */}
      {showArchiveModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                if (!pending) setShowArchiveModal(false);
              }}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Archive Client</h3>
                <p className="text-xs text-slate-500">Deactivate client account</p>
              </div>
            </div>

            {archiveConflictMsg ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Open Invoices Notice:</span>
                    <p className="mt-1 text-xs text-amber-800">{archiveConflictMsg}</p>
                    <p className="mt-2 text-xs font-medium text-amber-900">
                      Archiving anyway will not delete the invoices, but this client will no longer appear active in selectors.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-5">
                Are you sure you want to archive <strong>{selectedClient.name}</strong>? Existing invoices and payment history will be preserved.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                disabled={pending}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {archiveConflictMsg ? (
                <button
                  type="button"
                  onClick={() => handleArchive(true)}
                  disabled={pending}
                  className="min-h-[40px] rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {pending ? 'Archiving...' : 'Force Archive'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleArchive(false)}
                  disabled={pending}
                  className="min-h-[40px] rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {pending ? 'Archiving...' : 'Archive Client'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <ClientImportModal
        isOpen={showImportModal}
        onClose={handleCloseImport}
        onSuccess={() => {
          refresh();
          showToast('Clients imported successfully!');
        }}
      />
    </>
  );
}