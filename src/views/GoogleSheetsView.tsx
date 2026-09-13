import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  History,
  Link2,
  Unlink,
  HelpCircle,
  Calendar,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Clock,
  UserCheck,
  UserX,
  Lock,
  Mail,
  Send,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { GoogleSheetConfig, SyncLog, SheetAccessRequest } from '../types';
import { GOOGLE_CLIENT_ID } from './AuthView';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import app from '../lib/firebase';

const GOOGLE_CONSOLE_TEST_USERS_URL =
  'https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0438759415';

export const GoogleSheetsView: React.FC = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'personal' | 'master' | 'requests'>('personal');
  const [personalConfig, setPersonalConfig] = useState<GoogleSheetConfig | null>(null);
  const [masterConfig, setMasterConfig] = useState<GoogleSheetConfig | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(() => Boolean(sessionStorage.getItem('google_sheets_token')));
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Access control states
  const [accessStatus, setAccessStatus] = useState<{
    hasAccess: boolean;
    isPrivileged: boolean;
    request: SheetAccessRequest | null;
  } | null>(null);
  const [accessRequests, setAccessRequests] = useState<SheetAccessRequest[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [requestsFilter, setRequestsFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Form states
  const [sheetUrlOrId, setSheetUrlOrId] = useState('');
  const [syncMode, setSyncMode] = useState<'auto' | 'manual'>('manual');

  const currentConfig = activeTab === 'personal' ? personalConfig : masterConfig;
  const isConnected = Boolean(currentConfig && currentConfig.spreadsheet_id && currentConfig.spreadsheet_id.trim());

  // Extract spreadsheet ID from standard Google Sheets URL or raw ID
  const parseSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch access status
      const statusRes = await api.getSheetAccessStatus().catch(() => ({
        hasAccess: isAdmin || isSuperAdmin,
        isPrivileged: isAdmin || isSuperAdmin,
        request: null,
      }));
      setAccessStatus(statusRes);

      // 2. Fetch admin requests if privileged
      if (isAdmin || isSuperAdmin) {
        const reqsRes = await api.getSheetAccessRequests().catch(() => ({ requests: [], pendingCount: 0 }));
        setAccessRequests(reqsRes.requests);
        setPendingRequestsCount(reqsRes.pendingCount);
      }

      // 3. Fetch configs if user has access
      if (statusRes.hasAccess || isAdmin || isSuperAdmin) {
        const [pRes, mRes, logsRes] = await Promise.all([
          api.getSheetConfig('personal').catch(() => ({ config: null })),
          isAdmin || isSuperAdmin
            ? api.getSheetConfig('master').catch(() => ({ config: null }))
            : Promise.resolve({ config: null }),
          api.getSyncLogs(activeTab === 'master' ? 'master' : 'personal').catch(() => ({ logs: [] })),
        ]);

        setPersonalConfig(pRes.config);
        if (mRes) setMasterConfig(mRes.config);
        setSyncLogs(logsRes.logs);

        // Pre-fill form if configured
        const activeConf = activeTab === 'personal' ? pRes.config : mRes?.config;
        if (activeConf && activeConf.spreadsheet_id) {
          setSheetUrlOrId(activeConf.spreadsheet_id);
          setSyncMode(activeConf.sync_mode);
        } else {
          setSheetUrlOrId('');
          setSyncMode('manual');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, user]);

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRequest(true);
    try {
      const res = await api.requestSheetAccess({ reason: requestReason });
      success('Request Submitted', res.message || 'Your access request was sent to Super Admin.');
      setRequestReason('');
      await loadData();
    } catch (err: any) {
      error('Request Failed', err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    setReviewingId(id);
    try {
      await api.reviewSheetAccessRequest(id, status);
      success(
        status === 'approved' ? 'Access Approved' : 'Request Declined',
        `User request has been marked as ${status}.`
      );
      await loadData();
    } catch (err: any) {
      error('Review Action Failed', err.message);
    } finally {
      setReviewingId(null);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    success('Email Copied', `${email} copied! Now paste into Google Cloud Console under Test Users.`);
    setTimeout(() => setCopiedEmail(null), 3000);
  };

  const handleSaveCustomConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = parseSpreadsheetId(sheetUrlOrId);
    if (!parsedId) {
      error('Configuration Error', 'Please enter a valid Google Spreadsheet URL or Spreadsheet ID.');
      return;
    }

    try {
      const res = await api.saveSheetConfig({
        spreadsheet_id: parsedId,
        sheet_tab_name: 'Monthly Tabs',
        sheet_type: activeTab === 'master' ? 'master' : 'personal',
        sync_mode: syncMode,
      });

      if (activeTab === 'personal') {
        setPersonalConfig(res.config);
      } else {
        setMasterConfig(res.config);
      }
      success('Connected Google Sheet', `Saved configuration for ${activeTab} sheet.`);
    } catch (err: any) {
      error('Configuration Failed', err.message);
    }
  };

  const handleDisconnect = async () => {
    const type = activeTab === 'master' ? 'master' : 'personal';
    if (!window.confirm(`Disconnect this ${type} Google Sheet?`)) return;
    try {
      await api.disconnectSheet(type);
      if (activeTab === 'personal') setPersonalConfig(null);
      else setMasterConfig(null);
      setSheetUrlOrId('');
      success('Disconnected', `Disconnected ${type} Google Sheet.`);
    } catch (err: any) {
      error('Failed to disconnect', err.message);
    }
  };

  const requestGoogleToken = async (): Promise<string | null> => {
    // 1. Try Firebase Auth popup with sheets scope
    try {
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const googleCred = GoogleAuthProvider.credentialFromResult(cred);
      if (googleCred?.accessToken) {
        return googleCred.accessToken;
      }
    } catch (err: any) {
      console.warn('Firebase popup attempt note:', err?.message);
    }

    // 2. Fallback to GIS TokenClient
    const gWindow = window as any;
    if (gWindow?.google?.accounts?.oauth2) {
      return new Promise<string | null>((resolve) => {
        try {
          const tokenClient = gWindow.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: (tokenResponse: any) => {
              if (tokenResponse?.access_token) {
                resolve(tokenResponse.access_token);
              } else {
                resolve(null);
              }
            },
            error_callback: (err: any) => {
              console.warn('GIS tokenClient error:', err);
              resolve(null);
            },
          });
          tokenClient.requestAccessToken({ prompt: 'select_account' });
        } catch {
          resolve(null);
        }
      });
    }

    return null;
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      let token = sessionStorage.getItem('google_sheets_token');
      if (!token) {
        info('Google Authorization', 'Opening Google prompt to authorize access to your Google Sheets...');
        token = await requestGoogleToken();
        if (token) {
          sessionStorage.setItem('google_sheets_token', token);
          setHasValidToken(true);
        } else {
          error('Authorization Required', 'Google Sheets permission was not granted. Please allow access in the Google popup.');
          setIsSyncing(false);
          return;
        }
      }

      // Check if user specified a custom sheet ID in form
      const customId = parseSpreadsheetId(sheetUrlOrId);

      const res = await api.syncSheet(activeTab === 'master' ? 'master' : 'personal', token, customId || undefined);
      if (res.success) {
        success(
          'Synchronization Completed',
          res.message || `Successfully synchronized ${res.recordsCount} records to Google Sheets with monthly tabs.`
        );
        if (res.spreadsheetId) {
          setSheetUrlOrId(res.spreadsheetId);
        }
      } else {
        if (res.message?.includes('expired') || res.message?.includes('token') || res.message?.includes('401')) {
          sessionStorage.removeItem('google_sheets_token');
          setHasValidToken(false);
        }
        error('Sync Error', res.message || 'Synchronization encountered an issue.');
      }
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to sync with Google Sheets.';
      if (msg.includes('expired') || msg.includes('token') || msg.includes('401')) {
        sessionStorage.removeItem('google_sheets_token');
        setHasValidToken(false);
      }
      error('Sync Error', msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const spreadsheetLink = currentConfig?.spreadsheet_id
    ? `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheet_id}/edit`
    : null;

  const filteredRequests = accessRequests.filter((r) => {
    if (requestsFilter === 'all') return true;
    return r.status === requestsFilter;
  });

  const isPrivileged = isAdmin || isSuperAdmin;
  const userHasApprovedAccess = isPrivileged || Boolean(accessStatus?.hasAccess);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Google Sheets Synchronization Hub
              </h1>
              {userHasApprovedAccess ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Approved</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <Lock className="w-3 h-3" />
                  <span>Approval Required</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Automated multi-tab monthly export to your personal Google Drive
            </p>
          </div>
        </div>

        {/* Global Sync Button (Only if user has approved access and on sheet tabs) */}
        {userHasApprovedAccess && activeTab !== 'requests' && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'Synchronizing...'
                : isConnected
                ? 'Sync to Google Sheets'
                : 'Auto-Create & Sync'}
            </span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
            activeTab === 'personal'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Personal Google Sheet ({user?.display_name || 'My Records'})
        </button>

        {isPrivileged && (
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              activeTab === 'master'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Master Google Sheet (All Employees)</span>
          </button>
        )}

        {isPrivileged && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              activeTab === 'requests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Sync Access Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CASE A: ADMIN ACCESS REQUESTS MANAGEMENT VIEW                             */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && isPrivileged && (
        <div className="space-y-6">
          {/* Quick Guide Card for Super Admin */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-indigo-950/40 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Super Admin Free-Tier Approval Protocol</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Whitelist User in Google Cloud Console
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  Google Cloud Testing Mode enables up to <strong>100 free users</strong> with full Google Sheets sync permissions without any credit card or billing. When a user requests sync access, follow these quick steps:
                </p>
              </div>

              <a
                href={GOOGLE_CONSOLE_TEST_USERS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md shadow-indigo-600/20 shrink-0 transition-all"
              >
                <span>Open Google Console Test Users</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Step 1</span>
                <span>Click <strong>"Copy Gmail"</strong> next to applicant below.</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Step 2</span>
                <span>Click the blue <strong>"Open Google Console"</strong> button above.</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Step 3</span>
                <span>Under <strong>"Test users"</strong>, click <strong>"+ ADD USERS"</strong>, paste email, and click <strong>SAVE</strong>.</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-100 dark:border-indigo-950">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Step 4</span>
                <span>Come back here and click <strong>"Approve Access"</strong>. Done!</span>
              </div>
            </div>
          </div>

          {/* Filter and Requests Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Access Requests ({accessRequests.length})
                </h3>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setRequestsFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    requestsFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({accessRequests.length})
                </button>
                <button
                  onClick={() => setRequestsFilter('pending')}
                  className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    requestsFilter === 'pending'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>Pending</span>
                  {pendingRequestsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setRequestsFilter('approved')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    requestsFilter === 'approved'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setRequestsFilter('rejected')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    requestsFilter === 'rejected'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Declined
                </button>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">No requests found</p>
                <p>There are no access applications matching the selected filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* User Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.user_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : req.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                          <span>{req.user_email}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1 font-sans">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Submitted {new Date(req.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 inline-block mt-1">
                          <span className="font-semibold text-slate-400">Note: </span>
                          {req.reason}
                        </p>
                      )}

                      {req.reviewed_by_name && (
                        <p className="text-[11px] text-slate-400">
                          Reviewed by {req.reviewed_by_name} on{' '}
                          {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : ''}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                      {/* Copy Email Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(req.user_email)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
                        title="Copy email to paste in Google Cloud Console"
                      >
                        {copiedEmail === req.user_email ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy Gmail</span>
                          </>
                        )}
                      </button>

                      {/* Approve Button */}
                      {req.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={reviewingId === req.id}
                          onClick={() => handleReviewRequest(req.id, 'approved')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      {/* Reject Button */}
                      {req.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={reviewingId === req.id}
                          onClick={() => handleReviewRequest(req.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE B: NORMAL USER NOT APPROVED YET -> SHOW APPLICATION/PENDING VIEW     */}
      {/* ========================================================================= */}
      {!userHasApprovedAccess && activeTab === 'personal' && (
        <div className="space-y-6">
          {accessStatus?.request?.status === 'pending' ? (
            /* State B1: Pending Approval */
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-6 sm:p-8 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-2xl shrink-0 animate-pulse">
                  <Clock className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Application Pending Approval</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    Request Under Super Admin Review
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    Your request for Google Sheets synchronization access has been safely transmitted to the Super Admin (<strong>hmdasaifullah@gmail.com</strong>).
                  </p>
                </div>
              </div>

              {/* Request Details Preview */}
              <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-2 max-w-xl">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Google Account / Email:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submission Time:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {accessStatus.request ? new Date(accessStatus.request.created_at).toLocaleString() : ''}
                  </span>
                </div>
                {accessStatus.request?.reason && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Your Note:</span>
                    <span className="italic text-slate-700 dark:text-slate-300">"{accessStatus.request.reason}"</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Check Status / Refresh</span>
                </button>
                <span className="text-xs text-slate-500">
                  As soon as the admin whitelists your email, this page will automatically unlock.
                </span>
              </div>
            </div>
          ) : (
            /* State B2: Initial Request Form or Rejected Re-apply */
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800/80 border border-blue-200/80 dark:border-slate-700 p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Managed Google Sheets Permission</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Apply for Google Sheets Sync Access
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  To protect company records and prevent unauthorized exports, Google Sheets synchronization requires one-time approval from the Super Admin. Once approved, you will be able to auto-generate monthly attendance spreadsheets directly inside your own Google Drive.
                </p>

                {accessStatus?.request?.status === 'rejected' && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                    <strong>Note:</strong> Your previous application was declined. You can submit an updated note or reason below.
                  </div>
                )}
              </div>

              {/* Request Form */}
              <form onSubmit={handleSubmitAccessRequest} className="max-w-xl space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Registered Google Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    The Super Admin will whitelist this exact Gmail address in Google Cloud Console.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purpose / Note to Super Admin (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. For backing up my monthly duty records and official verification."
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all"
                >
                  <Send className={`w-4 h-4 ${submittingRequest ? 'animate-spin' : ''}`} />
                  <span>{submittingRequest ? 'Submitting Application...' : 'Send Access Application to Super Admin'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Preview of benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Auto-Create Spreadsheets</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Zero manual spreadsheet ID or URL typing. One-click creates your spreadsheet in your Google Drive.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Tab Separation</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Every month automatically gets its own structured tab with navy blue headers and day-of-week labels.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Audit & Tamper Proof</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                All synchronizations are tracked and verified with unique attendance IDs to prevent duplicates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE C: USER HAS APPROVED ACCESS -> SHOW FULL SPREADSHEET SYNC HUB        */}
      {/* ========================================================================= */}
      {userHasApprovedAccess && activeTab !== 'requests' && (
        <>
          {/* Main Connection Status & Auto-Setup Card */}
          {isConnected ? (
            /* State 1: Connected with active spreadsheet */
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Google Spreadsheet Active & Synced
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        Monthly Tabs Enabled
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {currentConfig?.spreadsheet_name ||
                        (activeTab === 'personal' ? 'Personal Attendance Sheet' : 'Master Attendance Sheet')}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">
                      ID: {currentConfig?.spreadsheet_id}
                    </p>
                  </div>
                </div>

                {/* Direct Open Button */}
                {spreadsheetLink && (
                  <a
                    href={spreadsheetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-emerald-700 dark:text-emerald-200 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-800 shadow-sm transition-all shrink-0"
                  >
                    <span>Open Google Sheet</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Multi-Tab: <strong>Separated by Month</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Current Tab: <strong>{currentMonthName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <RefreshCw className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Last Sync:{' '}
                    <strong>
                      {currentConfig?.last_sync_time
                        ? new Date(currentConfig.last_sync_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* State 2: Not connected yet - One Click Setup */
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800/80 border border-blue-200/80 dark:border-slate-700 p-6 sm:p-8 rounded-2xl shadow-sm">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>One-Click Automated Setup</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  No Manual Sheet Setup Required!
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  When you click the button below, we will automatically create a dedicated Google Sheet named{' '}
                  <strong className="text-slate-900 dark:text-white">
                    "
                    {activeTab === 'personal'
                      ? `Duty & Attendance Records - ${user?.display_name || 'My Records'}`
                      : 'Master Duty & Attendance Records'}
                    "
                  </strong>{' '}
                  directly inside your Google Drive. Each month's attendance records (e.g.{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{currentMonthName}</span>) will be
                  automatically organized into separate tabs with formatted header bars!
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>
                      {isSyncing ? 'Creating & Synchronizing...' : 'Authorize & Auto-Create My Google Sheet'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature Highlight: Monthly Tabs Mechanism */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">How Monthly Tabs Work</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every duty and attendance record is automatically grouped according to the month of its date. If a tab for
              that month (e.g. <strong>{currentMonthName}</strong>) does not exist in your spreadsheet yet, the system
              creates it with a frozen navy blue header row. If it already exists, existing entries are updated and new
              entries are appended without duplicates.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-400">Sample Monthly Tabs:</span>
              {['January 2026', 'February 2026', 'March 2026', currentMonthName].map((tab, idx) => (
                <span
                  key={idx}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                    tab === currentMonthName
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  📄 {tab}
                </span>
              ))}
            </div>
          </div>

          {/* Column Schema Standard Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Standard Google Sheets Column Structure ({activeTab === 'master' ? '15 Columns' : '13 Columns'})
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Each monthly tab is automatically created with the following structured columns:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {(activeTab === 'master'
                ? [
                    'Attendance ID',
                    'Date',
                    'Day',
                    'Employee Name',
                    'Employee Email',
                    'Duty Type',
                    'In Time',
                    'Out Time',
                    'Actual Hours',
                    'Expected Hours',
                    'Extra Hours',
                    'Short Hours',
                    'Status',
                    'Notes',
                    'Last Updated',
                  ]
                : [
                    'Attendance ID',
                    'Date',
                    'Day',
                    'Duty Type',
                    'In Time',
                    'Out Time',
                    'Actual Hours',
                    'Expected Hours',
                    'Extra Hours',
                    'Short Hours',
                    'Status',
                    'Notes',
                    'Last Updated',
                  ]
              ).map((col, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-mono px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs"
                >
                  {idx + 1}. {col}
                </span>
              ))}
            </div>
          </div>

          {/* Optional: Advanced Custom Spreadsheet URL or ID Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-500" />
                <span>Use Existing Custom Google Sheet URL or ID (Optional)</span>
              </div>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvancedSettings && (
              <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If you already have an existing spreadsheet you want to link rather than creating a new one
                  automatically, paste its URL or ID below:
                </p>

                <form onSubmit={handleSaveCustomConfig} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Google Sheet URL or Spreadsheet ID
                    </label>
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                      value={sheetUrlOrId}
                      onChange={(e) => setSheetUrlOrId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {isConnected && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Disconnect Custom Sheet</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      className="ml-auto px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl"
                    >
                      Save Custom Sheet
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Sync History Logs */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Sync Audit & History Logs
              </h3>
            </div>

            {syncLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No synchronization history recorded yet. Press "Auto-Create & Sync" to perform the first sync.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Records Count</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Details / Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {syncLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold capitalize text-slate-800 dark:text-slate-200">
                          {log.sync_type}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {log.records_count} records
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              log.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                          {log.error_message || 'Sync completed successfully'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer Legal notice */}
      <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
        <span>Duty & Attendance System</span>
        <span>•</span>
        <a href="/privacy" className="hover:underline text-blue-600 dark:text-blue-400">
          Privacy Policy
        </a>
        <span>•</span>
        <a href="/terms" className="hover:underline text-blue-600 dark:text-blue-400">
          Terms of Service
        </a>
      </div>
    </div>
  );
};
