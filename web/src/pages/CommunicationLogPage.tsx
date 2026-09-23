import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Select, TablePagination, DateRangeFilter } from '../components';
import {
  Mail,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface NotificationLog {
  id: number;
  channel: 'email' | 'sms';
  event: string;
  recipient: string;
  subject?: string | null;
  body: string;
  clientId?: number | null;
  invoiceId?: number | null;
  status: string;
  providerMessageId?: string | null;
  error?: string | null;
  createdAt: string;
}

function formatDateTime(value: string | Date): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export default function CommunicationLogPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== 'all') params.append('channel', channelFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<NotificationLog[]>(`/notifications/log${query}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch notification logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [channelFilter, statusFilter]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      const logDateStr = l.createdAt ? String(l.createdAt).slice(0, 10) : '';
      const matchesDate =
        (!startDate || (logDateStr && logDateStr >= startDate)) &&
        (!endDate || (logDateStr && logDateStr <= endDate));

      if (!matchesDate) return false;

      if (!q) return true;
      return (
        l.recipient?.toLowerCase().includes(q) ||
        l.event?.toLowerCase().includes(q) ||
        l.subject?.toLowerCase().includes(q) ||
        l.body?.toLowerCase().includes(q) ||
        String(l.invoiceId || '').includes(q)
      );
    });
  }, [logs, search, startDate, endDate]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Communication Log</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live delivery history and status for all email and SMS communications.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search recipient, event, subject..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Channel filter */}
            <div className="w-32">
              <Select
                value={channelFilter}
                onChange={(val) => {
                  setChannelFilter(val as any);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Channels' },
                  { value: 'email', label: 'Email Only' },
                  { value: 'sms', label: 'SMS Only' },
                ]}
              />
            </div>

            {/* Status filter */}
            <div className="w-32">
              <Select
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'sent', label: 'Sent' },
                  { value: 'simulated', label: 'Simulated' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'skipped', label: 'Skipped' },
                ]}
              />
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
        </div>

        {/* Logs Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Message Snippet</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2 text-amber-600" />
                      Loading communication events…
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No matching communication records found.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            log.channel === 'email' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.channel === 'email' ? <Mail size={11} /> : <MessageSquare size={11} />}
                          <span>{log.channel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{log.recipient}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{log.event}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {log.subject ? <span className="font-bold mr-1">[{log.subject}]</span> : null}
                        {log.body}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            log.status === 'delivered' || log.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'simulated'
                                ? 'bg-sky-100 text-sky-800'
                                : log.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.error && <p className="text-[10px] text-red-600 mt-0.5 truncate">{log.error}</p>}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <TablePagination
            currentPage={page}
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="events"
          />
        </div>
      </div>
    </div>
  );
}
