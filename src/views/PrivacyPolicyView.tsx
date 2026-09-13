import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff } from 'lucide-react';

export const PrivacyPolicyView: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
        
        {/* Back Button */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Duty & Attendance System
        </a>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Last updated: September 11, 2026
            </p>
          </div>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              1. Overview
            </h2>
            <p>
              Duty & Attendance System ("we", "our", or "the App") is an internal operational management
              tool designed to assist organizations, employees, and administrators in scheduling, tracking
              shifts, logging working hours, and synchronizing attendance records with designated Google Sheets.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              2. Data We Collect
            </h2>
            <p>
              To provide our attendance tracking and synchronization services, the App collects and processes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong>Account & Profile Information:</strong> Name, work email address, department, designation, and system role (Admin, Employee).
              </li>
              <li>
                <strong>Operational Attendance Data:</strong> Clock-in/out timestamps, selected duty types, total work hours, shift schedules, overtime, and remarks.
              </li>
              <li>
                <strong>Google Account Authentication Data:</strong> Temporary OAuth access tokens granted by users to read and append attendance entries into their designated Google Sheets.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              3. Google API Services User Data Policy Compliance
            </h2>
            <p>
              The App’s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <div className="my-3 p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200 font-medium">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <span>We only request access to Google Sheets specified directly by the user.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200 font-medium">
                <EyeOff className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <span>We do not sell, rent, or transfer your Google Sheets data to third parties or data brokers.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200 font-medium">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <span>We do not use Google user data to train or fine-tune machine learning or AI models.</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              4. Data Retention & Security
            </h2>
            <p>
              All operational attendance data is securely stored within authenticated cloud database infrastructure with role-based access control. OAuth tokens for Google Sheets are handled securely and never exposed publicly. Users may disconnect their Google Sheets integration or revoke OAuth access at any time via their Google Account security settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              5. Contact Us
            </h2>
            <p>
              If you have any questions, feedback, or requests regarding this Privacy Policy or your data, please contact the project administrator:
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Email: <span className="text-blue-600 dark:text-blue-400">hmdasaifullah28@gmail.com</span>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Duty & Attendance System</span>
          <a href="/terms" className="hover:underline text-blue-600 dark:text-blue-400">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
};
