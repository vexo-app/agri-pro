// src/config/constants/collections.js

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
