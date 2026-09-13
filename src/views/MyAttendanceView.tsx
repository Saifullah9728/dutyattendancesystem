import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Download,
  Filter,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Award,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatMinutesToHM, formatTime12h } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import { BENGALI_DAYS_SHORT, formatMonthYear, toBengaliDigits } from '../utils/translations';
import type { AttendanceRecord, DutyType, MonthlySummary } from '../types';

interface MyAttendanceViewProps {
  onOpenRecordModal: (record?: AttendanceRecord | null, date?: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const MyAttendanceView: React.FC<MyAttendanceViewProps> = ({ onOpenRecordModal, onNavigateTab }) => {
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { success, error } = useToast();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDutyType, setFilterDutyType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const monthName = useMemo(() => {
    return formatMonthYear(currentDate, language);
  }, [currentDate, language]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, dtRes] = await Promise.all([
        api.getMonthlyReport(selectedMonth, selectedYear),
        api.getDutyTypes(),
      ]);
      setRecords(reportRes.records);
      setSummary(reportRes.summary);
      setDutyTypes(dtRes.dutyTypes);
    } catch (err: any) {
      error('Failed to load attendance', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, user]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch =
        rec.date.includes(searchTerm) ||
        rec.duty_type_name_snapshot.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.notes && rec.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDuty = filterDutyType === 'all' || rec.duty_type_id === filterDutyType;
      const matchesStatus = filterStatus === 'all' || rec.status === filterStatus;

      return matchesSearch && matchesDuty && matchesStatus;
    });
  }, [records, searchTerm, filterDutyType, filterStatus]);

  const handleDelete = async (record: AttendanceRecord) => {
    if (!window.confirm(`Are you sure you want to delete the attendance record for ${record.date}?`)) {
      return;
    }
    try {
      await api.deleteAttendance(record.id);
      success('Record Deleted', `Removed attendance record for ${record.date}`);
      loadData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  // Export to Excel (.xlsx) using xlsx library
  const exportToExcel = () => {
    const dataRows = filteredRecords.map((r) => ({
      Date: r.date,
      Day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(r.date)),
      'Duty Type': r.duty_type_name_snapshot,
      'In Time': r.in_time ? formatTime12h(r.in_time) : 'N/A',
      'Out Time': r.out_time ? formatTime12h(r.out_time) : 'N/A',
      'Actual Duration': formatMinutesToHM(r.actual_duration_minutes),
      'Expected Duration': formatMinutesToHM(r.expected_duration_minutes_snapshot),
      'Extra Hours': `+${formatMinutesToHM(r.extra_duration_minutes)}`,
      'Short Hours': `-${formatMinutesToHM(r.short_duration_minutes)}`,
      Status: r.status.toUpperCase(),
      Notes: r.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance_${monthName.replace(' ', '_')}`);
    XLSX.writeFile(workbook, `Duty_Attendance_${(user?.display_name || 'Employee').replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth}.xlsx`);
    success('Export Successful', 'Downloaded Excel report.');
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Date,Day,Duty Type,In Time,Out Time,Actual Duration,Expected Duration,Extra Hours,Short Hours,Status,Notes',
    ];
    const rows = filteredRecords.map((r) => {
      const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(r.date));
      const inT = r.in_time ? formatTime12h(r.in_time) : '';
      const outT = r.out_time ? formatTime12h(r.out_time) : '';
      const act = formatMinutesToHM(r.actual_duration_minutes);
      const exp = formatMinutesToHM(r.expected_duration_minutes_snapshot);
      const extra = formatMinutesToHM(r.extra_duration_minutes);
      const short = formatMinutesToHM(r.short_duration_minutes);
      const notes = (r.notes || '').replace(/"/g, '""');
      return `"${r.date}","${day}","${r.duty_type_name_snapshot}","${inT}","${outT}","${act}","${exp}","${extra}","${short}","${r.status}","${notes}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Duty_Attendance_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', 'Downloaded CSV file.');
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('myAttendanceTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'bn'
              ? 'মাসিক ডিউটি শিফট ও কাজের সময় পর্যবেক্ষণ এবং পরিচালনা করুন'
              : 'Log, inspect, and manage monthly duty shifts with exact timing calculations'}
          </p>
        </div>

        {/* Action Buttons & Month Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Stepper */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold px-3 text-slate-800 dark:text-slate-200 min-w-[120px] text-center">
              {monthName}
            </span>
            <button
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Download Excel Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{t('exportExcel')}</span>
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Download CSV"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{t('exportCSV')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Print Attendance Table"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">{t('print')}</span>
          </button>

          {onNavigateTab && (
            <button
              id="btn-import-attendance-shortcut"
              onClick={() => onNavigateTab('import_duty')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors shadow-sm"
              title="Bulk Import from CSV or Excel"
            >
              <FileUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">{t('navBulkImport')}</span>
            </button>
          )}

          <button
            onClick={() => onOpenRecordModal()}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('recordDuty')}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={language === 'bn' ? 'তারিখ, ডিউটি শিফট অথবা নোট দিয়ে খুঁজুন...' : 'Search by date (YYYY-MM-DD), shift, or notes...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Duty Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterDutyType}
            onChange={(e) => setFilterDutyType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">{t('allDutyTypes')}</option>
            {dutyTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="normal">{language === 'bn' ? 'স্বাভাবিক (Normal)' : 'Normal'}</option>
            <option value="extra">{language === 'bn' ? 'ওভারটাইম (Extra)' : 'Extra / Overtime'}</option>
            <option value="short">{language === 'bn' ? 'ঘাটতি (Short Hours)' : 'Short Hours'}</option>
            <option value="day_off">{language === 'bn' ? 'ছুটি (Day Off)' : 'Day Off'}</option>
          </select>
        </div>
      </div>

      {/* Main Attendance Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-4">{t('date')} & {t('day')}</th>
                <th className="py-3 px-4">{t('dutyType')}</th>
                <th className="py-3 px-4">{t('inTime')}</th>
                <th className="py-3 px-4">{t('outTime')}</th>
                <th className="py-3 px-4 text-right">{language === 'bn' ? 'কাজের সময়' : 'Actual'}</th>
                <th className="py-3 px-4 text-right">{language === 'bn' ? 'নির্ধারিত' : 'Expected'}</th>
                <th className="py-3 px-4 text-right">{t('overtime')}</th>
                <th className="py-3 px-4 text-right">{t('shortage')}</th>
                <th className="py-3 px-4 text-center">{t('status')}</th>
                <th className="py-3 px-4">{t('notes')}</th>
                <th className="py-3 px-4 text-right print:hidden">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {language === 'bn'
                      ? `${monthName}-এ আপনার ফিল্টারের সাথে কোনো হাজিরার রেকর্ড মিলছে না।`
                      : `No attendance records match your filter for ${monthName}.`}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const dateObj = new Date(rec.date);
                  const dayName =
                    language === 'bn'
                      ? BENGALI_DAYS_SHORT[dateObj.getDay()]
                      : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);
                  const isDayOff = rec.duty_type_id === 'day_off';

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isDayOff ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      {/* Date & Day */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{rec.date}</span>
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {dayName}
                          </span>
                        </div>
                      </td>

                      {/* Duty Type */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                rec.duty_type_id === 'morning'
                                  ? '#2563eb'
                                  : rec.duty_type_id === 'general'
                                  ? '#10b981'
                                  : rec.duty_type_id === 'evening'
                                  ? '#f59e0b'
                                  : rec.duty_type_id === 'day_off'
                                  ? '#64748b'
                                  : '#8b5cf6',
                            }}
                          />
                          {rec.duty_type_name_snapshot}
                        </span>
                      </td>

                      {/* In Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {rec.in_time ? formatTime12h(rec.in_time) : <span className="text-slate-400">-</span>}
                      </td>

                      {/* Out Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {rec.out_time ? formatTime12h(rec.out_time) : <span className="text-slate-400">-</span>}
                      </td>

                      {/* Actual */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatMinutesToHM(rec.actual_duration_minutes)}
                      </td>

                      {/* Expected */}
                      <td className="py-3.5 px-4 text-right text-slate-500 dark:text-slate-400">
                        {formatMinutesToHM(rec.expected_duration_minutes_snapshot)}
                      </td>

                      {/* Extra Hours */}
                      <td className="py-3.5 px-4 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {rec.extra_duration_minutes > 0 ? `+${formatMinutesToHM(rec.extra_duration_minutes)}` : '-'}
                      </td>

                      {/* Short Hours */}
                      <td className="py-3.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {rec.short_duration_minutes > 0 ? `-${formatMinutesToHM(rec.short_duration_minutes)}` : '-'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {rec.duty_type_id !== 'day_off' && rec.in_time && !rec.out_time ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            In-Progress
                          </span>
                        ) : rec.duty_type_id !== 'day_off' && !rec.in_time && rec.out_time ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            Out Only
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              rec.status === 'normal'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : rec.status === 'extra'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : rec.status === 'short'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {rec.status}
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                        {rec.notes || <span className="text-slate-300 dark:text-slate-600 italic">None</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenRecordModal(rec)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Attendance"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rec)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                            title="Delete Attendance"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* SECTION 13 REQUIREMENT: BOTTOM SUMMARY BAR */}
        {summary && (
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-3">
              {/* Duty Counts Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'ডিউটি শিফটের হিসাব:' : 'Duty Breakdown:'}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'মর্নিং' : 'Morning'}: <strong className="text-blue-600 dark:text-blue-400">{summary.morning_count}</strong>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'জেনারেল' : 'General'}: <strong className="text-emerald-600 dark:text-emerald-400">{summary.general_count}</strong>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'ইভনিং' : 'Evening'}: <strong className="text-amber-600 dark:text-amber-400">{summary.evening_count}</strong>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    MOD: <strong className="text-purple-600 dark:text-purple-400">{summary.mod_count}</strong>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'অন্যান্য' : 'Others'}: <strong className="text-sky-600 dark:text-sky-400">{summary.others_count}</strong>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'bn' ? 'ছুটি (Day Off)' : 'Day Off'}: <strong className="text-slate-500">{summary.day_off_count}</strong>
                  </span>
                </div>
              </div>

              {/* Aggregated Totals Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm font-bold">
                <div className="text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'মোট কাজের দিন' : 'Total Working Days'}:{' '}
                  <span className="text-slate-900 dark:text-white font-extrabold">
                    {summary.total_working_days} {language === 'bn' ? 'দিন' : 'days'}
                  </span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'মোট প্রকৃত সময়' : 'Total Actual Hours'}:{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                    {formatMinutesToHM(summary.total_actual_minutes)}
                  </span>
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'মোট নির্ধারিত' : 'Total Expected'}:{' '}
                  <span className="text-slate-900 dark:text-white font-extrabold">
                    {formatMinutesToHM(summary.total_expected_minutes)}
                  </span>
                </div>
                <div className="text-amber-600 dark:text-amber-400">
                  {language === 'bn' ? 'মোট ওভারটাইম' : 'Total Extra Hours'}: +{formatMinutesToHM(summary.total_extra_minutes)}
                </div>
                <div className="text-rose-600 dark:text-rose-400">
                  {language === 'bn' ? 'মোট ঘাটতি' : 'Total Short Hours'}: -{formatMinutesToHM(summary.total_short_minutes)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
