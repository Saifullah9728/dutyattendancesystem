import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Eye, ShieldCheck, Download, ChevronRight, X } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import type { AuditLog } from '../types';

export const AuditLogsView: React.FC = () => {
  const { error } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        action: actionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 100,
      });
      setLogs(res.logs);
    } catch (err: any) {
      error('Failed to load logs', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter, startDate, endDate]);

  const exportLogsToCSV = () => {
    const headers = ['Timestamp,Actor,Target,Action,Target Type,Details'];
    const rows = logs.map((l) => {
      const time = new Date(l.created_at).toISOString();
      const actor = (l.actor_name || l.actor_id || '').replace(/"/g, '""');
      const target = (l.target_name || l.target_user_id || '').replace(/"/g, '""');
      const action = l.action;
      const targetType = l.target_type;
      const details = (l.details || '').replace(/"/g, '""');
      return `"${time}","${actor}","${target}","${action}","${targetType}","${details}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Duty_Attendance_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Audit History & Compliance Logs
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Tamper-evident record of all duty changes, role modifications, and system events
            </p>
          </div>
        </div>

        <button
          onClick={exportLogsToCSV}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto transition-colors"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Export Logs (CSV)</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Action Types</option>
            <option value="ATTENDANCE_CREATED">ATTENDANCE_CREATED</option>
            <option value="ATTENDANCE_UPDATED">ATTENDANCE_UPDATED</option>
            <option value="ATTENDANCE_DELETED">ATTENDANCE_DELETED</option>
            <option value="DUTY_TYPE_CREATED">DUTY_TYPE_CREATED</option>
            <option value="DUTY_TYPE_UPDATED">DUTY_TYPE_UPDATED</option>
            <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
            <option value="USER_STATUS_UPDATED">USER_STATUS_UPDATED</option>
            <option value="SHEET_CONFIG_SAVED">SHEET_CONFIG_SAVED</option>
            <option value="SHEET_SYNC_TRIGGERED">SHEET_SYNC_TRIGGERED</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing {logs.length} logged events
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Employee</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {log.actor_name || log.actor_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {log.target_name || (log.target_user_id ? log.target_user_id : 'System')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          log.action.includes('CREATED')
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : log.action.includes('UPDATED')
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : log.action.includes('DELETED')
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{log.details}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        title="View Full Changes"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit Log Details</h3>
                <p className="text-xs text-slate-500">{selectedLog.action}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Timestamp</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Type</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                    {selectedLog.target_type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Actor</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedLog.actor_name || selectedLog.actor_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedLog.target_name || selectedLog.target_user_id || 'System'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Details</span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {selectedLog.details}
                </div>
              </div>

              {selectedLog.old_value && (
                <div>
                  <span className="text-slate-400 block mb-1 font-bold text-rose-600 dark:text-rose-400">
                    Previous Values (Before Change):
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300">
                    {selectedLog.old_value}
                  </pre>
                </div>
              )}

              {selectedLog.new_value && (
                <div>
                  <span className="text-slate-400 block mb-1 font-bold text-emerald-600 dark:text-emerald-400">
                    New Values (After Change):
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300">
                    {selectedLog.new_value}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
