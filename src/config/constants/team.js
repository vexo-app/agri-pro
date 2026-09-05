// src/config/constants/team.js

// ─── Driver Status ────────────────────────────────────────────────────────────
export const DRIVER_STATUS = {
  ACTIVE:   "active",
  INACTIVE: "inactive",
};

export const DRIVER_STATUS_LABELS = {
  active:   "نشط",
  inactive: "غير نشط",
};

// ─── Team Member Role (فريق العمل: سائقون / إداريون ومحاسبون) ─────────────────
// حقل واحد بسيط بيتحط على نفس بيانات "السائق" الموجودة أصلاً — مفيش جدول
// جديد ومفيش منطق منفصل. أي سجل قديم من غير الحقل ده يتعامل معاه كـ DRIVER
// افتراضيًا (نفس السلوك القديم بالظبط، من غير أي ترحيل بيانات).
export const TEAM_ROLE = {
  DRIVER: "driver",
  STAFF:  "staff", // إداري / محاسب
};

export const TEAM_ROLE_LABELS = {
  driver: "سائق",
  staff:  "إداري / محاسب",
};

// ─── نوع العضو التفصيلي (position) ──────────────────────────────────────────
// في تبويب السائقين: سائق (الافتراضي) أو "أخرى" بمسمى حر بيكتبه المستخدم.
// في تبويب الإداريين والمحاسبين: إداري أو محاسب فقط (اختيار ثابت، مفيش كتابة حرة).
export const STAFF_POSITIONS = {
  ADMIN:      "admin",
  ACCOUNTANT: "accountant",
};

export const STAFF_POSITION_LABELS = {
  admin:      "إداري",
  accountant: "محاسب",
};
