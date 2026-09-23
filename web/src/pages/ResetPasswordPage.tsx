import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  KeyRound,
  Check,
} from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const companySlug = searchParams.get('company') || searchParams.get('companySlug') || '';
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companySlug || !token) {
      setError('This password reset link is incomplete or missing required parameters. Please request a new link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companySlug,
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Unable to reset password. The link may be expired.');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while resetting your password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasMinLength = newPassword.length >= 8;
  const hasMatching = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-100 via-amber-50/40 to-transparent pointer-events-none" />
      <div className="absolute -top-36 -left-24 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <img
            src="/icon.png"
            alt="LedgerFlow CRM"
            className="w-11 h-11 rounded-2xl object-contain shadow-md shadow-sky-500/10 border border-slate-200/80 p-1 bg-white"
          />
          <div className="text-left">
            <span className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1">
              LedgerFlow <span className="text-teal-600 font-medium">CRM</span>
            </span>
          </div>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {isSuccess ? 'Password Reset Complete' : 'Set New Password'}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {isSuccess
            ? 'Your account security has been updated successfully.'
            : companySlug
            ? `Resetting credentials for workspace: ${companySlug}`
            : 'Enter and confirm your new secure password.'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-6 sm:p-8 space-y-5">
          {/* Missing Token or Company Error */}
          {(!companySlug || !token) && !isSuccess && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900 text-sm">Invalid or Incomplete Link</p>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    This password reset link is missing required security tokens. Please request a fresh link from the login page.
                  </p>
                </div>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-bold text-amber-700 hover:text-amber-900 pt-1"
              >
                <span>Return to Sign In</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Success State */}
          {isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Password Updated!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  All active sessions have been invalidated. You can now sign in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to Sign In</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            /* Reset Form */
            companySlug &&
            token && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Workspace Tag */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                  <Building2 size={15} className="text-amber-600" />
                  <span>Workspace:</span>
                  <span className="font-bold text-slate-900">{companySlug}</span>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition"
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

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="space-y-1.5 pt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-400'}`}>
                      {hasMinLength ? <Check size={10} strokeWidth={3} /> : '•'}
                    </span>
                    <span className={hasMinLength ? 'text-slate-700 font-medium' : ''}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${hasMatching ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-400'}`}>
                      {hasMatching ? <Check size={10} strokeWidth={3} /> : '•'}
                    </span>
                    <span className={hasMatching ? 'text-slate-700 font-medium' : ''}>Passwords match</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !hasMinLength || !hasMatching}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/25 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Set New Password</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted and scoped strictly to your workspace.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
