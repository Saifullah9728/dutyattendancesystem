export type Language = 'en' | 'bn';

export const translations = {
  // Brand & Navigation
  brandTitle: {
    en: 'DUTY & ATTENDANCE',
    bn: 'ডিউটি ও হাজিরা',
  },
  brandSubtitle: {
    en: 'Shift & Working Hours Management',
    bn: 'শিফট ও কর্মঘণ্টা ব্যবস্থাপনা',
  },
  systemBadge: {
    en: 'SYSTEM',
    bn: 'সিস্টেম',
  },

  // Sidebar Menu
  navAttendanceDuty: {
    en: 'Attendance & Duty',
    bn: 'হাজিরা ও ডিউটি',
  },
  navDashboard: {
    en: 'Dashboard',
    bn: 'ড্যাশবোর্ড',
  },
  navMyAttendance: {
    en: 'My Attendance',
    bn: 'আমার হাজিরা',
  },
  navDutyCalendar: {
    en: 'Duty Calendar',
    bn: 'ডিউটি ক্যালেন্ডার',
  },
  navMonthlyReports: {
    en: 'Monthly Reports',
    bn: 'মাসিক রিপোর্ট',
  },
  navGoogleSheets: {
    en: 'Google Sheets',
    bn: 'গুগল শিটস',
  },
  navBulkImport: {
    en: 'Bulk Import (Excel/CSV)',
    bn: 'বাল্ক আপলোড (এক্সেল/CSV)',
  },
  navAdministration: {
    en: 'Administration',
    bn: 'প্রশাসন ও নিয়ন্ত্রণ',
  },
  navAllEmployees: {
    en: 'All Employees',
    bn: 'সকল কর্মকর্তা/কর্মী',
  },
  navDutyTypes: {
    en: 'Duty Types',
    bn: 'ডিউটি শিফট তালিকা',
  },
  navAuditHistory: {
    en: 'Audit History',
    bn: 'অডিট হিস্ট্রি',
  },
  navAdminMgmt: {
    en: 'Admin Management',
    bn: 'অ্যাডমিন পরিচালনা',
  },
  navPreferences: {
    en: 'Preferences',
    bn: 'পছন্দসমূহ',
  },
  navProfileSettings: {
    en: 'Profile & Settings',
    bn: 'প্রোফাইল ও সেটিংস',
  },
  recordDailyDuty: {
    en: 'Record Daily Duty',
    bn: 'দৈনিক ডিউটি এন্ট্রি',
  },
  recordDuty: {
    en: 'Record Duty',
    bn: 'ডিউটি এন্ট্রি',
  },

  // Roles
  roleSuperAdmin: {
    en: 'Super Admin',
    bn: 'সুপার অ্যাডমিন',
  },
  roleAdmin: {
    en: 'Admin',
    bn: 'অ্যাডমিন',
  },
  roleEmployee: {
    en: 'Employee',
    bn: 'কর্মী',
  },

  // Common UI Actions
  save: {
    en: 'Save',
    bn: 'সংরক্ষণ করুন',
  },
  saveChanges: {
    en: 'Save Changes',
    bn: 'পরিবর্তন সংরক্ষণ করুন',
  },
  saving: {
    en: 'Saving...',
    bn: 'সংরক্ষণ হচ্ছে...',
  },
  cancel: {
    en: 'Cancel',
    bn: 'বাতিল',
  },
  close: {
    en: 'Close',
    bn: 'বন্ধ করুন',
  },
  edit: {
    en: 'Edit',
    bn: 'সম্পাদনা',
  },
  delete: {
    en: 'Delete',
    bn: 'মুছে ফেলুন',
  },
  deleting: {
    en: 'Deleting...',
    bn: 'মুছে ফেলা হচ্ছে...',
  },
  confirm: {
    en: 'Confirm',
    bn: 'নিশ্চিত করুন',
  },
  exportExcel: {
    en: 'Export Excel',
    bn: 'এক্সেল ডাউনলোড',
  },
  exportCSV: {
    en: 'Export CSV',
    bn: 'সিএসভি ডাউনলোড',
  },
  print: {
    en: 'Print',
    bn: 'প্রিন্ট',
  },
  refresh: {
    en: 'Refresh',
    bn: 'রিফ্রেশ',
  },
  search: {
    en: 'Search...',
    bn: 'অনুসন্ধান করুন...',
  },
  filter: {
    en: 'Filter',
    bn: 'ফিল্টার',
  },
  actions: {
    en: 'Actions',
    bn: 'অ্যাকশন',
  },
  status: {
    en: 'Status',
    bn: 'স্ট্যাটাস',
  },
  date: {
    en: 'Date',
    bn: 'তারিখ',
  },
  day: {
    en: 'Day',
    bn: 'দিন / বার',
  },
  time: {
    en: 'Time',
    bn: 'সময়',
  },
  inTime: {
    en: 'In Time',
    bn: 'প্রবেশ সময়',
  },
  outTime: {
    en: 'Out Time',
    bn: 'প্রস্থান সময়',
  },
  shift: {
    en: 'Shift',
    bn: 'শিফট',
  },
  dutyType: {
    en: 'Duty Type',
    bn: 'ডিউটি শিফট',
  },
  totalHours: {
    en: 'Total Hours',
    bn: 'মোট কাজের সময়',
  },
  expectedHours: {
    en: 'Expected Hours',
    bn: 'প্রত্যাশিত সময়',
  },
  difference: {
    en: 'Difference',
    bn: 'পার্থক্য',
  },
  overtime: {
    en: 'Overtime',
    bn: 'ওভারটাইম',
  },
  deficit: {
    en: 'Short / Deficit',
    bn: 'ঘাটতি সময়',
  },
  notes: {
    en: 'Notes / Remarks',
    bn: 'নোট বা মন্তব্য',
  },
  optional: {
    en: 'Optional',
    bn: 'ঐচ্ছিক',
  },
  loading: {
    en: 'Loading...',
    bn: 'লোড হচ্ছে...',
  },
  noData: {
    en: 'No records found',
    bn: 'কোনো তথ্য পাওয়া যায়নি',
  },

  // Duty Statuses
  statusNormal: {
    en: 'Normal',
    bn: 'স্বাভাবিক',
  },
  statusExtra: {
    en: 'Overtime',
    bn: 'ওভারটাইম',
  },
  statusShort: {
    en: 'Deficit',
    bn: 'ঘাটতি',
  },
  statusDayOff: {
    en: 'Day Off',
    bn: 'ছুটির দিন',
  },
  statusBlank: {
    en: 'Blank (No Duty)',
    bn: 'ডিউটি নেই (ফাঁকা)',
  },

  // Months
  monthJanuary: { en: 'January', bn: 'জানুয়ারি' },
  monthFebruary: { en: 'February', bn: 'ফেব্রুয়ারি' },
  monthMarch: { en: 'March', bn: 'মার্চ' },
  monthApril: { en: 'April', bn: 'এপ্রিল' },
  monthMay: { en: 'May', bn: 'মে' },
  monthJune: { en: 'June', bn: 'জুন' },
  monthJuly: { en: 'July', bn: 'জুলাই' },
  monthAugust: { en: 'August', bn: 'আগস্ট' },
  monthSeptember: { en: 'September', bn: 'সেপ্টেম্বর' },
  monthOctober: { en: 'October', bn: 'অক্টোবর' },
  monthNovember: { en: 'November', bn: 'নভেম্বর' },
  monthDecember: { en: 'December', bn: 'ডিসেম্বর' },

  // Weekdays
  daySun: { en: 'Sunday', bn: 'রবিবার' },
  dayMon: { en: 'Monday', bn: 'সোমবার' },
  dayTue: { en: 'Tuesday', bn: 'মঙ্গলবার' },
  dayWed: { en: 'Wednesday', bn: 'বুধবার' },
  dayThu: { en: 'Thursday', bn: 'বৃহস্পতিবার' },
  dayFri: { en: 'Friday', bn: 'শুক্রবার' },
  daySat: { en: 'Saturday', bn: 'শনিবার' },

  // Short weekdays
  daySunShort: { en: 'Sun', bn: 'রবি' },
  dayMonShort: { en: 'Mon', bn: 'সোম' },
  dayTueShort: { en: 'Tue', bn: 'মঙ্গল' },
  dayWedShort: { en: 'Wed', bn: 'বুধ' },
  dayThuShort: { en: 'Thu', bn: 'বৃহ' },
  dayFriShort: { en: 'Fri', bn: 'শুক্র' },
  daySatShort: { en: 'Sat', bn: 'শনি' },

  // Navbar
  cloudSynced: {
    en: 'Cloud Synced',
    bn: 'ক্লাউড সিঙ্কড',
  },
  asiaDhaka: {
    en: 'Asia/Dhaka',
    bn: 'ঢাকা সময়',
  },
  switchAccount: {
    en: 'Switch Account / Login',
    bn: 'অ্যাকাউন্ট পরিবর্তন / লগইন',
  },
  signInWithGoogle: {
    en: 'Sign in with Google',
    bn: 'গুগল দিয়ে সাইন-ইন',
  },
  logout: {
    en: 'Log Out',
    bn: 'লগআউট',
  },
  languageToggle: {
    en: 'Language',
    bn: 'ভাষা',
  },
  langEnglish: {
    en: 'English',
    bn: 'English',
  },
  langBangla: {
    en: 'বাংলা',
    bn: 'বাংলা',
  },

  // Modal: Record Attendance
  modalRecordTitle: {
    en: 'Duty Attendance Entry',
    bn: 'ডিউটি ও হাজিরা এন্ট্রি',
  },
  modalRecordDesc: {
    en: 'Select date, duty shift, and record in/out times.',
    bn: 'তারিখ, ডিউটি শিফট এবং প্রবেশের ও প্রস্থানের সময় সংরক্ষণ করুন।',
  },
  selectDutyType: {
    en: 'Select Duty Shift',
    bn: 'ডিউটি শিফট নির্বাচন করুন',
  },
  calculatedSummary: {
    en: 'Automatic Time Calculation',
    bn: 'স্বয়ংক্রিয় কাজের হিসাব',
  },

  // Bulk Import
  bulkImportTitle: {
    en: 'Bulk Duty Import',
    bn: 'এক্সেলে বাল্ক ডিউটি আপলোড',
  },
  bulkImportSubtitle: {
    en: 'Upload CSV or Excel file to update monthly attendance & duty records',
    bn: 'এক ক্লিকে পুরো মাসের ডিউটি রেকর্ড এক্সেল বা সিএসভি ফাইল থেকে আপডেট করুন',
  },
  excelTemplate: {
    en: 'Excel Template (.xlsx)',
    bn: 'এক্সেল টেমপ্লেট (.xlsx)',
  },
  csvTemplate: {
    en: 'CSV Template (.csv)',
    bn: 'সিএসভি টেমপ্লেট (.csv)',
  },
  step1Title: {
    en: 'Step 1: Select Target Month, Year & Options',
    bn: 'ধাপ ১: লক্ষ্য মাস, বছর এবং বিকল্প নির্বাচন করুন',
  },
  step2Title: {
    en: 'Step 2: Choose or Drag & Drop File',
    bn: 'ধাপ ২: ফাইল নির্বাচন করুন বা টেনে আনুন (Drag & Drop)',
  },
  step3Title: {
    en: 'Step 3: Review Preview & Confirm Import',
    bn: 'ধাপ ৩: প্রিভিউ পর্যালোচনা করুন এবং সংরক্ষণ নিশ্চিত করুন',
  },
  targetMonth: {
    en: 'Target Month',
    bn: 'টার্গেট মাস',
  },
  targetYear: {
    en: 'Target Year',
    bn: 'টার্গেট বছর',
  },
  targetEmployee: {
    en: 'Target Employee',
    bn: 'টার্গেট কর্মী',
  },
  overwriteExisting: {
    en: 'Overwrite existing records for these dates',
    bn: 'এই তারিখের পূর্বের রেকর্ড থাকলে তা নতুন তথ্য দিয়ে প্রতিস্থাপন করুন',
  },
  rulesAndGuidelines: {
    en: 'Formatting Rules & Guidelines',
    bn: 'আপলোড করার নিয়মাবলী ও নির্দেশিকা',
  },
  confirmAndSave: {
    en: 'Confirm & Save to Database',
    bn: 'নিশ্চিত করুন ও ডাটাবেসে সেভ করুন',
  },
  validRows: {
    en: 'Valid',
    bn: 'সঠিক',
  },
  errorRows: {
    en: 'Errors',
    bn: 'ত্রুটিপূর্ণ',
  },

  // Attendance View
  myAttendanceTitle: {
    en: 'My Attendance Records',
    bn: 'আমার ব্যক্তিগত হাজিরা খাতা',
  },
  monthlySummaryStats: {
    en: 'Monthly Summary',
    bn: 'মাসিক সারসংক্ষেপ',
  },
  totalWorkingDays: {
    en: 'Total Working Days',
    bn: 'মোট কাজের দিন',
  },
  totalWorkedHours: {
    en: 'Total Worked Hours',
    bn: 'মোট কাজের সময়',
  },
  netBalance: {
    en: 'Net Overtime / Deficit',
    bn: 'নেট ব্যালেন্স (ওভারটাইম/ঘাটতি)',
  },

  // Calendar
  calendarTitle: {
    en: 'Duty Schedule Calendar',
    bn: 'ডিউটি শিডিউল ক্যালেন্ডার',
  },
  today: {
    en: 'Today',
    bn: 'আজ',
  },
  previousMonth: {
    en: 'Previous',
    bn: 'পূর্ববর্তী',
  },
  nextMonth: {
    en: 'Next',
    bn: 'পরবর্তী',
  },

  // Dashboard
  welcomeBack: {
    en: 'Welcome back',
    bn: 'স্বাগতম',
  },
  todaysDuty: {
    en: "Today's Duty",
    bn: 'আজকের ডিউটি শিফট',
  },
  recentAttendance: {
    en: 'Recent Attendance',
    bn: 'সাম্প্রতিক হাজিরা',
  },
  quickActions: {
    en: 'Quick Actions',
    bn: 'দ্রুত কার্যক্রম',
  },
  viewFullHistory: {
    en: 'View Full Attendance History',
    bn: 'সম্পূর্ণ হাজিরা ইতিহাস দেখুন',
  },
  allDutyTypes: {
    en: 'All Duty Types',
    bn: 'সকল ডিউটি শিফট',
  },
  allStatuses: {
    en: 'All Statuses',
    bn: 'সকল স্ট্যাটাস',
  },
  noRecordsFound: {
    en: 'No attendance records match your filter.',
    bn: 'আপনার ফিল্টারের সাথে কোনো হাজিরার রেকর্ড মিলছে না।',
  },
  exportExcel: {
    en: 'Export Excel',
    bn: 'এক্সেল ডাউনলোড',
  },
  exportCSV: {
    en: 'Export CSV',
    bn: 'CSV ডাউনলোড',
  },
  print: {
    en: 'Print',
    bn: 'প্রিন্ট করুন',
  },
  deleteConfirm: {
    en: 'Are you sure you want to delete this record?',
    bn: 'আপনি কি নিশ্চিতভাবে এই হাজিরার রেকর্ডটি মুছে ফেলতে চান?',
  },
} as const;

export type TranslationKey = keyof typeof translations;

export const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export const BENGALI_DAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
export const BENGALI_DAYS_LONG = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export const toBengaliDigits = (num: number | string): string => {
  const digits: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return String(num).replace(/\d/g, (d) => digits[d] || d);
};

export const formatMonthYear = (date: Date, language: 'en' | 'bn'): string => {
  if (language === 'bn') {
    const month = BENGALI_MONTHS[date.getMonth()];
    const year = toBengaliDigits(date.getFullYear());
    return `${month} ${year}`;
  }
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
};
