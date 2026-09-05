// src/config/constants/equipment.js

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
