import type { User, DutyType, AttendanceRecord, MonthlySummary, AuditLog, GoogleSheetConfig, SyncLog, SheetAccessRequest, SystemSettings } from '../types';

const STORAGE_KEY = 'duty_attendance_user_id';
const EMAIL_STORAGE_KEY = 'duty_attendance_user_email';
const USER_CACHE_KEY = 'duty_attendance_cached_user';

let currentUserId: string = '';
try {
  currentUserId = localStorage.getItem(STORAGE_KEY) || '';
} catch {}

export function setActiveUserSession(user: User) {
  currentUserId = user.id;
  try {
    localStorage.setItem(STORAGE_KEY, user.id);
    localStorage.setItem(EMAIL_STORAGE_KEY, user.email);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

export function clearActiveUserSession() {
  currentUserId = '';
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem('saifullah_user_id'); // legacy cleanup
  } catch (e) {
    console.warn('Storage clear failed:', e);
  }
}

export function setActiveUserId(userId: string) {
  currentUserId = userId;
  try {
    if (userId) {
      localStorage.setItem(STORAGE_KEY, userId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function clearActiveUserId() {
  clearActiveUserSession();
}

export function getActiveUserId(): string {
  if (!currentUserId) {
    try {
      currentUserId = localStorage.getItem(STORAGE_KEY) || '';
    } catch {}
  }
  return currentUserId;
}

export function getActiveUserEmail(): string {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const userId = getActiveUserId();
  const userEmail = getActiveUserEmail();

  if (userId) {
    headers.set('x-user-id', userId);
  }
  if (userEmail) {
    headers.set('x-user-email', userEmail);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error: any = new Error(data.error || data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  // Auth
  getMe: () => request<{ user: User | null }>('/api/auth/me'),
  signIn: (email: string) =>
    request<{ user: User; message: string }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  signUp: (payload: { email: string; display_name: string; avatar_url?: string; google_id?: string }) =>
    request<{ user: User; message: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  googleLogin: (payload: { email: string; display_name?: string; avatar_url?: string; google_id?: string; mode?: 'signin' | 'signup' }) =>
    request<{ user: User }>('/api/auth/google', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  switchUser: (userId: string) =>
    request<{ user: User }>('/api/auth/switch-user', { method: 'POST', body: JSON.stringify({ userId }) }),
  updateProfile: (payload: { display_name?: string; avatar_url?: string }) =>
    request<{ user: User }>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  // Duty Types
  getDutyTypes: () => request<{ dutyTypes: DutyType[] }>('/api/duty-types'),
  createDutyType: (payload: Partial<DutyType>) =>
    request<{ dutyType: DutyType }>('/api/duty-types', { method: 'POST', body: JSON.stringify(payload) }),
  updateDutyType: (id: string, payload: Partial<DutyType>) =>
    request<{ dutyType: DutyType }>(`/api/duty-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Attendance
  getAttendance: (params: { month?: number; year?: number; date?: string; duty_type_id?: string; status?: string; user_id?: string; all?: boolean }) => {
    const query = new URLSearchParams();
    if (params.month) query.set('month', String(params.month));
    if (params.year) query.set('year', String(params.year));
    if (params.date) query.set('date', params.date);
    if (params.duty_type_id) query.set('duty_type_id', params.duty_type_id);
    if (params.status) query.set('status', params.status);
    if (params.user_id) query.set('user_id', params.user_id);
    if (params.all) query.set('all', 'true');
    return request<{ records: AttendanceRecord[] }>(`/api/attendance?${query.toString()}`);
  },
  createAttendance: (payload: { date: string; duty_type_id: string; in_time: string; out_time: string; notes?: string; user_id?: string; force_confirm?: boolean }) =>
    request<{ record: AttendanceRecord; updated?: boolean }>('/api/attendance', { method: 'POST', body: JSON.stringify(payload) }),
  updateAttendance: (id: string, payload: { duty_type_id?: string; in_time?: string; out_time?: string; notes?: string }) =>
    request<{ record: AttendanceRecord }>(`/api/attendance/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAttendance: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/attendance/${id}`, { method: 'DELETE' }),

  // Reports
  getMonthlyReport: (month: number, year: number, userId?: string, all?: boolean) => {
    const query = new URLSearchParams({ month: String(month), year: String(year) });
    if (userId) query.set('user_id', userId);
    if (all) query.set('all', 'true');
    return request<{ summary: MonthlySummary; records: AttendanceRecord[] }>(`/api/reports/monthly?${query.toString()}`);
  },

  // Admin Users
  getUsers: () => request<{ users: (User & { total_records: number; total_actual_hours: string })[] }>('/api/admin/users'),
  updateUserRole: (id: string, role: string) =>
    request<{ user: User }>(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateUserStatus: (id: string, status: string) =>
    request<{ user: User }>(`/api/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Admin Audit Logs
  getAuditLogs: (params: { action?: string; actor_id?: string; target_id?: string; start_date?: string; end_date?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.action) query.set('action', params.action);
    if (params.actor_id) query.set('actor_id', params.actor_id);
    if (params.target_id) query.set('target_id', params.target_id);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.limit) query.set('limit', String(params.limit));
    return request<{ logs: AuditLog[] }>(`/api/admin/audit-logs?${query.toString()}`);
  },

  // Google Sheets
  getSheetConfig: (type: 'personal' | 'master' = 'personal') =>
    request<{ config: GoogleSheetConfig | null }>(`/api/sheets/config?type=${type}`),
  saveSheetConfig: (payload: { spreadsheet_id: string; spreadsheet_name?: string; sheet_tab_name?: string; sheet_type: 'personal' | 'master'; sync_mode?: 'auto' | 'manual' }) =>
    request<{ config: GoogleSheetConfig }>('/api/sheets/config', { method: 'POST', body: JSON.stringify(payload) }),
  disconnectSheet: (type: 'personal' | 'master' = 'personal') =>
    request<{ success: boolean; message: string }>(`/api/sheets/config?type=${type}`, { method: 'DELETE' }),
  syncSheet: (sheetType: 'personal' | 'master', accessToken?: string, spreadsheetId?: string) =>
    request<{
      success: boolean;
      recordsCount: number;
      message: string;
      error?: string;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      monthsSynced?: string[];
    }>('/api/sheets/sync', {
      method: 'POST',
      body: JSON.stringify({ sheet_type: sheetType, accessToken, spreadsheet_id: spreadsheetId }),
    }),
  getSyncLogs: (type: 'personal' | 'master' = 'personal') =>
    request<{ logs: SyncLog[] }>(`/api/sheets/logs?type=${type}`),

  // Google Sheets Sync Access Request & Approval Workflow
  getSheetAccessStatus: () =>
    request<{ hasAccess: boolean; isPrivileged: boolean; request: SheetAccessRequest | null }>('/api/sheets/access-status'),
  requestSheetAccess: (payload?: { reason?: string }) =>
    request<{ success: boolean; message: string; request: SheetAccessRequest }>('/api/sheets/access-request', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  getSheetAccessRequests: () =>
    request<{ requests: SheetAccessRequest[]; pendingCount: number }>('/api/sheets/access-requests'),
  reviewSheetAccessRequest: (id: string, status: 'approved' | 'rejected', notes?: string) =>
    request<{ success: boolean; request: SheetAccessRequest }>(`/api/sheets/access-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // System Settings
  getSettings: () => request<{ settings: SystemSettings }>('/api/settings'),
  updateSettings: (settings: Partial<SystemSettings>) =>
    request<{ success: boolean; message: string }>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Firebase Firestore Persistence
  getFirebaseStatus: () =>
    request<{
      isConfigured: boolean;
      lastSyncTimestamp: string | null;
      lastSyncStatus: 'idle' | 'success' | 'error' | 'syncing';
      lastSyncMessage: string;
    }>('/api/firebase/status'),
  syncFirebase: () =>
    request<{
      success: boolean;
      restoredFromCloud: number;
      uploadedToCloud: number;
      message: string;
    }>('/api/firebase/sync', { method: 'POST' }),
};
