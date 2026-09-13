import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Award,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatMinutesToHM } from '../utils/calculations';
import type { MonthlySummary, AttendanceRecord, User } from '../types';

export const ReportsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(user?.id || '');
  const [viewAllEmployees, setViewAllEmployees] = useState(false);
  const [loading, setLoading] = useState(true);

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate]);

  useEffect(() => {
    if (isAdmin) {
      api.getUsers().then((res) => {
        setEmployees(res.users);
      });
    }
  }, [isAdmin]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.getMonthlyReport(
        selectedMonth,
        selectedYear,
        isAdmin && !viewAllEmployees ? selectedEmployeeId : undefined,
        isAdmin && viewAllEmployees
      );
      setSummary(res.summary);
      setRecords(res.records);
    } catch (err: any) {
      error('Failed to load report', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedMonth, selectedYear, selectedEmployeeId, viewAllEmployees, user]);

  // Export to Excel
  const exportToExcel = () => {
    if (!summary) return;

    const summaryRow = [
      {
        'Report Field': 'Report Period',
        Value: `${monthName}`,
      },
      {
        'Report Field': 'Target Employee / Scope',
        Value: viewAllEmployees
          ? 'All Employees (Aggregated)'
          : employees.find((e) => e.id === selectedEmployeeId)?.display_name || user?.display_name || 'Current User',
      },
      {
        'Report Field': 'Total Working Days',
        Value: `${summary.total_working_days} days`,
      },
      {
        'Report Field': 'Morning Shift Count',
        Value: `${summary.morning_count} days`,
      },
      {
        'Report Field': 'General Shift Count',
        Value: `${summary.general_count} days`,
      },
      {
        'Report Field': 'Evening Shift Count',
        Value: `${summary.evening_count} days`,
      },
      {
        'Report Field': 'MOD Count',
        Value: `${summary.mod_count} days`,
      },
      {
        'Report Field': 'Others Count',
        Value: `${summary.others_count} days`,
      },
      {
        'Report Field': 'Day Off Count',
        Value: `${summary.day_off_count} days`,
      },
      {
        'Report Field': 'Total Actual Working Hours',
        Value: formatMinutesToHM(summary.total_actual_minutes),
      },
      {
        'Report Field': 'Total Expected Scheduled Hours',
        Value: formatMinutesToHM(summary.total_expected_minutes),
      },
      {
        'Report Field': 'Total Extra / Overtime Hours',
        Value: `+${formatMinutesToHM(summary.total_extra_minutes)}`,
      },
      {
        'Report Field': 'Total Short Hours',
        Value: `-${formatMinutesToHM(summary.total_short_minutes)}`,
      },
      {
        'Report Field': 'Net Balance',
        Value: `${summary.net_difference_minutes >= 0 ? '+' : ''}${formatMinutesToHM(summary.net_difference_minutes)}`,
      },
      {
        'Report Field': 'Average Daily Working Hours',
        Value: formatMinutesToHM(summary.average_daily_minutes),
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(summaryRow);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly_Duty_Summary');
    XLSX.writeFile(workbook, `Monthly_Report_${selectedYear}_${selectedMonth}.xlsx`);
    success('Export Successful', 'Downloaded Excel report summary.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Monthly Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Aggregated monthly shift distribution, expected vs actual working hours, and overtime metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
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
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Admin Scope Selector */}
      {isAdmin && employees.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Select Report Scope:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewAllEmployees(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                viewAllEmployees
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Employees (Team Overview)
            </button>

            <button
              onClick={() => setViewAllEmployees(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                !viewAllEmployees
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Individual Employee
            </button>

            {!viewAllEmployees && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.display_name} ({e.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* SECTION 39 FORMAL SUMMARY REPORT FORMAT CARD */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
            Official Duty Summary
          </span>
          <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
            Monthly Attendance & Hours Report Summary
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-4">
            <span>Period: <strong>{monthName}</strong></span>
            <span>Target: <strong>{viewAllEmployees ? 'All Employees (Consolidated)' : employees.find((e) => e.id === selectedEmployeeId)?.display_name || user?.display_name}</strong></span>
            <span>Timezone: <strong>Asia/Dhaka</strong></span>
          </div>
        </div>

        {/* SECTION 39 EXACT TABLE LAYOUT */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4 text-center">Value / Count</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Morning Shift (X)</td>
                <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">{summary?.morning_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">08:00 AM - 05:00 PM (9h scheduled)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">General Shift (Y)</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{summary?.general_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">10:00 AM - 07:00 PM (9h scheduled)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Evening Shift (Z)</td>
                <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">{summary?.evening_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">02:00 PM - 11:00 PM (9h scheduled)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">MOD (Manager on Duty)</td>
                <td className="py-3 px-4 text-center font-bold text-purple-600 dark:text-purple-400">{summary?.mod_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">Duty shift assignment</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Others</td>
                <td className="py-3 px-4 text-center font-bold text-sky-600 dark:text-sky-400">{summary?.others_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">Custom scheduled shifts</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Day Off</td>
                <td className="py-3 px-4 text-center font-bold text-slate-500">{summary?.day_off_count || 0}</td>
                <td className="py-3 px-4 text-slate-500">Approved weekly rest days (0h)</td>
              </tr>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Total Working Days</td>
                <td className="py-3 px-4 text-center font-black text-slate-900 dark:text-white">{summary?.total_working_days || 0} days</td>
                <td className="py-3 px-4 text-slate-500">Actual days with logged attendance</td>
              </tr>
              <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                <td className="py-3 px-4 font-bold text-blue-900 dark:text-blue-200">Total Actual Hours</td>
                <td className="py-3 px-4 text-center font-black text-blue-600 dark:text-blue-400 text-base">
                  {formatMinutesToHM(summary?.total_actual_minutes || 0)}
                </td>
                <td className="py-3 px-4 text-slate-500">Cumulative completed duty hours</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Total Expected Hours</td>
                <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                  {formatMinutesToHM(summary?.total_expected_minutes || 0)}
                </td>
                <td className="py-3 px-4 text-slate-500">Standard expected scheduled duration</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-amber-700 dark:text-amber-400">Total Extra Hours</td>
                <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                  +{formatMinutesToHM(summary?.total_extra_minutes || 0)}
                </td>
                <td className="py-3 px-4 text-slate-500">Recorded overtime beyond schedule</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-400">Total Short Hours</td>
                <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                  -{formatMinutesToHM(summary?.total_short_minutes || 0)}
                </td>
                <td className="py-3 px-4 text-slate-500">Deficit working duration against schedule</td>
              </tr>
              <tr className="bg-slate-100 dark:bg-slate-800 font-extrabold text-sm">
                <td className="py-3.5 px-4 text-slate-900 dark:text-white">Net Balance (+/-)</td>
                <td className="py-3.5 px-4 text-center font-black">
                  <span
                    className={
                      (summary?.net_difference_minutes || 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {(summary?.net_difference_minutes || 0) > 0 ? '+' : ''}
                    {formatMinutesToHM(summary?.net_difference_minutes || 0)}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                  Daily Average: {formatMinutesToHM(summary?.average_daily_minutes || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
