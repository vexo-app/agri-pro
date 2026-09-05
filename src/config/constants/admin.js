// src/config/constants/admin.js

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
