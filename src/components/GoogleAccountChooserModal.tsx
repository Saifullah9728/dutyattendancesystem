import React, { useState, useEffect } from 'react';
import { UserPlus, ArrowLeft, ShieldCheck, Check, Globe } from 'lucide-react';

export interface GoogleAccountProfile {
  email: string;
  name: string;
  avatarUrl: string;
  googleId?: string;
  isSuperAdmin?: boolean;
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'signin' | 'signup';
  onSelectAccount: (account: GoogleAccountProfile) => Promise<void>;
  loading?: boolean;
}

const STORAGE_KEY_KNOWN_ACCOUNTS = 'duty_attendance_known_google_accounts';

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSelectAccount,
  loading = false,
}) => {
  const [knownAccounts, setKnownAccounts] = useState<GoogleAccountProfile[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Initialize accounts
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_KNOWN_ACCOUNTS);
      let list: GoogleAccountProfile[] = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch {}
      }
      setKnownAccounts(list);
    } catch {
      setKnownAccounts([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle account pick
  const handleAccountClick = async (account: GoogleAccountProfile) => {
    // Save to known list
    const updated = [account, ...knownAccounts.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase())];
    setKnownAccounts(updated);
    try {
      localStorage.setItem(STORAGE_KEY_KNOWN_ACCOUNTS, JSON.stringify(updated.slice(0, 5)));
    } catch {}

    await onSelectAccount(account);
  };

  // Handle custom new Google account add
  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setInputError('অনুগ্রহ করে জিমেইল অ্যাড্রেস লিখুন');
      return;
    }
    if (!cleanEmail.includes('@')) {
      setInputError('একটি সঠিক ইমেইল প্রদান করুন (যেমন: example@gmail.com)');
      return;
    }

    const cleanName = newName.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ');
    const isSaifullah = cleanEmail === 'hmdasaifullah28@gmail.com';

    const account: GoogleAccountProfile = {
      email: cleanEmail,
      name: cleanName,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284c7&color=fff&bold=true`,
      googleId: `google-${Date.now()}`,
      isSuperAdmin: isSaifullah,
    };

    setIsAddingNew(false);
    setNewEmail('');
    setNewName('');
    setInputError(null);
    await handleAccountClick(account);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Google Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Google</span>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-medium w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isAddingNew
              ? 'গুগল অ্যাকাউন্ট ইনপুট করুন'
              : mode === 'signin'
              ? 'একটি অ্যাকাউন্ট বেছে নিন (Sign In)'
              : 'একটি অ্যাকাউন্ট বেছে নিন (Sign Up)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAddingNew
              ? 'Duty & Attendance System এ এগিয়ে যেতে আপনার জিমেইল দিন'
              : 'Duty & Attendance System এ এগিয়ে যেতে আপনার ডিভাইসের অ্যাকাউন্ট সিলেক্ট করুন'}
          </p>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">গুগল অ্যাকাউন্ট যাচাই করা হচ্ছে...</p>
            <p className="text-xs text-slate-500 mt-1">অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন</p>
          </div>
        )}

        {/* Body content */}
        <div className="p-4 max-h-[380px] overflow-y-auto">
          {!isAddingNew ? (
            <div className="space-y-1.5">
              {knownAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleAccountClick(account)}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                >
                  <img
                    src={account.avatarUrl}
                    alt={account.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-blue-500 transition-all shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {account.name}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{account.email}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:border-blue-500 group-hover:bg-blue-500 text-white transition-all shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                </button>
              ))}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    setInputError(null);
                  }}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      অন্য একটি গুগল অ্যাকাউন্ট ব্যবহার করুন
                    </p>
                    <p className="text-[11px] text-slate-400">Use another Google account</p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddNewSubmit} className="space-y-4 py-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  setInputError(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> অ্যাকাউন্টের তালিকায় ফিরে যান
              </button>

              {inputError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
                  {inputError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  গুগল ইমেইল (Google Email)
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  আপনার নাম (Google Name)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Md. Saifullah"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">খালি রাখলে ইমেইল অনুসারে নাম নির্ধারিত হবে</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  চালিয়ে যান
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info note */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <p className="flex items-center gap-1.5 mb-1 text-slate-700 dark:text-slate-300 font-medium">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            Duty & Attendance System এর সাথে এগিয়ে যেতে Google আপনার নাম, ইমেইল ও প্রোফাইল ছবি শেয়ার করবে।
          </p>
          <div className="flex gap-3 text-[10px] text-slate-400 mt-1">
            <span className="hover:underline cursor-pointer">গোপনীয়তা নীতি (Privacy Policy)</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer">ব্যবহারের শর্তাবলী (Terms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
