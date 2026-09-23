import React, { useState, Suspense } from 'react';
import { ROUTES } from '../routes';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { NotificationDropdown } from '../components/NotificationDropdown';
import { PageLoadingSkeleton } from '../components/PageLoadingSkeleton';
import {
  FileText,
  Repeat,
  CreditCard,
  PlusCircle,
  Boxes,
  History,
  Layers,
  Receipt,
  Users,
  Clock,
  Bell,
  Scale,
  TrendingUp,
  PieChart,
  DollarSign,
  BarChart3,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  UserCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Clients & Billing',
    items: [
      { name: 'Clients', path: '/clients', icon: Users },
      { name: 'Invoices', path: '/invoices', icon: FileText },
      { name: 'Payments', path: '/payments', icon: CreditCard },
      { name: 'Record Payment', path: '/record-payment', icon: PlusCircle },
      { name: 'Recurring Invoices', path: '/recurring-invoices', icon: Repeat, adminOnly: true },
    ],
  },
  {
    title: 'Products & Inventory',
    items: [
      { name: 'Products & Services', path: '/products-services-list', icon: Layers },
      { name: 'Inventory Stock', path: '/inventory-list', icon: Boxes },
      { name: 'Stock History', path: '/stock-history', icon: History },
      { name: 'Expense Tracker', path: '/expense-list', icon: Receipt },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { name: 'Alerts', path: '/invoice-alerts', icon: Bell },
      { name: 'Payment Reminders', path: '/invoice-payment-reminders', icon: Clock, adminOnly: true },
      { name: 'Message Templates', path: '/settings/notifications', icon: MessageSquare, adminOnly: true },
      { name: 'Message Log', path: '/communications', icon: History, adminOnly: true },
    ],
  },
  {
    title: 'Reports',
    items: [
      { name: 'Payment Reconciliation', path: '/payment-reconciliation', icon: Scale, adminOnly: true },
      { name: 'Sales Report', path: '/sales-report', icon: TrendingUp, adminOnly: true },
      { name: 'Revenue Report', path: '/revenue-report', icon: DollarSign, adminOnly: true },
      { name: 'Profit Report', path: '/profit-report', icon: PieChart, adminOnly: true },
      { name: 'Expense Report', path: '/expense-report', icon: BarChart3, adminOnly: true },
      { name: 'Payments Report', path: '/payments-report', icon: FileSpreadsheet, adminOnly: true },
    ],
  },
  {
    title: 'Settings & Administration',
    items: [
      { name: 'Company Profile', path: '/settings/company', icon: Building2, adminOnly: true },
      { name: 'Tax Rates', path: '/settings/taxes', icon: Scale, adminOnly: true },
      { name: 'System Users & Roles', path: '/settings/users', icon: ShieldCheck, adminOnly: true },
      { name: 'Profile & Password', path: '/profile', icon: UserCheck },
    ],
  },
];

export function StorefrontLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const currentRole = user?.role?.toLowerCase() || 'staff';
  const isAdmin = currentRole === 'admin';

  // Role-filtered navigation sections: non-admin roles only see what they have access to
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const getPageTitle = () => {
    if (location.pathname === '/profile') return 'My Profile & Security';
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (location.pathname === item.path) {
          return item.name;
        }
      }
    }
    if (location.pathname.startsWith('/create-invoice')) return 'Create Invoice';
    if (location.pathname.startsWith('/edit-invoice')) return 'Edit Invoice';
    if (location.pathname.startsWith('/invoice-details')) return 'Invoice Details';
    if (location.pathname.startsWith('/create-item')) return 'Add Inventory Item';
    if (location.pathname.startsWith('/create-client')) return 'Create Client';
    if (location.pathname.startsWith('/client-profile')) return 'Client Profile';
    if (location.pathname.startsWith('/create-expense')) return 'Create Expense';
    if (location.pathname.startsWith('/create-service')) return 'Create Product/Service';
    if (location.pathname.startsWith('/edit-client')) return 'Edit Client';
    if (location.pathname.startsWith('/clients/import')) return 'Import Clients';
    if (location.pathname.startsWith('/edit-expense')) return 'Edit Expense';
    if (location.pathname.startsWith('/edit-product-or-service')) return 'Edit Product/Service';
    if (location.pathname.startsWith('/product-or-service-details')) return 'Product/Service Details';
    if (location.pathname.startsWith('/edit-inventory-item')) return 'Edit Inventory Item';
    if (location.pathname.startsWith('/inventory-item-details')) return 'Inventory Item Details';
    if (location.pathname.startsWith('/payment-details')) return 'Payment Details';
    return 'Financial Operations';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 text-slate-700 shadow-xs">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200/90">
        <div className="flex items-center gap-3">
          <img 
            src="/icon.png" 
            alt="LedgerFlow CRM" 
            className="w-10 h-10 rounded-xl object-contain shadow-sm border border-slate-200/70 p-0.5 bg-white shrink-0" 
          />
          <div className="min-w-0">
            <span className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1">
              LedgerFlow <span className="text-teal-600 font-medium">CRM</span>
            </span>
            <p className="text-[10px] tracking-wider uppercase font-semibold text-slate-400 truncate">
              Finance & Operations
            </p>
          </div>
        </div>

        {/* Active Workspace / Role Banner */}
        <div className={`mt-4 p-2.5 rounded-xl border flex items-center gap-2.5 ${
          isAdmin 
            ? 'bg-amber-50/70 border-amber-200/80 text-amber-950' 
            : 'bg-sky-50/70 border-sky-200/80 text-sky-950'
        }`}>
          {isAdmin ? (
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
          ) : (
            <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
              <UserCheck className="w-4 h-4" />
            </span>
          )}
          <div className="truncate">
            <div className="text-[11px] font-bold text-slate-900">
              {isAdmin ? 'Admin Web Portal' : 'Staff Workspace'}
            </div>
            <div className="text-[10px] text-slate-500 capitalize font-medium">
              Role: {currentRole}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>{section.title}</span>
              {section.items.every((i) => i.adminOnly) && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Admin
                </span>
              )}
            </div>

            {section.items.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer text-left ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-900 border-l-2 border-amber-600 pl-2.5 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span className="truncate flex-1">{item.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Section & Logout Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2">
        <button
          onClick={() => {
            navigate('/profile');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border transition shadow-xs cursor-pointer text-left group ${
            location.pathname === '/profile'
              ? 'bg-amber-500/10 border-amber-300 text-amber-900'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
          }`}
          title="Click to view profile details and change password"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate group-hover:text-amber-800">{user?.name || user?.email || 'Active User'}</p>
            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
              <span className="truncate">{user?.companyName || 'My Profile & Password'}</span>
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-10 shadow-2xl">
            {sidebarContent}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Panel Badge in Header */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
              isAdmin
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-sky-50 text-sky-800 border-sky-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-amber-500 animate-pulse' : 'bg-sky-500'}`} />
              <span className="font-bold">
                {isAdmin ? 'Admin Web Portal' : 'Staff Workspace'}
              </span>
            </div>

            <NotificationDropdown />

            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs hover:ring-2 hover:ring-amber-500 hover:ring-offset-2 transition cursor-pointer"
              title="My Profile & Security"
            >
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<PageLoadingSkeleton />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 bg-white">
          &copy; {new Date().getFullYear()} LedgerFlow CRM • Trustworthy Finance Suite
        </footer>
      </div>
    </div>
  );
}

export default StorefrontLayout;
