// src/config/constants/maintenance.js

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
