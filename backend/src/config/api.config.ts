/**
 * LedgerFlow CRM - Central API Configuration & Endpoint Registry
 * Single Source of Truth for all API routes across the backend and client consumers.
 */

export const API_CONFIG = {
  BASE_PATH: '/api/v1',
  HEALTH_PATH: '/health',
  OPENAPI_PATH: '/openapi.json',
  DEFAULT_PAGE_SIZE: 50,
  VERSION: '1.0.0',
} as const;

export const API_ENDPOINTS = {
  HEALTH: {
    ROOT: '/health',
    API_HEALTH: '/api/health',
    V1_HEALTH: '/api/v1/health',
  },
  OPENAPI: {
    SPEC: '/openapi.json',
    V1_SPEC: '/api/v1/openapi.json',
  },
  AUTH: {
    ROOT: '/auth',
    LOGIN: '/auth/login',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  PRODUCTS_SERVICES: {
    ROOT: '/products-services',
    ITEM: '/products-services/:id',
  },
  INVENTORY: {
    ROOT: '/inventory',
    ITEM: '/inventory/:id',
    ADJUST: '/inventory/:id/adjust',
  },
  STOCK_MOVEMENTS: {
    ROOT: '/stockmovements',
    ITEM: '/stockmovements/:id',
  },
  INVOICES: {
    ROOT: '/invoices',
    ITEM: '/invoices/:id',
    SEND: '/invoices/:id/send',
  },
  RECURRING_INVOICES: {
    ROOT: '/recurringinvoices',
    ITEM: '/recurringinvoices/:id',
  },
  CLIENTS: {
    ROOT: '/clients',
    ITEM: '/clients/:id',
    CONTACTS: '/clients/:id/contacts',
    CONTACT_ITEM: '/clients/:id/contacts/:contactId',
  },
  EXPENSES: {
    ROOT: '/expenses',
    ITEM: '/expenses/:id',
  },
  PAYMENTS: {
    ROOT: '/payments',
    ITEM: '/payments/:id',
    RECONCILE: '/payments/reconciliation',
  },
  REPORTS: {
    SALES: '/reports/sales',
    PROFIT: '/reports/profit',
    REVENUE: '/reports/revenue',
    EXPENSES: '/reports/expenses',
    PAYMENTS: '/reports/payments',
  },
  ALERTS: {
    ROOT: '/alerts',
    ITEM: '/alerts/:id',
  },
  REMINDERS: {
    ROOT: '/reminders',
    ITEM: '/reminders/:id',
  },
  NOTIFICATIONS: {
    ROOT: '/notifications',
    TEST_EMAIL: '/notifications/test-email',
    SMTP_STATUS: '/notifications/smtp-status',
    SMS_STATUS: '/notifications/sms-status',
    TEST_SMS: '/notifications/test-sms',
    SMS_LOGS: '/notifications/sms-logs',
  },
} as const;

/**
 * Builds a full API path prefixed by API_CONFIG.BASE_PATH
 */
export function buildApiPath(path: string): string {
  if (path.startsWith(API_CONFIG.BASE_PATH)) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.BASE_PATH}${cleanPath}`;
}
