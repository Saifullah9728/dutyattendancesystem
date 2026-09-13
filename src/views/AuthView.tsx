import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { GoogleAccountChooserModal, type GoogleAccountProfile } from '../components/GoogleAccountChooserModal';
import {
  LogIn,
  UserPlus,
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  Shield,
  Info,
  Globe,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  firebaseConfig.oAuthClientId ||
  '446079436979-lvfn81h8efuu7ag8imrtluum6in0b1qi.apps.googleusercontent.com';

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

type Lang = 'en' | 'bn';

const TEXTS = {
  en: {
    systemTitle: 'Duty & Attendance System',
    systemSubtitle: 'Official Duty Shift, Attendance & Working Hours Portal',
    signInTab: 'Sign In',
    signUpTab: 'Sign Up',
    signInPrompt: 'Sign in directly with your Google Account. No password needed.',
    signUpPrompt: 'Create your employee account in one click with your Google Account. Profile details are loaded automatically.',
    continueWithGoogle: 'Continue with Google',
    signUpWithGoogle: 'Sign up with Google',
    securityNotice: 'Google Identity Services & Client ID Active',
    noAccountPrompt: "Don't have an account?",
    createNewAccount: 'Create New Account (Sign Up)',
    alreadyHaveAccount: 'Already have an account?',
    signInNow: 'Sign In',
    switchAccountHelp: 'Having trouble or want to select account directly?',
    signUpNowBtn: 'Sign Up with Google Now',
    goToSignInBtn: 'Go to Sign In (Sign In with Google)',
    credentialError: 'Could not retrieve credential from Google.',
    decodeError: 'Could not decode Google profile information.',
    profileLoadError: 'Failed to load Google profile information.',
    authFailed: 'Authentication Failed',
    welcome: 'Welcome!',
    accountCreated: 'Account Created!',
    signedInAs: (name: string) => `Successfully signed in as ${name}`,
  },
  bn: {
    systemTitle: 'Duty & Attendance System',
    systemSubtitle: 'অফিসিয়াল ডিউটি শিফট, উপস্থিতি ও ওয়ার্কিং আওয়ার পোর্টাল',
    signInTab: 'সাইন ইন (Sign In)',
    signUpTab: 'নতুন অ্যাকাউন্ট (Sign Up)',
    signInPrompt: 'আপনার ডিভাইসে থাকা Google Account দিয়ে সরাসরি লগইন করুন। কোনো পাসওয়ার্ড টাইপ করার প্রয়োজন নেই।',
    signUpPrompt: 'আপনার Google Account দিয়ে এক ক্লিকেই নতুন আইডি তৈরি করুন। নাম ও ছবি গুগল থেকে স্বয়ংক্রিয়ভাবে লোড হবে।',
    continueWithGoogle: 'গুগল দিয়ে সাইন ইন (Continue with Google)',
    signUpWithGoogle: 'গুগল দিয়ে সাইন আপ (Sign up with Google)',
    securityNotice: 'Google Identity Services ও Client ID সক্রিয়',
    noAccountPrompt: 'পূর্বে কোনো অ্যাকাউন্ট নেই?',
    createNewAccount: 'নতুন অ্যাকাউন্ট তৈরি করুন (Sign Up)',
    alreadyHaveAccount: 'ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে?',
    signInNow: 'সাইন ইন করুন (Sign In)',
    switchAccountHelp: 'সমস্যা হচ্ছে বা সরাসরি অ্যাকাউন্ট বেছে নিতে চান?',
    signUpNowBtn: 'এখনই Sign Up with Google করুন',
    goToSignInBtn: 'সাইন ইন ট্যাবে যান (Sign In with Google)',
    credentialError: 'গুগল থেকে ক্রেডেনশিয়াল পাওয়া যায়নি',
    decodeError: 'গুগল প্রোফাইল তথ্য ডিকোড করা সম্ভব হয়নি',
    profileLoadError: 'গুগল প্রোফাইল তথ্য লোড করতে সমস্যা হয়েছে।',
    authFailed: 'অথেনটিকেশন ব্যর্থ',
    welcome: 'স্বাগতম!',
    accountCreated: 'অ্যাকাউন্ট তৈরি সম্পন্ন!',
    signedInAs: (name: string) => `${name} হিসেবে সফলভাবে লগইন হয়েছে`,
  },
};

export const AuthView: React.FC = () => {
  const { googleLogin } = useAuth();
  const { success, error: toastError } = useToast();

  // Language state (default: English)
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('duty_app_auth_lang');
    return saved === 'bn' ? 'bn' : 'en';
  });

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);

  const googleNativeBtnRef = useRef<HTMLDivElement>(null);
  const t = TEXTS[lang];

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('duty_app_auth_lang', newLang);
  };

  // Initialize official Google Identity Services (GSI)
  useEffect(() => {
    let checkInterval: any;
    const initGsi = () => {
      const gWindow = window as any;
      if (!gWindow?.google?.accounts?.id) return false;

      try {
        gWindow.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            if (!response.credential) {
              setErrorMessage(t.credentialError);
              return;
            }
            const profile = decodeJwt(response.credential);
            if (profile && profile.email) {
              await handleAccountSelect({
                email: profile.email,
                name: profile.name || profile.given_name || profile.email.split('@')[0],
                avatarUrl: profile.picture || '',
                googleId: profile.sub,
              });
            } else {
              setErrorMessage(t.decodeError);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleNativeBtnRef.current) {
          googleNativeBtnRef.current.innerHTML = '';
          const calculatedWidth = Math.min(Math.max(window.innerWidth - 64, 260), 380);
          gWindow.google.accounts.id.renderButton(googleNativeBtnRef.current, {
            type: 'standard',
            shape: 'pill',
            theme: 'filled_blue',
            text: activeTab === 'signin' ? 'signin_with' : 'signup_with',
            size: 'large',
            logo_alignment: 'left',
            width: calculatedWidth,
            locale: lang === 'bn' ? 'bn' : 'en',
          });
          setIsGsiLoaded(true);
        }
        return true;
      } catch (err: any) {
        console.warn('GSI render error:', err);
        setIsGsiLoaded(false);
        return false;
      }
    };

    if (!initGsi()) {
      checkInterval = setInterval(() => {
        if (initGsi()) {
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [activeTab, lang]);

  // Trigger Google Sign-In / Sign-Up
  const handleOpenGoogleAuth = () => {
    setErrorMessage(null);

    const gWindow = window as any;

    // Check if on mobile or if Google One Tap is available
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 640 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (isMobile && gWindow?.google?.accounts?.id) {
      try {
        gWindow.google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google One Tap prompt notice:', e);
      }
    }

    // Try Google Identity Services OAuth2 Token Client popup
    if (gWindow?.google?.accounts?.oauth2) {
      try {
        setLoading(true);
        const tokenClient = gWindow.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setLoading(false);
              if (tokenResponse.error === 'popup_closed_by_user') {
                return;
              }
              // Fallback to chooser popup
              setIsChooserOpen(true);
              return;
            }
            try {
              // Fetch user profile from Google OAuth2 API
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await res.json();
              await handleAccountSelect({
                email: profile.email,
                name: profile.name || profile.given_name || profile.email.split('@')[0],
                avatarUrl: profile.picture || '',
                googleId: profile.sub,
              });
            } catch (err: any) {
              console.error('Failed to fetch Google profile:', err);
              setErrorMessage(t.profileLoadError);
              setLoading(false);
              setIsChooserOpen(true);
            }
          },
          error_callback: (nonOAuthError: any) => {
            console.warn('OAuth non-oauth error:', nonOAuthError);
            setLoading(false);
            setIsChooserOpen(true);
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Google GSI initTokenClient fallback to account chooser modal:', err);
        setLoading(false);
      }
    }

    // Fallback: Try Prompt One-Tap
    if (gWindow?.google?.accounts?.id) {
      try {
        gWindow.google.accounts.id.prompt();
      } catch {}
    }

    // Default: Open the official Google Account Chooser popup
    setIsChooserOpen(true);
  };

  // Process chosen account
  const handleAccountSelect = async (account: GoogleAccountProfile) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      await googleLogin(account.email, account.name, account.avatarUrl, activeTab);
      setIsChooserOpen(false);
      success(
        activeTab === 'signin' ? t.welcome : t.accountCreated,
        t.signedInAs(account.name)
      );
    } catch (err: any) {
      console.error('Auth Error:', err);
      const msg = err.data?.error || err.message || t.authFailed;
      setErrorMessage(msg);
      toastError(t.authFailed, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-3.5 sm:px-4 py-6 sm:py-12 selection:bg-blue-500 selection:text-white">
      {/* Background ambient accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-5 sm:mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-3 sm:mb-4 ring-4 ring-white dark:ring-slate-900">
            <CalendarCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t.systemTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium px-2">
            {t.systemSubtitle}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-4 sm:p-7">
          {/* Language Switcher Bar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'en' ? 'Language' : 'ভাষা'}:</span>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/70 dark:border-slate-700/70">
              <button
                id="btn-lang-en"
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all min-h-[30px] ${
                  lang === 'en'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                English
              </button>
              <button
                id="btn-lang-bn"
                type="button"
                onClick={() => handleLanguageChange('bn')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all min-h-[30px] ${
                  lang === 'bn'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 mb-5 sm:mb-6 border border-slate-200/50 dark:border-slate-700/50">
            <button
              id="tab-btn-signin"
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all ${
                activeTab === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t.signInTab}</span>
            </button>
            <button
              id="tab-btn-signup"
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all ${
                activeTab === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.signUpTab}</span>
            </button>
          </div>

          {/* Dynamic Error Notification Banner */}
          {errorMessage && (
            <div className="mb-5 sm:mb-6 p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 sm:gap-3 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMessage}</p>
                {activeTab === 'signin' && errorMessage.toLowerCase().includes('sign up') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setErrorMessage(null);
                      handleOpenGoogleAuth();
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 hover:underline bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 shadow-sm text-xs"
                  >
                    {t.signUpNowBtn} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {activeTab === 'signup' && errorMessage.toLowerCase().includes('sign in') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setErrorMessage(null);
                      handleOpenGoogleAuth();
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 hover:underline bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 shadow-sm text-xs"
                  >
                    {t.goToSignInBtn} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pure Google Auth Action Area */}
          <div className="py-1 text-center space-y-4">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {activeTab === 'signin' ? t.signInPrompt : t.signUpPrompt}
              </p>
            </div>

            {/* Smart Single Google Button Area (Never displays two buttons) */}
            <div className="flex flex-col items-center justify-center min-h-[48px]">
              {/* Official Google Identity Services Button */}
              <div
                ref={googleNativeBtnRef}
                className={isGsiLoaded ? 'min-h-[44px] flex justify-center w-full max-w-[380px]' : 'hidden'}
              />

              {/* Fallback Custom Google Button (Only shown if official GSI hasn't loaded) */}
              {!isGsiLoaded && (
                <button
                  id="google-main-auth-btn"
                  type="button"
                  disabled={loading}
                  onClick={handleOpenGoogleAuth}
                  className="w-full max-w-[380px] flex items-center justify-center gap-2.5 sm:gap-3 px-4 py-3 sm:py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-md shadow-slate-200/50 dark:shadow-none transition-all duration-200 active:scale-[0.98] group min-h-[48px]"
                >
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span className="truncate">
                    {activeTab === 'signin' ? t.continueWithGoogle : t.signUpWithGoogle}
                  </span>
                </button>
              )}

              {/* Clean fallback text link to directly select account without any scary tech messages */}
              <div className="pt-2">
                <button
                  id="btn-manual-account-chooser"
                  type="button"
                  onClick={() => setIsChooserOpen(true)}
                  className="text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 underline transition-colors"
                >
                  {t.switchAccountHelp}
                </button>
              </div>
            </div>
          </div>

          {/* Toggle Tab Footer */}
          <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
            {activeTab === 'signin' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.noAccountPrompt}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setErrorMessage(null);
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-block p-1"
                >
                  {t.createNewAccount}
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.alreadyHaveAccount}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setErrorMessage(null);
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-block p-1"
                >
                  {t.signInNow}
                </button>
              </p>
            )}
            
            {/* Legal Links for OAuth Compliance */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <a href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Google Account Chooser Popup Modal */}
      <GoogleAccountChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        mode={activeTab}
        onSelectAccount={handleAccountSelect}
        loading={loading}
      />
    </div>
  );
};
