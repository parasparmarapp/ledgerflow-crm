import type { Reminder } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { useReminders } from '../hooks';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select, TablePagination } from '../components';
import { AlertCircle, Bell, Calendar, Check, CheckCircle2, ChevronRight, Clock, Edit, Mail, MessageSquare, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type ReminderForm = {
  name: string;
  channel: string;
  triggerType: string;
  daysOffset: number;
  repeatEveryDays: number;
  maxRepeats: number;
  isActive: boolean;
  message: string;
};

const emptyForm: ReminderForm = {
  name: '',
  channel: 'email',
  triggerType: 'before_due',
  daysOffset: 3,
  repeatEveryDays: 7,
  maxRepeats: 3,
  isActive: true,
  message: '',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function channelIcon(channel: string) {
  const normalized = channel.toLowerCase();
  if (normalized.includes('sms') || normalized.includes('text')) {
    return <MessageSquare className="h-4 w-4" />;
  }
  return <Mail className="h-4 w-4" />;
}

function channelClasses(channel: string) {
  const normalized = channel.toLowerCase();
  if (normalized.includes('sms') || normalized.includes('text')) {
    return 'bg-violet-50 text-violet-700 border-violet-200';
  }
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

export default function InvoicePaymentRemindersPage() {
  const navigate = useNavigate();
  const {
    data = [],
    loading,
    error,
    refresh,
    create,
    update,
    remove,
  } = useReminders();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);
  const [form, setForm] = useState<ReminderForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
  }, [error]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredReminders = useMemo(() => {
    const query = search.toLowerCase().trim();

    return data.filter((reminder) => {
      const searchable = [
        reminder.channel,
        reminder.triggerType,
        reminder.message,
        String(reminder.id),
        String(reminder.invoiceId ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && reminder.isActive) ||
        (statusFilter === 'inactive' && !reminder.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const paginatedReminders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredReminders.slice(start, start + PAGE_SIZE);
  }, [filteredReminders, page]);

  const activeCount = data.filter((item) => item.isActive).length;
  const inactiveCount = data.filter((item) => !item.isActive).length;

  const openCreate = () => {
    setEditingReminder(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (reminder: any) => {
    setEditingReminder(reminder);
    setForm({
      name: reminder.name || '',
      channel: reminder.channel?.toLowerCase() || 'email',
      triggerType: reminder.triggerType?.toLowerCase().replace(/ /g, '_') || 'before_due',
      daysOffset: Number(reminder.daysOffset) || 0,
      repeatEveryDays: Number(reminder.repeatEveryDays) || 7,
      maxRepeats: Number(reminder.maxRepeats) || 3,
      isActive: Boolean(reminder.isActive),
      message: reminder.message || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (!isSaving) setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.channel.trim() || !form.triggerType.trim()) {
      showToast('Choose a channel and trigger type.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: form.name.trim() || undefined,
        channel: form.channel.toLowerCase(),
        triggerType: form.triggerType.toLowerCase(),
        daysOffset: Number(form.daysOffset) || 0,
        repeatEveryDays: form.triggerType === 'overdue' ? Number(form.repeatEveryDays) || 7 : undefined,
        maxRepeats: form.triggerType === 'overdue' ? Number(form.maxRepeats) || 3 : undefined,
        isActive: form.isActive,
        message: form.message.trim() || undefined,
      };

      if (editingReminder) {
        await update(editingReminder.id, payload);
        showToast('Reminder rule updated successfully.');
      } else {
        await create(payload);
        showToast('Reminder rule created successfully.');
      }

      setShowForm(false);
      await refresh();
    } catch {
      showToast(
        editingReminder ? 'Failed to update reminder rule.' : 'Failed to create reminder rule.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReminder) return;

    setIsDeleting(true);
    try {
      await remove(deletingReminder.id);
      setDeletingReminder(null);
      showToast('Reminder rule deleted successfully.');
      await refresh();
    } catch {
      showToast('Failed to delete reminder rule.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async (reminder: Reminder) => {
    try {
      await update(reminder.id, { isActive: !reminder.isActive });
      showToast(reminder.isActive ? 'Reminder rule paused.' : 'Reminder rule activated.');
      await refresh();
    } catch {
      showToast('Failed to update reminder status.', 'error');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Reminder rules refreshed.', 'info');
    } catch {
      showToast('Unable to refresh reminder rules.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              <Bell className="h-3.5 w-3.5" />
              Automated collections
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Invoice &amp; Payment Reminders
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure when and how customers receive payment reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              New reminder
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total rules
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-600">
                <Bell className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {data.length}
            </div>
            <p className="mt-1 text-sm text-slate-500">Configured reminder workflows</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active rules
              </span>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {activeCount}
            </div>
            <p className="mt-1 text-sm text-slate-500">Currently sending reminders</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paused rules
              </span>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {inactiveCount}
            </div>
            <p className="mt-1 text-sm text-slate-500">Not currently active</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reminder rules</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredReminders.length} of {data.length} rules shown
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search reminders..."
                  className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:w-60"
                />
              </div>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(['all', 'active', 'inactive'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setStatusFilter(filter);
                      setPage(1);
                    }}
                    className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold capitalize transition ${
                      statusFilter === filter
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : error ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <h3 className="mt-3 font-semibold text-slate-900">Unable to load reminders</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : filteredReminders.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                <Bell className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                {data.length === 0 ? 'No reminder rules yet' : 'No matching reminders'}
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {data.length === 0
                  ? 'Create your first reminder rule to automate invoice follow-ups.'
                  : 'Try changing your search or status filter.'}
              </p>
              {data.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4" />
                  Create reminder
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-200/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">Rule</th>
                    <th className="px-5 py-4">Trigger</th>
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReminders.map((reminder) => (
                    <tr key={reminder.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`rounded-lg border p-2 ${channelClasses(
                              reminder.channel || '',
                            )}`}
                          >
                            {channelIcon(reminder.channel || '')}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {reminder.channel || 'Unspecified channel'}
                            </div>
                            <div className="mt-0.5 max-w-xs truncate text-sm text-slate-500">
                              {reminder.message || 'Automatic payment reminder'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-700">
                          {reminder.triggerType || '—'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {Math.abs(Number(reminder.daysOffset) || 0)} day
                          {(Math.abs(Number(reminder.daysOffset) || 0) === 1 ? '' : 's')}{' '}
                          {Number(reminder.daysOffset) < 0 ? 'after' : 'before'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {reminder.invoiceId ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `${ROUTES.SCREEN_INVOICE_DETAILS}?id=${reminder.invoiceId}`,
                              )
                            }
                            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800"
                          >
                            #{reminder.invoiceId}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">All invoices</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggle(reminder)}
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            reminder.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              reminder.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {reminder.isActive ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {formatDate(reminder.createdAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(reminder)}
                            aria-label="Edit reminder"
                            className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingReminder(reminder)}
                            aria-label="Delete reminder"
                            className="inline-flex min-h-[36px] items-center rounded-lg border border-rose-200 px-3 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
            totalItems={filteredReminders.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="reminders"
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeForm}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <h2 className="text-lg font-bold text-slate-900">
                {editingReminder ? 'Edit reminder rule' : 'Create reminder rule'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Set the timing and delivery channel for this reminder.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Rule Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. 3-day Upcoming Reminder"
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <div>
                <Select
                  label="Channel"
                  value={form.channel}
                  onChange={(val) => setForm((current) => ({ ...current, channel: val }))}
                  options={[
                    { value: 'email', label: 'Email' },
                    { value: 'sms', label: 'SMS' },
                  ]}
                />
              </div>

              <div>
                <Select
                  label="Trigger type"
                  value={form.triggerType}
                  onChange={(val) =>
                    setForm((current) => ({ ...current, triggerType: val }))
                  }
                  options={[
                    { value: 'before_due', label: 'Before due date' },
                    { value: 'on_due', label: 'On due date' },
                    { value: 'overdue', label: 'After due date (Overdue)' },
                  ]}
                />
              </div>

              <label className="text-sm font-medium text-slate-700">
                Days offset
                <input
                  type="number"
                  min="0"
                  value={form.daysOffset}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      daysOffset: Number(event.target.value) || 0,
                    }))
                  }
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              {form.triggerType === 'overdue' && (
                <>
                  <label className="text-sm font-medium text-slate-700">
                    Repeat Every (Days)
                    <input
                      type="number"
                      min="1"
                      value={form.repeatEveryDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          repeatEveryDays: Number(event.target.value) || 7,
                        }))
                      }
                      className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Max Repeats
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={form.maxRepeats}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxRepeats: Number(event.target.value) || 3,
                        }))
                      }
                      className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                </>
              )}

              <label className="flex min-h-[44px] items-center gap-3 self-end rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                Activate this rule
              </label>

              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Message
                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, message: event.target.value }))
                  }
                  placeholder="Optional message shown to the customer"
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isSaving ? 'Saving...' : editingReminder ? 'Save changes' : 'Create rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setDeletingReminder(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close confirmation"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Delete reminder rule?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently remove the {deletingReminder.channel || 'selected'} reminder rule.
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingReminder(null)}
                disabled={isDeleting}
                className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? 'Deleting...' : 'Delete rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-indigo-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}