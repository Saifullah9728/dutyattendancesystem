import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar as CalendarIcon,
  BarChart3,
  FileSpreadsheet,
  Users,
  Clock,
  History,
  ShieldCheck,
  Settings,
  X,
} from 'lucide-react';
import { BrandLogo } from './Navbar';
import { useAuth } from '../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'my_attendance'
  | 'calendar'
  | 'reports'
  | 'sheets'
  | 'employees'
  | 'duty_types'
  | 'audit_logs'
  | 'admin_mgmt'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenRecordModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  onOpenRecordModal,
}) => {
  const { isSuperAdmin, isAdmin, user } = useAuth();

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const navItem = (tab: NavTab, label: string, icon: React.ReactNode, badge?: string) => {
    const isActive = currentTab === tab;
    return (
      <button
        key={tab}
        id={`nav-item-${tab}`}
        onClick={() => handleTabClick(tab)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {icon}
          </span>
          <span>{label}</span>
        </div>
        {badge && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
              isActive
                ? 'bg-white/20 text-white'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800">
        <BrandLogo />
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Record Duty CTA in Sidebar */}
      <div className="p-4">
        <button
          id="btn-sidebar-record-duty"
          onClick={() => {
            onOpenRecordModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 transition-all transform active:scale-[0.99]"
        >
          <Clock className="w-4 h-4" />
          <span>Record Daily Duty</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-6 scrollbar-thin">
        {/* Core Employee Menu */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Attendance & Duty
          </div>
          <div className="space-y-1">
            {navItem('dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
            {navItem('my_attendance', 'My Attendance', <CalendarCheck className="w-4 h-4" />)}
            {navItem('calendar', 'Duty Calendar', <CalendarIcon className="w-4 h-4" />)}
            {navItem('reports', 'Monthly Reports', <BarChart3 className="w-4 h-4" />)}
            {navItem('sheets', 'Google Sheets', <FileSpreadsheet className="w-4 h-4" />)}
          </div>
        </div>

        {/* Administration Section (Admins & Super Admin only) */}
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Administration</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 font-bold">
                Admin
              </span>
            </div>
            <div className="space-y-1">
              {navItem('employees', 'All Employees', <Users className="w-4 h-4" />)}
              {navItem('duty_types', 'Duty Types', <Clock className="w-4 h-4" />)}
              {navItem('audit_logs', 'Audit History', <History className="w-4 h-4" />)}
              {isSuperAdmin && navItem('admin_mgmt', 'Admin Management', <ShieldCheck className="w-4 h-4" />, 'Super')}
            </div>
          </div>
        )}

        {/* System & Profile */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Preferences
          </div>
          <div className="space-y-1">
            {navItem('settings', 'Profile & Settings', <Settings className="w-4 h-4" />)}
          </div>
        </div>
      </div>

      {/* User Footer Chip */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 p-2 rounded-xl">
          <img
            src={user?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s120'}
            alt={user?.display_name || 'User'}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-blue-500/20"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {user?.display_name}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-colors">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 z-50">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
