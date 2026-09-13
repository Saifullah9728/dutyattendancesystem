import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, AlertTriangle, CheckCircle2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<AttendanceRecord | null>(null);

  // Load active duty types and employees
  useEffect(() => {
    if (!isOpen) return;

    api.getDutyTypes().then((res) => {
      setDutyTypes(res.dutyTypes);
      if (!initialRecord && res.dutyTypes.length > 0) {
        // Find default or first active duty
        const morning = res.dutyTypes.find((d) => d.id === 'morning') || res.dutyTypes[0];
        setDutyTypeId(morning.id);
        setInTime(morning.start_time || '08:00');
        setOutTime(morning.end_time || '17:00');
      }
    });

    if (isAdmin) {
      api.getUsers().then((res) => {
        setEmployees(res.users);
      });
    }
  }, [isOpen, isAdmin]);

  // Set initial record state when editing an existing record
  useEffect(() => {
    if (initialRecord) {
      setDate(initialRecord.date);
      setDutyTypeId(initialRecord.duty_type_id);
      setInTime(initialRecord.in_time || '');
      setOutTime(initialRecord.out_time || '');
      setNotes(initialRecord.notes || '');
      setSelectedUserId(initialRecord.user_id);
      setDuplicateWarning(null);
    } else {
      setDate(initialDate || todayStr);
      setSelectedUserId(user?.id || '');
      setNotes('');
      setDuplicateWarning(null);
    }
  }, [initialRecord, initialDate, user, isOpen]);

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

  // Handle duty type change: auto-fill default shift times if user hasn't typed custom
  const handleDutyChange = (newDutyId: string) => {
    setDutyTypeId(newDutyId);
    const matched = dutyTypes.find((d) => d.id === newDutyId);
    if (matched) {
      if (matched.id === 'day_off') {
        setInTime('');
        setOutTime('');
      } else {
        setInTime(matched.start_time);
        setOutTime(matched.end_time);
      }
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

    if (selectedDuty.id !== 'day_off' && (!inTime || !outTime)) {
      error('Validation Error', 'Please enter both In Time and Out Time for working shifts.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialRecord) {
        // Updating existing record
        await api.updateAttendance(initialRecord.id, {
          duty_type_id: dutyTypeId,
          in_time: inTime,
          out_time: outTime,
          notes,
        });
        success('Duty Record Updated', `Successfully updated attendance for ${date}.`);
        onSaved();
        onClose();
      } else {
        // Creating new record (with duplicate check)
        const res = await api.createAttendance({
          date,
          duty_type_id: dutyTypeId,
          in_time: inTime,
          out_time: outTime,
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
        // Duplicate record found on this date!
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
                {initialRecord ? 'Edit Attendance Record' : 'Record Daily Duty'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Maintain working hours and duty shift details
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
                    Existing Record: <strong>{duplicateWarning.duty_type_name_snapshot}</strong> ({duplicateWarning.in_time || 'N/A'} - {duplicateWarning.out_time || 'N/A'}).
                  </p>
                  <p className="text-xs font-medium mt-1">
                    You are editing an existing attendance record. Do you want to continue and overwrite with the new values?
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
                  onChange={(e) => setSelectedUserId(e.target.value)}
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

            {/* In Time and Out Time (if not Day Off) */}
            {selectedDuty.id !== 'day_off' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    In Time
                  </label>
                  <input
                    type="time"
                    required
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {inTime && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                      {formatTime12h(inTime)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Out Time
                  </label>
                  <input
                    type="time"
                    required
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {outTime && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                      {formatTime12h(outTime)}
                    </span>
                  )}
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
              </div>

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
                placeholder="e.g. Completed operations shift, extra 1h for monthly inventory check"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="attendance-form"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <span>{initialRecord ? 'Update Record' : 'Save Attendance'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
