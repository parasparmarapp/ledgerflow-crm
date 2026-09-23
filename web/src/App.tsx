import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { StorefrontLayout } from './layouts/StorefrontLayout';
import { ROUTES } from './routes';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

const LoginPage = lazy(() => import('./LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Lazy-loaded screen components with default/named export resilience
const InvoiceListPage = lazy(() =>
  import('./pages/InvoiceListPage')
    .then((m: any) => ({ default: m.default || m.InvoiceListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InvoiceListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InvoiceListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InvoiceListPage" could not be loaded.') };
    })
);
const CreateInvoicePage = lazy(() =>
  import('./pages/CreateInvoicePage')
    .then((m: any) => ({ default: m.default || m.CreateInvoicePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'CreateInvoicePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] CreateInvoicePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "CreateInvoicePage" could not be loaded.') };
    })
);
const EditInvoicePage = lazy(() =>
  import('./pages/EditInvoicePage')
    .then((m: any) => ({ default: m.default || m.EditInvoicePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'EditInvoicePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] EditInvoicePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "EditInvoicePage" could not be loaded.') };
    })
);
const InvoiceDetailsPage = lazy(() =>
  import('./pages/InvoiceDetailsPage')
    .then((m: any) => ({ default: m.default || m.InvoiceDetailsPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InvoiceDetailsPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InvoiceDetailsPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InvoiceDetailsPage" could not be loaded.') };
    })
);
const RecurringInvoicesPage = lazy(() =>
  import('./pages/RecurringInvoicesPage')
    .then((m: any) => ({ default: m.default || m.RecurringInvoicesPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'RecurringInvoicesPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] RecurringInvoicesPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "RecurringInvoicesPage" could not be loaded.') };
    })
);
const InventoryListPage = lazy(() =>
  import('./pages/InventoryListPage')
    .then((m: any) => ({ default: m.default || m.InventoryListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InventoryListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InventoryListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InventoryListPage" could not be loaded.') };
    })
);
const CreateItemPage = lazy(() =>
  import('./pages/CreateItemPage')
    .then((m: any) => ({ default: m.default || m.CreateItemPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'CreateItemPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] CreateItemPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "CreateItemPage" could not be loaded.') };
    })
);
const EditInventoryItemPage = lazy(() =>
  import('./pages/EditInventoryItemPage')
    .then((m: any) => ({ default: m.default || m.EditInventoryItemPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'EditInventoryItemPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] EditInventoryItemPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "EditInventoryItemPage" could not be loaded.') };
    })
);
const InventoryItemDetailsPage = lazy(() =>
  import('./pages/InventoryItemDetailsPage')
    .then((m: any) => ({ default: m.default || m.InventoryItemDetailsPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InventoryItemDetailsPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InventoryItemDetailsPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InventoryItemDetailsPage" could not be loaded.') };
    })
);
const StockHistoryPage = lazy(() =>
  import('./pages/StockHistoryPage')
    .then((m: any) => ({ default: m.default || m.StockHistoryPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'StockHistoryPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] StockHistoryPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "StockHistoryPage" could not be loaded.') };
    })
);
const ClientListPage = lazy(() =>
  import('./pages/ClientListPage')
    .then((m: any) => ({ default: m.default || m.ClientListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ClientListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ClientListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ClientListPage" could not be loaded.') };
    })
);
const CreateClientPage = lazy(() =>
  import('./pages/CreateClientPage')
    .then((m: any) => ({ default: m.default || m.CreateClientPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'CreateClientPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] CreateClientPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "CreateClientPage" could not be loaded.') };
    })
);
const EditClientPage = lazy(() =>
  import('./pages/EditClientPage')
    .then((m: any) => ({ default: m.default || m.EditClientPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'EditClientPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] EditClientPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "EditClientPage" could not be loaded.') };
    })
);
const ClientProfilePage = lazy(() =>
  import('./pages/ClientProfilePage')
    .then((m: any) => ({ default: m.default || m.ClientProfilePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ClientProfilePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ClientProfilePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ClientProfilePage" could not be loaded.') };
    })
);
const SalesReportPage = lazy(() =>
  import('./pages/SalesReportPage')
    .then((m: any) => ({ default: m.default || m.SalesReportPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'SalesReportPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] SalesReportPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "SalesReportPage" could not be loaded.') };
    })
);
const ProfitReportPage = lazy(() =>
  import('./pages/ProfitReportPage')
    .then((m: any) => ({ default: m.default || m.ProfitReportPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ProfitReportPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ProfitReportPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ProfitReportPage" could not be loaded.') };
    })
);
const RevenueReportPage = lazy(() =>
  import('./pages/RevenueReportPage')
    .then((m: any) => ({ default: m.default || m.RevenueReportPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'RevenueReportPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] RevenueReportPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "RevenueReportPage" could not be loaded.') };
    })
);
const ExpenseListPage = lazy(() =>
  import('./pages/ExpenseListPage')
    .then((m: any) => ({ default: m.default || m.ExpenseListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ExpenseListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ExpenseListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ExpenseListPage" could not be loaded.') };
    })
);
const CreateExpensePage = lazy(() =>
  import('./pages/CreateExpensePage')
    .then((m: any) => ({ default: m.default || m.CreateExpensePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'CreateExpensePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] CreateExpensePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "CreateExpensePage" could not be loaded.') };
    })
);
const EditExpensePage = lazy(() =>
  import('./pages/EditExpensePage')
    .then((m: any) => ({ default: m.default || m.EditExpensePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'EditExpensePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] EditExpensePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "EditExpensePage" could not be loaded.') };
    })
);
const ExpenseReportPage = lazy(() =>
  import('./pages/ExpenseReportPage')
    .then((m: any) => ({ default: m.default || m.ExpenseReportPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ExpenseReportPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ExpenseReportPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ExpenseReportPage" could not be loaded.') };
    })
);
const ProductsServicesListPage = lazy(() =>
  import('./pages/ProductsServicesListPage')
    .then((m: any) => ({ default: m.default || m.ProductsServicesListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ProductsServicesListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ProductsServicesListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ProductsServicesListPage" could not be loaded.') };
    })
);
const CreateServicePage = lazy(() =>
  import('./pages/CreateServicePage')
    .then((m: any) => ({ default: m.default || m.CreateServicePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'CreateServicePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] CreateServicePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "CreateServicePage" could not be loaded.') };
    })
);
const EditProductOrServicePage = lazy(() =>
  import('./pages/EditProductOrServicePage')
    .then((m: any) => ({ default: m.default || m.EditProductOrServicePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'EditProductOrServicePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] EditProductOrServicePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "EditProductOrServicePage" could not be loaded.') };
    })
);
const ProductOrServiceDetailsPage = lazy(() =>
  import('./pages/ProductOrServiceDetailsPage')
    .then((m: any) => ({ default: m.default || m.ProductOrServiceDetailsPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'ProductOrServiceDetailsPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] ProductOrServiceDetailsPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "ProductOrServiceDetailsPage" could not be loaded.') };
    })
);
const InvoiceAlertsPage = lazy(() =>
  import('./pages/InvoiceAlertsPage')
    .then((m: any) => ({ default: m.default || m.InvoiceAlertsPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InvoiceAlertsPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InvoiceAlertsPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InvoiceAlertsPage" could not be loaded.') };
    })
);
const InvoicePaymentRemindersPage = lazy(() =>
  import('./pages/InvoicePaymentRemindersPage')
    .then((m: any) => ({ default: m.default || m.InvoicePaymentRemindersPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'InvoicePaymentRemindersPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] InvoicePaymentRemindersPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "InvoicePaymentRemindersPage" could not be loaded.') };
    })
);
const PaymentsListPage = lazy(() =>
  import('./pages/PaymentsListPage')
    .then((m: any) => ({ default: m.default || m.PaymentsListPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'PaymentsListPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] PaymentsListPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "PaymentsListPage" could not be loaded.') };
    })
);
const RecordPaymentPage = lazy(() =>
  import('./pages/RecordPaymentPage')
    .then((m: any) => ({ default: m.default || m.RecordPaymentPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'RecordPaymentPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] RecordPaymentPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "RecordPaymentPage" could not be loaded.') };
    })
);
const PaymentDetailsPage = lazy(() =>
  import('./pages/PaymentDetailsPage')
    .then((m: any) => ({ default: m.default || m.PaymentDetailsPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'PaymentDetailsPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] PaymentDetailsPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "PaymentDetailsPage" could not be loaded.') };
    })
);
const PaymentReconciliationPage = lazy(() =>
  import('./pages/PaymentReconciliationPage')
    .then((m: any) => ({ default: m.default || m.PaymentReconciliationPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'PaymentReconciliationPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] PaymentReconciliationPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "PaymentReconciliationPage" could not be loaded.') };
    })
);
const PaymentsReportPage = lazy(() =>
  import('./pages/PaymentsReportPage')
    .then((m: any) => ({ default: m.default || m.PaymentsReportPage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'PaymentsReportPage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] PaymentsReportPage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "PaymentsReportPage" could not be loaded.') };
    })
);
const UserProfilePage = lazy(() =>
  import('./pages/UserProfilePage')
    .then((m: any) => ({ default: m.default || m.UserProfilePage || (() => React.createElement('div', { className: 'p-8 text-slate-500' }, 'UserProfilePage')) }))
    .catch((err) => {
      console.error('[BuildAI Page Load Error] UserProfilePage:', err);
      return { default: () => React.createElement('div', { className: 'p-8 text-amber-700 bg-amber-50 rounded-xl m-4 border border-amber-200' }, 'Page "UserProfilePage" could not be loaded.') };
    })
);

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CompanySettingsPage = lazy(() => import('./pages/CompanySettingsPage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const CommunicationLogPage = lazy(() => import('./pages/CommunicationLogPage'));
const UsersManagementPage = lazy(() => import('./pages/UsersManagementPage'));
const TaxRatesPage = lazy(() => import('./pages/TaxRatesPage'));
const ClientImportPage = lazy(() => import('./pages/ClientImportPage'));

// Live Preview Navigation Bridge (receives postMessage from BuildAI preview toolbar)
function NavigationBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        if (e?.data?.type === 'NAVIGATE') {
          const rawTarget = e.data.path || e.data.routeName || e.data.screen;
          if (rawTarget) {
            const target = rawTarget.startsWith('/') ? rawTarget : '/' + rawTarget.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (target !== location.pathname) {
              navigate(target);
            }
          }
        }
      } catch (err) {
        console.warn('[BuildAI Navigation Bridge] Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, location.pathname]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavigationBridge />
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-400 text-sm font-medium animate-pulse">Loading LedgerFlow CRM...</div>}>
          <Routes>
            {/* Public Auth Routes */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicOnlyRoute>
                  <ResetPasswordPage />
                </PublicOnlyRoute>
              }
            />

            {/* Protected App Shell Routes with Sidebar Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <StorefrontLayout />
                </ProtectedRoute>
              }
            >
              <Route path={ROUTES.HOME} element={<DashboardPage />} />
              <Route path="/invoices" element={<InvoiceListPage />} />
              <Route path={ROUTES.INVOICE_LIST} element={<InvoiceListPage />} />
              <Route path={ROUTES.CREATE_INVOICE} element={<CreateInvoicePage />} />
              <Route path={ROUTES.EDIT_INVOICE} element={<EditInvoicePage />} />
              <Route path={ROUTES.INVOICE_DETAILS} element={<InvoiceDetailsPage />} />
              <Route
                path={ROUTES.RECURRING_INVOICES}
                element={
                  <AdminOnlyRoute>
                    <RecurringInvoicesPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path={ROUTES.INVENTORY_LIST} element={<InventoryListPage />} />
              <Route path={ROUTES.CREATE_ITEM} element={<CreateItemPage />} />
              <Route path={ROUTES.EDIT_INVENTORY_ITEM} element={<EditInventoryItemPage />} />
              <Route path={ROUTES.INVENTORY_ITEM_DETAILS} element={<InventoryItemDetailsPage />} />
              <Route path={ROUTES.STOCK_HISTORY} element={<StockHistoryPage />} />
              <Route path="/clients" element={<ClientListPage />} />
              <Route path="/clients/import" element={<ClientImportPage />} />
              <Route path={ROUTES.CLIENT_LIST} element={<ClientListPage />} />
              <Route path={ROUTES.CREATE_CLIENT} element={<CreateClientPage />} />
              <Route path={ROUTES.EDIT_CLIENT} element={<EditClientPage />} />
              <Route path={ROUTES.CLIENT_PROFILE} element={<ClientProfilePage />} />
              <Route
                path={ROUTES.SALES_REPORT}
                element={
                  <AdminOnlyRoute>
                    <SalesReportPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path={ROUTES.PROFIT_REPORT}
                element={
                  <AdminOnlyRoute>
                    <ProfitReportPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path={ROUTES.REVENUE_REPORT}
                element={
                  <AdminOnlyRoute>
                    <RevenueReportPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path={ROUTES.EXPENSE_LIST} element={<ExpenseListPage />} />
              <Route path={ROUTES.CREATE_EXPENSE} element={<CreateExpensePage />} />
              <Route path={ROUTES.EDIT_EXPENSE} element={<EditExpensePage />} />
              <Route
                path={ROUTES.EXPENSE_REPORT}
                element={
                  <AdminOnlyRoute>
                    <ExpenseReportPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path={ROUTES.PRODUCTS_SERVICES_LIST} element={<ProductsServicesListPage />} />
              <Route path="/products-services" element={<ProductsServicesListPage />} />
              <Route path={ROUTES.CREATE_SERVICE} element={<CreateServicePage />} />
              <Route path={ROUTES.EDIT_PRODUCT_OR_SERVICE} element={<EditProductOrServicePage />} />
              <Route path={ROUTES.PRODUCT_OR_SERVICE_DETAILS} element={<ProductOrServiceDetailsPage />} />
              <Route path={ROUTES.INVOICE_ALERTS} element={<InvoiceAlertsPage />} />
              <Route
                path={ROUTES.INVOICE_PAYMENT_REMINDERS}
                element={
                  <AdminOnlyRoute>
                    <InvoicePaymentRemindersPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path="/payments" element={<PaymentsListPage />} />
              <Route path={ROUTES.PAYMENTS_LIST} element={<PaymentsListPage />} />
              <Route path={ROUTES.RECORD_PAYMENT} element={<RecordPaymentPage />} />
              <Route path={ROUTES.PAYMENT_DETAILS} element={<PaymentDetailsPage />} />
              <Route
                path={ROUTES.PAYMENT_RECONCILIATION}
                element={
                  <AdminOnlyRoute>
                    <PaymentReconciliationPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path={ROUTES.PAYMENTS_REPORT}
                element={
                  <AdminOnlyRoute>
                    <PaymentsReportPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="/settings/company"
                element={
                  <AdminOnlyRoute>
                    <CompanySettingsPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="/settings/notifications"
                element={
                  <AdminOnlyRoute>
                    <NotificationSettingsPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="/communications"
                element={
                  <AdminOnlyRoute>
                    <CommunicationLogPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="/settings/users"
                element={
                  <AdminOnlyRoute>
                    <UsersManagementPage />
                  </AdminOnlyRoute>
                }
              />
              <Route
                path="/settings/audit-log"
                element={<Navigate to="/settings/users" replace />}
              />
              <Route
                path="/settings/taxes"
                element={
                  <AdminOnlyRoute>
                    <TaxRatesPage />
                  </AdminOnlyRoute>
                }
              />
              <Route path={ROUTES.USER_PROFILE} element={<UserProfilePage />} />
              <Route path="/profile" element={<UserProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}