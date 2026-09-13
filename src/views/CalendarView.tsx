import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatMinutesToHM, formatTime12h } from '../utils/calculations';
import type { AttendanceRecord } from '../types';

interface CalendarViewProps {
  onOpenRecordModal: (record?: AttendanceRecord | null, date?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenRecordModal }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate]);

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendance({ month: selectedMonth, year: selectedYear });
      setRecords(res.records);
    } catch (err) {
      console.error('Failed to load calendar records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [selectedMonth, selectedYear, user]);

  // Calendar grid computation
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      record?: AttendanceRecord;
    }> = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        dayNumber: 0,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const match = records.find((r) => r.date === dStr);
      cells.push({
        dayNumber: d,
        dateStr: dStr,
        isCurrentMonth: true,
        record: match,
      });
    }

    return cells;
  }, [currentDate, records]);

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Duty Calendar
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Click any calendar day to log or view shift details
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold px-3 text-slate-800 dark:text-slate-200 min-w-[130px] text-center">
              {monthName}
            </span>
            <button
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-[11px] font-semibold px-2 py-1 ml-1 rounded-lg bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span>Morning Shift (9h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span>General Shift (9h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
          <span>Evening Shift (9h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span>Day Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded border border-blue-500 ring-2 ring-blue-400/30" />
          <span>Today</span>
        </div>
      </div>

      {/* 7-Column Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Date Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
          {calendarCells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return <div key={idx} className="min-h-[70px] sm:min-h-[110px] bg-slate-50/40 dark:bg-slate-900/30 p-1 sm:p-2" />;
            }

            const isToday = cell.dateStr === todayStr;
            const rec = cell.record;
            const isDayOff = rec?.duty_type_id === 'day_off';

            return (
              <div
                key={idx}
                onClick={() => onOpenRecordModal(rec, cell.dateStr)}
                className={`min-h-[70px] sm:min-h-[115px] p-1.5 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between group ${
                  isToday
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-inset ring-blue-500/40'
                    : isDayOff
                    ? 'bg-slate-50/60 dark:bg-slate-800/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Cell Header: Day Number & Status Dot */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[11px] sm:text-xs font-bold ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {rec ? (
                    <span
                      className={`text-[8px] sm:text-[9px] font-extrabold uppercase px-1 sm:px-1.5 py-0.5 rounded-full ${
                        rec.duty_type_id !== 'day_off' && rec.in_time && !rec.out_time
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : rec.duty_type_id !== 'day_off' && !rec.in_time && rec.out_time
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : rec.status === 'normal'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : rec.status === 'extra'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : rec.status === 'short'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {rec.duty_type_id !== 'day_off' && rec.in_time && !rec.out_time
                        ? 'In'
                        : rec.duty_type_id !== 'day_off' && !rec.in_time && rec.out_time
                        ? 'Out'
                        : rec.status === 'day_off'
                        ? 'Off'
                        : rec.status}
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity hidden sm:inline-block">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Duty Details in Cell */}
                <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                  {rec ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              rec.duty_type_id === 'morning'
                                ? '#2563eb'
                                : rec.duty_type_id === 'general'
                                ? '#10b981'
                                : rec.duty_type_id === 'evening'
                                ? '#f59e0b'
                                : '#64748b',
                          }}
                        />
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                          {rec.duty_type_name_snapshot}
                        </span>
                      </div>

                      {!isDayOff ? (
                        <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-tight">
                          <div className="hidden sm:block">
                            {rec.in_time && rec.out_time
                              ? `${formatTime12h(rec.in_time)} - ${formatTime12h(rec.out_time)}`
                              : rec.in_time
                              ? `In: ${formatTime12h(rec.in_time)}`
                              : rec.out_time
                              ? `Out: ${formatTime12h(rec.out_time)}`
                              : 'No time'}
                          </div>
                          <div className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {rec.in_time && rec.out_time
                              ? formatMinutesToHM(rec.actual_duration_minutes)
                              : rec.in_time
                              ? 'In Progress'
                              : 'Out Only'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] sm:text-[10px] text-slate-400 italic">Day Off</span>
                      )}
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic opacity-60 group-hover:opacity-100 transition-opacity hidden sm:block">
                      No duty logged
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
