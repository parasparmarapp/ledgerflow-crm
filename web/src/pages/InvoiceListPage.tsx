import type { Invoice } from '../types';
import { useMemo, useState, useEffect } from 'react';
import { api } from '../api';
import { useInvoices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { DateRangeFilter, TablePagination, RecordPaymentModal } from '../components';
import { 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  Download, 
  Eye, 
  FileText, 
  Filter, 
  Mail, 
  Plus, 
  RefreshCw, 
  Search, 
  Trash2, 
  X, 
  XCircle,
  CreditCard,
  FileDown
} from 'lucide-react';

type ToastType = "success" | "error" | "info";

type Toast = {
  message: string;
  type: ToastType;
} | null;

const statusOptions = ["All", "Draft", "Sent", "Paid", "Overdue", "Cancelled"];

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "overdue") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (normalized === "sent") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "IN";
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const {
    data: invoices = [],
    loading,
    error,
    refresh,
    remove,
    sendInvoice,
  } = useInvoices();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleSendEmail = async (invoiceId: number) => {
    setSendingEmailId(invoiceId);
    try {
      await api.post(`/invoices/${invoiceId}/send`, { channels: ['email'] });
      showToast('Invoice email dispatched to client successfully.');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to send invoice email.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleDownloadPdf = async (invoiceId: number, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!response.ok) throw new Error('Failed to download invoice PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber || `invoice-${invoiceId}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Invoice PDF downloaded successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Could not download invoice PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    refresh({ from: from || undefined, to: to || undefined });
  };

  // Query backend whenever search, status, or date range changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh({
        search: search.trim() || undefined,
        status: status === "All" ? undefined : status.toLowerCase(),
        from: startDate || undefined,
        to: endDate || undefined,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, status, startDate, endDate, refresh]);

  const filteredInvoices = useMemo(() => {
    return invoices;
  }, [invoices]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, page]);

  const totals = useMemo(() => {
    const totalValue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice?.totalAmount || 0),
      0,
    );
    const paidValue = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice?.amountPaid || 0),
      0,
    );
    const outstandingValue = Math.max(totalValue - paidValue, 0);
    const overdueCount = filteredInvoices.filter(
      (invoice) => String(invoice?.status || "").toLowerCase() === "overdue",
    ).length;

    return {
      totalValue,
      paidValue,
      outstandingValue,
      overdueCount,
    };
  }, [invoices]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await refresh();
      showToast("Invoices refreshed successfully.", "info");
    } catch {
      showToast("Unable to refresh invoices.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) {
      showToast("There are no invoices to export.", "info");
      return;
    }

    const columns = [
      "Invoice number",
      "Client ID",
      "Issue date",
      "Due date",
      "Status",
      "Subtotal",
      "Tax",
      "Total",
      "Amount paid",
    ];

    const rows = filteredInvoices.map((invoice) =>
      [
        invoice.invoiceNumber,
        invoice.clientId,
        invoice.issueDate,
        invoice.dueDate,
        invoice.status,
        invoice.subtotal,
        invoice.taxAmount,
        invoice.totalAmount,
        invoice.amountPaid,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );

    const blob = new Blob([[columns.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ledgerflow-invoices.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Invoice export downloaded.");
  };

  const handleDelete = async () => {
    if (!invoiceToDelete?.id) {
      return;
    }

    setIsDeleting(true);

    try {
      await remove(invoiceToDelete.id);
      setInvoiceToDelete(null);
      setSelectedInvoice(null);
      showToast("Invoice deleted successfully.");
    } catch {
      showToast("Failed to delete invoice.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!selectedInvoice?.id) {
      return;
    }

    setIsSending(true);

    try {
      await sendInvoice(selectedInvoice.id);
      await refresh();
      setSelectedInvoice(null);
      showToast("Invoice sent successfully.");
    } catch {
      showToast("Failed to send invoice.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Workspace operational
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create, track, and manage every customer invoice in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.CREATE_INVOICE)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Create invoice
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total invoices
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">
                {invoices.length}
              </p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-500">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Across all statuses</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total billed
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(totals.totalValue)}
              </p>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-500">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Invoice value created</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(totals.outstandingValue)}
              </p>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-600">
                <Filter className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Remaining to collect</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overdue
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">
                {totals.overdueCount}
              </p>
              <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Need follow-up</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Invoice list
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {filteredInvoices.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Search by invoice number, client ID, or status.
                </p>
              </div>

              <div className="relative w-full xl:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search invoices..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setStatus(option);
                      setPage(1);
                    }}
                    className={`min-h-[36px] rounded-lg px-3 text-sm font-medium transition ${
                      status === option
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateRangeChange}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-red-50 p-3 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                Unable to load invoices
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                No invoices found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Adjust your search or filters, or create your first invoice.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("All");
                  }}
                  className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.CREATE_INVOICE)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4" />
                  Create invoice
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                <thead className="border-b border-slate-200/80 bg-slate-50/70">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Invoice
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Client
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Issue date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Due date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInvoices.map((invoice) => {
                    const invoiceStatus = String(invoice.status || "Draft");
                    const invoiceLabel = String(
                      invoice.invoiceNumber || `Invoice ${invoice.id}`,
                    );

                    return (
                      <tr
                        key={invoice.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-rose-600">
                              {getInitials(invoiceLabel)}
                            </div>
                            <div>
                              <p className="font-mono text-sm font-semibold text-slate-900">
                                {invoiceLabel}
                              </p>
                              <p className="text-xs text-slate-500">
                                ID #{invoice.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          Client #{invoice.clientId}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {formatCurrency(Number(invoice.totalAmount || 0))}
                          </p>
                          <p className="text-xs text-slate-500">
                            Paid{" "}
                            {formatCurrency(Number(invoice.amountPaid || 0))}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                              invoiceStatus,
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {invoiceStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(invoice.id, invoiceLabel)}
                              disabled={downloadingId === invoice.id}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              title="Download Invoice PDF"
                            >
                              {downloadingId === invoice.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                              ) : (
                                <Download className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              <span className="hidden sm:inline">PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendEmail(invoice.id)}
                              disabled={sendingEmailId === invoice.id}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              title="Send or resend invoice email to client"
                            >
                              {sendingEmailId === invoice.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                              ) : (
                                <Mail className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              <span className="hidden sm:inline">Email</span>
                            </button>

                            {Number(invoice.totalAmount || 0) > Number(invoice.amountPaid || 0) && invoiceStatus.toLowerCase() !== 'paid' && invoiceStatus.toLowerCase() !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => setInvoiceToPay(invoice)}
                                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer transition"
                                title="Record a payment for this invoice"
                              >
                                <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">Pay</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => navigate(`${ROUTES.INVOICE_DETAILS}?id=${invoice.id}`)}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              title="View Invoice Details"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceToDelete(invoice)}
                              className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-white px-2 text-red-600 hover:bg-red-50 cursor-pointer"
                              aria-label={`Delete ${invoiceLabel}`}
                              title="Delete invoice"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={page}
              totalItems={filteredInvoices.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="invoices"
            />
          </>
        )}
        </div>
      </div>

      {selectedInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              aria-label="Close invoice details"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <p className="text-sm font-medium text-rose-600">Invoice details</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {selectedInvoice.invoiceNumber || `Invoice ${selectedInvoice.id}`}
              </h2>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Client
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  Client #{selectedInvoice.clientId}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                    String(selectedInvoice.status || "Draft"),
                  )}`}
                >
                  {selectedInvoice.status || "Draft"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Issue date
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatDate(selectedInvoice.issueDate)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Due date
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatDate(selectedInvoice.dueDate)}
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatCurrency(Number(selectedInvoice.subtotal || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">Tax</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatCurrency(Number(selectedInvoice.taxAmount || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-mono text-lg font-bold text-slate-900">
                  {formatCurrency(Number(selectedInvoice.totalAmount || 0))}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const inv = selectedInvoice;
                    setSelectedInvoice(null);
                    handleDownloadPdf(inv.id, inv.invoiceNumber || `Invoice-${inv.id}`);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </button>
                {Number(selectedInvoice.totalAmount || 0) > Number(selectedInvoice.amountPaid || 0) && String(selectedInvoice.status).toLowerCase() !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => {
                      const inv = selectedInvoice;
                      setSelectedInvoice(null);
                      setInvoiceToPay(inv);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Record Payment
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceToDelete(selectedInvoice)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <Mail className="h-4 w-4" />
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {invoiceToDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setInvoiceToDelete(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              aria-label="Close delete confirmation"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Delete invoice?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently remove{" "}
              <span className="font-semibold text-slate-700">
                {invoiceToDelete.invoiceNumber || `Invoice ${invoiceToDelete.id}`}
              </span>
              . This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="min-h-[42px] rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="min-h-[42px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete invoice"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Record Payment Popup Modal */}
      <RecordPaymentModal
        isOpen={Boolean(invoiceToPay)}
        onClose={() => setInvoiceToPay(null)}
        invoice={invoiceToPay}
        onSuccess={() => {
          showToast('Payment recorded successfully!');
          refresh();
        }}
      />

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600"
              : toast.type === "error"
                ? "bg-red-500"
                : "bg-indigo-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : toast.type === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-0.5 hover:bg-white/15 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <ChevronRight className="h-4 w-4 rotate-90" />
          </button>
        </div>
      ) : null}
    </div>
  );
}