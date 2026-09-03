// scripts/seedDemoAccount.js
//
// بيعمل (أو يحدّث) حساب تجريبي واحد لشركة زراعي برو، ويملأه ببيانات
// واقعية-شكل عبر كل الموديولات الرئيسية، عشان شركة تقدر تسجل دخول
// وتستكشف التطبيق فورًا من غير ما تلاقي شاشات فاضية.
//
// ما بيلمسش:
//   - أي كود تاني في src/ (مفيش تغيير في البنية أو الميزات الحالية).
//   - أي مستخدم حقيقي أو بيانات إنتاج — بيشتغل بس على uid واحد جديد
//     (أو موجود بنفس الإيميل التجريبي) ومفيش أي query بتلمس مستخدمين
//     تانيين.
//   - firestore.rules أو ADMIN_UIDS — الحساب التجريبي عادي 100%، مش أدمن.
//
// نفس نمط السكريبتات التانية في المشروع (backfillUserProfiles.js,
// migrate-to-subcollections.js): مفتاح الأدمن بياخد كـ argument وقت
// التشغيل، مش مكتوب هنا أبداً.
//
// طريقة التشغيل:
// ------------------------------------------------------
// 1) ثبّت firebase-admin مرة واحدة لو مش متثبتة (مش من ضمن
//    dependencies بتاعة التطبيق نفسه، السكريبت ده بيتشغل من جهازك بس):
//      npm install --no-save firebase-admin
//
// 2) شغّل السكريبت وحط مسار مفتاح الـ service account بتاعك:
//      node scripts/seedDemoAccount.js /path/to/serviceAccountKey.json
//
//    اختياريًا تقدر تحدد إيميل وباسورد مختلفين للحساب التجريبي:
//      node scripts/seedDemoAccount.js /path/to/key.json demo@example.com "P@ssw0rd123"
//
// السكريبت idempotent — أي تشغيل تاني بيحدّث نفس المستندات (IDs ثابتة
// بتبدأ بـ demo-) بدل ما يكرر البيانات من الأول.

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("path");

const keyPathArg = process.argv[2];
if (!keyPathArg) {
  console.error("استخدام: node scripts/seedDemoAccount.js <path-to-service-account.json> [email] [password]");
  process.exit(1);
}

const DEMO_EMAIL    = process.argv[3] || "demo@zera3ypro.app";
const DEMO_PASSWORD = process.argv[4] || "Demo@Zera3y2026";
const DEMO_NAME     = "حساب تجريبي - زراعي برو";

const serviceAccount = require(path.resolve(keyPathArg));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db   = getFirestore();

// ─── أدوات مساعدة ──────────────────────────────────────────────────────────

/** تاريخ ISO (YYYY-MM-DD) قبل N يوم من النهاردة — نفس صيغة todayISO() في التطبيق. */
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

// كل مستندات الـ seed ليها IDs ثابتة (demo-...) عشان تشغيل السكريبت
// تاني يحدّث نفس البيانات بدل ما يكررها.
const setMany = async (colRef, docs) => {
  const batch = db.batch();
  docs.forEach(({ id, ...data }) => batch.set(colRef.doc(id), data, { merge: true }));
  await batch.commit();
};

async function main() {
  // ── 1) حساب Firebase Auth ────────────────────────────────────────────
  let uid;
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, { password: DEMO_PASSWORD, displayName: DEMO_NAME });
    console.log(`✔ الحساب موجود بالفعل (${DEMO_EMAIL}) — تم تحديث الباسورد والاسم. uid=${uid}`);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const created = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_NAME,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`✔ اتعمل حساب جديد (${DEMO_EMAIL}) — uid=${uid}`);
  }

  const userDoc = db.collection("users").doc(uid);

  // ── 2) بروفايل المستخدم (زي userProfileService.touch بالظبط) ──────────
  await userDoc.set({
    uid,
    email: DEMO_EMAIL,
    displayName: DEMO_NAME,
    createdAt: Timestamp.now(),
    lastActiveAt: Timestamp.now(),
    isDemo: true, // مش حقل بيستخدمه التطبيق حالياً — علامة توضيحية بس لو حد فتح الداتا مباشرة
  }, { merge: true });

  // ── 3) الإعدادات (سعر السولار) ─────────────────────────────────────────
  await userDoc.collection("meta").doc("settings").set({
    fuelPrice: 13.5,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  // ── 4) السائقون ─────────────────────────────────────────────────────────
  const drivers = [
    { id: "demo-driver-1", name: "محمد علي حسن",     phone: "01012345671", status: "active",   salary: 4500 },
    { id: "demo-driver-2", name: "أحمد سيد إبراهيم",  phone: "01098765432", status: "active",   salary: 4200 },
    { id: "demo-driver-3", name: "عبد الرحمن صابر",   phone: "01123456789", status: "active",   salary: 4000 },
    { id: "demo-driver-4", name: "كريم فتحي عبد الله", phone: "01234567890", status: "inactive", salary: 3800 },
    { id: "demo-driver-5", name: "سامي جمال عثمان",   phone: "01555555512", status: "active",   salary: 4600 },
  ];
  await setMany(userDoc.collection("drivers"), drivers.map((d) => ({
    ...d, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── 5) المعدات (أساسية + ملحقات) ───────────────────────────────────────
  const equipment = [
    { id: "demo-eq-1", category: "base", name: "جرار ماسي فيرجسون 290", type: "جرار",
      driverId: "demo-driver-1", customDriverName: "", fuelRate: 5,
      parentEquipmentId: "", customParentName: "", status: "active",
      lastGreaseDate: "", greaseHistory: [], lastOilChangeMeter: 1200, oilChangeHistory: [] },
    { id: "demo-eq-2", category: "base", name: "جرار نيوهولاند TD95", type: "جرار",
      driverId: "demo-driver-2", customDriverName: "", fuelRate: 4.5,
      parentEquipmentId: "", customParentName: "", status: "active",
      lastGreaseDate: "", greaseHistory: [], lastOilChangeMeter: 800, oilChangeHistory: [] },
    { id: "demo-eq-3", category: "base", name: "حصادة كلاس دومينيتور", type: "حصادة",
      driverId: "demo-driver-5", customDriverName: "", fuelRate: 9,
      parentEquipmentId: "", customParentName: "", status: "active",
      lastGreaseDate: "", greaseHistory: [], lastOilChangeMeter: 300, oilChangeHistory: [] },
    { id: "demo-eq-4", category: "attachment", name: "محراث قلاب 5 سلاح", type: "معدة حرث",
      driverId: "", customDriverName: "", fuelRate: 0,
      parentEquipmentId: "demo-eq-1", customParentName: "", status: "active",
      lastGreaseDate: daysAgo(20), greaseHistory: [], lastOilChangeMeter: "", oilChangeHistory: [] },
    { id: "demo-eq-5", category: "attachment", name: "دسك ثقيل 24 قرص", type: "معدة حرث",
      driverId: "", customDriverName: "", fuelRate: 0,
      parentEquipmentId: "demo-eq-2", customParentName: "", status: "maintenance",
      lastGreaseDate: daysAgo(45), greaseHistory: [], lastOilChangeMeter: "", oilChangeHistory: [] },
    { id: "demo-eq-6", category: "attachment", name: "رشاشة معلقة 400 لتر", type: "معدة زراعة",
      driverId: "", customDriverName: "", fuelRate: 0,
      parentEquipmentId: "demo-eq-1", customParentName: "", status: "active",
      lastGreaseDate: daysAgo(10), greaseHistory: [], lastOilChangeMeter: "", oilChangeHistory: [] },
  ];
  await setMany(userDoc.collection("equipment"), equipment.map((e) => ({
    ...e, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── 6) الشغلانات (Jobs) ─────────────────────────────────────────────────
  const jobs = [
    { id: "demo-job-1",  equipmentId: "demo-eq-1", driverId: "demo-driver-1", client: "عزبة الشيخ سالم",             workType: "المحراث",  acres: 12, pricePerAcre: 250, fuelUsed: 60, date: daysAgo(45), notes: "حرث أرض قطن", amountPaid: 0 },
    { id: "demo-job-2",  equipmentId: "demo-eq-2", driverId: "demo-driver-2", client: "مزرعة النيل الأخضر",          workType: "الدسك",    acres: 8,  pricePerAcre: 220, fuelUsed: 36, date: daysAgo(38), notes: "",                    amountPaid: 0 },
    { id: "demo-job-3",  equipmentId: "demo-eq-3", driverId: "demo-driver-5", client: "شركة الوادي الأخضر للاستصلاح", workType: "كومباين",  acres: 20, pricePerAcre: 300, fuelUsed: 150, date: daysAgo(30), notes: "حصاد قمح",            amountPaid: 0 },
    { id: "demo-job-4",  equipmentId: "demo-eq-1", driverId: "demo-driver-1", client: "أحمد الفار",                 workType: "الرشاشة",  acres: 6,  pricePerAcre: 180, fuelUsed: 20, date: daysAgo(22), notes: "رش مبيد فطري",        amountPaid: 0 },
    { id: "demo-job-5",  equipmentId: "demo-eq-2", driverId: "demo-driver-2", client: "عزبة الشيخ سالم",             workType: "بلانتر ذرة", acres: 10, pricePerAcre: 260, fuelUsed: 42, date: daysAgo(18), notes: "",                    amountPaid: 0 },
    { id: "demo-job-6",  equipmentId: "demo-eq-1", driverId: "demo-driver-1", client: "مصطفى عبد الله",             workType: "القلاب",   acres: 15, pricePerAcre: 240, fuelUsed: 70, date: daysAgo(14), notes: "",                    amountPaid: 0 },
    { id: "demo-job-7",  equipmentId: "demo-eq-3", driverId: "demo-driver-5", client: "مزرعة النيل الأخضر",          workType: "هولمر حصاد", acres: 18, pricePerAcre: 280, fuelUsed: 130, date: daysAgo(9),  notes: "حصاد أرز",            amountPaid: 0 },
    { id: "demo-job-8",  equipmentId: "demo-eq-2", driverId: "demo-driver-2", client: "أحمد الفار",                 workType: "معدة تسوية", acres: 7,  pricePerAcre: 200, fuelUsed: 30, date: daysAgo(5),  notes: "تسوية بالليزر",       amountPaid: 0 },
    { id: "demo-job-9",  equipmentId: "demo-eq-1", driverId: "demo-driver-1", client: "شركة الوادي الأخضر للاستصلاح", workType: "بلانتر بنجر", acres: 11, pricePerAcre: 255, fuelUsed: 48, date: daysAgo(2), notes: "",                    amountPaid: 0 },
    { id: "demo-job-10", equipmentId: "demo-eq-3", driverId: "demo-driver-5", client: "مصطفى عبد الله",             workType: "بدارة خدمة", acres: 5,  pricePerAcre: 190, fuelUsed: 18, date: daysAgo(0), notes: "شغلانة النهاردة",     amountPaid: 0 },
  ];
  await setMany(userDoc.collection("jobs"), jobs.map((j) => ({
    ...j, createdAt: new Date().toISOString(), updatedAt: Timestamp.now(),
  })));

  // ── 7) الدفعات (Payments) — مرتبطة بالـ jobs أعلاه ────────────────────
  // job-1 (revenue 3000): متأخر من 45 يوم ومدفوع جزئي بس → أوفرديو ديون فعلي.
  // job-2 (1760): مدفوع بالكامل. job-3 (6000): مدفوع جزئي كبير.
  // job-4..9: مدفوعات جزئية متفاوتة. job-10 (النهاردة): لسه مش مدفوع خالص.
  const payments = [
    { id: "demo-pay-1",  jobId: "demo-job-1", amount: 1500, date: daysAgo(40), notes: "دفعة أولى" },
    { id: "demo-pay-2",  jobId: "demo-job-2", amount: 1760, date: daysAgo(35), notes: "سداد كامل" },
    { id: "demo-pay-3",  jobId: "demo-job-3", amount: 4000, date: daysAgo(27), notes: "دفعة تحت الحساب" },
    { id: "demo-pay-4",  jobId: "demo-job-3", amount: 1500, date: daysAgo(15), notes: "دفعة تانية" },
    { id: "demo-pay-5",  jobId: "demo-job-4", amount: 1080, date: daysAgo(20), notes: "سداد كامل" },
    { id: "demo-pay-6",  jobId: "demo-job-5", amount: 1500, date: daysAgo(16), notes: "" },
    { id: "demo-pay-7",  jobId: "demo-job-6", amount: 3600, date: daysAgo(12), notes: "سداد كامل" },
    { id: "demo-pay-8",  jobId: "demo-job-7", amount: 3000, date: daysAgo(7),  notes: "دفعة جزئية" },
    { id: "demo-pay-9",  jobId: "demo-job-8", amount: 1400, date: daysAgo(4),  notes: "سداد كامل" },
    { id: "demo-pay-10", jobId: "demo-job-9", amount: 1000, date: daysAgo(1),  notes: "دفعة تحت الحساب" },
  ];
  await setMany(userDoc.collection("payments"), payments.map((p) => ({
    ...p, createdAt: new Date().toISOString(),
  })));

  // ── 8) الصيانة ────────────────────────────────────────────────────────
  const maintenance = [
    { id: "demo-maint-1", equipmentId: "demo-eq-1", type: "تغيير زيت",  cost: 850,  date: daysAgo(60), notes: "" },
    { id: "demo-maint-2", equipmentId: "demo-eq-2", type: "إطارات",    cost: 3200, date: daysAgo(50), notes: "تغيير إطارين خلفي" },
    { id: "demo-maint-3", equipmentId: "demo-eq-3", type: "فلاتر",     cost: 400,  date: daysAgo(25), notes: "" },
    { id: "demo-maint-4", equipmentId: "demo-eq-5", type: "ميكانيكي", cost: 1500, date: daysAgo(3),  notes: "قيد الإصلاح دلوقتي — الدسك واقف في الورشة" },
    { id: "demo-maint-5", equipmentId: "demo-eq-1", type: "بطارية",   cost: 1200, date: daysAgo(90), notes: "" },
  ];
  await setMany(userDoc.collection("maintenance"), maintenance.map((m) => ({
    ...m, createdAt: new Date().toISOString(), updatedAt: Timestamp.now(),
  })));

  // ── 9) تكاليف السائقين ────────────────────────────────────────────────
  const driverCosts = [
    { id: "demo-dcost-1", driverId: "demo-driver-1", type: "سلفة",       amount: 500,  date: daysAgo(20), notes: "" },
    { id: "demo-dcost-2", driverId: "demo-driver-2", type: "بدل وقود",   amount: 200,  date: daysAgo(15), notes: "" },
    { id: "demo-dcost-3", driverId: "demo-driver-5", type: "تأمين",      amount: 300,  date: daysAgo(10), notes: "قسط تأمين شهري" },
    { id: "demo-dcost-4", driverId: "demo-driver-1", type: "غرامة",      amount: 150,  date: daysAgo(6),  notes: "مخالفة مرورية" },
    { id: "demo-dcost-5", driverId: "demo-driver-3", type: "سلفة",       amount: 400,  date: daysAgo(3),  notes: "" },
  ];
  await setMany(userDoc.collection("driverCosts"), driverCosts.map((c) => ({
    ...c, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── 10) الرواتب ──────────────────────────────────────────────────────
  const salaryEntries = [
    { id: "demo-sal-1",  driverId: "demo-driver-1", type: "base",          amount: 4500, date: daysAgo(35), reason: "راتب شهر سابق", notes: "", paid: true },
    { id: "demo-sal-2",  driverId: "demo-driver-1", type: "bonus",         amount: 300,  date: daysAgo(35), reason: "حافز أداء",     notes: "", paid: true },
    { id: "demo-sal-3",  driverId: "demo-driver-1", type: "base",          amount: 4500, date: daysAgo(5),  reason: "راتب الشهر الحالي", notes: "", paid: true },
    { id: "demo-sal-4",  driverId: "demo-driver-2", type: "base",          amount: 4200, date: daysAgo(35), reason: "راتب شهر سابق", notes: "", paid: true },
    { id: "demo-sal-5",  driverId: "demo-driver-2", type: "advance",       amount: 1000, date: daysAgo(20), reason: "سلفة",          notes: "", paid: true },
    { id: "demo-sal-6",  driverId: "demo-driver-2", type: "advance_repay", amount: 500,  date: daysAgo(5),  reason: "سداد سلفة",     notes: "", paid: true },
    { id: "demo-sal-7",  driverId: "demo-driver-3", type: "base",          amount: 4000, date: daysAgo(5),  reason: "راتب الشهر الحالي", notes: "", paid: true },
    { id: "demo-sal-8",  driverId: "demo-driver-3", type: "deduction",     amount: 200,  date: daysAgo(5),  reason: "تأخير",         notes: "", paid: true },
    { id: "demo-sal-9",  driverId: "demo-driver-5", type: "base",          amount: 4600, date: daysAgo(5),  reason: "راتب الشهر الحالي", notes: "", paid: true },
    { id: "demo-sal-10", driverId: "demo-driver-5", type: "bonus",         amount: 500,  date: daysAgo(2),  reason: "ساعات إضافية",  notes: "", paid: true },
  ];
  await setMany(userDoc.collection("salaryEntries"), salaryEntries.map((s) => ({
    ...s, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── 11) الحضور والغياب — آخر 7 أيام لكل سائق نشط ───────────────────────
  const activeDrivers = drivers.filter((d) => d.status === "active");
  const attendanceStatuses = ["present", "present", "present", "late", "present", "absent", "half"];
  const attendance = [];
  activeDrivers.forEach((d, di) => {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      attendance.push({
        id: `demo-att-${di + 1}-${dayOffset}`,
        driverId: d.id,
        date: daysAgo(dayOffset),
        status: attendanceStatuses[(dayOffset + di) % attendanceStatuses.length],
        notes: "",
      });
    }
  });
  await setMany(userDoc.collection("attendance"), attendance.map((a) => ({
    ...a, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── 12) العهدة ───────────────────────────────────────────────────────
  // إجمالي: 50,000 إيداع - (12,150 معدات + 2,550 سائقين + 1,000 أخرى) = رصيد موجب واقعي
  const custodyTransactions = [
    { id: "demo-cust-1", type: "deposit", amount: 50000, date: daysAgo(55), source: "صاحب الشركة", notes: "عهدة الشهر" },
    { id: "demo-cust-2", type: "expense", category: "equipment", equipmentId: "demo-eq-2", amount: 3200, date: daysAgo(50), notes: "إطارات" },
    { id: "demo-cust-3", type: "expense", category: "equipment", equipmentId: "demo-eq-5", amount: 1500, date: daysAgo(3),  notes: "صيانة الدسك" },
    { id: "demo-cust-4", type: "expense", category: "driver",    driverId: "demo-driver-1", amount: 500,  date: daysAgo(20), notes: "سلفة سائق" },
    { id: "demo-cust-5", type: "expense", category: "driver",    driverId: "demo-driver-2", amount: 200,  date: daysAgo(15), notes: "بدل وقود" },
    { id: "demo-cust-6", type: "expense", category: "other",     otherLabel: "إيجار ورشة",  amount: 1000, date: daysAgo(8),  notes: "" },
  ];
  await setMany(userDoc.collection("custodyTransactions"), custodyTransactions.map((c) => ({
    ...c, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  })));

  // ── تقرير نهائي ──────────────────────────────────────────────────────
  console.log("\n✅ خلص الـ seed بنجاح.\n");
  console.log("بيانات الدخول:");
  console.log(`  الإيميل  : ${DEMO_EMAIL}`);
  console.log(`  الباسورد : ${DEMO_PASSWORD}`);
  console.log(`  uid      : ${uid}`);
  console.log("\nملخص البيانات:");
  console.log(`  ${drivers.length} سائقين، ${equipment.length} معدات، ${jobs.length} شغلانات،`);
  console.log(`  ${payments.length} دفعات، ${maintenance.length} سجلات صيانة، ${driverCosts.length} تكاليف سائقين،`);
  console.log(`  ${salaryEntries.length} قيود رواتب، ${attendance.length} سجل حضور، ${custodyTransactions.length} معاملات عهدة.`);
}

main().catch((err) => {
  console.error("❌ حصل خطأ أثناء الـ seed:", err);
  process.exit(1);
});
