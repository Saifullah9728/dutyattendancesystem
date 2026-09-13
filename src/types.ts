export type UserRole = 'super_admin' | 'admin' | 'user';
export type UserStatus = 'active' | 'deactivated';

export interface User {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface DutyType {
  id: string;
  name: string;
  start_time: string; // e.g. "08:00"
  end_time: string;   // e.g. "17:00"
  expected_duration_minutes: number; // e.g. 540 for 9 hours
  is_working_day: boolean;
  contributes_to_hours: boolean;
  color: string;      // hex color
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'normal' | 'extra' | 'short' | 'day_off';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  date: string; // YYYY-MM-DD
  duty_type_id: string;
  duty_type_name_snapshot: string;
  expected_duration_minutes_snapshot: number;
  in_time: string; // HH:mm
  out_time: string; // HH:mm
  actual_duration_minutes: number;
  extra_duration_minutes: number;
  short_duration_minutes: number;
  difference_minutes: number; // actual - expected
  status: AttendanceStatus;
  notes: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCalculationResult {
  actual_duration_minutes: number;
  expected_duration_minutes: number;
  extra_duration_minutes: number;
  short_duration_minutes: number;
  difference_minutes: number;
  status: AttendanceStatus;
  formatted_actual: string;
  formatted_expected: string;
  formatted_diff: string;
}

export interface MonthlySummary {
  month: number; // 1-12
  year: number;
  total_working_days: number;
  morning_count: number;
  general_count: number;
  evening_count: number;
  mod_count: number;
  others_count: number;
  day_off_count: number;
  custom_counts: Record<string, number>;
  total_actual_minutes: number;
  total_expected_minutes: number;
  total_extra_minutes: number;
  total_short_minutes: number;
  net_difference_minutes: number;
  average_daily_minutes: number;
  attendance_rate_percent: number;
}

export type AuditAction =
  | 'ATTENDANCE_CREATED'
  | 'ATTENDANCE_UPDATED'
  | 'ATTENDANCE_DELETED'
  | 'DUTY_TYPE_CREATED'
  | 'DUTY_TYPE_UPDATED'
  | 'DUTY_TYPE_TOGGLED'
  | 'USER_UPDATED'
  | 'ROLE_UPDATED'
  | 'ADMIN_PROMOTED'
  | 'ADMIN_DEMOTED'
  | 'GOOGLE_SHEET_CONNECTED'
  | 'GOOGLE_SHEET_DISCONNECTED'
  | 'SETTINGS_UPDATED'
  | 'MASTER_SHEET_CONFIGURED';

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_name: string;
  actor_email: string;
  target_user_id: string;
  target_name: string;
  action: AuditAction;
  entity_type: 'attendance' | 'duty_type' | 'user' | 'sheet' | 'settings';
  entity_id: string;
  old_value: string; // JSON string
  new_value: string; // JSON string
  notes: string;
  timestamp: string;
}

export interface GoogleSheetConfig {
  id: string;
  user_id: string | null; // null for master sheet
  sheet_type: 'personal' | 'master';
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet_tab_name: string;
  sync_mode: 'auto' | 'manual';
  last_sync_time: string | null;
  last_sync_status: 'success' | 'failed' | 'pending' | 'never';
  last_sync_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  sheet_config_id: string;
  user_id: string | null;
  sync_type: 'personal' | 'master';
  status: 'success' | 'failed';
  records_count: number;
  error_message: string | null;
  timestamp: string;
}

export interface SheetAccessRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  reviewed_by_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  app_name: string;
  timezone: string;
  date_format: string;
  time_format: '12h' | '24h';
  allow_future_attendance: boolean;
  updated_at: string;
}
