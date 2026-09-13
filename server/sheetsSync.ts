import { Database } from 'sql.js';
import { execute, queryAll, queryOne } from './db';
import { formatMinutesToHM } from '../src/utils/calculations';
import type { AttendanceRecord } from '../src/types';

interface SyncOptions {
  sheetConfigId: string;
  userId: string | null;
  userName?: string;
  sheetType: 'personal' | 'master';
  spreadsheetId: string;
  sheetTabName?: string;
  accessToken?: string;
}

export interface SyncResult {
  success: boolean;
  recordsCount: number;
  message: string;
  error?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  monthsSynced?: string[];
}

/**
 * Returns month tab name formatted like "September 2026"
 */
function getMonthTabName(dateStr: string): string {
  if (!dateStr) return 'General';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${monthNames[monthIndex]} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  } catch {}
  return 'General';
}

/**
 * Returns day of week e.g. "Fri", "Mon"
 */
function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }
  } catch {}
  return '';
}

export async function performGoogleSheetsSync(
  db: Database,
  options: SyncOptions
): Promise<SyncResult> {
  const { sheetConfigId, userId, userName, sheetType, spreadsheetId, accessToken } = options;
  const now = new Date().toISOString();
  const logId = `synclog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Validate Google OAuth Token
  if (!accessToken) {
    const errorMsg = 'Google OAuth token is missing or expired. Please authorize Google Sheets access.';
    
    execute(
      db,
      `INSERT INTO sync_logs (id, sheet_config_id, user_id, sync_type, status, records_count, error_message, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, sheetConfigId, userId, sheetType, 'failed', 0, errorMsg, now]
    );

    execute(
      db,
      `UPDATE google_sheet_configs
       SET last_sync_time = ?, last_sync_status = 'failed', last_sync_message = ?, updated_at = ?
       WHERE id = ?`,
      [now, errorMsg, now, sheetConfigId]
    );

    return {
      success: false,
      recordsCount: 0,
      message: errorMsg,
      error: errorMsg,
    };
  }

  // Clean spreadsheetId if URL was passed
  let cleanSpreadsheetId = (spreadsheetId || '').trim();
  const urlMatch = cleanSpreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    cleanSpreadsheetId = urlMatch[1];
  }

  try {
    const isMaster = sheetType === 'master';
    const defaultSheetTitle = isMaster
      ? 'Master Duty & Attendance Records'
      : `Duty & Attendance Records - ${userName || 'My Records'}`;

    // 2. Auto-Create Google Sheet if no spreadsheet exists yet
    if (!cleanSpreadsheetId) {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: defaultSheetTitle,
          },
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        const msg = errData.error?.message || `Google Sheets API creation error (status ${createRes.status})`;
        throw new Error(msg);
      }

      const createdSheetData = await createRes.json();
      cleanSpreadsheetId = createdSheetData.spreadsheetId;

      // Update config with the newly created spreadsheet ID
      execute(
        db,
        `UPDATE google_sheet_configs
         SET spreadsheet_id = ?, spreadsheet_name = ?, updated_at = ?
         WHERE id = ?`,
        [cleanSpreadsheetId, defaultSheetTitle, now, sheetConfigId]
      );
    }

    // 3. Fetch records from local database
    let records: AttendanceRecord[] = [];
    if (sheetType === 'personal' && userId) {
      records = queryAll<AttendanceRecord>(
        db,
        `SELECT a.*, u.display_name as user_name, u.email as user_email
         FROM attendance_records a
         JOIN users u ON a.user_id = u.id
         WHERE a.user_id = ?
         ORDER BY a.date ASC, a.in_time ASC`,
        [userId]
      );
    } else {
      records = queryAll<AttendanceRecord>(
        db,
        `SELECT a.*, u.display_name as user_name, u.email as user_email
         FROM attendance_records a
         JOIN users u ON a.user_id = u.id
         ORDER BY a.date ASC, a.in_time ASC`
      );
    }

    // 4. Group records by month (e.g. "September 2026", "October 2026")
    const recordsByMonth = new Map<string, AttendanceRecord[]>();
    for (const rec of records) {
      const monthKey = getMonthTabName(rec.date);
      if (!recordsByMonth.has(monthKey)) {
        recordsByMonth.set(monthKey, []);
      }
      recordsByMonth.get(monthKey)!.push(rec);
    }

    // If there are no attendance records in DB yet, create current month tab as a starting template
    if (recordsByMonth.size === 0) {
      const currentMonthKey = getMonthTabName(now.slice(0, 10));
      recordsByMonth.set(currentMonthKey, []);
    }

    // 5. Query existing spreadsheet tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanSpreadsheetId)}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaRes.ok) {
      const errData = await metaRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Failed to read Google Sheet (status ${metaRes.status})`);
    }

    const meta = await metaRes.json();
    const existingSheets: { sheetId: number; title: string }[] = (meta.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title || '',
    }));

    const existingTabsMap = new Map<string, { sheetId: number; title: string }>();
    for (const s of existingSheets) {
      if (s.title) {
        existingTabsMap.set(s.title.toLowerCase().trim(), s);
      }
    }

    const expectedHeaders = isMaster
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
        ];

    let totalUpdated = 0;
    let totalAppended = 0;
    const monthsSynced: string[] = [];

    // 6. Process each month tab
    for (const [monthTabName, monthRecords] of recordsByMonth.entries()) {
      monthsSynced.push(monthTabName);
      let targetSheetId: number | null = null;
      const tabLower = monthTabName.toLowerCase().trim();

      // Ensure tab exists
      if (existingTabsMap.has(tabLower)) {
        targetSheetId = existingTabsMap.get(tabLower)!.sheetId;
      } else {
        // If sheet only has default "Sheet1", rename it to monthTabName
        if (existingTabsMap.size === 1 && existingTabsMap.has('sheet1')) {
          const sheet1 = existingTabsMap.get('sheet1')!;
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanSpreadsheetId)}:batchUpdate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                requests: [
                  {
                    updateSheetProperties: {
                      properties: {
                        sheetId: sheet1.sheetId,
                        title: monthTabName,
                        gridProperties: { frozenRowCount: 1 },
                      },
                      fields: 'title,gridProperties.frozenRowCount',
                    },
                  },
                ],
              }),
            }
          );
          existingTabsMap.delete('sheet1');
          existingTabsMap.set(tabLower, { sheetId: sheet1.sheetId, title: monthTabName });
          targetSheetId = sheet1.sheetId;
        } else {
          // Add a new tab with frozen top header row
          const addRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanSpreadsheetId)}:batchUpdate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: monthTabName,
                        gridProperties: { frozenRowCount: 1 },
                      },
                    },
                  },
                ],
              }),
            }
          );

          if (addRes.ok) {
            const addData = await addRes.json();
            const newProps = addData.replies?.[0]?.addSheet?.properties;
            if (newProps) {
              targetSheetId = newProps.sheetId;
              existingTabsMap.set(tabLower, { sheetId: newProps.sheetId, title: newProps.title });
            }
          }
        }
      }

      // Read existing data in this month tab
      const endColLetter = isMaster ? 'O' : 'M';
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        cleanSpreadsheetId
      )}/values/${encodeURIComponent(monthTabName)}!A1:${endColLetter}2000`;

      const readRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const existingData = readRes.ok ? await readRes.json() : {};
      const rows: string[][] = existingData.values || [];

      // Check if header row exists
      const needsHeaders = rows.length === 0 || rows[0][0] !== 'Attendance ID';

      // Map existing records by Attendance ID (Column A, 0-indexed)
      const existingIdToRowIndex = new Map<string, number>();
      for (let r = 1; r < rows.length; r++) {
        const id = rows[r][0];
        if (id) {
          existingIdToRowIndex.set(id, r + 1); // 1-indexed sheet row
        }
      }

      const updates: { range: string; values: string[][] }[] = [];
      const appends: string[][] = [];

      if (needsHeaders) {
        appends.push(expectedHeaders);
      }

      // Prepare row data for each attendance record in this month
      for (const rec of monthRecords) {
        const rowData = isMaster
          ? [
              rec.id,
              rec.date,
              getDayOfWeek(rec.date),
              rec.user_name || '',
              rec.user_email || '',
              rec.duty_type_name_snapshot,
              rec.in_time || 'N/A',
              rec.out_time || 'N/A',
              formatMinutesToHM(rec.actual_duration_minutes),
              formatMinutesToHM(rec.expected_duration_minutes_snapshot),
              formatMinutesToHM(rec.extra_duration_minutes),
              formatMinutesToHM(rec.short_duration_minutes),
              rec.status.toUpperCase(),
              rec.notes || '',
              rec.updated_at,
            ]
          : [
              rec.id,
              rec.date,
              getDayOfWeek(rec.date),
              rec.duty_type_name_snapshot,
              rec.in_time || 'N/A',
              rec.out_time || 'N/A',
              formatMinutesToHM(rec.actual_duration_minutes),
              formatMinutesToHM(rec.expected_duration_minutes_snapshot),
              formatMinutesToHM(rec.extra_duration_minutes),
              formatMinutesToHM(rec.short_duration_minutes),
              rec.status.toUpperCase(),
              rec.notes || '',
              rec.updated_at,
            ];

        const existingRowIndex = existingIdToRowIndex.get(rec.id);
        if (existingRowIndex && !needsHeaders) {
          updates.push({
            range: `${monthTabName}!A${existingRowIndex}:${endColLetter}${existingRowIndex}`,
            values: [rowData],
          });
          totalUpdated++;
        } else {
          appends.push(rowData);
          totalAppended++;
        }
      }

      // Apply batch row updates if any
      if (updates.length > 0) {
        const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          cleanSpreadsheetId
        )}/values:batchUpdate`;

        await fetch(batchUpdateUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updates,
          }),
        });
      }

      // Apply row appends if any
      if (appends.length > 0) {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          cleanSpreadsheetId
        )}/values/${encodeURIComponent(monthTabName)}!A1:append?valueInputOption=USER_ENTERED`;

        await fetch(appendUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: appends,
          }),
        });
      }

      // If headers were newly added and we have targetSheetId, apply styling (Navy Blue header bar with bold white text)
      if (needsHeaders && targetSheetId !== null) {
        try {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanSpreadsheetId)}:batchUpdate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId: targetSheetId,
                        startRowIndex: 0,
                        endRowIndex: 1,
                      },
                      cell: {
                        userEnteredFormat: {
                          backgroundColor: { red: 0.12, green: 0.25, blue: 0.69 },
                          textFormat: {
                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                            bold: true,
                            fontSize: 10,
                          },
                          horizontalAlignment: 'CENTER',
                        },
                      },
                      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                    },
                  },
                ],
              }),
            }
          );
        } catch {
          // Non-blocking cosmetic enhancement
        }
      }
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}/edit`;
    const successMsg = `Synced ${records.length} records across ${monthsSynced.length} monthly tabs (${monthsSynced.join(', ')}).`;

    // Record sync log
    execute(
      db,
      `INSERT INTO sync_logs (id, sheet_config_id, user_id, sync_type, status, records_count, error_message, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, sheetConfigId, userId, sheetType, 'success', records.length, null, now]
    );

    // Update config status
    execute(
      db,
      `UPDATE google_sheet_configs
       SET last_sync_time = ?, last_sync_status = 'success', last_sync_message = ?, updated_at = ?
       WHERE id = ?`,
      [now, successMsg, now, sheetConfigId]
    );

    return {
      success: true,
      recordsCount: records.length,
      message: successMsg,
      spreadsheetId: cleanSpreadsheetId,
      spreadsheetUrl,
      monthsSynced,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Google Sheets sync failed unexpectedly';

    execute(
      db,
      `INSERT INTO sync_logs (id, sheet_config_id, user_id, sync_type, status, records_count, error_message, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, sheetConfigId, userId, sheetType, 'failed', 0, errorMsg, now]
    );

    execute(
      db,
      `UPDATE google_sheet_configs
       SET last_sync_time = ?, last_sync_status = 'failed', last_sync_message = ?, updated_at = ?
       WHERE id = ?`,
      [now, errorMsg, now, sheetConfigId]
    );

    return {
      success: false,
      recordsCount: 0,
      message: errorMsg,
      error: errorMsg,
    };
  }
}
