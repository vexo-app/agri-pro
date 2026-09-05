// src/config/constants/custody.js

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
