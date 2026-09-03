#!/usr/bin/env node
// scripts/reportDuplicateSalaryEntries.js
//
// السبب:
// ------------------------------------------------------
// نظام تكاليف السائقين القديم (`driverCosts`) اتدمج جوه نظام الرواتب
// الحالي (`salaryEntries`) — الكود اللي بيعمل ده موجود في
// utils/migrateDriverCosts.js وبيتنادى مرة واحدة لكل حساب من
// contexts/DataContext.jsx وقت أول تحميل بعد التحديث.
//
// حماية التكرار الحالية بتعتمد على حقل `legacyDriverCostId` اللي بيتحط
// على كل قيد راتب ناتج من الترحيل، عشان لو المستند القديم اتمسح فشل بعد
// ما القيد الجديد اتكتب، الترحيل التاني يعرف يتخطاه. لكن الحقل ده اتضاف
// *بعد* أول نسخة من الترحيل — فأي حساب اترحّل على النسخة القديمة، وبعدين
// حصل فشل في مسح المستند القديم، ممكن يكون عنده قيد راتب اتترحّل مرتين:
// واحد قديم من غير `legacyDriverCostId`، وواحد جديد بيه.
//
// السكريبت ده بيقرأ بس (dry run افتراضيًا) ويطبع تقرير بالتكرارات
// المحتملة من غير ما يلمس أي حاجة. الحذف الفعلي اختياري وصريح (--clean)،
// ومحصور بس في الحالة شبه المؤكدة 100%: قيدين بنفس الـ legacyDriverCostId
// (نفس المستند القديم اترحّل حرفيًا مرتين — ده مينفعش يحصل غير بالخطأ ده،
// مش بفعل مستخدم). أي تكرار تاني بيتعرف بالتخمين (نفس السائق/النوع/
// المبلغ/التاريخ من غير legacyDriverCostId مشترك) بيتطبع في التقرير
// كـ "يحتاج مراجعة يدوية" فقط، ومش بيتمسح أبداً من السكريبت ده — راجعه
// من صفحة السائق في التطبيق واحذفه يدوي لو اتأكدت إنه تكرار فعلاً.
//
// طريقة التشغيل:
// ------------------------------------------------------
// 1) نزّل service account key من:
//    Firebase Console → Project Settings → Service Accounts → Generate new private key
//    وسيبه *برا* الريبو خالص (متحطوش جوه scripts/ ولا أي مكان تاني في
//    المشروع، ومتسيبوش يتنشر على GitHub!)
// 2) تقرير بس (مفيش أي حذف):
//      node scripts/reportDuplicateSalaryEntries.js /path/to/serviceAccountKey.json
// 3) بعد ما تراجع التقرير وتتأكد، لو حابب تنضف الحالة شبه المؤكدة بس:
//      node scripts/reportDuplicateSalaryEntries.js /path/to/serviceAccountKey.json --clean
//    (الحالات اللي محتاجة مراجعة يدوية *مش* بتتحذف حتى مع --clean.)

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const CLEAN = process.argv.includes("--clean");

const keyPathArg = process.argv[2];
if (!keyPathArg || keyPathArg.startsWith("--")) {
  console.error("استخدام: node scripts/reportDuplicateSalaryEntries.js <path-to-service-account.json> [--clean]");
  process.exit(1);
}

initializeApp({ credential: cert(require(path.resolve(keyPathArg))) });
const auth = getAuth();
const db = getFirestore();

const MIGRATION_MARKER = "(منقول من:";
const looksMigrated = (entry) => typeof entry.notes === "string" && entry.notes.includes(MIGRATION_MARKER);
const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const matchKey = (e) => [e.driverId, e.type, Number(e.amount) || 0, e.date || ""].join("|");

// Same classification as src/utils/findDuplicateSalaryEntries.js, kept as a
// plain CommonJS copy here since this script runs standalone (outside the
// app's ES module build) — see that file for the reasoning behind each rule.
function findDuplicates(salaryEntries) {
  const migrated = salaryEntries.filter(looksMigrated);
  const highConfidence = [];
  const needsReview = [];

  const byLegacyId = new Map();
  migrated.forEach((e) => {
    if (!e.legacyDriverCostId) return;
    const list = byLegacyId.get(e.legacyDriverCostId) || [];
    list.push(e);
    byLegacyId.set(e.legacyDriverCostId, list);
  });

  const resolvedIds = new Set();
  byLegacyId.forEach((group, legacyDriverCostId) => {
    if (group.length < 2) return;
    const withMillis = group.map((e) => ({ e, ms: toMillis(e.createdAt) }));
    const allResolvable = withMillis.every((g) => g.ms !== null);
    const sorted = allResolvable ? [...withMillis].sort((a, b) => a.ms - b.ms).map((g) => g.e) : group;
    const [keep, ...duplicates] = sorted;
    group.forEach((e) => resolvedIds.add(e.id));
    (allResolvable ? highConfidence : needsReview).push({ key: `legacy:${legacyDriverCostId}`, keep, duplicates });
  });

  const remaining = migrated.filter((e) => !resolvedIds.has(e.id));
  const byMatchKey = new Map();
  remaining.forEach((e) => {
    const key = matchKey(e);
    const list = byMatchKey.get(key) || [];
    list.push(e);
    byMatchKey.set(key, list);
  });
  byMatchKey.forEach((group, key) => {
    if (group.length < 2) return;
    const withMillis = group.map((e) => ({ e, ms: toMillis(e.createdAt) }));
    const allResolvable = withMillis.every((g) => g.ms !== null);
    const sorted = allResolvable ? [...withMillis].sort((a, b) => a.ms - b.ms).map((g) => g.e) : group;
    const [keep, ...duplicates] = sorted;
    needsReview.push({ key, keep, duplicates });
  });

  return { highConfidence, needsReview };
}

async function listAllAuthUsers() {
  const all = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    all.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

const describe = (e) => `id=${e.id} driver=${e.driverId} type=${e.type} amount=${e.amount} date=${e.date}`;

async function main() {
  console.log(CLEAN ? "🧹 وضع التنظيف — هيتمسح الحالة شبه المؤكدة بس" : "🧪 تقرير بس (dry run) — مفيش أي حذف");
  const users = await listAllAuthUsers();
  console.log(`بفحص ${users.length} حساب...\n`);

  let totalHighConfidenceGroups = 0;
  let totalHighConfidenceDuplicates = 0;
  let totalNeedsReviewGroups = 0;
  let totalNeedsReviewDuplicates = 0;
  let totalCleaned = 0;

  for (const u of users) {
    const snap = await db.collection("users").doc(u.uid).collection("salaryEntries").get();
    if (snap.empty) continue;
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const { highConfidence, needsReview } = findDuplicates(entries);
    if (highConfidence.length === 0 && needsReview.length === 0) continue;

    console.log(`— حساب ${u.uid} (${u.email || "بلا إيميل"}) —`);

    for (const group of highConfidence) {
      totalHighConfidenceGroups++;
      totalHighConfidenceDuplicates += group.duplicates.length;
      console.log(`  ✅ تكرار شبه مؤكد — نفس legacyDriverCostId (${group.duplicates.length + 1} قيد)`);
      console.log(`     محتفظ به: ${describe(group.keep)}`);
      group.duplicates.forEach((d) => console.log(`     ${CLEAN ? "🗑️  هيتمسح" : "تكرار"}: ${describe(d)}`));

      if (CLEAN) {
        for (const dup of group.duplicates) {
          await db.collection("users").doc(u.uid).collection("salaryEntries").doc(dup.id).delete();
          totalCleaned++;
        }
      }
    }

    for (const group of needsReview) {
      totalNeedsReviewGroups++;
      totalNeedsReviewDuplicates += group.duplicates.length;
      console.log(`  ⚠️  يحتاج مراجعة يدوية — من غير legacyDriverCostId مشترك (${group.duplicates.length + 1} قيد)`);
      console.log(`     مرشّح للاحتفاظ: ${describe(group.keep)}`);
      group.duplicates.forEach((d) => console.log(`     تكرار محتمل (مش هيتمسح): ${describe(d)}`));
    }

    console.log("");
  }

  console.log("----------------------------------------");
  console.log(`تكرارات شبه مؤكدة: ${totalHighConfidenceGroups} مجموعة، ${totalHighConfidenceDuplicates} قيد زيادة`);
  console.log(CLEAN
    ? `اتمسح فعلاً: ${totalCleaned} قيد`
    : `اتمسح فعلاً: 0 (شغّل بـ --clean بعد المراجعة عشان يتنضفوا)`);
  console.log(`يحتاج مراجعة يدوية (مش هيتمسح تلقائي خالص): ${totalNeedsReviewGroups} مجموعة، ${totalNeedsReviewDuplicates} قيد`);
}

main().catch((err) => {
  console.error("السكريبت فشل:", err);
  process.exit(1);
});
