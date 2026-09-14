// scripts/testFirestoreRules.js
//
// audit finding F-015: قبل الملف ده، مفيش أي اختبار آلي لقواعد Firestore
// نفسها — أهم طبقة حماية في المشروع كله (عزل بيانات كل شركة عن التانية
// معتمد بالكامل عليها، مش على أي كود في الفرونت) كانت بتتراجع بالعين بس
// وقت أي تعديل. السكريبت ده بيشغّل سيناريوهات تهديد فعلية (مش وصفية) ضد
// القواعد الحقيقية في firestore.rules عبر Firebase Local Emulator — مش
// mock، نفس ملف القواعد اللي بينتشر فعلياً.
//
// الفئات التلاتة المطلوبة في roadmap الـ phase دي بالظبط:
//   1) عزل البيانات بين الشركات (A ضد B)
//   2) مستخدم عادي ضد أدمن
//   3) مستندات بحقول متلاعب بيها (تخريب متعمد لحقل)
//
// ─────────────────────────────────────────────────────────────────────
// طريقة التشغيل (على جهازك، مش في بيئة التطوير اللي كتبت بيها الملف ده):
//   1. npm install --save-dev @firebase/rules-unit-testing   (لو لسه مش متثبتة)
//   2. تأكد إن عندك Java متثبت (متطلب Firebase Emulator نفسه، مش المشروع)
//   3. npm run test:rules
//      (بيشغّل: npx firebase-tools emulators:exec --only firestore "node scripts/testFirestoreRules.js"
//       — بيبدأ Firestore emulator محلي فاضي، يشغّل الاختبارات، يقفله.
//       مفيش أي اتصال بمشروع Firebase حقيقي ولا إنترنت وقت التشغيل نفسه،
//       npx بس محتاج إنترنت أول مرة عشان يحمّل firebase-tools.)
//
// ⚠️ ملحوظة أمانة لازم تتقال بوضوح: الملف ده اتكتب واتراجع منطقياً سطر
// بسطر مقابل firestore.rules الفعلي (نفس الملف اللي قريته بالكامل قبل ما
// أكتب أي سطر هنا)، لكن معنديش القدرة أشغّل Firestore emulator فعلياً في
// بيئة العمل الحالية بتاعتي — مفيش اتصال بـ npm registry هنا لتثبيت
// @firebase/rules-unit-testing أصلاً (سياسة أمان في بيئة التطوير دي، مش
// قيد في مشروعك). يعني ده أول تسليم في كل الـ phases من غير ما أقدر
// أوعدك إنه "شغال 100%" زي باقي الملفات اللي عدلتها وعملتلها syntax
// check فعلي بـ esbuild — أنا واثق في المنطق لأني راجعته يدوياً مقابل
// القواعد الحقيقية، لكن لازم إنت تشغّله فعلياً على جهازك وتتأكد.
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

// ❗ لازم يطابق أول قيمة في ADMIN_UIDS بـ src/config/constants/admin.js
// (ونفس القيمة في firestore.rules → isAdmin()) — لو غيّرت واحدة، غيّر
// التلاتة مع بعض.
const ADMIN_UID = "VOS2uWwCxJUsmTgT4aSBqvoxPwa2";
const COMPANY_A = "test-company-a";
const COMPANY_B = "test-company-b";

// ─── Guest Access (read-only) fixtures ────────────────────────────────────
// شركة مخصصة لاختبارات الضيوف لوحدها (مش COMPANY_A/B) عشان كل كود ضيف
// استخدام واحد بس، ولازم كل سيناريو يكون له كود منفصل من غير ما يتعارض
// مع بعضه أو مع باقي المجموعات فوق.
const GUEST_OWNER = "test-company-guest";

let testEnv;
let passed = 0;
let failed = 0;
const failures = [];

async function test(groupLabel, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ groupLabel, name, err });
    console.log(`  ❌ ${name}`);
    console.log(`     ${String(err.message || err).split("\n")[0]}`);
  }
}

function ctx(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

// سياق ضيف Anonymous Auth حقيقي — لازم claim معينة (firebase.sign_in_provider
// == 'anonymous') عشان isAnonymousGuest() في firestore.rules تفرّقه عن
// مستخدم عادي مسجل بإيميل/باسورد بنفس شكل الـuid.
function guestCtx(uid) {
  return testEnv
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore();
}

// تنفيذ "استخدام الكود" بالظبط زي ما هيحصل من الفرونت: ترانزاكشن واحدة
// بتحدّث guestAccess (redeemedByUid) وتنشئ guestSessions مع بعض. لازم
// تعدي من قواعد الحماية الحقيقية (مش seed بتاعها withSecurityRulesDisabled)
// عشان الاختبار ده يبقى اختبار حقيقي لأهم ضمان في الميزة: استخدام واحد بس.
function redeemGuestCode(guestUid, ownerUid, code) {
  const guestDb = guestCtx(guestUid);
  return guestDb.runTransaction(async (tx) => {
    const accessRef = guestDb.doc(`users/${ownerUid}/guestAccess/${code}`);
    const sessionRef = guestDb.doc(`guestSessions/${guestUid}`);
    tx.update(accessRef, { redeemedByUid: guestUid, redeemedAt: new Date() });
    tx.set(sessionRef, { ownerUid, code, createdAt: new Date() });
  });
}

// شكل sections افتراضي: كل الأقسام مقفولة (enabled=false, financial=false)
// — كل سيناريو بيفتح بس اللي محتاجه عن طريق overrides.
function guestSections(overrides = {}) {
  const base = {};
  ["equipment", "jobs", "drivers", "maintenance", "custody", "taxDeductions", "suppliers"]
    .forEach((s) => { base[s] = { enabled: false, financial: false }; });
  return { ...base, ...overrides };
}

function openSection() {
  return { enabled: true, financial: true };
}

const NOW_MS = Date.now();
const HOUR = 60 * 60 * 1000;

// وثيقة jobs صحيحة بالكامل — أساس نعدّل فيه لكل سيناريو تخريب حقل.
const validJob = {
  acres: 10,
  pricePerAcre: 200,
  fuelUsed: 5,
  fuelPriceAtJob: 15,
  amountPaid: 0,
  date: "2026-01-15",
  client: "عميل تجريبي",
  workType: "حرث",
};

async function seedFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${COMPANY_A}`).set({ email: "a@test.local", displayName: "شركة أ" });
    await db.doc(`users/${COMPANY_B}`).set({ email: "b@test.local", displayName: "شركة ب" });
    await db.doc(`users/${COMPANY_A}/jobs/job1`).set(validJob);
    await db.doc(`users/${COMPANY_B}/jobs/job1`).set(validJob);
    await db.doc(`backups/${COMPANY_A}`).set({ lastBackupAt: new Date() });
    await db.doc(`backups/${COMPANY_B}`).set({ lastBackupAt: new Date() });
    await db.doc(`backups/${COMPANY_A}/snapshots/snap1`).set({ createdAt: new Date() });
    await db.doc(`backups/${COMPANY_B}/snapshots/snap1`).set({ createdAt: new Date() });
    await db.doc("errorLogs/err1").set({ userId: COMPANY_A, message: "test", resolved: false });
    await db.doc("adminMessages/broadcast1").set({ targetUserId: null, text: "بث عام" });
    await db.doc("adminMessages/targetedA").set({ targetUserId: COMPANY_A, text: "لشركة أ بس" });
    await db.doc("adminMessages/targetedB").set({ targetUserId: COMPANY_B, text: "لشركة ب بس" });
  });
}

// ─── Guest Access fixtures ────────────────────────────────────────────────
// كل guestAccess doc هنا "نظيف" (redeemedByUid: null) — كل سيناريو محتاج
// استخدام فعلي بيعدي عن طريق redeemGuestCode() (اللي بيعدي فعليًا من قواعد
// الحماية)، مش بالـseed المباشر، عشان يبقى اختبار حقيقي للترانزاكشن نفسها.
//
// ⚠️ اختبارات ساعات اليوم (dailyWindow) بتحسب النافذة بالنسبة لوقت تشغيل
// السكريبت الفعلي (UTC) — فيه احتمال ضئيل جدًا (على حدود منتصف الليل UTC
// بالظبط) يحصل تضارب في الحساب. مقبول لأغراض هذا الاختبار.
async function seedGuestFixtures() {
  const now = new Date(NOW_MS);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  // نافذة "مفتوحة" فيها الوقت الحالي، ونافذة "مقفولة" بعيدة عنه — الاتنين
  // من غير ما يعدّوا حدود اليوم (0-1439) ومن غير عبور نص الليل.
  const openStart  = Math.max(0, nowMin - 30);
  const openEnd    = Math.min(1439, nowMin + 30);
  const closedStart = nowMin < 720 ? nowMin + 90 : 0;
  const closedEnd    = nowMin < 720 ? Math.min(1439, nowMin + 120) : Math.max(1, nowMin - 90);

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${GUEST_OWNER}`).set({ email: "guest-owner@test.local", displayName: "شركة اختبار الضيوف" });

    await db.doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).set({ ...validJob, client: "عميل مسموح" });
    await db.doc(`users/${GUEST_OWNER}/jobs/jobOtherClient`).set({ ...validJob, client: "عميل تاني" });
    await db.doc(`users/${GUEST_OWNER}/equipment/eq1`).set({ name: "جرار 1", fuelRate: 10, status: "active" });
    await db.doc(`users/${GUEST_OWNER}/drivers/drv1`).set({ name: "سائق 1", salary: 3000, status: "active" });
    await db.doc(`users/${GUEST_OWNER}/attendance/att1`).set({ status: "present", date: "2026-01-15", driverId: "drv1" });
    await db.doc(`users/${GUEST_OWNER}/maintenance/m1`).set({ cost: 500, equipmentId: "eq1", type: "زيت" });
    await db.doc(`users/${GUEST_OWNER}/payments/p1`).set({ amount: 100, jobId: "jobAllowedClient" });
    await db.doc(`users/${GUEST_OWNER}/custodyTransactions/c1`).set({ amount: 200, type: "deposit", category: "other" });
    await db.doc(`users/${GUEST_OWNER}/taxDeductions/t1`).set({ amount: 50, type: "tax" });
    await db.doc(`users/${GUEST_OWNER}/supplierInvoices/si1`).set({ amount: 300, supplierName: "مورد 1" });

    const baseAccess = {
      name: "كود اختبار",
      validFrom: new Date(NOW_MS - HOUR),
      validUntil: new Date(NOW_MS + HOUR),
      cancelled: false,
      redeemedByUid: null,
    };

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeFull`).set({
      ...baseAccess,
      sections: guestSections({
        equipment: openSection(), jobs: openSection(), drivers: openSection(),
        maintenance: openSection(), custody: openSection(), taxDeductions: openSection(), suppliers: openSection(),
      }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeEquipmentOnly`).set({
      ...baseAccess,
      sections: guestSections({ equipment: openSection() }),
    });

    // القسم مفعّل (enabled) بس البيانات المالية مقفولة — القرار المتفق
    // عليه: القسم كله يتخفى (مش يظهر بدون أرقام)، لأن Firestore Rules
    // مقدرش يخفي حقل بعينه جوه مستند مسموح أصلاً.
    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeFinancialOff`).set({
      ...baseAccess,
      sections: guestSections({ jobs: { enabled: true, financial: false } }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeExpired`).set({
      ...baseAccess,
      validFrom: new Date(NOW_MS - 2 * HOUR),
      validUntil: new Date(NOW_MS - HOUR),
      sections: guestSections({ equipment: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeNotStarted`).set({
      ...baseAccess,
      validFrom: new Date(NOW_MS + HOUR),
      validUntil: new Date(NOW_MS + 2 * HOUR),
      sections: guestSections({ equipment: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeCancelled`).set({
      ...baseAccess,
      cancelled: true,
      sections: guestSections({ equipment: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeDailyOpen`).set({
      ...baseAccess,
      dailyStartMinute: openStart,
      dailyEndMinute: openEnd,
      sections: guestSections({ equipment: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeDailyClosed`).set({
      ...baseAccess,
      dailyStartMinute: closedStart,
      dailyEndMinute: closedEnd,
      sections: guestSections({ equipment: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeClientFilter`).set({
      ...baseAccess,
      allowedClients: ["عميل مسموح"],
      sections: guestSections({ jobs: openSection() }),
    });

    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeSingleUse`).set({
      ...baseAccess,
      sections: guestSections({ equipment: openSection() }),
    });

    // كود منفصل مخصص لاختبار "الإلغاء بعد الاستخدام" — لازم يبقى كود لوحده
    // غير مستخدم في أي سيناريو تاني، عشان استخدامه في السيناريو ده يبقى
    // أول وآخر استخدام له فعلاً.
    await db.doc(`users/${GUEST_OWNER}/guestAccess/codeCancelAfterUse`).set({
      ...baseAccess,
      sections: guestSections({ equipment: openSection() }),
    });
  });
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: "agri-pro-rules-test",
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"),
    },
  });

  await seedFixtures();
  await seedGuestFixtures();

  console.log("\n── المجموعة 1: عزل البيانات بين الشركات (A ضد B) ──");
  {
    const asA = ctx(COMPANY_A);
    await test("isolation", "شركة أ تقدر تقرا بياناتها هي (positive control)", () =>
      assertSucceeds(asA.doc(`users/${COMPANY_A}/jobs/job1`).get())
    );
    await test("isolation", "شركة أ ممنوعة تقرا وظيفة شركة ب", () =>
      assertFails(asA.doc(`users/${COMPANY_B}/jobs/job1`).get())
    );
    await test("isolation", "شركة أ ممنوعة تكتب/تعدّل وظيفة شركة ب", () =>
      assertFails(asA.doc(`users/${COMPANY_B}/jobs/job1`).set(validJob))
    );
    await test("isolation", "شركة أ ممنوعة تمسح وظيفة شركة ب", () =>
      assertFails(asA.doc(`users/${COMPANY_B}/jobs/job1`).delete())
    );
    await test("isolation", "شركة أ ممنوعة تقرا ملف بروفايل شركة ب (users/{uid})", () =>
      assertFails(asA.doc(`users/${COMPANY_B}`).get())
    );
    await test("isolation", "شركة أ ممنوعة تعمل list لكل المستخدمين", () =>
      assertFails(asA.collection("users").get())
    );
    await test("isolation", "شركة أ ممنوعة تقرا حتى metadata النسخة الاحتياطية بتاعة شركة ب", () =>
      assertFails(asA.doc(`backups/${COMPANY_B}`).get())
    );
    await test("isolation", "شركة أ ممنوعة تقرا محتوى snapshot بتاع شركة ب", () =>
      assertFails(asA.doc(`backups/${COMPANY_B}/snapshots/snap1`).get())
    );
  }

  console.log("\n── المجموعة 2: مستخدم عادي ضد أدمن ──");
  {
    const asA = ctx(COMPANY_A);
    const asAdmin = ctx(ADMIN_UID);

    await test("admin-vs-user", "مستخدم عادي ممنوع يقرا سجل الأخطاء (errorLogs)", () =>
      assertFails(asA.collection("errorLogs").get())
    );
    await test("admin-vs-user", "مستخدم عادي ممنوع يعلّم خطأ كـ متحلّ حتى لو بتاعه هو", () =>
      assertFails(asA.doc("errorLogs/err1").update({ resolved: true }))
    );
    await test("admin-vs-user", "مستخدم عادي ممنوع يمسح سجل خطأ", () =>
      assertFails(asA.doc("errorLogs/err1").delete())
    );
    await test("admin-vs-user", "مستخدم عادي ممنوع ينشئ رسالة أدمن (adminMessages)", () =>
      assertFails(asA.doc("adminMessages/fromUser").set({ targetUserId: null, text: "hack" }))
    );
    await test("admin-vs-user", "مستخدم عادي يقدر يقرا رسالة بث عامة موجّهة لكل الناس", () =>
      assertSucceeds(asA.doc("adminMessages/broadcast1").get())
    );
    await test("admin-vs-user", "مستخدم عادي يقدر يقرا رسالة موجّهة له هو بالتحديد", () =>
      assertSucceeds(asA.doc("adminMessages/targetedA").get())
    );
    await test("admin-vs-user", "مستخدم عادي ممنوع يقرا رسالة موجّهة لشركة تانية بالتحديد", () =>
      assertFails(asA.doc("adminMessages/targetedB").get())
    );

    await test("admin-vs-user", "الأدمن يقدر يقرا سجل الأخطاء كامل", () =>
      assertSucceeds(asAdmin.collection("errorLogs").get())
    );
    await test("admin-vs-user", "الأدمن يقدر يعلّم خطأ كـ متحلّ", () =>
      assertSucceeds(asAdmin.doc("errorLogs/err1").update({ resolved: true }))
    );
    await test("admin-vs-user", "الأدمن يقدر يعمل list لكل المستخدمين", () =>
      assertSucceeds(asAdmin.collection("users").get())
    );
    await test("admin-vs-user", "الأدمن يقدر يقرا ملف بروفايل أي شركة (users/{uid})", () =>
      assertSucceeds(asAdmin.doc(`users/${COMPANY_A}`).get())
    );
    // audit finding F-003 (Phase 5): كانت هنا assertFails — الأدمن ما
    // كانش يقدر يقرا محتوى subcollection بيانات شركة (jobs/payments/
    // salaryEntries...) خالص، بس بروفايلها الأساسي. اتضافت || isAdmin()
    // لقاعدة القراءة العامة (match /{document=**}) في firestore.rules
    // عشان يقدر تقرير فحص تكامل البيانات المجمّع (adminIntegrityService)
    // يقرا بيانات كل الشركات. القراءة بس — لسه مفيش أي مسار كتابة جديد
    // للأدمن على بيانات شركة تانية.
    await test(
      "admin-vs-user",
      "الأدمن يقدر يقرا محتوى subcollection بيانات أي شركة (jobs) — لازمة لتقرير فحص التكامل المجمّع",
      () => assertSucceeds(asAdmin.doc(`users/${COMPANY_A}/jobs/job1`).get())
    );
    await test(
      "admin-vs-user",
      "شركة أ لسه ممنوعة تقرا subcollection بيانات شركة ب حتى بعد إضافة صلاحية الأدمن (مش هي الأدمن)",
      () => assertFails(asA.doc(`users/${COMPANY_B}/jobs/job1`).get())
    );
  }

  console.log("\n── المجموعة 3: مستندات بحقول متلاعب بيها (تخريب متعمد) ──");
  {
    const asA = ctx(COMPANY_A);

    await test("tampering", "إنشاء وظيفة ببيانات صحيحة (positive control)", () =>
      assertSucceeds(asA.doc(`users/${COMPANY_A}/jobs/valid1`).set(validJob))
    );
    await test("tampering", "ممنوع إنشاء وظيفة بـ pricePerAcre سالب", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/jobs/neg1`).set({ ...validJob, pricePerAcre: -500 }))
    );
    await test("tampering", "ممنوع إنشاء وظيفة بـ acres نوعه نص مش رقم", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/jobs/bad1`).set({ ...validJob, acres: "كتير" }))
    );
    await test("tampering", "ممنوع إنشاء وظيفة من غير acres أصلاً (حقل مطلوب)", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/jobs/missing1`).set({ pricePerAcre: 200 }))
    );
    await test("tampering", "ممنوع إنشاء وظيفة بمبلغ فوق السقف المسموح (> 1,000,000,000)", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/jobs/huge1`).set({ ...validJob, pricePerAcre: 5000000000 }))
    );
    await test("tampering", "ممنوع إنشاء قيد راتب بـ type مش من الأنواع المسموحة", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/salaryEntries/bad1`).set({ amount: 100, type: "غير_موجود" }))
    );
    await test("tampering", "ممنوع إنشاء سجل خطأ منسوب لمستخدم تاني (userId مزوّر)", () =>
      assertFails(asA.doc("errorLogs/forged1").set({ userId: COMPANY_B, message: "spoofed" }))
    );
    await test("tampering", "ممنوع تعديل notes بنص أطول من 3000 حرف", () =>
      assertFails(asA.doc(`users/${COMPANY_A}/jobs/job1`).update({ notes: "x".repeat(3001) }))
    );
  }

  console.log("\n── المجموعة 4: الوصول للضيوف (Guest Access — read-only) ──");
  {
    // (أ) استخدام الكود (الترانزاكشن) — الحالات العادية بتنجح، والحالات
    // اللي المفروض تتمنع (منتهي/لسه ماوصلش/ملغي) بترفض من وقت الاستخدام
    // نفسه مش من وقت القراءة بس.
    await test("guest-access", "استخدام كود صالح بينجح (ترانزاكشن guestAccess+guestSessions)", () =>
      assertSucceeds(redeemGuestCode("guest-full1", GUEST_OWNER, "codeFull"))
    );
    await test("guest-access", "استخدام كود منتهي الصلاحية بيترفض", () =>
      assertFails(redeemGuestCode("guest-expired1", GUEST_OWNER, "codeExpired"))
    );
    await test("guest-access", "استخدام كود لسه ماوصلش وقته بيترفض", () =>
      assertFails(redeemGuestCode("guest-notstarted1", GUEST_OWNER, "codeNotStarted"))
    );
    await test("guest-access", "استخدام كود ملغي (cancelled) بيترفض حتى لو جوه الفترة", () =>
      assertFails(redeemGuestCode("guest-cancelled1", GUEST_OWNER, "codeCancelled"))
    );
    await test("guest-access", "استخدام نفس الكود مرة تانية من ضيف تاني بيترفض (استخدام واحد بس)", async () => {
      await assertSucceeds(redeemGuestCode("guest-single1", GUEST_OWNER, "codeSingleUse"));
      await assertFails(redeemGuestCode("guest-single2", GUEST_OWNER, "codeSingleUse"));
    });

    // (ب) القراءة حسب الأقسام المفعّلة
    await test("guest-access", "ضيف بكود كامل الصلاحيات يقدر يقرا equipment", () =>
      assertSucceeds(guestCtx("guest-full1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get())
    );
    await test("guest-access", "ضيف بكود كامل الصلاحيات يقدر يقرا jobs/payments/drivers/maintenance/custody/tax/suppliers", async () => {
      const g = guestCtx("guest-full1");
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/payments/p1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/drivers/drv1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/attendance/att1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/maintenance/m1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/custodyTransactions/c1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/taxDeductions/t1`).get());
      await assertSucceeds(g.doc(`users/${GUEST_OWNER}/supplierInvoices/si1`).get());
    });

    await test("guest-access", "استخدام كود قسم واحد بس (equipment) بينجح", () =>
      assertSucceeds(redeemGuestCode("guest-equip1", GUEST_OWNER, "codeEquipmentOnly"))
    );
    await test("guest-access", "ضيف equipment-only يقدر يقرا equipment", () =>
      assertSucceeds(guestCtx("guest-equip1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get())
    );
    await test("guest-access", "ضيف equipment-only ممنوع يقرا jobs (قسم مش مفعّل ليه)", () =>
      assertFails(guestCtx("guest-equip1").doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).get())
    );

    await test("guest-access", "استخدام كود القسم مفعّل لكن البيانات المالية مقفولة بينجح", () =>
      assertSucceeds(redeemGuestCode("guest-finoff1", GUEST_OWNER, "codeFinancialOff"))
    );
    await test(
      "guest-access",
      "ضيف: القسم enabled لكن financial=false ⇒ القسم كله بيتخفى (قرار متفق عليه، مش bug)",
      () => assertFails(guestCtx("guest-finoff1").doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).get())
    );

    // (ج) الوقت — الفترة العامة + ساعات اليوم
    await test("guest-access", "ضيف بكود منتهي الصلاحية ممنوع يقرا أي حاجة حتى لو كان اتسجل قبل كده (مفيش guestSession أصلاً لأن الاستخدام اتمنع)", () =>
      assertFails(guestCtx("guest-expired1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get())
    );
    await test("guest-access", "استخدام كود بساعات يوم اختيارية بينجح بغض النظر عن الساعة الحالية", async () => {
      await assertSucceeds(redeemGuestCode("guest-dailyopen1", GUEST_OWNER, "codeDailyOpen"));
      await assertSucceeds(redeemGuestCode("guest-dailyclosed1", GUEST_OWNER, "codeDailyClosed"));
    });
    await test("guest-access", "ضيف جوه نافذة الساعات المسموحة يقدر يقرا", () =>
      assertSucceeds(guestCtx("guest-dailyopen1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get())
    );
    await test("guest-access", "ضيف بره نافذة الساعات المسموحة ممنوع يقرا حتى لو الكود لسه ساري عمومًا", () =>
      assertFails(guestCtx("guest-dailyclosed1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get())
    );

    // (د) الإلغاء اليدوي — لازم يترفض من وقت الاستخدام (اتغطى فوق)، وكمان
    // لو الإلغاء حصل بعد الاستخدام (على guestSession شغالة أصلاً).
    await test("guest-access", "إلغاء كود بعد استخدامه بيقطع القراءة فورًا حتى بدون refresh", async () => {
      await assertSucceeds(redeemGuestCode("guest-cancel-after1", GUEST_OWNER, "codeCancelAfterUse"));
      await assertSucceeds(guestCtx("guest-cancel-after1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get());
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(`users/${GUEST_OWNER}/guestAccess/codeCancelAfterUse`).update({ cancelled: true });
      });
      await assertFails(guestCtx("guest-cancel-after1").doc(`users/${GUEST_OWNER}/equipment/eq1`).get());
    });

    // (هـ) فلترة العملاء (jobs بس)
    await test("guest-access", "استخدام كود بفلترة عملاء بينجح", () =>
      assertSucceeds(redeemGuestCode("guest-client1", GUEST_OWNER, "codeClientFilter"))
    );
    await test("guest-access", "ضيف بفلترة عملاء يقدر يقرا وظيفة العميل المسموح بيه", () =>
      assertSucceeds(guestCtx("guest-client1").doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).get())
    );
    await test("guest-access", "ضيف بفلترة عملاء ممنوع يقرا وظيفة عميل تاني", () =>
      assertFails(guestCtx("guest-client1").doc(`users/${GUEST_OWNER}/jobs/jobOtherClient`).get())
    );
    await test(
      "guest-access",
      "ضيف بفلترة عملاء: list بشرط where('client','in',[...]) مطابق بينجح، وبدون الشرط بيترفض بالكامل (Firestore rules مش filters)",
      async () => {
        const g = guestCtx("guest-client1");
        await assertSucceeds(
          g.collection(`users/${GUEST_OWNER}/jobs`).where("client", "in", ["عميل مسموح"]).get()
        );
        await assertFails(g.collection(`users/${GUEST_OWNER}/jobs`).get());
      }
    );

    // (و) مفيش أي كتابة نهائيًا حتى في الأقسام المسموح بيها بالقراءة
    await test("guest-access", "ضيف كامل الصلاحيات ممنوع يعمل create/update/delete على equipment", async () => {
      const g = guestCtx("guest-full1");
      await assertFails(g.doc(`users/${GUEST_OWNER}/equipment/hack1`).set({ name: "مزوّر" }));
      await assertFails(g.doc(`users/${GUEST_OWNER}/equipment/eq1`).update({ name: "معدّل" }));
      await assertFails(g.doc(`users/${GUEST_OWNER}/equipment/eq1`).delete());
    });
    await test("guest-access", "ضيف كامل الصلاحيات ممنوع يعمل create/update/delete على jobs", async () => {
      const g = guestCtx("guest-full1");
      await assertFails(g.doc(`users/${GUEST_OWNER}/jobs/hack1`).set(validJob));
      await assertFails(g.doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).update({ notes: "معدّل" }));
      await assertFails(g.doc(`users/${GUEST_OWNER}/jobs/jobAllowedClient`).delete());
    });
    await test("guest-access", "ضيف ممنوع يعدّل guestAccess بتاعه هو نفسه (زي يمدّ الصلاحية بنفسه)", () =>
      assertFails(guestCtx("guest-full1").doc(`users/${GUEST_OWNER}/guestAccess/codeFull`).update({
        validUntil: new Date(NOW_MS + 100 * HOUR),
      }))
    );

    // (ز) مفيش enumeration للأكواد، ومفيش تسريب عبر العزل بين الشركات
    await test("guest-access", "ضيف ممنوع يعمل list لكل أكواد guestAccess بتاعة المالك", () =>
      assertFails(guestCtx("guest-full1").collection(`users/${GUEST_OWNER}/guestAccess`).get())
    );
    await test("guest-access", "ضيف كود شركة الاختبار ممنوع يقرا بيانات شركة تانية (COMPANY_A) خالص", () =>
      assertFails(guestCtx("guest-full1").doc(`users/${COMPANY_A}/jobs/job1`).get())
    );

    // (ح) بروفايل المالك (users/{uid}) — لعرض بانر "انت بتشوف بيانات [الشركة]"
    await test("guest-access", "ضيف بجلسة صالحة يقدر يقرا بروفايل المالك (اسم/إيميل بس)", () =>
      assertSucceeds(guestCtx("guest-full1").doc(`users/${GUEST_OWNER}`).get())
    );
    await test("guest-access", "ضيف بعد إلغاء الكود ممنوع يقرا بروفايل المالك تاني", () =>
      assertFails(guestCtx("guest-cancel-after1").doc(`users/${GUEST_OWNER}`).get())
    );

    // (ط) واجهة إعدادات المالك (Phase 3) — إنشاء/إلغاء/تمديد/حذف كود
    // فعليًا عن طريق القواعد الحقيقية (isOwner + isValidNewGuestAccess /
    // isValidOwnerGuestAccessUpdate)، مش seed مباشر زي seedGuestFixtures
    // فوق. الاختباران "كان بيفشل قبل إصلاح Phase 3" بيغطوا باگ حقيقي كان
    // موجود في isValidOwnerGuestAccessUpdate (مقارنة after.redeemedAt ==
    // before.redeemedAt من غير فحص 'in' أول — الحقل مش موجود أصلاً قبل أول
    // استخدام للكود، فأي إلغاء/تمديد لكود لسه ماتستخدمش كان هيترفض دايمًا).
    await test("guest-access", "المالك يقدر ينشئ كود جديد صالح", () =>
      assertSucceeds(ctx(GUEST_OWNER).doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerCreate1`).set({
        name: "كود جديد",
        validFrom: new Date(NOW_MS - HOUR),
        validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }),
        cancelled: false,
        redeemedByUid: null,
      }))
    );
    await test("guest-access", "المالك ممنوع ينشئ كود validUntil قبل validFrom", () =>
      assertFails(ctx(GUEST_OWNER).doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerBad1`).set({
        name: "كود غلط",
        validFrom: new Date(NOW_MS + HOUR),
        validUntil: new Date(NOW_MS - HOUR),
        sections: guestSections({ equipment: openSection() }),
        cancelled: false,
        redeemedByUid: null,
      }))
    );
    await test("guest-access", "المالك ممنوع ينشئ كود بحقل redeemedByUid مش null من الأول", () =>
      assertFails(ctx(GUEST_OWNER).doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerBad2`).set({
        name: "كود غلط",
        validFrom: new Date(NOW_MS - HOUR),
        validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }),
        cancelled: false,
        redeemedByUid: "حد",
      }))
    );
    await test("guest-access", "المالك يقدر يلغي كود لسه ماتستخدمش (كان بيفشل قبل إصلاح Phase 3)", async () => {
      const owner = ctx(GUEST_OWNER);
      await owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerCancel1`).set({
        name: "كود هيتلغي", validFrom: new Date(NOW_MS - HOUR), validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }), cancelled: false, redeemedByUid: null,
      });
      await assertSucceeds(owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerCancel1`).update({ cancelled: true }));
    });
    await test("guest-access", "المالك يقدر يمدّ صلاحية كود لسه ماتستخدمش (كان بيفشل قبل إصلاح Phase 3)", async () => {
      const owner = ctx(GUEST_OWNER);
      await owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerExtend1`).set({
        name: "كود هيتمدّ", validFrom: new Date(NOW_MS - HOUR), validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }), cancelled: false, redeemedByUid: null,
      });
      await assertSucceeds(owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerExtend1`).update({
        validUntil: new Date(NOW_MS + 10 * HOUR),
      }));
    });
    await test("guest-access", "المالك ممنوع يحط قيمة لـredeemedByUid بنفسه وقت الإلغاء/التمديد", async () => {
      const owner = ctx(GUEST_OWNER);
      await owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerHack1`).set({
        name: "محاولة تلاعب", validFrom: new Date(NOW_MS - HOUR), validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }), cancelled: false, redeemedByUid: null,
      });
      await assertFails(owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerHack1`).update({
        redeemedByUid: "guest-fake",
      }));
    });
    await test("guest-access", "المالك يقدر يلغي كود اتستخدم فعلاً من غير ما يلمس redeemedByUid/redeemedAt", () =>
      assertSucceeds(ctx(GUEST_OWNER).doc(`users/${GUEST_OWNER}/guestAccess/codeFull`).update({ cancelled: true }))
    );
    await test("guest-access", "المالك يقدر يمسح كود", async () => {
      const owner = ctx(GUEST_OWNER);
      await owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerDelete1`).set({
        name: "كود هيتمسح", validFrom: new Date(NOW_MS - HOUR), validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }), cancelled: false, redeemedByUid: null,
      });
      await assertSucceeds(owner.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerDelete1`).delete());
    });
    await test("guest-access", "مالك تاني (شركة مختلفة) ممنوع يعمل أي حاجة على أكواد شركة الاختبار", async () => {
      const other = ctx(COMPANY_A);
      await assertFails(other.doc(`users/${GUEST_OWNER}/guestAccess/codeFull`).update({ cancelled: true }));
      await assertFails(other.doc(`users/${GUEST_OWNER}/guestAccess/codeOwnerHack2`).set({
        name: "تلاعب", validFrom: new Date(NOW_MS - HOUR), validUntil: new Date(NOW_MS + HOUR),
        sections: guestSections({ equipment: openSection() }), cancelled: false, redeemedByUid: null,
      }));
    });
  }

  await testEnv.cleanup();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل، من إجمالي ${passed + failed}`);
  if (failed > 0) {
    console.log("\nالاختبارات اللي فشلت:");
    failures.forEach((f) => {
      console.log(`  [${f.groupLabel}] ${f.name}`);
      console.log(`    ${f.err.message}`);
    });
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("فشل تشغيل الاختبارات نفسها (مش بالضرورة مشكلة في القواعد):", err);
  process.exitCode = 1;
});
