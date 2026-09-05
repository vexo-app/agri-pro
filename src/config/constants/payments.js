// src/config/constants/payments.js

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
