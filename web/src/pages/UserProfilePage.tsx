import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../lib/api';
import { 
  User, 
  Mail, 
  Shield, 
  Key, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  Calendar,
  AlertCircle,
  Building2,
  Check,
  Save,
  Loader2
} from 'lucide-react';

export default function UserProfilePage() {
  const { user, updateUser } = useAuth();
  
  // Profile edit state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password edit state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const currentRole = user?.role?.toLowerCase() || 'staff';
  const isAdmin = currentRole === 'admin';

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const trimmedName = profileName.trim();
    const trimmedEmail = profileEmail.trim().toLowerCase();

    if (!trimmedName) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setProfileError('Please provide a valid email address.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res: any = await api.patch('/auth/me', {
        name: trimmedName,
        email: trimmedEmail,
      });

      const updatedName = res?.name || trimmedName;
      const updatedEmail = res?.email || trimmedEmail;

      updateUser({
        name: updatedName,
        email: updatedEmail,
      });

      showToast('Profile information updated successfully!', 'success');
    } catch (err: any) {
      const errMsg = err?.message || err?.error || 'Failed to update profile information.';
      setProfileError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errMsg = err?.message || err?.error || 'Failed to update password. Please check your current password.';
      setPasswordError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>LedgerFlow CRM</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Account Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin & User Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your account credentials, update email and security settings, and view operational access.
          </p>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm transition-all ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Account Summary Card & Role */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-amber-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <h2 className="text-lg font-bold text-slate-900">{user?.name || 'CRM Team Member'}</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{user?.email}</p>
                
                <div className="mt-4 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    isAdmin 
                      ? 'bg-amber-50 text-amber-900 border-amber-200' 
                      : 'bg-sky-50 text-sky-900 border-sky-200'
                  }`}>
                    <Shield className="w-3.5 h-3.5" />
                    <span className="capitalize">{currentRole} Role</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Account ID
                  </span>
                  <span className="font-mono font-bold text-slate-800">#{user?.id || 1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Status
                  </span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active & Verified
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Database
                  </span>
                  <span className="font-semibold text-slate-700">PostgreSQL 16</span>
                </div>
              </div>
            </div>

            {/* Role Permissions Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Role Permissions</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isAdmin 
                  ? 'Administrator with full system privileges, access to executive reports, system users & roles, and company finance.' 
                  : 'Operations & field staff member with access to customer directory, catalog, invoicing, and payments.'}
              </p>
              <div className="pt-2 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Invoicing & Inventory Stock Control</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Customer Contacts & Multi-Division Catalog</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Record Payments (E-Payment & Cash)</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  {isAdmin ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-700">System Users & Roles Management</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="text-slate-400 line-through">System Users & Roles (Admin only)</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 font-medium">
                  {isAdmin ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-700">Financial Reports & Reconciliation</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="text-slate-400 line-through">Financial Reports (Admin only)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Profile Edit & Password Change Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card 1: Edit Profile Details (Name & Email) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Profile Information</h2>
                  <p className="text-xs text-slate-500">
                    Update your account name and registered email address.
                  </p>
                </div>
              </div>

              {profileError && (
                <div className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {profileError}
                  </div>
                </div>
              )}

              <form onSubmit={handleProfileUpdate} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="e.g. Ama Osei"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="admin@company.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Profile Changes */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 disabled:opacity-60 transition cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Card 2: Security & Change Password Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Security & Password</h2>
                  <p className="text-xs text-slate-500">
                    Update your account password to protect access and ensure security.
                  </p>
                </div>
              </div>

              {passwordError && (
                <div className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {passwordError}
                  </div>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="mt-6 space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition pr-11"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 transition pr-11"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Password must be at least 8 characters. We recommend including uppercase letters, numbers, and symbols.
                </p>

                {/* Submit button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingPassword}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/10 disabled:opacity-60 transition cursor-pointer"
                  >
                    {isSubmittingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
