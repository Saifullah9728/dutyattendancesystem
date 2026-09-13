import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatMinutesToHM, formatTime12h } from '../utils/calculations';
import type { DutyType } from '../types';

export const DutyTypesView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  const [dutyTypes, setDutyTypes] = useState<DutyType[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<DutyType | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [expectedDurationHours, setExpectedDurationHours] = useState('9');
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [contributesToHours, setContributesToHours] = useState(true);
  const [color, setColor] = useState('#2563eb');
  const [description, setDescription] = useState('');

  const loadTypes = async () => {
    setLoading(true);
    try {
      const res = await api.getDutyTypes();
      setDutyTypes(res.dutyTypes);
    } catch (err: any) {
      error('Failed to load duty types', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const openCreateModal = () => {
    setEditingType(null);
    setName('');
    setStartTime('09:00');
    setEndTime('18:00');
    setExpectedDurationHours('9');
    setIsWorkingDay(true);
    setContributesToHours(true);
    setColor('#3b82f6');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (dt: DutyType) => {
    setEditingType(dt);
    setName(dt.name);
    setStartTime(dt.start_time);
    setEndTime(dt.end_time);
    setExpectedDurationHours(String(Math.round(dt.expected_duration_minutes / 60)));
    setIsWorkingDay(dt.is_working_day);
    setContributesToHours(dt.contributes_to_hours);
    setColor(dt.color || '#2563eb');
    setDescription(dt.description || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMinutes = Math.round(parseFloat(expectedDurationHours || '0') * 60);

    try {
      if (editingType) {
        await api.updateDutyType(editingType.id, {
          name,
          start_time: startTime,
          end_time: endTime,
          expected_duration_minutes: durationMinutes,
          is_working_day: isWorkingDay,
          contributes_to_hours: contributesToHours,
          color,
          description,
        });
        success('Duty Type Updated', `Updated settings for "${name}". Historical records remain protected by snapshots.`);
      } else {
        await api.createDutyType({
          name,
          start_time: startTime,
          end_time: endTime,
          expected_duration_minutes: durationMinutes,
          is_working_day: isWorkingDay,
          contributes_to_hours: contributesToHours,
          color,
          description,
        });
        success('Duty Type Created', `Created new duty type "${name}".`);
      }
      setModalOpen(false);
      loadTypes();
    } catch (err: any) {
      error('Operation Failed', err.message);
    }
  };

  const handleToggleActive = async (dt: DutyType) => {
    if (dt.id === 'day_off') {
      error('Protected Duty', 'Day Off is a core system duty type and cannot be deactivated.');
      return;
    }
    try {
      await api.updateDutyType(dt.id, { is_active: !dt.is_active });
      success('Duty Updated', `${dt.name} is now ${!dt.is_active ? 'active' : 'inactive'}.`);
      loadTypes();
    } catch (err: any) {
      error('Failed to update', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Duty Types & Shift Schedules
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure shift hours, expected working duration, and snapshot configurations
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Duty Type</span>
        </button>
      </div>

      {/* Snapshot Protection Notice Card */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200">
          <span className="font-bold">Historical Snapshot Guarantee: </span>
          When an employee records attendance, the current shift timing and expected duration are permanently snapshotted in that record. Editing a duty type here will safely affect future attendance entries without altering prior month audit reports.
        </div>
      </div>

      {/* Duty Types Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dutyTypes.map((dt) => (
          <div
            key={dt.id}
            className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between ${
              dt.is_active
                ? 'border-slate-200/80 dark:border-slate-800 shadow-sm'
                : 'border-slate-200/40 dark:border-slate-800/40 opacity-60 bg-slate-50/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs shrink-0"
                    style={{ backgroundColor: dt.color || '#2563eb' }}
                  />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {dt.name}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    dt.is_active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {dt.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Shift Schedule:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {dt.id === 'day_off'
                      ? 'No Fixed Timing'
                      : `${formatTime12h(dt.start_time)} - ${formatTime12h(dt.end_time)}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Expected Duration:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatMinutesToHM(dt.expected_duration_minutes)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Working Day Flag:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {dt.is_working_day ? 'Counts as Working Day' : 'Rest / Off'}
                  </span>
                </div>

                {dt.description && (
                  <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                    "{dt.description}"
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => openEditModal(dt)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Settings</span>
              </button>

              {dt.id !== 'day_off' && (
                <button
                  onClick={() => handleToggleActive(dt)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    dt.is_active
                      ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {dt.is_active ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Duty Type Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingType ? `Edit Duty Type: ${editingType.name}` : 'Create Custom Duty Type'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Duty Type Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Night Operations Shift"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    value={expectedDurationHours}
                    onChange={(e) => setExpectedDurationHours(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Display Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
                    />
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{color}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWorkingDay}
                    onChange={(e) => setIsWorkingDay(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Counts as a formal Working Day in monthly totals</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contributesToHours}
                    onChange={(e) => setContributesToHours(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Contributes duration to monthly hours calculation</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Duty Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Standard day operations shift with 1h lunch break"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
                >
                  Save Duty Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
