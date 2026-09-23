import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Select, TablePagination } from '../components';
import {
  Users,
  UserPlus,
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Lock,
} from 'lucide-react';

interface SystemUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export default function UsersManagementPage() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'staff' as 'admin' | 'staff' });
  const [isAdding, setIsAdding] = useState(false);

  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'staff' as 'admin' | 'staff' });
  const [isEditing, setIsEditing] = useState(false);

  const [resetUser, setResetUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<SystemUser[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load system users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }
    setIsAdding(true);
    try {
      await api.post('/users', addForm);
      showToast(`User ${addForm.email} provisioned successfully.`);
      setShowAddModal(false);
      setAddForm({ name: '', email: '', password: '', role: 'staff' });
      void fetchUsers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create user.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }
    setIsEditing(true);
    try {
      await api.patch(`/users/${editUser.id}`, editForm);
      showToast(`User ${editForm.email} updated successfully.`);
      if (editUser.id === currentUser?.id) {
        updateUser({ name: editForm.name, email: editForm.email, role: editForm.role });
      }
      setEditUser(null);
      void fetchUsers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update user.', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const handleToggleActive = async (u: SystemUser) => {
    if (u.id === currentUser?.id) {
      showToast('You cannot deactivate your own account.', 'error');
      return;
    }
    try {
      if (u.isActive) {
        await api.post(`/users/${u.id}/deactivate`, {});
        showToast(`User ${u.email} deactivated.`);
      } else {
        await api.patch(`/users/${u.id}`, { isActive: true });
        showToast(`User ${u.email} reactivated.`);
      }
      void fetchUsers();
    } catch (err: any) {
      showToast(err?.message || 'Operation failed.', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || newPassword.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    setIsResetting(true);
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { password: newPassword });
      showToast(`Password reset successfully for ${resetUser.email}.`);
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset password.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Users size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">System Users & Roles</h1>
                <p className="text-xs text-slate-500">
                  Provision team accounts, assign RBAC permissions (Admin vs Staff), and manage security access.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs"
            >
              <UserPlus size={15} />
              <span>Invite New User</span>
            </button>
          </div>
        </div>

        {/* Directory Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search user name or email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
            <span className="text-xs text-slate-500 font-semibold">{filteredUsers.length} Users Registered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2 text-amber-600" />
                      Loading system accounts…
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                {u.name}
                                {isSelf && (
                                  <span className="rounded bg-amber-100 text-amber-800 px-1 py-0.2 text-[9px] font-bold">
                                    You
                                  </span>
                                )}
                              </span>
                              <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isAdmin
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-sky-100 text-sky-900 border border-sky-200'
                            }`}
                          >
                            {isAdmin ? <ShieldCheck size={11} /> : <UserCheck size={11} />}
                            <span>{u.role}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700 line-through'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">{formatDate(u.lastLoginAt)}</td>

                        <td className="py-3.5 px-6 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditUser(u);
                              setEditForm({ name: u.name, email: u.email, role: u.role });
                            }}
                            className="font-semibold text-slate-600 hover:text-slate-900 p-1"
                            title="Edit Role/Name/Email"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResetUser(u);
                              setNewPassword('');
                            }}
                            className="font-semibold text-amber-600 hover:text-amber-800 p-1"
                            title="Reset Password"
                          >
                            <KeyRound size={14} />
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`font-semibold p-1 ${u.isActive ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                              title={u.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                            >
                              {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={page}
            totalItems={filteredUsers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="users"
          />
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3">
              <UserPlus size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Invite New User</h2>
            <p className="text-xs text-slate-500 mt-0.5">Provision an active account with role-based permissions.</p>

            <form onSubmit={handleCreateUser} className="my-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Ama Osei"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="a.osei@company.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Temporary Password * (Min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={addForm.password}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <Select
                  label="Role Assignment *"
                  value={addForm.role}
                  onChange={(val) => setAddForm((prev) => ({ ...prev, role: val as any }))}
                  options={[
                    { value: 'staff', label: 'Staff (Operational access: clients, products, draft invoices, own expenses)' },
                    { value: 'admin', label: 'Admin (Full access: reports, settings, void/revise, system users & roles)' },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isAdding && <Loader2 size={13} className="animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setEditUser(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <h2 className="text-base font-bold text-slate-900">Edit User Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update user profile information, contact email, and RBAC role.</p>

            <form onSubmit={handleUpdateUser} className="my-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <Select
                  label="Role"
                  value={editForm.role}
                  onChange={(val) => setEditForm((prev) => ({ ...prev, role: val as any }))}
                  options={[
                    { value: 'staff', label: 'Staff (Operations & Billing)' },
                    { value: 'admin', label: 'Admin (Full Privileges)' },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isEditing && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setResetUser(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3">
              <KeyRound size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Reset User Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter a new secure password for <span className="font-semibold">{resetUser.email}</span>.
            </p>

            <form onSubmit={handleResetPassword} className="my-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password (Min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || newPassword.length < 8}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isResetting && <Loader2 size={13} className="animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
