import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  X,
  AlertCircle,
  LogIn,
  LogOut,
  Sparkles,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from './Toast';
import { calculateAttendance, formatMinutesToHM, formatTime12h } from '../utils/calculations';
import type { DutyType, AttendanceRecord, User } from '../types';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialRecord?: AttendanceRecord | null;
  initialDate?: string;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialRecord,
  initialDate,
}) => {
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { success, error, warning } = useToast();

  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || '');

  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(initialDate || todayStr);
  const [dutyTypeId, setDutyTypeId] = useState<string>('morning');
  const [inTime, setInTime] = useState<string>('08:00');
  const [outTime, setOutTime] = useState<string>('17:00');
  const [notes, setNotes] = useState<string>('');

  // Mode: 'both' | 'in_only' | 'out_only'
  const [timeMode, setTimeMode] = useState<'both' | 'in_only' | 'out_only'>('both');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<AttendanceRecord | null>(null);
  const [existingRecordForDate, setExistingRecordForDate] = useState<AttendanceRecord | null>(null);

  // Load active duty types and employees
  useEffect(() => {
    if (!isOpen) return;

    api.getDutyTypes().then((res) => {
      setDutyTypes(res.dutyTypes);
      if (!initialRecord && res.dutyTypes.length > 0) {
        const morning = res.dutyTypes.find((d) => d.id === 'morning') || res.dutyTypes[0];
        setDutyTypeId(morning.id);
        setInTime(morning.start_time || '08:00');
        setOutTime(morning.end_time || '17:00');
        setTimeMode('both');
      }
    });

    if (isAdmin) {
      api.getUsers().then((res) => {
        setEmployees(res.users);
      });
    }
  }, [isOpen, isAdmin]);

  // Set initial record state when editing an existing record passed via prop
  useEffect(() => {
    if (initialRecord) {
      setDate(initialRecord.date);
      setDutyTypeId(initialRecord.duty_type_id);
      setInTime(initialRecord.in_time || '');
      setOutTime(initialRecord.out_time || '');
      setNotes(initialRecord.notes || '');
      setSelectedUserId(initialRecord.user_id);
      setDuplicateWarning(null);
      setExistingRecordForDate(null);

      if (initialRecord.in_time && !initialRecord.out_time) {
        setTimeMode('in_only');
      } else if (!initialRecord.in_time && initialRecord.out_time) {
        setTimeMode('out_only');
      } else {
        setTimeMode('both');
      }
    } else {
      setDate(initialDate || todayStr);
      setSelectedUserId(user?.id || '');
      setNotes('');
      setDuplicateWarning(null);
    }
  }, [initialRecord, initialDate, user, isOpen]);

  // Check if a record already exists for selected date and employee (when not editing an explicit initialRecord)
  useEffect(() => {
    if (!isOpen || initialRecord || !date || !selectedUserId) {
      setExistingRecordForDate(null);
      return;
    }

    let isMounted = true;
    api
      .getAttendance({ date, user_id: selectedUserId })
      .then((res) => {
        if (!isMounted) return;
        if (res.records && res.records.length > 0) {
          const rec = res.records[0];
          setExistingRecordForDate(rec);
          setDutyTypeId(rec.duty_type_id);
          setInTime(rec.in_time || '');
          setOutTime(rec.out_time || '');
          if (rec.notes) setNotes(rec.notes);

          if (rec.in_time && !rec.out_time) {
            setTimeMode('both'); // ready to record out time!
          } else if (!rec.in_time && rec.out_time) {
            setTimeMode('both'); // ready to record in time!
          }
        } else {
          setExistingRecordForDate(null);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, date, selectedUserId, initialRecord]);

  // Selected duty type object
  const selectedDuty = useMemo(() => {
    return (
      dutyTypes.find((d) => d.id === dutyTypeId) || {
        id: dutyTypeId,
        name: 'Custom',
        start_time: '08:00',
        end_time: '17:00',
        expected_duration_minutes: 540,
        is_working_day: true,
        contributes_to_hours: true,
        color: '#2563eb',
        description: '',
        is_active: true,
        created_at: '',
        updated_at: '',
      }
    );
  }, [dutyTypes, dutyTypeId]);

  // Handle duty type change
  const handleDutyChange = (newDutyId: string) => {
    setDutyTypeId(newDutyId);
    const matched = dutyTypes.find((d) => d.id === newDutyId);
    if (matched) {
      if (matched.id === 'day_off') {
        setInTime('');
        setOutTime('');
      } else {
        if (timeMode === 'in_only') {
          setInTime(matched.start_time || '08:00');
          setOutTime('');
        } else if (timeMode === 'out_only') {
          setInTime('');
          setOutTime(matched.end_time || '17:00');
        } else {
          setInTime(matched.start_time || '08:00');
          setOutTime(matched.end_time || '17:00');
        }
      }
    }
  };

  // Switch quick mode (Both, In Only, Out Only)
  const handleModeChange = (mode: 'both' | 'in_only' | 'out_only') => {
    setTimeMode(mode);
    if (mode === 'in_only') {
      setOutTime('');
      if (!inTime && selectedDuty.id !== 'day_off') {
        setInTime(selectedDuty.start_time || '08:00');
      }
    } else if (mode === 'out_only') {
      setInTime('');
      if (!outTime && selectedDuty.id !== 'day_off') {
        setOutTime(selectedDuty.end_time || '17:00');
      }
    } else {
      // 'both'
      if (!inTime && selectedDuty.id !== 'day_off') {
        setInTime(selectedDuty.start_time || '08:00');
      }
      if (!outTime && selectedDuty.id !== 'day_off') {
        setOutTime(selectedDuty.end_time || '17:00');
      }
    }
  };

  // Helper to set current time
  const setTimeToNow = (setter: (val: string) => void, field: 'in' | 'out') => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    setter(timeStr);
    if (field === 'in' && !outTime && timeMode !== 'both') {
      setTimeMode('in_only');
    } else if (field === 'out' && !inTime && timeMode !== 'both') {
      setTimeMode('out_only');
    }
  };

  // Real-time calculated attendance preview
  const calculation = useMemo(() => {
    return calculateAttendance(selectedDuty, inTime, outTime);
  }, [selectedDuty, inTime, outTime]);

  const handleSubmit = async (e?: React.FormEvent, forceConfirm: boolean = false) => {
    if (e) e.preventDefault();
    if (!date) {
      error('Validation Error', 'Please select a date.');
      return;
    }

    const trimmedIn = inTime.trim();
    const trimmedOut = outTime.trim();

    if (selectedDuty.id !== 'day_off' && !trimmedIn && !trimmedOut) {
      error('Validation Error', 'Please enter In Time, Out Time, or both for working shifts.');
      return;
    }

    setIsSubmitting(true);
    try {
      const activeRecordId = initialRecord?.id || existingRecordForDate?.id;

      if (activeRecordId) {
        // Updating existing record
        await api.updateAttendance(activeRecordId, {
          duty_type_id: dutyTypeId,
          in_time: trimmedIn,
          out_time: trimmedOut,
          notes,
        });
        success('Duty Record Updated', `Successfully updated attendance for ${date}.`);
        onSaved();
        onClose();
      } else {
        // Creating new record (with duplicate check fallback)
        const res = await api.createAttendance({
          date,
          duty_type_id: dutyTypeId,
          in_time: trimmedIn,
          out_time: trimmedOut,
          notes,
          user_id: selectedUserId !== user?.id ? selectedUserId : undefined,
          force_confirm: forceConfirm,
        });

        if (res.updated) {
          success('Record Updated', `Updated existing record for ${date}.`);
        } else {
          success('Duty Recorded', `Saved ${selectedDuty.name} shift for ${date}.`);
        }
        onSaved();
        onClose();
      }
    } catch (err: any) {
      if (err.status === 409 && err.data?.duplicate) {
        // Duplicate record found on this date
        setDuplicateWarning(err.data.existingRecord);
        warning('Duplicate Date Detected', 'An attendance record already exists for this date.');
      } else {
        error('Failed to save duty', err.message || 'An error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = Boolean(initialRecord || existingRecordForDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {isEditing
                  ? language === 'bn'
                    ? 'ডিউটি রেকর্ড আপডেট'
                    : 'Update Attendance Record'
                  : t('modalRecordTitle')}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn'
                  ? 'প্রবেশ, প্রস্থান সময় ও শিফট নির্বাচন করুন'
                  : 'Provide In Time, Out Time, or both together'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Existing Record on Selected Date Banner */}
          {existingRecordForDate && !initialRecord && (
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 space-y-1 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-bold">
                  Existing Record Found for {date} ({existingRecordForDate.duty_type_name_snapshot})
                </span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                {existingRecordForDate.in_time && !existingRecordForDate.out_time ? (
                  <>
                    Check-in recorded at <strong>{formatTime12h(existingRecordForDate.in_time)}</strong>. Enter Out
                    Time below to complete your shift!
                  </>
                ) : !existingRecordForDate.in_time && existingRecordForDate.out_time ? (
                  <>
                    Check-out recorded at <strong>{formatTime12h(existingRecordForDate.out_time)}</strong>. Enter In
                    Time below.
                  </>
                ) : (
                  <>
                    Shift recorded from <strong>{formatTime12h(existingRecordForDate.in_time)}</strong> to{' '}
                    <strong>{formatTime12h(existingRecordForDate.out_time)}</strong>. You can modify times below.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Duplicate Date Warning Box (Section 11 Requirement) */}
          {duplicateWarning && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 space-y-2.5 animate-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    An attendance record already exists for this date.
                  </h4>
                  <p className="text-xs mt-1">
                    Existing Record: <strong>{duplicateWarning.duty_type_name_snapshot}</strong> (
                    {duplicateWarning.in_time ? formatTime12h(duplicateWarning.in_time) : 'No In Time'} -{' '}
                    {duplicateWarning.out_time ? formatTime12h(duplicateWarning.out_time) : 'No Out Time'}).
                  </p>
                  <p className="text-xs font-medium mt-1">
                    Do you want to overwrite the existing record with these new values?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-200/70 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:hover:bg-amber-900 dark:text-amber-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
                >
                  Yes, Update Existing Record
                </button>
              </div>
            </div>
          )}

          <form id="attendance-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
            {/* Admin Employee Selector (if admin) */}
            {isAdmin && employees.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Employee
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.display_name} ({emp.email}) - {emp.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Duty Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Duty Type Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Duty Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {dutyTypes.map((dt) => {
                  const isSelected = dt.id === dutyTypeId;
                  return (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => handleDutyChange(dt.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dt.color || '#2563eb' }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {dt.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {dt.id === 'day_off'
                          ? 'No Working Time'
                          : `${formatMinutesToHM(dt.expected_duration_minutes)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Entry Mode & Inputs (if not Day Off) */}
            {selectedDuty.id !== 'day_off' ? (
              <div className="space-y-3 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                {/* Mode Selector Chips */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-200/70 dark:border-slate-700/70">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Time Entry Options
                  </span>

                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-700/70 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => handleModeChange('both')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        timeMode === 'both'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Both (In & Out)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('in_only')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                        timeMode === 'in_only'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <LogIn className="w-3 h-3" />
                      In Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('out_only')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                        timeMode === 'out_only'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <LogOut className="w-3 h-3" />
                      Out Only
                    </button>
                  </div>
                </div>

                {/* In Time and Out Time Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* IN TIME INPUT */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      inTime
                        ? 'border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        In Time
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTimeToNow(setInTime, 'in')}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 transition-colors"
                          title="Set to Current Time"
                        >
                          Now
                        </button>
                        {inTime && (
                          <button
                            type="button"
                            onClick={() => {
                              setInTime('');
                              if (outTime) setTimeMode('out_only');
                            }}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Clear In Time"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="time"
                      value={inTime}
                      onChange={(e) => {
                        setInTime(e.target.value);
                        if (e.target.value && outTime) setTimeMode('both');
                        else if (e.target.value && !outTime) setTimeMode('in_only');
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 min-h-[16px]">
                      {inTime ? (
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {formatTime12h(inTime)}
                        </span>
                      ) : (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          Not entered (Optional if Out Time given)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* OUT TIME INPUT */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      outTime
                        ? 'border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <LogOut className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Out Time
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTimeToNow(setOutTime, 'out')}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-300 transition-colors"
                          title="Set to Current Time"
                        >
                          Now
                        </button>
                        {outTime && (
                          <button
                            type="button"
                            onClick={() => {
                              setOutTime('');
                              if (inTime) setTimeMode('in_only');
                            }}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Clear Out Time"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="time"
                      value={outTime}
                      onChange={(e) => {
                        setOutTime(e.target.value);
                        if (e.target.value && inTime) setTimeMode('both');
                        else if (e.target.value && !inTime) setTimeMode('out_only');
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 min-h-[16px]">
                      {outTime ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {formatTime12h(outTime)}
                        </span>
                      ) : (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          Not entered (Optional if In Time given)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    You can submit <strong>In Time only</strong>, <strong>Out Time only</strong>, or{' '}
                    <strong>both In & Out</strong> together.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Day Off Selected
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Scheduled expected duration is 0 hours. No In/Out times required.
                </p>
              </div>
            )}

            {/* REAL-TIME ATTENDANCE CALCULATION PREVIEW */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Calculation Engine Summary</span>
                {selectedDuty.id === 'day_off' ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                    DAY OFF
                  </span>
                ) : inTime && outTime ? (
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      calculation.status === 'normal'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : calculation.status === 'extra'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : calculation.status === 'short'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Status: {calculation.status.toUpperCase()}
                  </span>
                ) : inTime && !outTime ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    IN-PROGRESS (Out Pending)
                  </span>
                ) : !inTime && outTime ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    OUT RECORDED (In Pending)
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                    AWAITING TIME
                  </span>
                )}
              </div>

              {inTime && outTime ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                        Expected
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {calculation.formatted_expected}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                        Actual
                      </span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {calculation.formatted_actual}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                        Difference
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          calculation.difference_minutes > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : calculation.difference_minutes < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {calculation.formatted_diff}
                      </span>
                    </div>
                  </div>

                  {calculation.extra_duration_minutes > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Extra/Overtime Hours: +{formatMinutesToHM(calculation.extra_duration_minutes)}</span>
                    </div>
                  )}
                  {calculation.short_duration_minutes > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Short Hours: -{formatMinutesToHM(calculation.short_duration_minutes)}</span>
                    </div>
                  )}
                </>
              ) : inTime && !outTime ? (
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>In Time: <strong>{formatTime12h(inTime)}</strong></span>
                    <span>Expected: <strong>{formatMinutesToHM(selectedDuty.expected_duration_minutes)}</strong></span>
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Shift is active. You can save now and record Out Time at the end of your shift.
                  </p>
                </div>
              ) : !inTime && outTime ? (
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Out Time: <strong>{formatTime12h(outTime)}</strong></span>
                    <span>Expected: <strong>{formatMinutesToHM(selectedDuty.expected_duration_minutes)}</strong></span>
                  </div>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <LogOut className="w-3.5 h-3.5" />
                    Out Time will be logged. You can add In Time later if desired.
                  </p>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
                  {selectedDuty.id === 'day_off'
                    ? 'No hours scheduled for Day Off.'
                    : 'Enter In Time, Out Time, or both to preview shift calculation.'}
                </div>
              )}
            </div>

            {/* Notes Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Duty Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning check-in completed, overtime requested, etc."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
            {isEditing ? 'Editing existing entry' : 'New attendance record'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="attendance-form"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>{t('saving')}</span>
              ) : (
                <>
                  <span>
                    {isEditing
                      ? language === 'bn'
                        ? 'আপডেট সংরক্ষণ করুন'
                        : 'Update Record'
                      : language === 'bn'
                      ? 'হাজিরা সেভ করুন'
                      : 'Save Attendance'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
