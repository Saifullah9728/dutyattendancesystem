import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import type { Database } from 'sql.js';
import { queryAll, execute, onDatabaseWrite } from './db';

let firestoreInstance: Firestore | null = null;
let isInitialized = false;
let lastSyncTimestamp: string | null = null;
let lastSyncStatus: 'idle' | 'success' | 'error' | 'syncing' = 'idle';
let lastSyncMessage: string = 'Not synced yet';
let activeDbRef: Database | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export function initFirebaseSync(db: Database) {
  activeDbRef = db;
  getFirestoreServer();

  // Register listener for any database write
  onDatabaseWrite((sql: string) => {
    const upper = sql.toUpperCase();
    if (
      upper.includes('USERS') ||
      upper.includes('ATTENDANCE_RECORDS') ||
      upper.includes('DUTY_TYPES') ||
      upper.includes('SYSTEM_SETTINGS') ||
      upper.includes('AUDIT_LOGS')
    ) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (activeDbRef) {
          uploadLocalChangesToCloud(activeDbRef).catch((e) =>
            console.error('Debounced cloud upload failed:', e.message)
          );
        }
      }, 1500);
    }
  });
}

export async function uploadLocalChangesToCloud(db: Database): Promise<void> {
  const fdb = getFirestoreServer();
  if (!fdb) return;

  try {
    // 1. Upload users
    const users = queryAll<any>(db, 'SELECT * FROM users');
    for (const u of users) {
      await setDoc(doc(fdb, 'users', String(u.id)), u, { merge: true });
    }

    // 2. Upload duty types
    const dutyTypes = queryAll<any>(db, 'SELECT * FROM duty_types');
    for (const dt of dutyTypes) {
      await setDoc(doc(fdb, 'duty_types', String(dt.id)), dt, { merge: true });
    }

    // 3. Upload attendance records
    const records = queryAll<any>(db, 'SELECT * FROM attendance_records');
    for (const rec of records) {
      await setDoc(doc(fdb, 'attendance_records', String(rec.id)), rec, { merge: true });
    }

    // 4. Upload system settings
    const settings = queryAll<any>(db, 'SELECT * FROM system_settings');
    for (const s of settings) {
      await setDoc(doc(fdb, 'system_settings', String(s.key)), s, { merge: true });
    }

    lastSyncTimestamp = new Date().toISOString();
    lastSyncStatus = 'success';
    lastSyncMessage = `Live sync completed: ${users.length} users, ${records.length} records.`;
  } catch (err: any) {
    console.error('Failed uploading changes to Cloud Firestore:', err.message);
  }
}

export function getFirestoreServer(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('Firebase config file not found at:', configPath);
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.projectId || !config.apiKey) {
      console.warn('Incomplete Firebase configuration in firebase-applet-config.json');
      return null;
    }

    const app = getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        });

    firestoreInstance = config.firestoreDatabaseId
      ? initializeFirestore(app, {}, config.firestoreDatabaseId)
      : getFirestore(app);

    isInitialized = true;
    console.log('Firebase Firestore initialized successfully for project:', config.projectId, 'Database ID:', config.firestoreDatabaseId || '(default)');
    return firestoreInstance;
  } catch (err) {
    console.error('Failed to initialize Firebase Firestore server:', err);
    return null;
  }
}

/**
 * Syncs data between Cloud Firestore and local SQLite on server startup or on demand.
 * If Cloud Firestore has data (e.g. after container redeploy/republish),
 * it restores users, attendance, duty types, and settings into the local database.
 * If Cloud Firestore is missing records present locally, it uploads them to Firestore.
 */
export async function syncCloudWithLocal(db: Database): Promise<{
  success: boolean;
  restoredFromCloud: number;
  uploadedToCloud: number;
  message: string;
}> {
  const fdb = getFirestoreServer();
  if (!fdb) {
    return {
      success: false,
      restoredFromCloud: 0,
      uploadedToCloud: 0,
      message: 'Firestore is not configured.',
    };
  }

  lastSyncStatus = 'syncing';
  lastSyncMessage = 'Sync in progress...';

  try {
    let restoredCount = 0;
    let uploadedCount = 0;

    // 1. SYNC USERS
    const usersCol = collection(fdb, 'users');
    const cloudUsersSnap = await getDocs(usersCol);
    const cloudUsersMap = new Map<string, any>();
    cloudUsersSnap.forEach((d) => {
      cloudUsersMap.set(d.id, d.data());
    });

    const localUsers = queryAll<any>(db, 'SELECT * FROM users');
    const localUsersMap = new Map<string, any>();
    localUsers.forEach((u) => localUsersMap.set(u.id, u));

    // Restore users from Cloud into Local if missing or newer
    for (const [id, cloudUser] of cloudUsersMap.entries()) {
      const localUser = localUsersMap.get(id);
      if (!localUser) {
        // Insert missing user from cloud
        execute(
          db,
          `INSERT OR REPLACE INTO users (id, google_id, email, display_name, avatar_url, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cloudUser.id || id,
            cloudUser.google_id || '',
            cloudUser.email,
            cloudUser.display_name || '',
            cloudUser.avatar_url || '',
            cloudUser.role || 'user',
            cloudUser.status || 'active',
            cloudUser.created_at || new Date().toISOString(),
            cloudUser.updated_at || new Date().toISOString(),
          ]
        );
        restoredCount++;
      }
    }

    // Upload local users to Cloud if not present in Cloud
    for (const [id, localUser] of localUsersMap.entries()) {
      if (!cloudUsersMap.has(id)) {
        await setDoc(doc(fdb, 'users', id), localUser, { merge: true });
        uploadedCount++;
      }
    }

    // 2. SYNC DUTY TYPES
    const dutyCol = collection(fdb, 'duty_types');
    const cloudDutySnap = await getDocs(dutyCol);
    const cloudDutyMap = new Map<string, any>();
    cloudDutySnap.forEach((d) => cloudDutyMap.set(d.id, d.data()));

    const localDutyTypes = queryAll<any>(db, 'SELECT * FROM duty_types');
    const localDutyMap = new Map<string, any>();
    localDutyTypes.forEach((d) => localDutyMap.set(d.id, d));

    for (const [id, cloudDt] of cloudDutyMap.entries()) {
      if (!localDutyMap.has(id)) {
        execute(
          db,
          `INSERT OR REPLACE INTO duty_types (id, name, start_time, end_time, expected_duration_minutes, is_working_day, contributes_to_hours, color, description, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cloudDt.id || id,
            cloudDt.name,
            cloudDt.start_time,
            cloudDt.end_time,
            cloudDt.expected_duration_minutes ?? 540,
            cloudDt.is_working_day ?? 1,
            cloudDt.contributes_to_hours ?? 1,
            cloudDt.color || '#2563eb',
            cloudDt.description || '',
            cloudDt.is_active ?? 1,
            cloudDt.created_at || new Date().toISOString(),
            cloudDt.updated_at || new Date().toISOString(),
          ]
        );
        restoredCount++;
      }
    }

    for (const [id, localDt] of localDutyMap.entries()) {
      if (!cloudDutyMap.has(id)) {
        await setDoc(doc(fdb, 'duty_types', id), localDt, { merge: true });
        uploadedCount++;
      }
    }

    // 3. SYNC ATTENDANCE RECORDS
    const attCol = collection(fdb, 'attendance_records');
    const cloudAttSnap = await getDocs(attCol);
    const cloudAttMap = new Map<string, any>();
    cloudAttSnap.forEach((d) => cloudAttMap.set(d.id, d.data()));

    const localAtt = queryAll<any>(db, 'SELECT * FROM attendance_records');
    const localAttMap = new Map<string, any>();
    localAtt.forEach((a) => localAttMap.set(a.id, a));

    for (const [id, cloudRec] of cloudAttMap.entries()) {
      if (!localAttMap.has(id)) {
        execute(
          db,
          `INSERT OR REPLACE INTO attendance_records (
            id, user_id, date, duty_type_id, duty_type_name_snapshot,
            expected_duration_minutes_snapshot, in_time, out_time,
            actual_duration_minutes, extra_duration_minutes, short_duration_minutes,
            difference_minutes, status, notes, created_by, updated_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cloudRec.id || id,
            cloudRec.user_id,
            cloudRec.date,
            cloudRec.duty_type_id,
            cloudRec.duty_type_name_snapshot || '',
            cloudRec.expected_duration_minutes_snapshot ?? 540,
            cloudRec.in_time || '',
            cloudRec.out_time || '',
            cloudRec.actual_duration_minutes ?? 0,
            cloudRec.extra_duration_minutes ?? 0,
            cloudRec.short_duration_minutes ?? 0,
            cloudRec.difference_minutes ?? 0,
            cloudRec.status,
            cloudRec.notes || '',
            cloudRec.created_by || '',
            cloudRec.updated_by || '',
            cloudRec.created_at || new Date().toISOString(),
            cloudRec.updated_at || new Date().toISOString(),
          ]
        );
        restoredCount++;
      }
    }

    for (const [id, localRec] of localAttMap.entries()) {
      if (!cloudAttMap.has(id)) {
        await setDoc(doc(fdb, 'attendance_records', id), localRec, { merge: true });
        uploadedCount++;
      }
    }

    // 4. SYNC SYSTEM SETTINGS
    const settingsCol = collection(fdb, 'system_settings');
    const cloudSettingsSnap = await getDocs(settingsCol);
    const cloudSettingsMap = new Map<string, any>();
    cloudSettingsSnap.forEach((d) => cloudSettingsMap.set(d.id, d.data()));

    const localSettings = queryAll<any>(db, 'SELECT * FROM system_settings');
    const localSettingsMap = new Map<string, any>();
    localSettings.forEach((s) => localSettingsMap.set(s.key, s));

    for (const [key, cloudSet] of cloudSettingsMap.entries()) {
      if (!localSettingsMap.has(key) && key !== 'cloud_status') {
        execute(
          db,
          `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`,
          [key, cloudSet.value || '', cloudSet.updated_at || new Date().toISOString()]
        );
        restoredCount++;
      }
    }

    for (const [key, localSet] of localSettingsMap.entries()) {
      if (!cloudSettingsMap.has(key)) {
        await setDoc(doc(fdb, 'system_settings', key), localSet, { merge: true });
        uploadedCount++;
      }
    }

    // 5. Update Cloud Heartbeat
    await setDoc(doc(fdb, 'system_settings', 'cloud_status'), {
      status: 'connected',
      synced_at: new Date().toISOString(),
      user_count: queryAll<any>(db, 'SELECT COUNT(*) as c FROM users')[0]?.c || 0,
      attendance_count: queryAll<any>(db, 'SELECT COUNT(*) as c FROM attendance_records')[0]?.c || 0,
    });

    lastSyncTimestamp = new Date().toISOString();
    lastSyncStatus = 'success';
    lastSyncMessage = `Synchronized: ${restoredCount} restored from Cloud, ${uploadedCount} uploaded to Cloud.`;

    console.log(`[Firestore Sync] Completed successfully. Restored: ${restoredCount}, Uploaded: ${uploadedCount}`);
    return {
      success: true,
      restoredFromCloud: restoredCount,
      uploadedToCloud: uploadedCount,
      message: lastSyncMessage,
    };
  } catch (err: any) {
    lastSyncStatus = 'error';
    lastSyncMessage = err?.message || 'Unknown Firestore sync error';
    console.error('[Firestore Sync] Error during sync:', err);
    return {
      success: false,
      restoredFromCloud: 0,
      uploadedToCloud: 0,
      message: lastSyncMessage,
    };
  }
}

// Background fire-and-forget sync helper functions for individual records
export function cloudSaveUser(user: any) {
  const fdb = getFirestoreServer();
  if (!fdb || !user?.id) return;
  setDoc(doc(fdb, 'users', String(user.id)), { ...user }, { merge: true }).catch((e) =>
    console.error('Failed to sync user to Firestore:', e.message)
  );
}

export function cloudDeleteUser(userId: string) {
  const fdb = getFirestoreServer();
  if (!fdb || !userId) return;
  deleteDoc(doc(fdb, 'users', String(userId))).catch((e) =>
    console.error('Failed to delete user from Firestore:', e.message)
  );
}

export function cloudSaveAttendance(record: any) {
  const fdb = getFirestoreServer();
  if (!fdb || !record?.id) return;
  setDoc(doc(fdb, 'attendance_records', String(record.id)), { ...record }, { merge: true }).catch((e) =>
    console.error('Failed to sync attendance to Firestore:', e.message)
  );
}

export function cloudDeleteAttendance(recordId: string) {
  const fdb = getFirestoreServer();
  if (!fdb || !recordId) return;
  deleteDoc(doc(fdb, 'attendance_records', String(recordId))).catch((e) =>
    console.error('Failed to delete attendance from Firestore:', e.message)
  );
}

export function cloudSaveDutyType(dt: any) {
  const fdb = getFirestoreServer();
  if (!fdb || !dt?.id) return;
  setDoc(doc(fdb, 'duty_types', String(dt.id)), { ...dt }, { merge: true }).catch((e) =>
    console.error('Failed to sync duty type to Firestore:', e.message)
  );
}

export function cloudDeleteDutyType(id: string) {
  const fdb = getFirestoreServer();
  if (!fdb || !id) return;
  deleteDoc(doc(fdb, 'duty_types', String(id))).catch((e) =>
    console.error('Failed to delete duty type from Firestore:', e.message)
  );
}

export function cloudSaveSetting(key: string, value: string) {
  const fdb = getFirestoreServer();
  if (!fdb || !key) return;
  setDoc(
    doc(fdb, 'system_settings', String(key)),
    { key, value, updated_at: new Date().toISOString() },
    { merge: true }
  ).catch((e) => console.error('Failed to sync setting to Firestore:', e.message));
}

export function cloudSaveAuditLog(log: any) {
  const fdb = getFirestoreServer();
  if (!fdb || !log?.id) return;
  setDoc(doc(fdb, 'audit_logs', String(log.id)), { ...log }, { merge: true }).catch((e) =>
    console.error('Failed to sync audit log to Firestore:', e.message)
  );
}

export function getCloudSyncStatus() {
  return {
    isConfigured: isInitialized || Boolean(getFirestoreServer()),
    lastSyncTimestamp,
    lastSyncStatus,
    lastSyncMessage,
  };
}
