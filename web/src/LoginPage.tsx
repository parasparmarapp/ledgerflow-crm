import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowRight, 
  Lock, 
  Mail, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Building2, 
  Check, 
  KeyRound, 
  X, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companies, setCompanies] = useState<{ id: number; slug: string; name: string }[]>([]);
  const [companySlug, setCompanySlug] = useState('');
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCompanySlug, setForgotCompanySlug] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const redirectPath = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    fetch('/api/v1/auth/companies')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load companies.');
        return response.json();
      })
      .then((items) => {
        setCompanies(items);
        let previousCompany: string | null = null;
        try { previousCompany = localStorage.getItem('crm_company_slug'); } catch { /* Private browsing can block storage. */ }
        if (items.some((item: { slug: string }) => item.slug === previousCompany)) setCompanySlug(previousCompany!);
        else if (items.length > 0) setCompanySlug(items[0].slug);
      })
      .catch(() => setError('Unable to load companies. Please refresh the page.'))
      .finally(() => setCompaniesLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !companySlug) {
      setError('Select a company and provide your email address and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, companySlug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Invalid credentials. Please verify your email and password.');
      }

      if (data?.token && data?.user) {
        try { localStorage.setItem('crm_company_slug', companySlug); } catch { /* Login still works without saved preference. */ }
        login(data.token, data.user);
        navigate(redirectPath, { replace: true });
      } else {
        throw new Error('Authentication response did not contain a valid session token.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Please verify your connection and credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForgot = () => {
    setForgotEmail(email);
    setForgotCompanySlug(companySlug || (companies[0]?.slug ?? ''));
    setForgotMessage(null);
    setForgotError(null);
    setForgotModalOpen(true);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCompanySlug || !forgotEmail) {
      setForgotError('Please select a company and provide your email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companySlug: forgotCompanySlug, email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Unable to submit reset request.');
      }
      setForgotMessage(data?.message || 'If that email belongs to an active account in the selected company, a reset link will be sent shortly.');
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to request reset link.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-100 via-amber-50/40 to-transparent pointer-events-none" />
      <div className="absolute -top-36 -left-24 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 text-center px-4">
        <div className="inline-flex items-center justify-center gap-3.5 mb-3">
          <img 
            src="/icon.png" 
            alt="LedgerFlow CRM" 
            className="w-12 h-12 rounded-2xl object-contain shadow-md shadow-sky-500/10 border border-slate-200/80 p-1 bg-white" 
          />
          <div className="text-left">
            <span className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
              LedgerFlow <span className="text-teal-600 font-medium">CRM</span>
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Business Flows For A Brighter Tomorrow</p>
          </div>
        </div>

        <h1 className="mt-4 text-center text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Choose your company, then sign in to your workspace.
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4 sm:px-0">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-6 sm:p-8 space-y-6">

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <div className="flex items-end justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Your company</span>
                <span className="text-[11px] text-slate-400">Select one workspace</span>
              </div>
              {companiesLoading ? (
                <div className="grid grid-cols-2 gap-3" aria-label="Loading companies">
                  <div className="h-[84px] rounded-xl bg-slate-100 animate-pulse" />
                  <div className="h-[84px] rounded-xl bg-slate-100 animate-pulse" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Choose company">
                  {companies.map((company) => {
                    const selected = companySlug === company.slug;
                    return (
                      <button
                        type="button"
                        key={company.id}
                        aria-pressed={selected}
                        onClick={() => { setCompanySlug(company.slug); setError(null); }}
                        className={`min-w-0 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${selected ? 'border-amber-500 bg-amber-50 shadow-sm shadow-amber-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Building2 size={17} /></span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'}`}>{selected && <Check size={12} strokeWidth={3} />}</span>
                        </span>
                        <span className="mt-2 block truncate text-sm font-semibold text-slate-900">{company.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgot}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || companiesLoading || companies.length === 0}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Your company’s workspace stays separate and secure.</span>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100">
            <button
              onClick={() => !forgotLoading && setForgotModalOpen(false)}
              disabled={forgotLoading}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Reset Password</h2>
                <p className="text-xs text-slate-500">Receive a secure link to create a new password</p>
              </div>
            </div>

            {forgotMessage ? (
              <div className="py-4 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Check Your Inbox</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {forgotMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-4 space-y-4 text-xs">
                {forgotError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-red-700">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Workspace *</label>
                  <select
                    value={forgotCompanySlug}
                    onChange={(e) => setForgotCompanySlug(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 p-2.5 bg-slate-50 text-slate-900 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Your Registered Email *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@brand-it.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={forgotLoading}
                    onClick={() => setForgotModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail || !forgotCompanySlug}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-60 shadow-xs shadow-amber-200"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Sending Link…</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

