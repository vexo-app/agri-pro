// src/config/constants/salary.js

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
