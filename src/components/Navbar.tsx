import React, { useState, useEffect } from 'react';
import { Clock, Sun, Moon, ShieldCheck, UserCheck, ChevronDown, LogIn, LogOut, Sparkles, Laptop, Cloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { GoogleAccountChooserModal, type GoogleAccountProfile } from './GoogleAccountChooserModal';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenMobileMenu: () => void;
  onOpenRecordModal: () => void;
}

export const BrandLogo: React.FC<{ className?: string; iconOnly?: boolean }> = ({ className = 'h-9', iconOnly = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Custom crafted SVG combining Clock, Shift Schedule Grid, and Attendance Checkmark */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 text-white shrink-0">
        <svg viewBox="0 0 40 40" className="w-6 h-6 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
          {/* Clock Circle */}
          <circle cx="20" cy="20" r="14" className="stroke-white/60" strokeWidth="2.2" />
          {/* Shift 9-hour arc indicator */}
          <path d="M20 10 A10 10 0 1 1 10 20" className="stroke-white" strokeWidth="2.8" strokeDasharray="3 2" />
          {/* Clock Hands */}
          <polyline points="20 14 20 20 25 22" className="stroke-white" strokeWidth="2.2" />
          {/* Verification checkmark badge */}
          <circle cx="27" cy="27" r="6.5" className="fill-emerald-500 stroke-white stroke-[1.8]" />
          <polyline points="24.5 27 26.5 29 29.5 25" className="stroke-white stroke-[1.8]" />
        </svg>
      </div>

      {!iconOnly && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              DUTY & ATTENDANCE
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
              SYSTEM
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
            Shift & Working Hours Management
          </span>
        </div>
      )}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  onOpenMobileMenu,
  onOpenRecordModal,
}) => {
  const { user, switchUser, googleLogin, logout, isSuperAdmin, isAdmin } = useAuth();
  const { success, info } = useToast();
  const [dhakaTime, setDhakaTime] = useState('');
  const [dhakaDate, setDhakaDate] = useState('');
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [switchingLoading, setSwitchingLoading] = useState(false);

  // Live Asia/Dhaka Clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Dhaka',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Dhaka',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        setDhakaTime(timeFormatter.format(now));
        setDhakaDate(dateFormatter.format(now));
      } catch {
        const now = new Date();
        setDhakaTime(now.toLocaleTimeString());
        setDhakaDate(now.toLocaleDateString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchGoogleAccount = async (account: GoogleAccountProfile) => {
    setSwitchingLoading(true);
    try {
      await googleLogin(account.email, account.name, account.avatarUrl);
      success('সাইন ইন সফল', `${account.name} হিসেবে অ্যাকাউন্ট সক্রিয় হয়েছে`);
      setShowGoogleChooser(false);
    } catch (err: any) {
      // error handled in context/toast
    } finally {
      setSwitchingLoading(false);
    }
  };

  const triggerGoogleSwitch = () => {
    setShowSwitchDropdown(false);
    const gWindow = window as any;
    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      '1054300024756-51am3fpthoj2tn2ge69rlvdf9a0hikab.apps.googleusercontent.com';

    if (gWindow?.google?.accounts?.oauth2) {
      try {
        const tokenClient = gWindow.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await res.json();
                await googleLogin(profile.email, profile.name, profile.picture);
                success('সাইন ইন সফল', `${profile.name} হিসেবে অ্যাকাউন্ট সক্রিয় হয়েছে`);
                return;
              } catch (e) {
                console.error('Failed to fetch userinfo:', e);
              }
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Google switch fallback:', err);
      }
    }
    setShowGoogleChooser(true);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      {/* Left: Mobile Menu Toggle & Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-1 sm:-ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="lg:hidden">
          <BrandLogo iconOnly className="sm:hidden" />
          <div className="hidden sm:block">
            <BrandLogo />
          </div>
        </div>

        {/* Live Asia/Dhaka Clock - Desktop */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold tabular-nums">{dhakaTime}</span>
          <span className="text-slate-400 dark:text-slate-500">•</span>
          <span>{dhakaDate}</span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold ml-1">
            Asia/Dhaka
          </span>
        </div>

        {/* Live Firebase Firestore Cloud Persistence Badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-[11px] font-semibold text-sky-800 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80"
          title="Google Cloud Firebase Firestore Persistence Active"
        >
          <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Cloud Synced</span>
        </div>

        {/* Live Asia/Dhaka Clock - Mobile/Tablet compact */}
        <div className="flex md:hidden items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold tabular-nums text-[10px] sm:text-xs">{dhakaTime}</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Quick Duty Record Button */}
        <button
          id="btn-quick-record-attendance"
          onClick={onOpenRecordModal}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all min-h-[40px]"
        >
          <Clock className="w-4 h-4" />
          <span>Record Duty</span>
        </button>

        {/* Quick Duty Record Button for Small Mobile */}
        <button
          id="btn-quick-record-mobile"
          onClick={onOpenRecordModal}
          className="flex sm:hidden items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white shadow-sm active:scale-95"
          title="Record Duty"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* Dark Mode Toggle */}
        <button
          id="btn-toggle-dark-mode"
          onClick={() => setDarkMode((prev) => !prev)}
          className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* Profile & Account Switcher / Logout */}
        <div className="relative">
          <button
            id="btn-user-profile-menu"
            onClick={() => setShowSwitchDropdown((prev) => !prev)}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left min-h-[40px]"
          >
            <img
              src={user?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s120'}
              alt={user?.display_name || 'User'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-blue-500/30"
              referrerPolicy="no-referrer"
            />
            <div className="hidden lg:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                {user?.display_name || 'Saifullah'}
              </span>
              <div className="flex items-center gap-1">
                {isSuperAdmin ? (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Super Admin
                  </span>
                ) : isAdmin ? (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <UserCheck className="w-3 h-3" /> Employee
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Clean Production Dropdown */}
          {showSwitchDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.display_name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    Role: {user?.role.replace('_', ' ')}
                  </span>
                  {isSuperAdmin && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                      Super Admin
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 px-3 space-y-1">
                <button
                  onClick={triggerGoogleSwitch}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-colors text-left"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>অন্য Google অ্যাকাউন্টে পরিবর্তন করুন</span>
                </button>

                <button
                  id="navbar-logout-btn"
                  onClick={async () => {
                    setShowSwitchDropdown(false);
                    await logout();
                    info('লগআউট সম্পন্ন', 'আপনি সফলভাবে সাইন আউট করেছেন');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>সাইন আউট (Sign Out)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Account Chooser Popup Modal */}
      <GoogleAccountChooserModal
        isOpen={showGoogleChooser}
        onClose={() => setShowGoogleChooser(false)}
        mode="signin"
        onSelectAccount={handleSwitchGoogleAccount}
        loading={switchingLoading}
      />
    </header>
  );
};
