import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
  Package,
  FileText,
  RefreshCw,
  X,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import type { Alert } from '../types';

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSec < 60) return 'Just now';
  if (diffInSec < 3600) return `${Math.floor(diffInSec / 60)}m ago`;
  if (diffInSec < 86400) return `${Math.floor(diffInSec / 3600)}h ago`;
  if (diffInSec < 604800) return `${Math.floor(diffInSec / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAlertConfig(alert: Alert) {
  const type = (alert.alertType || '').toLowerCase();
  if (type.includes('overdue') || type.includes('late')) {
    return {
      icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
      bg: 'bg-rose-50 border-rose-200',
      title: 'Payment Overdue Alert',
    };
  }
  if (type.includes('stock') || alert.inventoryItemId) {
    return {
      icon: <Package className="w-4 h-4 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-200',
      title: 'Inventory Stock Notice',
    };
  }
  if (type.includes('reminder') || type.includes('due')) {
    return {
      icon: <Clock className="w-4 h-4 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-200',
      title: 'Payment Reminder',
    };
  }
  return {
    icon: <FileText className="w-4 h-4 text-teal-600" />,
    bg: 'bg-teal-50 border-teal-200',
    title: alert.alertType ? alert.alertType.replace(/_/g, ' ') : 'System Notification',
  };
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { alerts, loading, refresh, update } = useAlerts();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Count unread alerts (pending / sent / not resolved / not read)
  const unreadAlerts = useMemo(() => {
    return alerts.filter(
      (a) =>
        a.status?.toLowerCase() !== 'read' &&
        a.status?.toLowerCase() !== 'resolved'
    );
  }, [alerts]);

  const displayedAlerts = useMemo(() => {
    if (filter === 'unread') {
      return unreadAlerts;
    }
    return alerts;
  }, [alerts, filter, unreadAlerts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, alert: Alert) => {
    e.stopPropagation();
    try {
      await update(alert.id, { status: 'read' });
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = alerts.filter(
      (a) =>
        a.status?.toLowerCase() !== 'read' &&
        a.status?.toLowerCase() !== 'resolved'
    );
    await Promise.all(
      unread.map((a) => update(a.id, { status: 'read' }).catch(() => {}))
    );
  };

  const handleAlertClick = (alert: Alert) => {
    if (alert.invoiceId) {
      navigate(`/invoice-details?id=${alert.invoiceId}`);
      setIsOpen(false);
    } else if (alert.inventoryItemId) {
      navigate(`/inventory-item-details?id=${alert.inventoryItemId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition relative cursor-pointer ${
          isOpen ? 'bg-slate-100 text-slate-900 ring-2 ring-amber-500/20' : ''
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadAlerts.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">Notifications</span>
              {unreadAlerts.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {unreadAlerts.length} new
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Up to date
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRefresh}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                title="Refresh notifications"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`}
                />
              </button>
              {unreadAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pt-2 pb-1 flex gap-2 border-b border-slate-100 bg-white text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`pb-1.5 px-2 font-semibold transition border-b-2 cursor-pointer ${
                filter === 'all'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`pb-1.5 px-2 font-semibold transition border-b-2 cursor-pointer ${
                filter === 'unread'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Unread ({unreadAlerts.length})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-amber-500" />
                Loading alerts...
              </div>
            ) : displayedAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-slate-700">No notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filter === 'unread' ? 'All caught up on unread items!' : 'No alerts recorded yet.'}
                </p>
              </div>
            ) : (
              displayedAlerts.slice(0, 15).map((alert) => {
                const config = getAlertConfig(alert);
                const isUnread =
                  alert.status?.toLowerCase() !== 'read' &&
                  alert.status?.toLowerCase() !== 'resolved';

                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-slate-50 ${
                      isUnread ? 'bg-amber-50/30' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${config.bg}`}
                    >
                      {config.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {config.title}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(alert.createdAt || alert.sentAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                        {alert.message ||
                          (alert.invoiceId
                            ? `Notification tied to Invoice #${alert.invoiceId}. Action recommended.`
                            : alert.inventoryItemId
                            ? `Stock notification for inventory item #${alert.inventoryItemId}.`
                            : `System generated alert for channel ${alert.channel || 'in-app'}.`)}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 capitalize">
                          Channel: <span className="font-semibold text-slate-600">{alert.channel || 'System'}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(e, alert)}
                              className="text-amber-700 font-semibold hover:text-amber-800 hover:underline cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                          {(alert.invoiceId || alert.inventoryItemId) && (
                            <span className="flex items-center gap-0.5 text-slate-400 hover:text-slate-700 font-medium">
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 bg-slate-50/60 text-center">
            <button
              type="button"
              onClick={() => {
                navigate('/invoice-alerts');
                setIsOpen(false);
              }}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
            >
              View all alerts &amp; reminders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
