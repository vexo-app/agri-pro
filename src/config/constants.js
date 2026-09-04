// src/config/constants.js

// ─── Admin ──────────────────────────────────────────────────────────────────
// UIDs اللي ليها دخول لصفحة الأدمن (/admin). الحماية الحقيقية هي قاعدة
// isAdmin() في firestore.rules — القائمة هنا بتتحكم بس في إظهار/إخفاء
// الواجهة، مش في الصلاحيات الفعلية على البيانات.
//
// إزاي تحصل على الـ UID بتاعك:
//   1. سجّل حساب عادي في التطبيق (زي أي عميل).
//   2. روح Firebase Console → Authentication → دور على إيميلك → انسخ "User UID".
//   3. حط القيمة دي هنا، وفي نفس القيمة بالظبط جوه isAdmin() في firestore.rules.
//   4. انشر الـ rules تاني (firebase deploy --only firestore:rules).
export const ADMIN_UIDS = [
  "VOS2uWwCxJUsmTgT4aSBqvoxPwa2",
];

// ─── Firestore Collections ────────────────────────────────────────────────────
// الحقول اللي بقت جوه users/{uid}/... (equipment, jobs, drivers, maintenance,
// payments, driverCosts, salaryEntries, attendance, custodyTransactions,
// settings) اتشالت من هنا — أسماء الـ subcollections مكتوبة مباشرة جوه كل
// service (src/services/*.js) بدل ما تتلف من هنا. اللي فاضل هنا هو بس
// الـ collections اللي لسه على المستوى الأعلى فعلاً.
export const COLLECTIONS = {
  NOTIFICATIONS:  "notifications",
  BACKUPS:        "backups",
  USERS:          "users",
  ERROR_LOGS:     "errorLogs",
  ADMIN_MESSAGES: "adminMessages",
};

// ─── Backup ───────────────────────────────────────────────────────────────────
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_BACKUPS_KEPT   = 7;                    // keep last 7 snapshots

// حد أقصى منطقي (مليار جنيه) لأي حقل مالي/كمّي (سعر، تكلفة، مبلغ، راتب...).
// مش قيد على العمل الفعلي (ولا شركة هتوصل للرقم ده)، الهدف بس إنه يمسك
// أخطاء الكتابة (زي صفر زيادة بالغلط) ويمنع أي قيمة غير منطقية تدخل
// الحسابات وتفسد التقارير.
export const MAX_MONEY_VALUE = 1_000_000_000;

// ─── Equipment ────────────────────────────────────────────────────────────────
// فئة المعدة: أساسية (جرار/عربية بتتحرك بذاتها وليها سائق) أو ملحق (بيتعلق على معدة أساسية)
export const EQUIPMENT_CATEGORY = {
  BASE:       "base",
  ATTACHMENT: "attachment",
};

export const EQUIPMENT_CATEGORY_LABELS = {
  base:       "معدة أساسية",
  attachment: "ملحق",
};

// أنواع المعدات الأساسية (ذاتية الحركة)
export const BASE_EQUIPMENT_TYPES = [
  "جرار",
  "عربية",
  "شاحنة",
  "لودر",
  "بيلة",
  "أخرى",
];

// أنواع الملحقات (بتتعلق على معدة أساسية)
export const ATTACHMENT_TYPES = [
  "معدة حرث",
  "معدة زراعة",
  "مضخة مياه",
  "حصادة",
  "أخرى",
];

// نُبقي القائمة القديمة لأي استخدام قديم لسه موجود (تجميع الاتنين)
export const EQUIPMENT_TYPES = [
  ...BASE_EQUIPMENT_TYPES.slice(0, -1),
  ...ATTACHMENT_TYPES,
];

export const EQUIPMENT_STATUS = {
  ACTIVE:      "active",
  MAINTENANCE: "maintenance",
  INACTIVE:    "inactive",
};

export const EQUIPMENT_STATUS_LABELS = {
  active:      "نشطة",
  maintenance: "في الصيانة",
  inactive:    "متوقفة",
};

export const EQUIPMENT_TYPE_ICONS = {
  "جرار":        "🚜",
  "معدة حرث":   "⚙️",
  "معدة زراعة": "🌿",
  "مضخة مياه":  "💧",
  "حصادة":      "🌾",
  "أخرى":       "🔧",
};

// ─── Work Types ───────────────────────────────────────────────────────────────
export const WORK_TYPES = [
  "المحراث",
  "القلاب",
  "السبسيولار",
  "معدة تسوية",
  "الدسك",
  "الرشاشة",
  "كومباين",
  "بلانتر بنجر",
  "بلانتر ذرة",
  "سطارة",
  "هولمر حصاد",
  "بدارة خدمة",
  "بدارة خضري",
  "أخرى",
];

export const WORK_TYPE_ICONS = {
  "المحراث":      "🌱",
  "القلاب":       "🌱",
  "السبسيولار":   "🌱",
  "معدة تسوية":   "⚖️",
  "الدسك":        "🌾",
  "الرشاشة":      "💧",
  "كومباين":      "🌻",
  "بلانتر بنجر":  "🌾",
  "بلانتر ذرة":   "🌾",
  "سطارة":        "🌾",
  "هولمر حصاد":   "🌻",
  "بدارة خدمة":   "🌾",
  "بدارة خضري":   "🌾",
  "أخرى":         "🔧",
};

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const MAINTENANCE_TYPES = [
  "تغيير زيت",
  "صيانة دورية",
  "إطارات",
  "بطارية",
  "فلاتر",
  "كهرباء",
  "ميكانيكي",
  "هيكل",
  "أخرى",
];

export const MAINTENANCE_INTERVALS = [
  { label: "كل 250 ساعة", hours: 250 },
  { label: "كل 500 ساعة", hours: 500 },
  { label: "كل شهر",      days:  30  },
  { label: "كل 3 أشهر",   days:  90  },
  { label: "كل 6 أشهر",   days:  180 },
  { label: "كل سنة",      days:  365 },
];

// ─── Payment Status ───────────────────────────────────────────────────────────
export const PAYMENT_STATUS = {
  PAID:    "paid",
  PARTIAL: "partial",
  UNPAID:  "unpaid",
};

export const PAYMENT_STATUS_LABELS = {
  paid:    "مدفوع",
  partial: "جزئي",
  unpaid:  "غير مدفوع",
};

export const PAYMENT_STATUS_VARIANTS = {
  paid:    "green",
  partial: "amber",
  unpaid:  "red",
};

// ─── Driver Status ────────────────────────────────────────────────────────────
export const DRIVER_STATUS = {
  ACTIVE:   "active",
  INACTIVE: "inactive",
};

export const DRIVER_STATUS_LABELS = {
  active:   "نشط",
  inactive: "غير نشط",
};

// ─── Driver Costs ─────────────────────────────────────────────────────────────
// كان DriverCostForm.jsx بيستورد الثابت ده من هنا من غير ما يكون معرّف
// فعلياً في الملف — أي فتح لفورم "إضافة تكلفة سائق" كان بيرمي خطأ
// (DRIVER_COST_TYPES is undefined). الإضافة دي بس بتكمّل الثابت الناقص،
// مفيش أي تغيير في أي مكان تاني.
export const DRIVER_COST_TYPES = [
  "راتب شهري",
  "سلفة",
  "بدل وقود",
  "تأمين",
  "غرامة",
  "أخرى",
];

// ─── Notifications ────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  MAINTENANCE_DUE:   "maintenance_due",
  DEBT_OVERDUE:      "debt_overdue",
  CUSTODY_OVERDRAWN: "custody_overdrawn",
  GENERAL:           "general",
};

export const NOTIFICATION_LABELS = {
  maintenance_due:   "موعد صيانة",
  debt_overdue:      "دين متأخر",
  custody_overdrawn: "عهدة بالسالب",
  general:           "عام",
};

// ─── Misc ─────────────────────────────────────────────────────────────────────
export const DEFAULT_FUEL_PRICE = 12; // EGP per litre
export const APP_VERSION        = "2.0.0";

// ─── Salary System ────────────────────────────────────────────────────────────
export const SALARY_ENTRY_TYPES = {
  BASE:      "base",       // الراتب الأساسي
  BONUS:     "bonus",      // حافز / زيادة
  DEDUCTION: "deduction",  // خصم
  ADVANCE:   "advance",    // سلفة
  ADVANCE_REPAY: "advance_repay", // سداد سلفة
};

export const SALARY_ENTRY_LABELS = {
  base:           "راتب أساسي",
  bonus:          "حافز / مكافأة",
  deduction:      "خصم",
  advance:        "سلفة",
  advance_repay:  "سداد سلفة",
};

export const SALARY_ENTRY_COLORS = {
  base:           "text-green-400",
  bonus:          "text-blue-400",
  deduction:      "text-red-400",
  advance:        "text-amber-400",
  advance_repay:  "text-purple-400",
};

export const DEDUCTION_REASONS = [
  "غياب",
  "تأخير",
  "خطأ في العمل",
  "سداد سلفة",
  "أخرى",
];

export const BONUS_REASONS = [
  "حافز أداء",
  "ساعات إضافية",
  "بدل وقود",
  "بدل سكن",
  "مكافأة",
  "أخرى",
];

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT:  "absent",
  LATE:    "late",
  HALF:    "half",
};

export const ATTENDANCE_LABELS = {
  present: "حضر",
  absent:  "غياب",
  late:    "تأخير",
  half:    "نصف يوم",
};

// ─── Taxes & Deductions (ضرائب وخصومات) ─────────────────────────────────────────
// سجل مستقل عن العهدة — مبالغ متغيرة بتواريخ مختلفة (ضرائب، رسوم حكومية،
// غرامات، خصومات أخرى) بتتخصم من صافي الربح في الداشبورد، لكن ملهاش أي
// تأثير على رصيد العهدة نفسه.
export const TAX_DEDUCTION_TYPES = {
  TAX:           "tax",
  GOV_FEE:       "gov_fee",
  FINE:          "fine",
  OTHER:         "other",
};

export const TAX_DEDUCTION_TYPE_LABELS = {
  tax:      "ضريبة",
  gov_fee:  "رسوم حكومية",
  fine:     "غرامة",
  other:    "خصم آخر",
};

// ─── Custody (العهدة) ──────────────────────────────────────────────────────────
// رجل الأعمال بيسلّم الشركة مبلغ (عهدة) بشكل دوري، وبيتصرف منه على الميكنة والسواقين.
export const CUSTODY_TYPES = {
  DEPOSIT: "deposit", // إضافة فلوس (تسليم من رجل الأعمال)
  EXPENSE: "expense", // صرف فلوس (مصروف يتخصم من الرصيد)
};

export const CUSTODY_TYPE_LABELS = {
  deposit: "إضافة فلوس",
  expense: "صرف فلوس",
};

// تصنيف المصروف — يفيد في التقارير (فين بتروح الفلوس)
export const CUSTODY_EXPENSE_CATEGORIES = {
  EQUIPMENT: "equipment", // ميكنة
  DRIVER:    "driver",    // سائقين
  OTHER:     "other",     // أخرى
};

export const CUSTODY_EXPENSE_CATEGORY_LABELS = {
  equipment: "ميكنة",
  driver:    "سائقين",
  other:     "أخرى",
};
