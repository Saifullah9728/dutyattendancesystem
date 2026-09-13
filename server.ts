import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getDb, queryAll, queryOne, execute, saveDb } from './server/db';
import { initFirebaseSync, syncCloudWithLocal, getCloudSyncStatus } from './server/firebase';
import { calculateAttendance } from './src/utils/calculations';
import { performGoogleSheetsSync } from './server/sheetsSync';
import type { User, DutyType, AttendanceRecord, SystemSettings } from './src/types';

const PORT = 3000;
// STRICT: Only hmdasaifullah28@gmail.com is the permanent Super Admin
const SUPER_ADMIN_EMAILS = ['hmdasaifullah28@gmail.com'];

const isSuperAdminEmail = (email: string) => {
  const clean = (email || '').toLowerCase().trim();
  return clean === 'hmdasaifullah28@gmail.com';
};

interface AuthRequest extends Request {
  user?: User;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((part) => {
    const [key, ...val] = part.trim().split('=');
    if (key) {
      cookies[key] = decodeURIComponent(val.join('='));
    }
  });
  return cookies;
}

function setAuthCookies(res: Response, user: User) {
  // 365 days persistent cookie
  const maxAge = 365 * 24 * 60 * 60;
  res.setHeader('Set-Cookie', [
    `duty_session=${encodeURIComponent(user.id)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`,
    `duty_user_email=${encodeURIComponent(user.email)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`,
  ]);
}

function clearAuthCookies(res: Response) {
  res.setHeader('Set-Cookie', [
    `duty_session=; Max-Age=0; Path=/; SameSite=Lax`,
    `duty_user_email=; Max-Age=0; Path=/; SameSite=Lax`,
  ]);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize SQLite database
  const db = await getDb();
  console.log('Duty & Attendance System SQLite Database initialized.');

  // Initialize Firebase Firestore Cloud Persistence & Auto-Sync
  initFirebaseSync(db);
  syncCloudWithLocal(db)
    .then((res) => {
      console.log('[Firestore] Startup cloud sync completed:', res.message);
    })
    .catch((err) => {
      console.error('[Firestore] Startup cloud sync failed:', err);
    });

  // Current session resolver (checks Headers & Persistent Cookies & Email Fallback)
  app.use((req: AuthRequest, res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const userId = (req.headers['x-user-id'] as string) || cookies['duty_session'];
    const userEmail = (req.headers['x-user-email'] as string) || cookies['duty_user_email'];

    let user: User | null = null;
    if (userId) {
      user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [userId]);
    }
    if (!user && userEmail) {
      user = queryOne<User>(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [userEmail.toLowerCase().trim()]);
    }

    if (user) {
      // Enforce Super Admin role for designated emails
      if (isSuperAdminEmail(user.email) && user.role !== 'super_admin') {
        user.role = 'super_admin';
        execute(db, 'UPDATE users SET role = "super_admin" WHERE id = ?', [user.id]);
      }
      req.user = user;
    }
    next();
  });

  // Auth Guards
  const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (req.user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
    }
    next();
  };

  const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
  };

  const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super Admin privileges required' });
    }
    next();
  };

  // ==========================================
  // AUTH & PROFILE ENDPOINTS
  // ==========================================

  // Check current session
  app.get('/api/auth/me', (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.json({ user: null });
    }
    res.json({ user: req.user });
  });

  // Explicit Sign In with email / Google account
  app.post('/api/auth/signin', (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(cleanEmail);

    let user = queryOne<User>(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (!user) {
      return res.status(404).json({
        error: `No account found with "${cleanEmail}". Please Sign Up first to create your account!`,
        code: 'ACCOUNT_NOT_FOUND',
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        error: 'Your account has been deactivated by an administrator. Please contact support.',
      });
    }

    const now = new Date().toISOString();
    if (isSuperAdmin && user.role !== 'super_admin') {
      execute(db, 'UPDATE users SET role = "super_admin", updated_at = ? WHERE id = ?', [now, user.id]);
      user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [user.id])!;
    }

    setAuthCookies(res, user);
    res.json({ user, message: 'Signed in successfully' });
  });

  // Explicit Sign Up with email, display name & optional Google details
  app.post('/api/auth/signup', (req: AuthRequest, res: Response) => {
    const { email, display_name, avatar_url, google_id } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
      return res.status(400).json({ error: 'Full Name is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne<User>(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(409).json({
        error: `An account with "${cleanEmail}" already exists. Please Sign In instead!`,
        code: 'ACCOUNT_ALREADY_EXISTS',
      });
    }

    const isSuperAdmin = isSuperAdminEmail(cleanEmail);
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const role = isSuperAdmin ? 'super_admin' : 'user';
    const now = new Date().toISOString();

    execute(
      db,
      `INSERT INTO users (id, google_id, email, display_name, avatar_url, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        google_id || '',
        cleanEmail,
        display_name.trim(),
        avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role,
        'active',
        now,
        now,
      ]
    );

    const newUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id])!;

    // Audit log
    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        newUser.id,
        newUser.display_name,
        newUser.email,
        newUser.id,
        newUser.display_name,
        'USER_REGISTERED',
        'user',
        newUser.id,
        'null',
        JSON.stringify(newUser),
        `New account registered via Sign Up (${role})`,
        now,
      ]
    );

    setAuthCookies(res, newUser);
    res.status(201).json({ user: newUser, message: 'Account created successfully' });
  });

  // Google Authentication helper (supporting mode: 'signin' | 'signup' | 'auto')
  app.post('/api/auth/google', (req: AuthRequest, res: Response) => {
    const { email, display_name, avatar_url, google_id, mode } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google Authentication' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(cleanEmail);

    let user = queryOne<User>(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    const now = new Date().toISOString();

    // Mode: Sign In only
    if (mode === 'signin') {
      if (!user) {
        return res.status(404).json({
          error: `No account found with "${cleanEmail}". Please Sign Up first!`,
          code: 'ACCOUNT_NOT_FOUND',
        });
      }
      if (user.status === 'deactivated') {
        return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
      }
      if (isSuperAdmin && user.role !== 'super_admin') {
        execute(db, 'UPDATE users SET role = "super_admin", updated_at = ? WHERE id = ?', [now, user.id]);
        user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [user.id])!;
      }
      setAuthCookies(res, user);
      return res.json({ user });
    }

    // Mode: Sign Up only
    if (mode === 'signup') {
      if (user) {
        return res.status(409).json({
          error: `An account with "${cleanEmail}" already exists. Please Sign In instead!`,
          code: 'ACCOUNT_ALREADY_EXISTS',
        });
      }
    }

    if (!user) {
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const role = isSuperAdmin ? 'super_admin' : 'user';
      execute(
        db,
        `INSERT INTO users (id, google_id, email, display_name, avatar_url, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, google_id || '', cleanEmail, display_name || cleanEmail.split('@')[0], avatar_url || '', role, 'active', now, now]
      );
      user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id])!;

      // Audit log registration
      execute(
        db,
        `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          user.id,
          user.display_name,
          user.email,
          user.id,
          user.display_name,
          'USER_REGISTERED',
          'user',
          user.id,
          'null',
          JSON.stringify(user),
          'New user registered with Google Account',
          now,
        ]
      );
    } else {
      let updatedRole = user.role;
      if (isSuperAdmin) {
        updatedRole = 'super_admin';
      }
      const finalDisplayName = (display_name && String(display_name).trim()) ? String(display_name).trim() : user.display_name;
      const finalAvatarUrl = (avatar_url && String(avatar_url).trim()) ? String(avatar_url).trim() : user.avatar_url;
      const finalGoogleId = (google_id && String(google_id).trim()) ? String(google_id).trim() : user.google_id;
      execute(
        db,
        `UPDATE users
         SET display_name = ?,
             avatar_url = ?,
             google_id = ?,
             role = ?,
             updated_at = ?
         WHERE id = ?`,
        [finalDisplayName, finalAvatarUrl, finalGoogleId, updatedRole, now, user.id]
      );
      user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [user.id])!;
    }

    setAuthCookies(res, user);
    res.json({ user });
  });

  // Logout endpoint
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Switch active user (for testing & role demonstration)
  app.post('/api/auth/switch-user', (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const user = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    setAuthCookies(res, user);
    res.json({ user });
  });

  app.put('/api/auth/profile', requireAuth, (req: AuthRequest, res: Response) => {
    const { display_name, avatar_url } = req.body;
    const now = new Date().toISOString();
    const oldUser = req.user!;

    execute(
      db,
      `UPDATE users
       SET display_name = COALESCE(?, display_name),
           avatar_url = COALESCE(?, avatar_url),
           updated_at = ?
       WHERE id = ?`,
      [display_name, avatar_url, now, oldUser.id]
    );

    const updatedUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [oldUser.id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        oldUser.id,
        oldUser.display_name,
        oldUser.email,
        oldUser.id,
        updatedUser.display_name,
        'USER_UPDATED',
        'user',
        oldUser.id,
        JSON.stringify({ display_name: oldUser.display_name }),
        JSON.stringify({ display_name: updatedUser.display_name }),
        'User profile updated',
        now,
      ]
    );

    res.json({ user: updatedUser });
  });

  // ==========================================
  // DUTY TYPES ENDPOINTS
  // ==========================================

  app.get('/api/duty-types', (req: AuthRequest, res: Response) => {
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    const sql = isAdmin
      ? 'SELECT * FROM duty_types ORDER BY is_active DESC, name ASC'
      : 'SELECT * FROM duty_types WHERE is_active = 1 ORDER BY name ASC';
    const dutyTypes = queryAll<DutyType>(db, sql);
    res.json({ dutyTypes });
  });

  app.post('/api/duty-types', requireAdmin, (req: AuthRequest, res: Response) => {
    const { name, start_time, end_time, expected_duration_minutes, is_working_day, contributes_to_hours, color, description } = req.body;
    if (!name || expected_duration_minutes === undefined) {
      return res.status(400).json({ error: 'Name and expected duration are required' });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
    const now = new Date().toISOString();

    execute(
      db,
      `INSERT INTO duty_types (id, name, start_time, end_time, expected_duration_minutes, is_working_day, contributes_to_hours, color, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        name,
        start_time || '09:00',
        end_time || '18:00',
        expected_duration_minutes,
        is_working_day ? 1 : 0,
        contributes_to_hours ? 1 : 0,
        color || '#2563eb',
        description || '',
        now,
        now,
      ]
    );

    const created = queryOne<DutyType>(db, 'SELECT * FROM duty_types WHERE id = ?', [id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, NULL, NULL, 'DUTY_TYPE_CREATED', 'duty_type', ?, 'null', ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        id,
        JSON.stringify(created),
        `Admin created new duty type: ${name}`,
        now,
      ]
    );

    res.json({ dutyType: created });
  });

  app.put('/api/duty-types/:id', requireAdmin, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, start_time, end_time, expected_duration_minutes, is_working_day, contributes_to_hours, color, description, is_active } = req.body;

    const existing = queryOne<DutyType>(db, 'SELECT * FROM duty_types WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Duty type not found' });
    }

    const now = new Date().toISOString();

    execute(
      db,
      `UPDATE duty_types
       SET name = COALESCE(?, name),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           expected_duration_minutes = COALESCE(?, expected_duration_minutes),
           is_working_day = COALESCE(?, is_working_day),
           contributes_to_hours = COALESCE(?, contributes_to_hours),
           color = COALESCE(?, color),
           description = COALESCE(?, description),
           is_active = COALESCE(?, is_active),
           updated_at = ?
       WHERE id = ?`,
      [
        name,
        start_time,
        end_time,
        expected_duration_minutes,
        is_working_day !== undefined ? (is_working_day ? 1 : 0) : undefined,
        contributes_to_hours !== undefined ? (contributes_to_hours ? 1 : 0) : undefined,
        color,
        description,
        is_active !== undefined ? (is_active ? 1 : 0) : undefined,
        now,
        id,
      ]
    );

    const updated = queryOne<DutyType>(db, 'SELECT * FROM duty_types WHERE id = ?', [id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, NULL, NULL, 'DUTY_TYPE_UPDATED', 'duty_type', ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        id,
        JSON.stringify(existing),
        JSON.stringify(updated),
        `Duty type "${updated.name}" updated (historical records preserved via snapshots)`,
        now,
      ]
    );

    res.json({ dutyType: updated });
  });

  // ==========================================
  // ATTENDANCE RECORDS ENDPOINTS
  // ==========================================

  app.get('/api/attendance', requireAuth, (req: AuthRequest, res: Response) => {
    const { month, year, date, duty_type_id, status } = req.query;
    let targetUserId = req.user!.id;

    // Normal users can NEVER query another employee's records!
    if (req.user!.role === 'admin' || req.user!.role === 'super_admin') {
      if (req.query.user_id) {
        targetUserId = req.query.user_id as string;
      } else if (req.query.all === 'true') {
        targetUserId = ''; // Query all employees
      }
    }

    let sql = `
      SELECT a.*, u.display_name as user_name, u.email as user_email
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (targetUserId) {
      sql += ' AND a.user_id = ?';
      params.push(targetUserId);
    }

    if (date) {
      sql += ' AND a.date = ?';
      params.push(date);
    } else if (month && year) {
      const monthPadded = String(month).padStart(2, '0');
      sql += ' AND strftime("%Y-%m", a.date) = ?';
      params.push(`${year}-${monthPadded}`);
    } else if (year) {
      sql += ' AND strftime("%Y", a.date) = ?';
      params.push(`${year}`);
    }

    if (duty_type_id) {
      sql += ' AND a.duty_type_id = ?';
      params.push(duty_type_id);
    }

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.date DESC, a.created_at DESC';

    const records = queryAll<AttendanceRecord>(db, sql, params);
    res.json({ records });
  });

  // Create attendance record with Duplicate Date Protection
  app.post('/api/attendance', requireAuth, (req: AuthRequest, res: Response) => {
    const {
      date,
      duty_type_id,
      in_time,
      out_time,
      notes,
      user_id: requestedUserId,
      force_confirm, // true if user confirmed duplicate overwrite
    } = req.body;

    if (!date || !duty_type_id) {
      return res.status(400).json({ error: 'Date and Duty Type are required' });
    }

    // Security: Only admins can record attendance on behalf of other users
    let targetUserId = req.user!.id;
    if (requestedUserId && requestedUserId !== req.user!.id) {
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        return res.status(403).json({ error: 'Cannot create attendance for other employees' });
      }
      targetUserId = requestedUserId;
    }

    // Check future date restriction
    const todayStr = new Date().toISOString().split('T')[0];
    const settings = queryAll<{ key: string; value: string }>(db, 'SELECT * FROM system_settings');
    const allowFuture = settings.find((s) => s.key === 'allow_future_attendance')?.value === '1';

    if (!allowFuture && date > todayStr) {
      return res.status(400).json({ error: 'Future attendance records are not permitted by system policy.' });
    }

    // Duplicate Check
    const existing = queryOne<AttendanceRecord>(
      db,
      'SELECT * FROM attendance_records WHERE user_id = ? AND date = ?',
      [targetUserId, date]
    );

    if (existing && !force_confirm) {
      return res.status(409).json({
        duplicate: true,
        message: 'An attendance record already exists for this date.',
        existingRecord: existing,
      });
    }

    // Fetch duty type for snapshot calculations
    const dutyType = queryOne<DutyType>(db, 'SELECT * FROM duty_types WHERE id = ?', [duty_type_id]);
    if (!dutyType) {
      return res.status(400).json({ error: 'Invalid or inactive duty type' });
    }

    const calc = calculateAttendance(dutyType, in_time || '', out_time || '');
    const now = new Date().toISOString();
    const targetUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [targetUserId])!;

    if (existing && force_confirm) {
      // Update existing record
      execute(
        db,
        `UPDATE attendance_records
         SET duty_type_id = ?,
             duty_type_name_snapshot = ?,
             expected_duration_minutes_snapshot = ?,
             in_time = ?,
             out_time = ?,
             actual_duration_minutes = ?,
             extra_duration_minutes = ?,
             short_duration_minutes = ?,
             difference_minutes = ?,
             status = ?,
             notes = ?,
             updated_by = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          duty_type_id,
          dutyType.name,
          dutyType.expected_duration_minutes,
          in_time || '',
          out_time || '',
          calc.actual_duration_minutes,
          calc.extra_duration_minutes,
          calc.short_duration_minutes,
          calc.difference_minutes,
          calc.status,
          notes || '',
          req.user!.id,
          now,
          existing.id,
        ]
      );

      const updatedRecord = queryOne<AttendanceRecord>(
        db,
        'SELECT * FROM attendance_records WHERE id = ?',
        [existing.id]
      )!;

      execute(
        db,
        `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, 'ATTENDANCE_UPDATED', 'attendance', ?, ?, ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          req.user!.id,
          req.user!.display_name,
          req.user!.email,
          targetUserId,
          targetUser.display_name,
          existing.id,
          JSON.stringify(existing),
          JSON.stringify(updatedRecord),
          `Attendance for ${date} updated after duplicate confirmation`,
          now,
        ]
      );

      return res.json({ record: updatedRecord, updated: true });
    }

    // Create new record
    const id = `att-${targetUserId}-${date}-${Date.now().toString(36)}`;
    execute(
      db,
      `INSERT INTO attendance_records (
        id, user_id, date, duty_type_id, duty_type_name_snapshot,
        expected_duration_minutes_snapshot, in_time, out_time,
        actual_duration_minutes, extra_duration_minutes, short_duration_minutes,
        difference_minutes, status, notes, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        targetUserId,
        date,
        duty_type_id,
        dutyType.name,
        dutyType.expected_duration_minutes,
        in_time || '',
        out_time || '',
        calc.actual_duration_minutes,
        calc.extra_duration_minutes,
        calc.short_duration_minutes,
        calc.difference_minutes,
        calc.status,
        notes || '',
        req.user!.id,
        req.user!.id,
        now,
        now,
      ]
    );

    const createdRecord = queryOne<AttendanceRecord>(
      db,
      'SELECT * FROM attendance_records WHERE id = ?',
      [id]
    )!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'ATTENDANCE_CREATED', 'attendance', ?, 'null', ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        targetUserId,
        targetUser.display_name,
        id,
        JSON.stringify(createdRecord),
        `Attendance recorded for ${date}: ${dutyType.name}`,
        now,
      ]
    );

    res.status(201).json({ record: createdRecord });
  });

  // Edit attendance record
  app.put('/api/attendance/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { duty_type_id, in_time, out_time, notes } = req.body;

    const existing = queryOne<AttendanceRecord>(
      db,
      'SELECT * FROM attendance_records WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Security check: normal user can only edit their own records
    if (req.user!.role === 'user' && existing.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to edit this attendance record' });
    }

    const dutyType = queryOne<DutyType>(db, 'SELECT * FROM duty_types WHERE id = ?', [duty_type_id || existing.duty_type_id]);
    if (!dutyType) {
      return res.status(400).json({ error: 'Invalid duty type' });
    }

    const finalIn = in_time !== undefined ? in_time : existing.in_time;
    const finalOut = out_time !== undefined ? out_time : existing.out_time;
    const calc = calculateAttendance(dutyType, finalIn, finalOut);
    const now = new Date().toISOString();

    execute(
      db,
      `UPDATE attendance_records
       SET duty_type_id = ?,
           duty_type_name_snapshot = ?,
           expected_duration_minutes_snapshot = ?,
           in_time = ?,
           out_time = ?,
           actual_duration_minutes = ?,
           extra_duration_minutes = ?,
           short_duration_minutes = ?,
           difference_minutes = ?,
           status = ?,
           notes = COALESCE(?, notes),
           updated_by = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        dutyType.id,
        dutyType.name,
        dutyType.expected_duration_minutes,
        finalIn,
        finalOut,
        calc.actual_duration_minutes,
        calc.extra_duration_minutes,
        calc.short_duration_minutes,
        calc.difference_minutes,
        calc.status,
        notes,
        req.user!.id,
        now,
        id,
      ]
    );

    const updated = queryOne<AttendanceRecord>(db, 'SELECT * FROM attendance_records WHERE id = ?', [id])!;
    const targetUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [existing.user_id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'ATTENDANCE_UPDATED', 'attendance', ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        existing.user_id,
        targetUser.display_name,
        id,
        JSON.stringify(existing),
        JSON.stringify(updated),
        `Attendance updated for ${existing.date}`,
        now,
      ]
    );

    res.json({ record: updated });
  });

  // Delete attendance record
  app.delete('/api/attendance/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const existing = queryOne<AttendanceRecord>(
      db,
      'SELECT * FROM attendance_records WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (req.user!.role === 'user' && existing.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this record' });
    }

    const now = new Date().toISOString();
    const targetUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [existing.user_id]);

    execute(db, 'DELETE FROM attendance_records WHERE id = ?', [id]);

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'ATTENDANCE_DELETED', 'attendance', ?, ?, 'null', ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        existing.user_id,
        targetUser?.display_name || 'Employee',
        id,
        JSON.stringify(existing),
        `Attendance deleted for ${existing.date}`,
        now,
      ]
    );

    res.json({ success: true, message: 'Record deleted successfully' });
  });

  // ==========================================
  // MONTHLY REPORTS & SUMMARIES
  // ==========================================

  app.get('/api/reports/monthly', requireAuth, (req: AuthRequest, res: Response) => {
    const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    let targetUserId = req.user!.id;
    if (req.user!.role === 'admin' || req.user!.role === 'super_admin') {
      if (req.query.user_id) {
        targetUserId = req.query.user_id as string;
      } else if (req.query.all === 'true') {
        targetUserId = '';
      }
    }

    const monthPadded = String(month).padStart(2, '0');
    let sql = `
      SELECT a.*, u.display_name as user_name
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE strftime("%Y-%m", a.date) = ?
    `;
    const params: any[] = [`${year}-${monthPadded}`];

    if (targetUserId) {
      sql += ' AND a.user_id = ?';
      params.push(targetUserId);
    }

    sql += ' ORDER BY a.date ASC';

    const records = queryAll<AttendanceRecord>(db, sql, params);

    // Compute aggregations
    let morningCount = 0;
    let generalCount = 0;
    let eveningCount = 0;
    let modCount = 0;
    let othersCount = 0;
    let dayOffCount = 0;
    const customCounts: Record<string, number> = {};

    let totalWorkingDays = 0;
    let totalActualMinutes = 0;
    let totalExpectedMinutes = 0;
    let totalExtraMinutes = 0;
    let totalShortMinutes = 0;

    for (const rec of records) {
      const duty = rec.duty_type_id.toLowerCase();
      if (duty === 'morning') morningCount++;
      else if (duty === 'general') generalCount++;
      else if (duty === 'evening') eveningCount++;
      else if (duty === 'mod') modCount++;
      else if (duty === 'others') othersCount++;
      else if (duty === 'day_off') dayOffCount++;
      else {
        customCounts[rec.duty_type_name_snapshot] = (customCounts[rec.duty_type_name_snapshot] || 0) + 1;
      }

      if (duty !== 'day_off') {
        totalWorkingDays++;
      }

      totalActualMinutes += rec.actual_duration_minutes;
      totalExpectedMinutes += rec.expected_duration_minutes_snapshot;
      totalExtraMinutes += rec.extra_duration_minutes;
      totalShortMinutes += rec.short_duration_minutes;
    }

    const netDifferenceMinutes = totalActualMinutes - totalExpectedMinutes;
    const averageDailyMinutes = totalWorkingDays > 0 ? Math.round(totalActualMinutes / totalWorkingDays) : 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const attendanceRate = daysInMonth > 0 ? Math.round((totalWorkingDays / (daysInMonth - dayOffCount || 1)) * 100) : 0;

    res.json({
      summary: {
        month,
        year,
        total_working_days: totalWorkingDays,
        morning_count: morningCount,
        general_count: generalCount,
        evening_count: eveningCount,
        mod_count: modCount,
        others_count: othersCount,
        day_off_count: dayOffCount,
        custom_counts: customCounts,
        total_actual_minutes: totalActualMinutes,
        total_expected_minutes: totalExpectedMinutes,
        total_extra_minutes: totalExtraMinutes,
        total_short_minutes: totalShortMinutes,
        net_difference_minutes: netDifferenceMinutes,
        average_daily_minutes: averageDailyMinutes,
        attendance_rate_percent: Math.min(100, Math.max(0, attendanceRate)),
      },
      records,
    });
  });

  // ==========================================
  // ADMIN USER MANAGEMENT ENDPOINTS
  // ==========================================

  app.get('/api/admin/users', requireAdmin, (req: AuthRequest, res: Response) => {
    const users = queryAll<User>(db, 'SELECT * FROM users ORDER BY role DESC, display_name ASC');

    // Attach basic statistics for each user
    const enhancedUsers = users.map((u) => {
      const stats = queryOne<{ count: number; total_hours: number }>(
        db,
        `SELECT COUNT(*) as count, SUM(actual_duration_minutes) as total_hours
         FROM attendance_records
         WHERE user_id = ?`,
        [u.id]
      );
      return {
        ...u,
        total_records: stats?.count || 0,
        total_actual_hours: ((stats?.total_hours || 0) / 60).toFixed(1),
      };
    });

    res.json({ users: enhancedUsers });
  });

  // Promote / Demote User Role (Super Admin Only)
  app.put('/api/admin/users/:id/role', requireSuperAdmin, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['super_admin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protection for Initial Super Admin
    if (isSuperAdminEmail(targetUser.email) && role !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot demote the primary Super Admin account' });
    }

    // Protection against removing the last Super Admin
    if (targetUser.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = queryOne<{ count: number }>(
        db,
        'SELECT COUNT(*) as count FROM users WHERE role = "super_admin"'
      )?.count || 0;
      if (superAdminCount <= 1) {
        return res.status(403).json({ error: 'Cannot demote the only remaining Super Admin' });
      }
    }

    const now = new Date().toISOString();
    execute(db, 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, id]);

    const updated = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'ROLE_UPDATED', 'user', ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        targetUser.id,
        targetUser.display_name,
        targetUser.id,
        JSON.stringify({ role: targetUser.role }),
        JSON.stringify({ role: updated.role }),
        `Role changed from ${targetUser.role} to ${role}`,
        now,
      ]
    );

    res.json({ user: updated });
  });

  // Activate / Deactivate User
  app.put('/api/admin/users/:id/status', requireAdmin, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const targetUser = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (isSuperAdminEmail(targetUser.email) && status === 'deactivated') {
      return res.status(403).json({ error: 'Cannot deactivate the primary Super Admin' });
    }

    const now = new Date().toISOString();
    execute(db, 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);

    const updated = queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [id])!;

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'USER_UPDATED', 'user', ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        targetUser.id,
        targetUser.display_name,
        targetUser.id,
        JSON.stringify({ status: targetUser.status }),
        JSON.stringify({ status: updated.status }),
        `Account status changed to ${status}`,
        now,
      ]
    );

    res.json({ user: updated });
  });

  // ==========================================
  // AUDIT LOGS ENDPOINTS (ADMIN)
  // ==========================================

  app.get('/api/admin/audit-logs', requireAdmin, (req: AuthRequest, res: Response) => {
    const { action, actor_id, target_id, start_date, end_date, limit } = req.query;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (actor_id) {
      sql += ' AND actor_user_id = ?';
      params.push(actor_id);
    }
    if (target_id) {
      sql += ' AND target_user_id = ?';
      params.push(target_id);
    }
    if (start_date) {
      sql += ' AND timestamp >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND timestamp <= ?';
      params.push(end_date);
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 100, 500);
    sql += ` ORDER BY timestamp DESC LIMIT ${maxLimit}`;

    const logs = queryAll(db, sql, params);
    res.json({ logs });
  });

  // ==========================================
  // GOOGLE SHEETS ENDPOINTS
  // ==========================================

  // Get sheet configuration (Personal or Master)
  app.get('/api/sheets/config', requireAuth, (req: AuthRequest, res: Response) => {
    const sheetType = req.query.type as string; // 'personal' | 'master'

    if (sheetType === 'master') {
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        return res.status(403).json({ error: 'Master sheet configuration restricted to Admins' });
      }
      const config = queryOne(db, 'SELECT * FROM google_sheet_configs WHERE sheet_type = "master"');
      return res.json({ config });
    }

    // Default: Personal sheet configuration for current user
    const config = queryOne(
      db,
      'SELECT * FROM google_sheet_configs WHERE user_id = ? AND sheet_type = "personal"',
      [req.user!.id]
    );
    res.json({ config });
  });

  // Save/Update sheet configuration
  app.post('/api/sheets/config', requireAuth, (req: AuthRequest, res: Response) => {
    const { spreadsheet_id, spreadsheet_name, sheet_tab_name, sheet_type, sync_mode } = req.body;
    if (!spreadsheet_id) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    const isMaster = sheet_type === 'master';
    if (isMaster && req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Admins can configure the Master Sheet' });
    }

    const targetUserId = isMaster ? null : req.user!.id;
    const now = new Date().toISOString();

    const existing = isMaster
      ? queryOne(db, 'SELECT * FROM google_sheet_configs WHERE sheet_type = "master"')
      : queryOne(db, 'SELECT * FROM google_sheet_configs WHERE user_id = ? AND sheet_type = "personal"', [req.user!.id]);

    if (existing) {
      execute(
        db,
        `UPDATE google_sheet_configs
         SET spreadsheet_id = ?,
             spreadsheet_name = ?,
             sheet_tab_name = ?,
             sync_mode = ?,
             updated_at = ?
         WHERE id = ?`,
        [spreadsheet_id, spreadsheet_name || 'Duty Attendance Sheet', sheet_tab_name || 'Attendance', sync_mode || 'manual', now, existing.id]
      );
    } else {
      const id = `sheetcfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      execute(
        db,
        `INSERT INTO google_sheet_configs (id, user_id, sheet_type, spreadsheet_id, spreadsheet_name, sheet_tab_name, sync_mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, targetUserId, sheet_type || 'personal', spreadsheet_id, spreadsheet_name || 'Duty Attendance Sheet', sheet_tab_name || 'Attendance', sync_mode || 'manual', now, now]
      );
    }

    const updated = isMaster
      ? queryOne(db, 'SELECT * FROM google_sheet_configs WHERE sheet_type = "master"')
      : queryOne(db, 'SELECT * FROM google_sheet_configs WHERE user_id = ? AND sheet_type = "personal"', [req.user!.id]);

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'GOOGLE_SHEET_CONNECTED', 'sheet', ?, 'null', ?, ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        targetUserId,
        req.user!.display_name,
        updated.id,
        JSON.stringify(updated),
        `Configured Google Sheet: ${spreadsheet_name || spreadsheet_id}`,
        now,
      ]
    );

    res.json({ config: updated });
  });

  // Disconnect sheet configuration
  app.delete('/api/sheets/config', requireAuth, (req: AuthRequest, res: Response) => {
    const sheetType = req.query.type as string;
    const isMaster = sheetType === 'master';

    if (isMaster && req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Admins can disconnect the Master Sheet' });
    }

    const now = new Date().toISOString();
    if (isMaster) {
      execute(db, 'DELETE FROM google_sheet_configs WHERE sheet_type = "master"');
    } else {
      execute(db, 'DELETE FROM google_sheet_configs WHERE user_id = ? AND sheet_type = "personal"', [req.user!.id]);
    }

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, 'GOOGLE_SHEET_DISCONNECTED', 'sheet', ?, 'null', 'null', ?, ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        isMaster ? null : req.user!.id,
        req.user!.display_name,
        isMaster ? 'master' : req.user!.id,
        `Disconnected ${isMaster ? 'Master' : 'Personal'} Google Sheet`,
        now,
      ]
    );

    res.json({ success: true, message: 'Google Sheet disconnected' });
  });

  // Trigger Google Sheet synchronization
  app.post('/api/sheets/sync', requireAuth, async (req: AuthRequest, res: Response) => {
    const { sheet_type, accessToken, spreadsheet_id } = req.body;
    const isMaster = sheet_type === 'master';

    if (isMaster && req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Master sheet synchronization restricted to Admins' });
    }

    // If regular user requesting personal sheet sync, enforce approved request requirement
    if (!isMaster && req.user!.role === 'user') {
      const approvedReq = queryOne(
        db,
        'SELECT id FROM sheet_access_requests WHERE user_id = ? AND status = "approved"',
        [req.user!.id]
      );
      if (!approvedReq) {
        return res.status(403).json({
          error: 'Google Sheets sync access requires Super Admin approval. Please submit an access request from the Google Sheets page.',
        });
      }
    }

    let config = isMaster
      ? queryOne(db, 'SELECT * FROM google_sheet_configs WHERE sheet_type = "master"')
      : queryOne(db, 'SELECT * FROM google_sheet_configs WHERE user_id = ? AND sheet_type = "personal"', [req.user!.id]);

    const defaultSheetTitle = isMaster
      ? 'Master Duty & Attendance Records'
      : `Duty & Attendance - ${req.user!.display_name || req.user!.email}`;

    if (!config) {
      const id = `sheetcfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const initialId = (spreadsheet_id || '').trim();
      execute(
        db,
        `INSERT INTO google_sheet_configs (id, user_id, sheet_type, spreadsheet_id, spreadsheet_name, sheet_tab_name, sync_mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, isMaster ? null : req.user!.id, sheet_type || 'personal', initialId, defaultSheetTitle, 'Monthly Tabs', 'manual', now, now]
      );
      config = queryOne(db, 'SELECT * FROM google_sheet_configs WHERE id = ?', [id]);
    } else if (spreadsheet_id && spreadsheet_id.trim() && spreadsheet_id.trim() !== config.spreadsheet_id) {
      execute(
        db,
        'UPDATE google_sheet_configs SET spreadsheet_id = ?, updated_at = ? WHERE id = ?',
        [spreadsheet_id.trim(), new Date().toISOString(), config.id]
      );
      config.spreadsheet_id = spreadsheet_id.trim();
    }

    const result = await performGoogleSheetsSync(db, {
      sheetConfigId: config.id,
      userId: isMaster ? null : req.user!.id,
      userName: req.user!.display_name || req.user!.email,
      sheetType: isMaster ? 'master' : 'personal',
      spreadsheetId: config.spreadsheet_id,
      sheetTabName: config.sheet_tab_name,
      accessToken: accessToken,
    });

    res.json(result);
  });

  // Get Sync Logs
  app.get('/api/sheets/logs', requireAuth, (req: AuthRequest, res: Response) => {
    const isMaster = req.query.type === 'master';
    let sql = 'SELECT * FROM sync_logs WHERE 1=1';
    const params: any[] = [];

    if (isMaster) {
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      sql += ' AND sync_type = "master"';
    } else {
      sql += ' AND user_id = ? AND sync_type = "personal"';
      params.push(req.user!.id);
    }

    sql += ' ORDER BY timestamp DESC LIMIT 20';
    const logs = queryAll(db, sql, params);
    res.json({ logs });
  });

  // Get current user's sheet sync access status
  app.get('/api/sheets/access-status', requireAuth, (req: AuthRequest, res: Response) => {
    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (isPrivileged) {
      return res.json({ hasAccess: true, isPrivileged: true, request: null });
    }

    const latestReq = queryOne<any>(
      db,
      'SELECT * FROM sheet_access_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user!.id]
    );

    const hasAccess = Boolean(latestReq && latestReq.status === 'approved');
    res.json({ hasAccess, isPrivileged: false, request: latestReq || null });
  });

  // Submit or update a request for Google Sheets sync access
  app.post('/api/sheets/access-request', requireAuth, (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (isPrivileged) {
      return res.json({ success: true, message: 'Administrators already have direct access.' });
    }

    const now = new Date().toISOString();
    const existing = queryOne<any>(
      db,
      'SELECT * FROM sheet_access_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user!.id]
    );

    let recordId = existing?.id;
    if (existing) {
      if (existing.status === 'approved') {
        return res.json({ success: true, message: 'Your request has already been approved.', request: existing });
      }
      // Re-submit
      execute(
        db,
        `UPDATE sheet_access_requests
         SET status = 'pending', reason = ?, updated_at = ?, user_name = ?, user_email = ?
         WHERE id = ?`,
        [reason || existing.reason || '', now, req.user!.display_name, req.user!.email, existing.id]
      );
    } else {
      recordId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      execute(
        db,
        `INSERT INTO sheet_access_requests (id, user_id, user_name, user_email, status, reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [recordId, req.user!.id, req.user!.display_name, req.user!.email, reason || '', now, now]
      );
    }

    const updated = queryOne(db, 'SELECT * FROM sheet_access_requests WHERE id = ?', [recordId]);
    res.json({ success: true, message: 'Access request submitted to Super Admin successfully.', request: updated });
  });

  // Get all sheet access requests (Admin / Super Admin)
  app.get('/api/sheets/access-requests', requireAdmin, (req: AuthRequest, res: Response) => {
    const requests = queryAll<any>(
      db,
      `SELECT * FROM sheet_access_requests
       ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, updated_at DESC`
    );
    const pendingCount = requests.filter((r) => r.status === 'pending').length;
    res.json({ requests, pendingCount });
  });

  // Review (Approve or Reject) a sheet access request
  app.post('/api/sheets/access-requests/:id/review', requireAdmin, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const existing = queryOne<any>(db, 'SELECT * FROM sheet_access_requests WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const now = new Date().toISOString();
    execute(
      db,
      `UPDATE sheet_access_requests
       SET status = ?, reviewed_by_id = ?, reviewed_by_name = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, req.user!.id, req.user!.display_name, now, now, id]
    );

    const updated = queryOne(db, 'SELECT * FROM sheet_access_requests WHERE id = ?', [id]);

    // Audit log
    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        existing.user_id,
        existing.user_name,
        status === 'approved' ? 'approve' : 'reject',
        'sheet_access',
        id,
        JSON.stringify({ status: existing.status }),
        JSON.stringify({ status }),
        notes || `Sheet sync access ${status} by ${req.user!.display_name}`,
        now,
      ]
    );

    res.json({ success: true, request: updated });
  });

  // ==========================================
  // SYSTEM SETTINGS ENDPOINTS
  // ==========================================

  app.get('/api/settings', (req: Request, res: Response) => {
    const rows = queryAll<{ key: string; value: string }>(db, 'SELECT * FROM system_settings');
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ settings });
  });

  app.put('/api/settings', requireSuperAdmin, (req: AuthRequest, res: Response) => {
    const newSettings = req.body;
    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(newSettings)) {
      if (typeof val === 'string' || typeof val === 'boolean' || typeof val === 'number') {
        execute(
          db,
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, String(val), now]
        );
      }
    }

    execute(
      db,
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_email, target_user_id, target_name, action, entity_type, entity_id, old_value, new_value, notes, timestamp)
       VALUES (?, ?, ?, ?, NULL, NULL, 'SETTINGS_UPDATED', 'settings', 'system', 'null', ?, 'System settings updated by Super Admin', ?)`,
      [
        `audit-${Date.now()}`,
        req.user!.id,
        req.user!.display_name,
        req.user!.email,
        JSON.stringify(newSettings),
        now,
      ]
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  });

  // ==========================================
  // FIREBASE FIRESTORE PERSISTENCE & SYNC
  // ==========================================

  app.get('/api/firebase/status', (_req: Request, res: Response) => {
    res.json(getCloudSyncStatus());
  });

  app.post('/api/firebase/sync', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const result = await syncCloudWithLocal(db);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Firestore cloud sync failed' });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE / SPA STATIC HANDLER
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Duty & Attendance System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Duty & Attendance System server:', err);
});
