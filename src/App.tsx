import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Sidebar, type NavTab } from './components/Sidebar';
import { AttendanceModal } from './components/AttendanceModal';
import { DashboardView } from './views/DashboardView';
import { MyAttendanceView } from './views/MyAttendanceView';
import { CalendarView } from './views/CalendarView';
import { ReportsView } from './views/ReportsView';
import { GoogleSheetsView } from './views/GoogleSheetsView';
import { ImportDutyView } from './views/ImportDutyView';
import { EmployeesView } from './views/EmployeesView';
import { DutyTypesView } from './views/DutyTypesView';
import { AdminManagementView } from './views/AdminManagementView';
import { AuditLogsView } from './views/AuditLogsView';
import { ProfileSettingsView } from './views/ProfileSettingsView';
import { AuthView } from './views/AuthView';
import { PrivacyPolicyView } from './views/PrivacyPolicyView';
import { TermsOfServiceView } from './views/TermsOfServiceView';
import type { AttendanceRecord } from './types';

const MainLayout: React.FC = () => {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('saifullah_theme') === 'dark';
  });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [selectedModalDate, setSelectedModalDate] = useState<string | undefined>(undefined);

  // Sync dark mode class on <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('saifullah_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('saifullah_theme', 'light');
    }
  }, [darkMode]);

  const handleOpenRecordModal = (record?: AttendanceRecord | null, date?: string) => {
    setEditingRecord(record || null);
    setSelectedModalDate(date);
    setModalOpen(true);
  };

  const handleSavedAttendance = () => {
    // Invalidate or reload data if needed; views listen to their own updates or reload
    window.dispatchEvent(new CustomEvent('saifullah-attendance-updated'));
  };

  // Public legal routes for Google OAuth compliance
  const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  if (pathname === '/privacy' || pathname.startsWith('/privacy')) {
    return <PrivacyPolicyView />;
  }
  if (pathname === '/terms' || pathname.startsWith('/terms')) {
    return <TermsOfServiceView />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Loading Duty & Attendance System...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenRecordModal={() => handleOpenRecordModal()}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenRecordModal={() => handleOpenRecordModal()}
        />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onOpenRecordModal={handleOpenRecordModal}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'my_attendance' && (
            <MyAttendanceView
              onOpenRecordModal={handleOpenRecordModal}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView onOpenRecordModal={handleOpenRecordModal} />
          )}

          {currentTab === 'reports' && <ReportsView />}

          {currentTab === 'sheets' && <GoogleSheetsView />}

          {currentTab === 'import_duty' && <ImportDutyView onNavigateTab={setCurrentTab} />}

          {currentTab === 'employees' && isAdmin && <EmployeesView />}

          {currentTab === 'duty_types' && isAdmin && <DutyTypesView />}

          {currentTab === 'audit_logs' && isAdmin && <AuditLogsView />}

          {currentTab === 'admin_mgmt' && isSuperAdmin && <AdminManagementView />}

          {currentTab === 'settings' && <ProfileSettingsView />}
        </main>
      </div>

      {/* Attendance Entry & Editing Modal */}
      <AttendanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSavedAttendance}
        initialRecord={editingRecord}
        initialDate={selectedModalDate}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <MainLayout />
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
