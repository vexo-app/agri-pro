// src/config/constants/salary.js

// ─── Salary System ────────────────────────────────────────────────────────────
// ملحوظة: نظام "السلف" (advance / advance_repay) اتشال بالكامل بطلب صريح —
// كان بيتتبّع كمبلغ متبقي منفصل عن الراتب الشهري، وده اتلغى عشان يبسّط
// حسابات الرواتب. أي مستند قديم في Firestore لسه فيه type="advance" أو
// "advance_repay" (من حسابات مهاجَرة قبل كده عبر migrateDriverCosts.js)
// مش بيتحذف ولا بيتلمس — بس دلوقتي بيتجاهله كل منطق الحساب (زي أي نوع قيد
// غير معروف) وبيظهر في سجل القيود بالنص الخام بتاعه بدل تسمية جميلة، من
// غير ما يأثر على أي رقم مالي.
export const SALARY_ENTRY_TYPES = {
  BASE:      "base",       // الراتب الأساسي
  BONUS:     "bonus",      // حافز / زيادة
  DEDUCTION: "deduction",  // خصم — فلوس خرجت للعامل فعلًا (سحب/إيجار...): بتقلل الباقي له، مش مصروف الشركة
  PENALTY:   "penalty",    // جزاء — العامل ما خدش الفلوس دي: بتقلل الباقي له وبتقلل مصروف المرتبات
  CARRYOVER: "carryover",  // تعديل يدوي لمبلغ "خصم مرحّل من الشهر اللي فات" (لو مش موجود بيتحسب تلقائي)
};

// سالب أي شهر من الشهر ده وبعده بيترحّل خصم على الشهر اللي بعده. الشهور
// اللي قبله ما بيترحّلش منها حاجة (قرار المالك: الترحيل للجاي بس).
export const SALARY_CARRYOVER_START_MONTH = "2026-09";

export const SALARY_ENTRY_LABELS = {
  base:           "راتب أساسي",
  bonus:          "حافز / مكافأة",
  deduction:      "خصم",
  penalty:        "جزاء",
  carryover:      "خصم مرحّل من الشهر اللي فات",
};

export const SALARY_ENTRY_COLORS = {
  base:           "text-green-400",
  bonus:          "text-blue-400",
  deduction:      "text-red-400",
  penalty:        "text-orange-400",
  carryover:      "text-purple-400",
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
