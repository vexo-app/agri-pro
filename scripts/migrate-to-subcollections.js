#!/usr/bin/env node
// scripts/migrate-to-subcollections.js
//
// بينقل بيانات موجودة فعلاً من التنظيم القديم (collections منفصلة على
// المستوى الأعلى فيها حقل userId) للتنظيم الجديد (users/{uid}/...).
//
// الافتراضي: DRY RUN — بيطبعلك بس عدد المستندات اللي هينقلها من غير ما
// يكتب أي حاجة. لما تتأكد إن العدد صح، شغّله تاني بـ --write عشان ينفّذ
// فعلاً. البيانات القديمة *مش* بتتمسح تلقائياً — لازم --delete-old
// صراحةً بعد ما تتأكد إن كل حاجة اتنقلت ومتحقق منها في التطبيق شغال.
//
// الاستخدام:
//   1) npm install --no-save firebase-admin   (مش من ضمن dependencies بتاعة
//      التطبيق نفسه؛ السكريبت ده بيتشغل من جهازك بس مش جوه الـ app)
//   2) نزّل service account key من:
//      Firebase Console → Project Settings → Service Accounts → Generate new private key
//      وسيبه *برا* الريبو خالص (متحطوش جوه scripts/ ولا أي مكان تاني في
//      المشروع — الملف ده بيدّي صلاحية أدمن كاملة، ومتسيبوش يتنشر على GitHub!)
//   3) جرب dry run الأول:      node scripts/migrate-to-subcollections.js /path/to/serviceAccountKey.json
//   4) لما تتأكد من العدد:      node scripts/migrate-to-subcollections.js /path/to/serviceAccountKey.json --write
//   5) بعد التأكد إن التطبيق شغال كويس بالبيانات الجديدة:
//                                node scripts/migrate-to-subcollections.js /path/to/serviceAccountKey.json --delete-old

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path  = require("path");

const WRITE       = process.argv.includes("--write");
const DELETE_OLD  = process.argv.includes("--delete-old");

// مفتاح الأدمن بيتاخد من مسار يتديله وقت التشغيل، مش من ملف ثابت جوه
// المشروع — نفس النمط المستخدم في backfillUserProfiles.js. لو حد شغّل
// السكريبت من غير ما يديله مسار، بيوقف برسالة واضحة بدل ما يدور على
// ملف مش موجود ويرمي stack trace غامض.
const keyPathArg = process.argv[2];
if (!keyPathArg || keyPathArg.startsWith("--")) {
  console.error("استخدام: node scripts/migrate-to-subcollections.js <path-to-service-account.json> [--write] [--delete-old]");
  process.exit(1);
}

initializeApp({
  credential: cert(require(path.resolve(keyPathArg))),
});
const db = getFirestore();

// [اسم الـ collection القديم, اسم الـ subcollection الجديد تحت users/{uid}]
const COLLECTIONS = [
  ["equipment",           "equipment"],
  ["jobs",                "jobs"],
  ["drivers",             "drivers"],
  ["maintenance",         "maintenance"],
  ["payments",            "payments"],
  ["driverCosts",         "driverCosts"],
  ["salaryEntries",       "salaryEntries"],
  ["attendance",          "attendance"],
  ["custodyTransactions", "custodyTransactions"],
];

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function migrateCollection(oldName, newSubName) {
  const snap = await db.collection(oldName).get();
  console.log(`\n${oldName}: ${snap.size} مستند`);

  const byUser = new Map();
  const skipped = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.userId) { skipped.push(d.id); return; }
    if (!byUser.has(data.userId)) byUser.set(data.userId, []);
    byUser.get(data.userId).push(d);
  });

  if (skipped.length) {
    console.warn(`  ⚠️  ${skipped.length} مستند من غير userId اتجاهلوا: ${skipped.join(", ")}`);
  }

  if (!WRITE) {
    console.log(`  (dry run) هيتنقلوا لـ ${byUser.size} مستخدم مختلف تحت users/{uid}/${newSubName}`);
    return;
  }

  let written = 0;
  for (const [uid, docs] of byUser) {
    for (const batchDocs of chunk(docs, 450)) {
      const batch = db.batch();
      batchDocs.forEach((d) => {
        const { userId, ...rest } = d.data(); // userId بقى ضمني في المسار، مش محتاجينه كحقل
        const ref = db.collection("users").doc(uid).collection(newSubName).doc(d.id);
        batch.set(ref, rest, { merge: true });
      });
      await batch.commit();
      written += batchDocs.length;
    }
  }
  console.log(`  ✅ اتكتب ${written} مستند تحت users/{uid}/${newSubName}`);

  if (DELETE_OLD) {
    for (const batchDocs of chunk(snap.docs, 450)) {
      const batch = db.batch();
      batchDocs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`  🗑️  اتمسح ${oldName} القديم (${snap.size} مستند)`);
  }
}

async function migrateSettings() {
  const snap = await db.collection("settings").get();
  console.log(`\nsettings: ${snap.size} مستند`);
  if (!WRITE) {
    console.log(`  (dry run) هيتنقلوا لـ users/{uid}/meta/settings`);
    return;
  }
  for (const d of snap.docs) {
    // في الـ collection القديم دي، ID المستند هو نفسه الـ userId
    await db.collection("users").doc(d.id).collection("meta").doc("settings")
      .set(d.data(), { merge: true });
  }
  console.log(`  ✅ اتكتب ${snap.size} إعدادات تحت users/{uid}/meta/settings`);
  if (DELETE_OLD) {
    for (const batchDocs of chunk(snap.docs, 450)) {
      const batch = db.batch();
      batchDocs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`  🗑️  اتمسح settings القديم`);
  }
}

(async () => {
  console.log(WRITE ? "🚀 وضع الكتابة الفعلية" : "🧪 Dry run — مفيش هيتكتب، بس عد وعرض");
  if (DELETE_OLD && !WRITE) {
    console.error("لازم تحط --write مع --delete-old (مينفعش تمسح من غير كتابة).");
    process.exit(1);
  }

  for (const [oldName, newSubName] of COLLECTIONS) {
    await migrateCollection(oldName, newSubName);
  }
  await migrateSettings();

  console.log("\nتم. لو ده كان dry run، راجع الأرقام واتأكد إنها منطقية، بعدين شغّل بـ --write.");
})().catch((err) => {
  console.error("فشلت الهجرة:", err);
  process.exit(1);
});
