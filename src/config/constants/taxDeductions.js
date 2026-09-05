// src/config/constants/taxDeductions.js

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
