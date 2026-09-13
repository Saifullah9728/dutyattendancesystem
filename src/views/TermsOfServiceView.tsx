import React from 'react';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const TermsOfServiceView: React.FC = () => {
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
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Last updated: September 11, 2026
            </p>
          </div>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using the Duty & Attendance System ("the Service"), you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              2. Permitted Use
            </h2>
            <p>
              The Service is provided to manage organizational duty shifts, record daily attendance, monitor employee working hours, and synchronize work records with designated Google Sheets. You agree to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Provide accurate and verifiable attendance information.</li>
              <li>Use the Google Sheets integration solely for legitimate workforce records.</li>
              <li>Maintain the confidentiality of your credentials and authorized sessions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              3. Google Integration & Third-Party Services
            </h2>
            <p>
              When connecting your Google Account for Google Sheets synchronization, you grant the Service permission to create and append data into your designated spreadsheet. You may revoke access at any time through your Google Account Security Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              4. Service Availability & Modifications
            </h2>
            <p>
              We strive for high reliability and uptime. However, we reserve the right to modify, suspend, or discontinue any aspect of the Service for maintenance or security improvements without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              5. Limitation of Liability
            </h2>
            <p>
              The Service is provided on an "as is" and "as available" basis. To the fullest extent permitted by applicable law, the administrators shall not be liable for any indirect or consequential damages arising from the use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              6. Contact Information
            </h2>
            <p>
              For inquiries regarding these Terms of Service, please reach out to the project administrator at{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">hmdasaifullah@gmail.com</span>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Duty & Attendance System</span>
          <a href="/privacy" className="hover:underline text-blue-600 dark:text-blue-400">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};
