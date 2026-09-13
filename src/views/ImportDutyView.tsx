import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User as UserIcon,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import type { DutyType, User } from '../types';
import { calculateAttendance, formatMinutesToHM } from '../utils/calculations';

interface ParsedRow {
  rowNumber: number;
  rawDate: string;
  normalizedDate: string;
  dayOfWeek: string;
  dutyTypeRaw: string;
  matchedDutyType: DutyType | null;
  inTime: string;
  outTime: string;
  notes: string;
  isValid: boolean;
  warning?: string;
  calculatedStatus?: string;
  calculatedActualHM?: string;
  calculatedDiffHM?: string;
}

interface ImportDutyViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const ImportDutyView: React.FC<ImportDutyViewProps> = ({ onNavigateTab }) => {
  const { user, isAdmin } = useAuth();
  const { success, error, warning } = useToast();
  const showSuccess = (msg: string) => success(msg);
  const showError = (msg: string) => error(msg);
  const showWarning = (msg: string) => warning(msg);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || '');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);

  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  // File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showRules, setShowRules] = useState<boolean>(true);

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
    errors: string[];
    monthPrefix: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load duty types and employees
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoadingConfig(true);
        const dtRes = await api.getDutyTypes();
        setDutyTypes(dtRes.dutyTypes || []);

        if (isAdmin) {
          const uRes = await api.getUsers();
          setEmployees(uRes.users || []);
        }
      } catch (err: any) {
        showError(err.message || 'Failed to load configuration.');
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [isAdmin]);

  // Set default target user
  useEffect(() => {
    if (user?.id && !selectedUserId) {
      setSelectedUserId(user.id);
    }
  }, [user]);

  // Months list
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Helper to normalize time string (supports 24h, 12h AM/PM, decimal from Excel)
  const normalizeTimeString = (rawVal: any): string => {
    if (rawVal === undefined || rawVal === null || rawVal === '') return '';

    // If it's an Excel time fraction (e.g. 0.33333333 = 08:00)
    if (typeof rawVal === 'number' && rawVal >= 0 && rawVal < 1) {
      const totalMinutes = Math.round(rawVal * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const str = String(rawVal).trim();
    if (!str) return '';

    // Check for 12-hour format like "8:00 AM" or "08:30pm"
    const match12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?$/);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2];
      const ampm = match12[3]?.toUpperCase();

      if (ampm) {
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
      }
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // Check simple "H:MM" or "HH:MM"
    const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const h = parseInt(match24[1], 10);
      const m = match24[2];
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    return str;
  };

  // Helper to match duty type
  const matchDutyType = (raw: string, allTypes: DutyType[]): DutyType | null => {
    if (!raw) return allTypes.find((d) => d.id === 'morning') || allTypes[0] || null;
    const lower = raw.trim().toLowerCase();

    // Direct ID or name match
    const exact = allTypes.find(
      (d) => d.id.toLowerCase() === lower || d.name.toLowerCase() === lower
    );
    if (exact) return exact;

    // Common synonyms
    if (lower === 'off' || lower === 'day off' || lower === 'dayoff' || lower === 'ছুটি' || lower === 'holiday') {
      const dayOff = allTypes.find((d) => d.id === 'day_off');
      if (dayOff) return dayOff;
    }
    if (lower.includes('morn') || lower === 'সকাল') {
      const morn = allTypes.find((d) => d.id === 'morning');
      if (morn) return morn;
    }
    if (lower.includes('even') || lower === 'সন্ধ্যা') {
      const eve = allTypes.find((d) => d.id === 'evening');
      if (eve) return eve;
    }
    if (lower.includes('night') || lower === 'রাত') {
      const n = allTypes.find((d) => d.id === 'night');
      if (n) return n;
    }

    return allTypes[0] || null;
  };

  // Process File rows with XLSX
  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setParsing(true);
    setImportResult(null);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        showWarning('Uploaded file is empty or has no recognizable data rows.');
        setParsedRows([]);
        return;
      }

      const targetPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const results: ParsedRow[] = [];

      rawJson.forEach((row, index) => {
        const rowNumber = index + 2; // header is row 1
        const keys = Object.keys(row);

        // Find Date column
        const dateKey = keys.find((k) =>
          /^(date|day|তারিখ|দিন|dt)$/i.test(k.trim().toLowerCase())
        ) || keys[0];

        // Find Duty Type column
        const dutyKey = keys.find((k) =>
          /^(duty|duty_type|duty type|shift|শিফট|type)$/i.test(k.trim().toLowerCase())
        ) || keys[1];

        // Find In Time column
        const inKey = keys.find((k) =>
          /^(in|in_time|intime|in time|start|start_time|start time|প্রবেশ)$/i.test(k.trim().toLowerCase())
        );

        // Find Out Time column
        const outKey = keys.find((k) =>
          /^(out|out_time|outtime|out time|end|end_time|end time|প্রস্থান)$/i.test(k.trim().toLowerCase())
        );

        // Find single Combined Time column (e.g. "Time", "Duty Time", "In/Out", "সময়", "শিফট সময়")
        const combinedTimeKey = keys.find((k) =>
          /^(time|duty_time|duty time|in_out|in\/out|in-out|hours|duty_hours|সময়|শিফট সময়|শিফট টাইম)$/i.test(
            k.trim().toLowerCase()
          )
        );

        // Find Notes column
        const notesKey = keys.find((k) =>
          /^(notes|note|remarks|comment|মন্তব্য)$/i.test(k.trim().toLowerCase())
        );

        const rawDate = String(row[dateKey] ?? '').trim();
        const rawDuty = String(row[dutyKey] ?? '').trim();
        let rawIn = inKey ? row[inKey] : '';
        let rawOut = outKey ? row[outKey] : '';
        const rawCombined = combinedTimeKey ? String(row[combinedTimeKey] ?? '').trim() : '';
        const rawNotes = notesKey ? String(row[notesKey] ?? '').trim() : '';

        // If inKey was not given or empty, but combinedTimeKey exists, check if it has a range
        const timeSource = rawCombined || (typeof rawIn === 'string' ? rawIn : '');
        if (
          timeSource &&
          (timeSource.includes('-') ||
            timeSource.includes('–') ||
            /\bto\b/i.test(timeSource) ||
            timeSource.includes('/'))
        ) {
          // Split single-box time format like "08:00 - 17:00" or "8:00 AM to 5:00 PM"
          const splitParts = timeSource.split(/\s*[-–/]\s*|\s+to\s+/i);
          if (splitParts.length >= 2) {
            rawIn = splitParts[0].trim();
            rawOut = splitParts[1].trim();
          }
        }

        if (!rawDate && !rawDuty && !rawIn && !rawOut && !rawCombined) {
          // empty row, ignore
          return;
        }

        // Normalize Date
        let normalizedDate = '';
        let isValid = true;
        let warning = '';

        if (/^\d{1,2}$/.test(rawDate)) {
          // Just day number 1-31
          const dayNum = parseInt(rawDate, 10);
          if (dayNum >= 1 && dayNum <= 31) {
            normalizedDate = `${targetPrefix}-${String(dayNum).padStart(2, '0')}`;
          } else {
            isValid = false;
            warning = `Day number ${rawDate} out of range (1-31).`;
          }
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          // Standard YYYY-MM-DD
          normalizedDate = rawDate;
        } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(rawDate)) {
          // DD-MM-YYYY or DD/MM/YYYY
          const parts = rawDate.split(/[/-]/);
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (typeof row[dateKey] === 'number' && row[dateKey] > 40000) {
          // Excel serial date format
          const dateObj = new Date(Math.round((row[dateKey] - 25569) * 86400 * 1000));
          const y = dateObj.getUTCFullYear();
          const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getUTCDate()).padStart(2, '0');
          normalizedDate = `${y}-${m}-${d}`;
        } else {
          isValid = false;
          warning = `Invalid date format "${rawDate}". Use YYYY-MM-DD, DD-MM-YYYY, or day number 1-31.`;
        }

        // Check date belongs to selected month/year
        if (isValid && normalizedDate && !normalizedDate.startsWith(targetPrefix)) {
          isValid = false;
          warning = `Date ${normalizedDate} does not match selected month (${targetPrefix}).`;
        }

        // Match Duty Type
        const matchedDuty = matchDutyType(rawDuty, dutyTypes);

        // Normalize Times
        const inTime = normalizeTimeString(rawIn);
        const outTime = normalizeTimeString(rawOut);

        // Calculation preview
        let calculatedStatus = 'normal';
        let calculatedActualHM = '0h 00m';
        let calculatedDiffHM = '0h 00m';

        if (matchedDuty) {
          if (matchedDuty.id === 'day_off') {
            calculatedStatus = 'day_off';
          } else if (!inTime && !outTime) {
            calculatedStatus = 'blank';
            calculatedActualHM = '0h 00m (Blank)';
            calculatedDiffHM = `-${formatMinutesToHM(matchedDuty.expected_duration_minutes)}`;
          } else {
            const calc = calculateAttendance(matchedDuty, inTime, outTime);
            calculatedStatus = calc.status;
            calculatedActualHM = calc.formatted_actual;
            calculatedDiffHM = calc.formatted_diff;
          }
        }

        // Calculate Day of Week
        let dayOfWeek = '';
        if (normalizedDate) {
          try {
            const d = new Date(`${normalizedDate}T12:00:00Z`);
            dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
          } catch {
            dayOfWeek = '';
          }
        }

        results.push({
          rowNumber,
          rawDate,
          normalizedDate,
          dayOfWeek,
          dutyTypeRaw: rawDuty,
          matchedDutyType: matchedDuty,
          inTime,
          outTime,
          notes: rawNotes,
          isValid,
          warning,
          calculatedStatus,
          calculatedActualHM,
          calculatedDiffHM,
        });
      });

      // Sort by date ascending
      results.sort((a, b) => a.normalizedDate.localeCompare(b.normalizedDate));

      setParsedRows(results);
      const validCount = results.filter((r) => r.isValid).length;
      if (validCount > 0) {
        showSuccess(`Successfully parsed ${results.length} rows (${validCount} valid).`);
      } else {
        showWarning('Parsed rows contain errors. Please review the table below.');
      }
    } catch (err: any) {
      showError(`Failed to parse file: ${err.message}`);
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Generate and Download Template (.xlsx or .csv)
  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const rows = [];

    const defaultWorkingDuty = dutyTypes.find((d) => d.id === 'morning') || dutyTypes[0];
    const defaultOffDuty = dutyTypes.find((d) => d.id === 'day_off') || { name: 'Day Off' };

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${dayStr}`;
      const dateObj = new Date(`${dateStr}T12:00:00Z`);
      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const isFriday = weekday === 'Friday';

      if (isFriday) {
        rows.push({
          Date: dateStr,
          Day_Name: weekday,
          Duty_Type: defaultOffDuty.name,
          In_Time: '',
          Out_Time: '',
          Notes: 'Weekly Off',
        });
      } else {
        rows.push({
          Date: dateStr,
          Day_Name: weekday,
          Duty_Type: defaultWorkingDuty ? defaultWorkingDuty.name : 'Morning Shift',
          In_Time: defaultWorkingDuty ? defaultWorkingDuty.start_time : '08:00',
          Out_Time: defaultWorkingDuty ? defaultWorkingDuty.end_time : '17:00',
          Notes: '',
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const monthName = monthNames[selectedMonth - 1];

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Duty_${monthName}_${selectedYear}`);
      XLSX.writeFile(wb, `Duty_Template_${monthName}_${selectedYear}.xlsx`);
      showSuccess(`Excel template downloaded for ${monthName} ${selectedYear}!`);
    } else {
      const csvData = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Duty_Template_${monthName}_${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`CSV template downloaded for ${monthName} ${selectedYear}!`);
    }
  };

  // Submit bulk records to database
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showError('No valid rows to import. Please check your data.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        year: selectedYear,
        month: selectedMonth,
        user_id: isAdmin && selectedUserId ? selectedUserId : user?.id,
        overwrite_existing: overwriteExisting,
        records: validRows.map((r) => ({
          date: r.normalizedDate,
          duty_type_id: r.matchedDutyType?.id || 'morning',
          in_time: r.inTime,
          out_time: r.outTime,
          notes: r.notes,
        })),
      };

      const res = await api.bulkImportAttendance(payload);
      setImportResult(res);
      showSuccess(
        `Bulk import complete: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`
      );
    } catch (err: any) {
      showError(err.message || 'Failed to import attendance records.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset file selection
  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;
  const workingDaysCount = parsedRows.filter(
    (r) => r.isValid && r.matchedDutyType?.id !== 'day_off'
  ).length;
  const dayOffCount = parsedRows.filter(
    (r) => r.isValid && r.matchedDutyType?.id === 'day_off'
  ).length;

  const targetEmployee = employees.find((e) => e.id === selectedUserId) || user;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Bulk Duty Import
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Upload CSV or Excel file to update monthly attendance & duty records
              </p>
            </div>
          </div>
        </div>

        {/* Action button to download templates */}
        <div className="flex items-center gap-2">
          <button
            id="btn-download-excel-template"
            onClick={() => downloadTemplate('xlsx')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel Template (.xlsx)</span>
          </button>
          <button
            id="btn-download-csv-template"
            onClick={() => downloadTemplate('csv')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV Template (.csv)</span>
          </button>
        </div>
      </div>

      {/* Target Parameters Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Step 1: Select Target Month, Year & Options</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Month Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Target Month
            </label>
            <select
              id="select-import-month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value));
                if (file) processFile(file);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {monthNames.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Target Year
            </label>
            <select
              id="select-import-year"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                if (file) processFile(file);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Select (Admins only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Target Employee
            </label>
            {isAdmin ? (
              <select
                id="select-import-employee"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.display_name} ({emp.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                <UserIcon className="w-4 h-4 text-blue-500" />
                <span className="truncate">{user?.display_name} (Self)</span>
              </div>
            )}
          </div>

          {/* Overwrite toggle */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none">
              <input
                id="checkbox-overwrite-existing"
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                Overwrite existing records for these dates
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Rules & Guidelines Accordion Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-white">
            <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Formatting Rules & Guidelines (আপলোড করার নিয়মাবলী)</span>
          </div>
          <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showRules && (
          <div className="pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-3.5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ফাইলে নিচের কলামগুলো থাকলে সিস্টেম স্বয়ংক্রিয়ভাবে শনাক্ত করবে। সবচেয়ে সহজ উপায় হলো উপরের{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">"Excel Template"</strong>{' '}
              বাটনে ক্লিক করে তৈরি করা ফাইলটি ডাউনলোড করে প্রয়োজনীয় মান পরিবর্তন করে আপলোড করা:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  1. Date / তারিখ
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                  `YYYY-MM-DD` (যেমন: {selectedYear}-{String(selectedMonth).padStart(2, '0')}-01), অথবা `DD-MM-YYYY`, অথবা শুধু দিন সংখ্যা (1-31)।
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  2. Duty Type / শিফট
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  শিফটের নাম বা আইডি (যেমন: Morning, Evening, Night, Day Off)।
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  3. In / Out Time (সময়)
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  <strong className="text-blue-600 dark:text-blue-400">এক ঘরে:</strong> `08:00 - 17:00` অথবা <strong className="text-indigo-600 dark:text-indigo-400">আলাদা কলামে:</strong> `In_Time` ও `Out_Time`।
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  * সময় না লিখলে (ফাঁকা রাখলে) সেটি Blank / No Duty হিসেবে থাকবে (কোনো কাজের ঘণ্টা যোগ হবে না)।
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  4. Notes / মন্তব্য
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  ঐচ্ছিক নোট (যেমন: "Overtime approved", "Official holiday" ইত্যাদি)।
                </p>
              </div>
            </div>

            {/* Currently Active Duty Types Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Active Duty Types in System:
              </span>
              {dutyTypes.map((dt) => (
                <span
                  key={dt.id}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dt.color }} />
                  <span>{dt.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({dt.is_working_day ? `${dt.start_time}-${dt.end_time}` : 'Off'})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload Drop Zone Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Step 2: Choose or Drag & Drop File</span>
          </div>
          {file && (
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Clear file
            </button>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.005]'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {file ? file.name : 'Click to select or drag and drop your file here'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>
              </p>
            </div>
            {file && (
              <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {(file.size / 1024).toFixed(1)} KB • {file.type || 'Spreadsheet'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Success Banner if import completed */}
      {importResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 shadow-sm animate-in fade-in space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold">
                Attendance Successfully Imported for {monthNames[selectedMonth - 1]} {selectedYear}!
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5">
                Target: {targetEmployee?.display_name} • Total Processed:{' '}
                {importResult.totalProcessed} records ({importResult.createdCount} newly created,{' '}
                {importResult.updatedCount} updated, {importResult.skippedCount} skipped).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/80">
            {onNavigateTab && (
              <>
                <button
                  onClick={() => onNavigateTab('calendar')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>View in Duty Calendar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onNavigateTab('my_attendance')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100/50 transition-colors"
                >
                  <span>View My Attendance Table</span>
                </button>
                <button
                  onClick={() => onNavigateTab('reports')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100/50 transition-colors"
                >
                  <span>View Monthly Summary Report</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview Table & Submission Bar (Step 3) */}
      {parsedRows.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Step 3: Review Preview & Confirm Import</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: <strong>{targetEmployee?.display_name}</strong> • Month:{' '}
                <strong>
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </strong>
              </p>
            </div>

            {/* Quick Stats Chips */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {parsedRows.length} Days Found
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {validCount} Valid
              </span>
              {errorCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorCount} Errors
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[440px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Day</th>
                  <th className="px-3 py-2.5">Duty Type</th>
                  <th className="px-3 py-2.5">In Time</th>
                  <th className="px-3 py-2.5">Out Time</th>
                  <th className="px-3 py-2.5">Total Hours</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5 text-right">Validity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedRows.map((row) => {
                  const isDayOff = row.matchedDutyType?.id === 'day_off';
                  return (
                    <tr
                      key={row.rowNumber}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        !row.isValid ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {row.normalizedDate || row.rawDate}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                        {row.dayOfWeek || '-'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row.matchedDutyType ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[11px]"
                            style={{
                              backgroundColor: `${row.matchedDutyType.color}15`,
                              color: row.matchedDutyType.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: row.matchedDutyType.color }}
                            />
                            {row.matchedDutyType.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">{row.dutyTypeRaw || 'Unknown'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {row.inTime || (isDayOff ? '-' : <span className="text-slate-400 italic">none</span>)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {row.outTime || (isDayOff ? '-' : <span className="text-slate-400 italic">none</span>)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.calculatedActualHM}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row.calculatedStatus === 'day_off' && (
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase">
                            Day Off
                          </span>
                        )}
                        {row.calculatedStatus === 'blank' && (
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase">
                            Blank (No Duty)
                          </span>
                        )}
                        {row.calculatedStatus === 'normal' && (
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                            Normal
                          </span>
                        )}
                        {row.calculatedStatus === 'extra' && (
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 uppercase">
                            +{row.calculatedDiffHM}
                          </span>
                        )}
                        {row.calculatedStatus === 'short' && (
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 uppercase">
                            {row.calculatedDiffHM}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 max-w-[140px] truncate">
                        {row.notes || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valid
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"
                            title={row.warning}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirm Import Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Ready to write <strong>{validCount}</strong> attendance records for{' '}
              <strong>{targetEmployee?.display_name}</strong> to the database.
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-cancel-bulk-import"
                onClick={handleReset}
                disabled={submitting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Reset
              </button>
              <button
                id="btn-confirm-bulk-import"
                onClick={handleConfirmImport}
                disabled={submitting || validCount === 0}
                className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Save to Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
