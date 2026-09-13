import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, AlertTriangle, UserPlus, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { User } from '../types';

export const AdminManagementView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { success, error, warning } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserToPromote, setSelectedUserToPromote] = useState('');
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<'admin' | 'super_admin'>('admin');
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      error('Failed to load users', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const adminUsers = users.filter((u) => u.role === 'admin' || u.role === 'super_admin');
  const nonAdminUsers = users.filter((u) => u.role === 'user');

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToPromote) {
      warning('Selection Required', 'Please select an employee to promote.');
      return;
    }

    const targetUser = users.find((u) => u.id === selectedUserToPromote);
    if (!targetUser) return;

    if (!window.confirm(`Are you sure you want to promote ${targetUser.display_name} to ${selectedRoleToAssign.replace('_', ' ').toUpperCase()}?`)) {
      return;
    }

    try {
      await api.updateUserRole(targetUser.id, selectedRoleToAssign);
      success('Role Assigned', `Promoted ${targetUser.display_name} to ${selectedRoleToAssign}.`);
      setSelectedUserToPromote('');
      loadUsers();
    } catch (err: any) {
      error('Role Assignment Failed', err.message);
    }
  };

  const isProtectedAdmin = (email: string) =>
    ['hmdasaifullah28@gmail.com'].includes((email || '').toLowerCase());

  const handleDemote = async (targetUser: User) => {
    if (isProtectedAdmin(targetUser.email)) {
      warning('Action Forbidden', 'The primary Super Admin (Saifullah) cannot be demoted or modified.');
      return;
    }

    const superAdminsCount = users.filter((u) => u.role === 'super_admin').length;
    if (targetUser.role === 'super_admin' && superAdminsCount <= 1) {
      warning('Safety Restriction', 'Cannot remove the last active Super Admin in the system.');
      return;
    }

    if (!window.confirm(`Are you sure you want to demote ${targetUser.display_name} back to regular Employee (User)?`)) {
      return;
    }

    try {
      await api.updateUserRole(targetUser.id, 'user');
      success('Role Updated', `${targetUser.display_name} has been reverted to regular Employee.`);
      loadUsers();
    } catch (err: any) {
      error('Demotion Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Admin & Role Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Super Admin authority to assign administrators and safeguard security policies
            </p>
          </div>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
          Authorized Super Admin View
        </div>
      </div>

      {/* Safety Policy Banner */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">Built-in Role Protection Safeguards:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
            <li>Account <strong>hmdasaifullah28@gmail.com</strong> is hardcoded as the root permanent Super Admin and cannot be demoted or deactivated.</li>
            <li>System strictly prevents removing the last Super Admin, protecting against administrator lockout.</li>
            <li>All role promotions and demotions generate an immutable audit log entry.</li>
          </ul>
        </div>
      </div>

      {/* Assign New Admin Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Promote Employee to Administrative Role
          </h3>
        </div>

        <form onSubmit={handlePromote} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Regular Employee
            </label>
            <select
              value={selectedUserToPromote}
              onChange={(e) => setSelectedUserToPromote(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Choose employee to promote --</option>
              {nonAdminUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Role
            </label>
            <select
              value={selectedRoleToAssign}
              onChange={(e) => setSelectedRoleToAssign(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="admin">Admin (Operational Management)</option>
              <option value="super_admin">Super Admin (Full System Control)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!selectedUserToPromote}
              className="w-full px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
            >
              Promote
            </button>
          </div>
        </form>
      </div>

      {/* Current Administrators List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden space-y-1">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Current Administrators & Super Admins ({adminUsers.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {adminUsers.map((admin) => (
            <div key={admin.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <img
                  src={admin.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s120'}
                  alt={admin.display_name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/20"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span>{admin.display_name}</span>
                    {admin.role === 'super_admin' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Super Admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{admin.email}</div>
                </div>
              </div>

              <div className="self-end sm:self-auto">
                {!isProtectedAdmin(admin.email) ? (
                  <button
                    onClick={() => handleDemote(admin)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Demote to User
                  </button>
                ) : (
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50">
                    Protected Root Admin
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
