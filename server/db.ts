import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'duty_manager.sqlite');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error reading existing sqlite database file, creating fresh:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb(dbInstance);
  return dbInstance;
}

export function saveDb(db: Database = dbInstance!): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duty_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      expected_duration_minutes INTEGER NOT NULL,
      is_working_day INTEGER NOT NULL DEFAULT 1,
      contributes_to_hours INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      duty_type_id TEXT NOT NULL,
      duty_type_name_snapshot TEXT NOT NULL,
      expected_duration_minutes_snapshot INTEGER NOT NULL,
      in_time TEXT NOT NULL,
      out_time TEXT NOT NULL,
      actual_duration_minutes INTEGER NOT NULL,
      extra_duration_minutes INTEGER NOT NULL,
      short_duration_minutes INTEGER NOT NULL,
      difference_minutes INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records (date);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      target_user_id TEXT,
      target_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      notes TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs (target_user_id);

    CREATE TABLE IF NOT EXISTS google_sheet_configs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      sheet_type TEXT NOT NULL,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_name TEXT NOT NULL,
      sheet_tab_name TEXT NOT NULL DEFAULT 'Attendance',
      sync_mode TEXT NOT NULL DEFAULT 'manual',
      last_sync_time TEXT,
      last_sync_status TEXT DEFAULT 'never',
      last_sync_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      sheet_config_id TEXT,
      user_id TEXT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sheet_access_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT,
      reviewed_by_id TEXT,
      reviewed_by_name TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sheet_req_user ON sheet_access_requests (user_id);
    CREATE INDEX IF NOT EXISTS idx_sheet_req_status ON sheet_access_requests (status);
  `);

  seedDefaultData(db);
}

function seedDefaultData(db: Database) {
  const now = new Date().toISOString();

  // Clean up any historical demo/mock accounts, demo records, and remove hmdasaifullah@gmail.com from super admin
  try {
    db.run(`
      DELETE FROM users WHERE email IN ('rahim.duty@example.com', 'tanvir.admin@example.com') OR id IN ('user-colleague-rahim', 'user-colleague-tanvir');
      DELETE FROM users WHERE email = 'hmdasaifullah@gmail.com' AND id = 'user-saifullah-superadmin';
      UPDATE users SET role = 'user' WHERE email = 'hmdasaifullah@gmail.com';
      DELETE FROM attendance_records WHERE id LIKE 'att-saifullah-%' OR user_id IN ('user-colleague-rahim', 'user-colleague-tanvir');
      DELETE FROM audit_logs WHERE actor_user_id IN ('user-colleague-rahim', 'user-colleague-tanvir');
    `);
  } catch (cleanErr) {
    console.warn('Cleanup check completed:', cleanErr);
  }

  // 1. Ensure Root Super Admin Account (hmdasaifullah28@gmail.com only)
  const adminStmt28 = db.prepare('SELECT id FROM users WHERE email = ?');
  adminStmt28.bind(['hmdasaifullah28@gmail.com']);
  const hasAdmin28 = adminStmt28.step();
  adminStmt28.free();

  if (!hasAdmin28) {
    db.run(
      `INSERT INTO users (id, google_id, email, display_name, avatar_url, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'user-saifullah-superadmin-28',
        'google-saifullah-28',
        'hmdasaifullah28@gmail.com',
        'Saifullah (Super Admin)',
        'https://lh3.googleusercontent.com/a/default-user=s120',
        'super_admin',
        'active',
        now,
        now,
      ]
    );
  }

  // 2. Check Duty Types
  const dutyCount = db.exec('SELECT COUNT(*) FROM duty_types')[0]?.values[0]?.[0] as number;
  if (!dutyCount || dutyCount === 0) {
    const dutyTypes = [
      ['morning', 'Morning', '08:00', '17:00', 540, 1, 1, '#2563eb', 'Scheduled Morning Shift (08:00 AM - 05:00 PM, 9h)', 1],
      ['general', 'General', '10:00', '19:00', 540, 1, 1, '#059669', 'Scheduled General Shift (10:00 AM - 07:00 PM, 9h)', 1],
      ['evening', 'Evening', '14:00', '23:00', 540, 1, 1, '#d97706', 'Scheduled Evening Shift (02:00 PM - 11:00 PM, 9h)', 1],
      ['mod', 'MOD', '09:00', '18:00', 540, 1, 1, '#7c3aed', 'Manager On Duty / Configurable Shift', 1],
      ['others', 'Others', '09:00', '18:00', 540, 1, 1, '#0284c7', 'Custom duty assignment', 1],
      ['day_off', 'Day Off', '00:00', '00:00', 0, 0, 0, '#64748b', 'Scheduled Weekly Day Off / Rest Day', 1],
    ];

    for (const dt of dutyTypes) {
      db.run(
        `INSERT INTO duty_types (id, name, start_time, end_time, expected_duration_minutes, is_working_day, contributes_to_hours, color, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...dt, now, now]
      );
    }
  }

  // 3. Check System Settings
  const settingsCount = db.exec('SELECT COUNT(*) FROM system_settings')[0]?.values[0]?.[0] as number;
  if (!settingsCount || settingsCount === 0) {
    const defaultSettings = [
      ['app_name', 'Duty & Attendance System'],
      ['timezone', 'Asia/Dhaka'],
      ['date_format', 'YYYY-MM-DD'],
      ['time_format', '12h'],
      ['allow_future_attendance', '0'],
    ];

    for (const [key, val] of defaultSettings) {
      db.run(
        `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, val, now]
      );
    }
  } else {
    db.run("UPDATE system_settings SET value = 'Duty & Attendance System' WHERE key = 'app_name' AND value = 'Saifullah Duty Manager'");
  }
}

// Type-safe query helpers
export function queryAll<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(db: Database, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

type WriteListener = (sql: string, params: any[]) => void;
const writeListeners: WriteListener[] = [];

export function onDatabaseWrite(listener: WriteListener): void {
  writeListeners.push(listener);
}

export function execute(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveDb(db);
  for (const listener of writeListeners) {
    try {
      listener(sql, params);
    } catch (e) {
      console.error('Write listener error:', e);
    }
  }
}
