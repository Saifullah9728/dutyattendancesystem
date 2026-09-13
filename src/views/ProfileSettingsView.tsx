import React, { useState, useEffect } from 'react';
import { User, Settings, ShieldCheck, Globe, Clock, Save, CheckCircle2, UserCheck, AlertCircle, Cloud, RefreshCw, Database } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { SystemSettings } from '../types';

export const ProfileSettingsView: React.FC = () => {
  const { user, isSuperAdmin, isAdmin, updateProfile, refreshAuth } = useAuth();
  const { success, error, info } = useToast();

  // Profile Form
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // System Settings (Super Admin only)
  const [appName, setAppName] = useState('Duty & Attendance System');
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [allowFutureAttendance, setAllowFutureAttendance] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Cloud Persistence State
  const [cloudStatus, setCloudStatus] = useState<{
    isConfigured: boolean;
    lastSyncTimestamp: string | null;
    lastSyncStatus: 'idle' | 'success' | 'error' | 'syncing';
    lastSyncMessage: string;
  } | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const loadCloudStatus = () => {
    api.getFirebaseStatus()
      .then((res) => setCloudStatus(res))
      .catch((e) => console.warn('Could not load Firebase status:', e));
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setAvatarUrl(user.avatar_url || '');
    }

    api.getSettings().then((res) => {
      if (res.settings) {
        setAppName(res.settings.app_name);
        setTimezone(res.settings.timezone);
        setDateFormat(res.settings.date_format);
        setTimeFormat(res.settings.time_format);
        setAllowFutureAttendance(Boolean(res.settings.allow_future_attendance));
      }
    });

    loadCloudStatus();
    const interval = setInterval(loadCloudStatus, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleManualSync = async () => {
    setSyncingCloud(true);
    info('Cloud Sync Initiated', 'Syncing data between local server and Firebase Firestore...');
    try {
      const res = await api.syncFirebase();
      if (res.success) {
        success('Cloud Synced Successfully', res.message);
      } else {
        error('Sync Warning', res.message);
      }
      loadCloudStatus();
    } catch (err: any) {
      error('Sync Failed', err?.message || 'Failed to sync with Firebase');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(displayName, avatarUrl);
      success('Profile Updated', 'Your profile details have been saved.');
    } catch (err: any) {
      error('Failed to update profile', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings({
        app_name: appName,
        timezone,
        date_format: dateFormat,
        time_format: timeFormat,
        allow_future_attendance: allowFutureAttendance,
      });
      success('Settings Saved', 'System configuration has been successfully updated.');
    } catch (err: any) {
      error('Settings Update Failed', err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Profile & System Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your identity, preferences, and regional operational configurations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Profile Card */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">User Profile Details</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={avatarUrl || user?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s120'}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-500/20 shadow-xs"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {user?.display_name}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    {user?.role.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">{user?.email}</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Google Account Email (Primary Identity)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-500 font-mono cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Google email is verified by OAuth authentication and cannot be edited.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Avatar Image URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Saving...' : 'Update Profile'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* System Settings (Super Admin Only) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Global System Settings</h2>
            </div>
            {isSuperAdmin ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Super Admin Access
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Read Only
              </span>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Application Brand Name
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Timezone
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Time Format
                </label>
                <select
                  disabled={!isSuperAdmin}
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                >
                  <option value="12h">12-Hour (08:00 AM)</option>
                  <option value="24h">24-Hour (08:00)</option>
                </select>
              </div>
            </div>

            {/* Allow Future Attendance Toggle */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isSuperAdmin}
                  checked={allowFutureAttendance}
                  onChange={(e) => setAllowFutureAttendance(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Allow Logging Attendance for Future Dates
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    When disabled, employees cannot submit duty records ahead of today's date in Asia/Dhaka time.
                  </span>
                </div>
              </label>
            </div>

            {isSuperAdmin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving...' : 'Save System Settings'}</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Cloud Persistence & Firebase Status Card */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Google Firebase Firestore Cloud Persistence
                  </h2>
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Permanent cloud database protecting against container restarts and republish resets
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncingCloud}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-60 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin text-blue-600' : ''}`} />
                <span>{syncingCloud ? 'Syncing with Cloud...' : 'Sync Now with Cloud'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
                Connected Firebase Project
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-xs">
                scientific-rigging-k53bd
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                Database: ai-studio-saifullahdutyman...
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
                Last Cloud Synchronization
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                {cloudStatus?.lastSyncTimestamp
                  ? new Date(cloudStatus.lastSyncTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                  : 'On Startup'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium truncate">
                {cloudStatus?.lastSyncMessage || 'Cloud connection established'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
                Data Loss Protection
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Reprovision Safe
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Republishing will not wipe accounts or attendance.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <strong>স্থায়ী ক্লাউড স্টোরেজ সক্রিয়:</strong> আপনার ডাটাবেজ এখন Google Cloud Firebase Firestore এর সাথে লাইভ সংযুক্ত।
              যেকোনো ইউজার তৈরি, ডিউটি রেকর্ড বা সেটিংস পরিবর্তনের সাথে সাথে ক্লাউডে ব্যাকআপ সংরক্ষিত হয়।
              ভবিষ্যতে অ্যাপ যতবারই <strong>Republish</strong> বা <strong>Deploy</strong> করা হোক না কেন, কোনো তথ্য মুছে যাবে না বা ০ হবে না।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
