import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  ArrowUpRight,
  UserCheck,
  ShieldCheck,
  PlusCircle,
  BarChart3,
  CalendarOff,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatMinutesToHM, formatTime12h } from '../utils/calculations';
import type { MonthlySummary, AttendanceRecord, DutyType, User } from '../types';

interface DashboardViewProps {
  onOpenRecordModal: (record?: AttendanceRecord | null, date?: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenRecordModal,
  onNavigateTab,
}) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Monthly Summary & Records for current user
      const reportRes = await api.getMonthlyReport(selectedMonth, selectedYear);
      setSummary(reportRes.summary);
      setRecentRecords(reportRes.records);

      // 2. Load today's record
      const todayMatch = reportRes.records.find((r) => r.date === todayStr);
      setTodayRecord(todayMatch || null);

      // 3. Load active duty types
      const dtRes = await api.getDutyTypes();
      setDutyTypes(dtRes.dutyTypes);

      // 4. If admin, load all users for team overview
      if (isAdmin) {
        const usersRes = await api.getUsers();
        setTeamUsers(usersRes.users);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, user]);

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Month Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {user?.display_name?.split(' ')[0] || 'Saifullah'}
            </h1>
            {isSuperAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Super Admin
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Overview of your duty schedule, working hours, and monthly attendance
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-bold px-3 text-slate-800 dark:text-slate-200 min-w-[120px] text-center">
            {monthName}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleCurrentMonth}
            className="text-[11px] font-semibold px-2 py-1 ml-1 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors"
          >
            Current
          </button>
        </div>
      </div>

      {/* TODAY'S DUTY STATUS HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-5 sm:p-6 shadow-xl shadow-blue-900/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur">
                Today's Duty Status
              </span>
              <span className="text-xs text-blue-200 font-medium">
                {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}
              </span>
            </div>

            {todayRecord ? (
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{todayRecord.duty_type_name_snapshot} Shift</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    Recorded
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-blue-100 mt-1">
                  {todayRecord.duty_type_id !== 'day_off' ? (
                    <>
                      <span>
                        Timing: <strong>{formatTime12h(todayRecord.in_time)}</strong> - <strong>{formatTime12h(todayRecord.out_time)}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Actual: <strong>{formatMinutesToHM(todayRecord.actual_duration_minutes)}</strong> (Expected: {formatMinutesToHM(todayRecord.expected_duration_minutes_snapshot)})
                      </span>
                    </>
                  ) : (
                    <span>Weekly Rest / Day Off</span>
                  )}
                  {todayRecord.notes && (
                    <>
                      <span>•</span>
                      <span className="italic opacity-90 truncate max-w-xs">"{todayRecord.notes}"</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  No attendance logged yet for today
                </h2>
                <p className="text-xs sm:text-sm text-blue-200">
                  Please submit your daily shift details, In Time and Out Time.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {todayRecord ? (
              <button
                onClick={() => onOpenRecordModal(todayRecord)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white text-blue-900 hover:bg-blue-50 shadow-md transition-all active:scale-95"
              >
                Edit Today's Record
              </button>
            ) : (
              <button
                onClick={() => onOpenRecordModal(null, todayStr)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Record Attendance Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-xl" />
      </div>

      {/* ADMIN TEAM OVERVIEW (If Admin) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Admin Team Attendance Snapshot
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('employees')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Manage All Employees</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Employees</span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {teamUsers.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400">Active Status</span>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {teamUsers.filter((u) => u.status === 'active').length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400">Configured Shifts</span>
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                {dutyTypes.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400">Target Timezone</span>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-2">
                Asia/Dhaka (GMT+6)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY SUMMARY METRICS CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {monthName} Attendance Metrics
          </h3>
          <button
            onClick={() => onNavigateTab('reports')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>View Full Analytics</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Working Days */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Working Days</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_working_days || 0}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Days duty recorded
            </span>
          </div>

          {/* Actual Hours */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Actual Hours</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {formatMinutesToHM(summary?.total_actual_minutes || 0)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Total duty completed
            </span>
          </div>

          {/* Expected Hours */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Expected Hours</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMinutesToHM(summary?.total_expected_minutes || 0)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Based on shift schedules
            </span>
          </div>

          {/* Extra Hours (Orange/Amber) */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Extra Hours</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              +{formatMinutesToHM(summary?.total_extra_minutes || 0)}
            </div>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Overtime logged
            </span>
          </div>

          {/* Short Hours (Red/Rose) */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Short Hours</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              -{formatMinutesToHM(summary?.total_short_minutes || 0)}
            </div>
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
              Deficit from schedule
            </span>
          </div>

          {/* Net Difference */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Net Balance</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div
              className={`text-2xl font-black ${
                (summary?.net_difference_minutes || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {(summary?.net_difference_minutes || 0) > 0 ? '+' : ''}
              {formatMinutesToHM(summary?.net_difference_minutes || 0)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Avg daily: {formatMinutesToHM(summary?.average_daily_minutes || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* DUTY TYPE DISTRIBUTION TAGS (Section 14 & 15 requirement) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          Monthly Duty Type Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Morning</span>
            </div>
            <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400 mt-1">
              {summary?.morning_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">08:00 AM - 05:00 PM (9h)</span>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">General</span>
            </div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
              {summary?.general_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">10:00 AM - 07:00 PM (9h)</span>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Evening</span>
            </div>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-1">
              {summary?.evening_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">02:00 PM - 11:00 PM (9h)</span>
          </div>

          <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">MOD</span>
            </div>
            <div className="text-lg font-extrabold text-purple-700 dark:text-purple-400 mt-1">
              {summary?.mod_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">Manager On Duty</span>
          </div>

          <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Others</span>
            </div>
            <div className="text-lg font-extrabold text-sky-700 dark:text-sky-400 mt-1">
              {summary?.others_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">Configurable shift</span>
          </div>

          <div className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Day Off</span>
            </div>
            <div className="text-lg font-extrabold text-slate-700 dark:text-slate-300 mt-1">
              {summary?.day_off_count || 0} <span className="text-xs font-normal text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-500">Weekly rest day</span>
          </div>
        </div>
      </div>

      {/* RECENT DUTY HISTORY LIST */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Recent Attendance Records
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing duty records logged in {monthName}
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('my_attendance')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>View All Records</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No duty records found for this month.</p>
            <button
              onClick={() => onOpenRecordModal()}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
            >
              Record First Duty
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentRecords.slice(0, 7).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onOpenRecordModal(rec)}
                className="py-3 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 text-slate-800 dark:text-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(rec.date))}
                    </span>
                    <span className="text-sm font-black leading-none">
                      {new Date(rec.date).getDate()}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {rec.duty_type_name_snapshot}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
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
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      {rec.duty_type_id !== 'day_off' ? (
                        <span>
                          {formatTime12h(rec.in_time)} - {formatTime12h(rec.out_time)}
                        </span>
                      ) : (
                        <span>Rest day (0h)</span>
                      )}
                      {rec.notes && <span className="truncate max-w-[150px] italic">"{rec.notes}"</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {formatMinutesToHM(rec.actual_duration_minutes)}
                  </div>
                  <div
                    className={`text-[10px] font-semibold ${
                      rec.difference_minutes > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : rec.difference_minutes < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {rec.difference_minutes > 0 ? `+${formatMinutesToHM(rec.difference_minutes)}` : ''}
                    {rec.difference_minutes < 0 ? `-${formatMinutesToHM(rec.short_duration_minutes)}` : ''}
                    {rec.difference_minutes === 0 && rec.duty_type_id !== 'day_off' ? 'Normal' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
