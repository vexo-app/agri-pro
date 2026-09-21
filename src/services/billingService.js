// src/services/billingService.js
// ─────────────────────────────────────────────────────────
// نظام الباقات والاشتراكات — Phase 1 (دفع يدوي: فودافون كاش/InstaPay +
// إيصال واتساب، لحد الاشتراك في بوابة دفع رسمية). راجع
// SAAS_PRICING_AND_BILLING_RESEARCH.html (قسم 17-18) للتصميم الكامل.
//
// التقسيم مقصود: entitlements هي مصدر الحقيقة الوحيد اللي التطبيق بيقراه
// عشان يقرر الصلاحيات (حد المعدات/الفريق، حالة الترخيص). subscriptions
// سجل تجاري (دورة فوترة، آخر دفعة) — مش بيتقرأ من منطق الصلاحيات نفسه.
// الاثنين ما بيتكتبوش إلا من الأدمن (firestore.rules)، أبداً من العميل
// مباشرة — التطبيق بيطلب (billingRequests) والأدمن بيفعّل يدوياً.
// ─────────────────────────────────────────────────────────
import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  collection, query, orderBy, onSnapshot, serverTimestamp,
  Timestamp, runTransaction,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { COLLECTIONS } from "../config/constants";
import {
  CYCLE_DAYS, BILLING_REQUEST_STATUS, PLAN_IDS, ENTITLEMENT_SOURCE, TRIAL_DAYS,
  BILLING_CYCLE, MANUAL_PAYMENT_METHODS, getPlanById,
} from "../config/constants/billing";

const entitlementRef  = (uid) => doc(db, COLLECTIONS.ENTITLEMENTS, uid);
const subscriptionRef = (uid) => doc(db, COLLECTIONS.SUBSCRIPTIONS, uid);
const billingRequestsCol = () => collection(db, COLLECTIONS.BILLING_REQUESTS);

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const toDate = (value) => value?.toDate?.() || (value instanceof Date ? value : null);

export const calculateBillingPeriod = ({ now, billingCycle, entitlement, subscription }) => {
  const candidates = [
    toDate(entitlement?.expirationDate),
    toDate(subscription?.currentPeriodEnd),
  ].filter((date) => date && date.getTime() > now.getTime());
  const periodStart = candidates.reduce(
    (latest, date) => date.getTime() > latest.getTime() ? date : latest,
    now
  );
  return {
    periodStart,
    periodEnd: addDays(periodStart, CYCLE_DAYS[billingCycle] || 30),
  };
};

export const billingService = {
  // ─── الشركة نفسها ────────────────────────────────────────────────────

  /**
   * تجربة مجانية 14 يوم تلقائية — بتتنادى مرة واحدة بس من
   * AuthContext.jsx → register() لحساب شركة جديد، وصول كامل لحدود
   * ومزايا باقة "احترافي" بدون بطاقة ائتمان (قسم 15 في التقرير).
   * الحماية الحقيقية في firestore.rules (isValidTrialSelfCreate): create
   * بينجح مرة واحدة بس طول عمر الحساب — أي محاولة تانية (نفس الكود لو
   * اتنادى غلط تاني، أو تلاعب مباشر بالـ SDK) هترفض تلقائيًا لأن
   * الـ entitlement بقى موجود، وupdate/delete فاضلين أدمن بس. best-effort
   * عمدًا (زي باقي كتابات التسجيل) — فشلها ميوقفش التسجيل نفسه.
   */
  startTrial: async (uid) => {
    const now = new Date();
    const expirationDate = addDays(now, TRIAL_DAYS);
    await setDoc(entitlementRef(uid), {
      type: "plan",
      source: ENTITLEMENT_SOURCE.TRIAL,
      planId: PLAN_IDS.PROFESSIONAL,
      startDate: Timestamp.fromDate(now),
      expirationDate: Timestamp.fromDate(expirationDate),
    });
  },

  /** Real-time — بيرجّع unsubscribe. entitlement = null لو مفيش واحد لسه.
   *  onError اختياري — بيتنادى لو الـ listener فشل (صلاحيات/شبكة) عشان
   *  اللي مستخدم الدالة يقدر يوقف حالة الـ loading بدل ما تفضل عالقة. */
  subscribeToEntitlement: (uid, onChange, onError) =>
    onSnapshot(
      entitlementRef(uid),
      (snap) => onChange(snap.exists() ? snap.data() : null),
      (error) => {
        console.error("subscribeToEntitlement failed:", error);
        onError?.(error);
      }
    ),

  /** Real-time — subscriptions/{uid} (دورة الفوترة الفعلية شهري/سنوي،
   *  آخر دفعة...). سجل تجاري للعرض بس في صفحة /billing، مش مصدر
   *  الصلاحيات (ده entitlements). null لو الشركة لسه ما اشتركتش في باقة
   *  مدفوعة فعلية (تجربة مجانية مثلاً — مفيش subscriptions doc أصلاً). */
  subscribeToSubscription: (uid, onChange, onError) =>
    onSnapshot(
      subscriptionRef(uid),
      (snap) => onChange(snap.exists() ? snap.data() : null),
      (error) => {
        console.error("subscribeToSubscription failed:", error);
        onError?.(error);
      }
    ),

  /** طلب دفع يدوي جديد — بيتسجل بحالة "قيد المراجعة" لحد ما الأدمن يتأكد
   *  من التحويل ويفعّل الباقة. بيرجّع الـ id عشان نقدر نتابع حالته live. */
  createBillingRequest: async ({ planId, billingCycle, amount, method }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("لازم تكون مسجّل دخول");
    const plan = getPlanById(planId);
    const expectedAmount = billingCycle === BILLING_CYCLE.ANNUAL
      ? plan?.priceAnnual
      : billingCycle === BILLING_CYCLE.MONTHLY ? plan?.priceMonthly : null;
    if (!plan || amount !== expectedAmount) throw new Error("بيانات الباقة أو المبلغ غير صحيحة");
    if (!Object.values(MANUAL_PAYMENT_METHODS).includes(method)) {
      throw new Error("طريقة الدفع غير صحيحة");
    }
    const docRef = await addDoc(billingRequestsCol(), {
      uid,
      planId,
      billingCycle,
      amount,
      method,
      status: BILLING_REQUEST_STATUS.PENDING_REVIEW,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /** متابعة حالة طلب دفع بعينه (لصاحبه بس — rules بتتأكد من uid). */
  subscribeToBillingRequest: (requestId, onChange) =>
    onSnapshot(doc(db, COLLECTIONS.BILLING_REQUESTS, requestId), (snap) =>
      onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    ),

  // ─── أدمن بس — الحماية الفعلية في firestore.rules (isAdmin) ──────────

  /** كل الـ entitlements — لعمود "الباقة/الحالة" في جدول الشركات. */
  getAllEntitlements: async () => {
    const snap = await getDocs(collection(db, COLLECTIONS.ENTITLEMENTS));
    const map = {};
    snap.docs.forEach((d) => { map[d.id] = d.data(); });
    return map; // { [uid]: entitlementData }
  },

  /** كل طلبات الدفع بكل حالاتها (قيد المراجعة/مؤكدة/مرفوضة) — لصفحة
   *  "طلبات الشراء" الكاملة في الأدمن (مراقبة شاملة زي أي متجر). ترتيب
   *  واحد فقط (createdAt) فمش محتاج composite index. */
  getAllBillingRequests: async () => {
    const q = query(billingRequestsCol(), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /** طلبات الدفع اللي لسه محتاجة مراجعة الأدمن — لكارت الملخص في
   *  AdminPage. عمدًا بتستخدم getAllBillingRequests وتفلتر بعدها بدل
   *  where("status",...) + orderBy("createdAt") مع بعض: الاتنين مع بعض
   *  كانوا محتاجين composite index في Firestore (وده كان سبب خطأ
   *  "query requires an index" اللي كان بيظهر في الكونسول)، وعدد طلبات
   *  الدفع أصلاً صغير فمفيش داعي لاستعلام تاني منفصل يحتاج فهرس زيادة. */
  getPendingBillingRequests: async () => {
    const all = await billingService.getAllBillingRequests();
    return all.filter((r) => r.status === BILLING_REQUEST_STATUS.PENDING_REVIEW);
  },

  /**
   * الأدمن بيتأكد إن التحويل وصل فعلاً (يدوياً، برا التطبيق) وبعدين
   * يضغط هنا — بيفعّل الاشتراك والصلاحية مع بعض، ويقفل الطلب كـ "متأكد
   * منه". دورة الفوترة بتتحسب من النهاردة (مش من تاريخ الطلب) عشان لو
   * الأدمن اتأخر يوم-يومين في المراجعة، الشركة ما تخسرش من مدتها.
   */
  confirmBillingRequestAndActivate: async (request) => {
    const admin = auth.currentUser;
    if (!admin) throw new Error("لازم تكون مسجّل دخول كأدمن");

    const requestRef = doc(db, COLLECTIONS.BILLING_REQUESTS, request.id);
    await runTransaction(db, async (transaction) => {
      // Read the request again inside the transaction. This prevents a stale
      // admin screen or a double click from activating the same payment twice.
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists()) throw new Error("طلب الاشتراك غير موجود");
      const currentRequest = requestSnap.data();
      if (currentRequest.status !== BILLING_REQUEST_STATUS.PENDING_REVIEW) {
        throw new Error("طلب الاشتراك تمت مراجعته بالفعل");
      }

      const currentEntitlementRef = entitlementRef(currentRequest.uid);
      const currentSubscriptionRef = subscriptionRef(currentRequest.uid);
      const existingEntitlementSnap = await transaction.get(currentEntitlementRef);
      const existingSubscriptionSnap = await transaction.get(currentSubscriptionRef);
      const existingEntitlement = existingEntitlementSnap.exists() ? existingEntitlementSnap.data() : null;
      const existingSubscription = existingSubscriptionSnap.exists() ? existingSubscriptionSnap.data() : null;
      const now = new Date();
      const { periodStart, periodEnd } = calculateBillingPeriod({
        now,
        billingCycle: currentRequest.billingCycle,
        entitlement: existingEntitlement,
        subscription: existingSubscription,
      });
      const startDate = existingEntitlement?.startDate || Timestamp.fromDate(now);

      transaction.update(requestRef, {
        status: BILLING_REQUEST_STATUS.CONFIRMED,
        confirmedAt: serverTimestamp(),
        confirmedBy: admin.uid,
      });
      transaction.set(currentSubscriptionRef, {
        planId: currentRequest.planId,
        billingCycle: currentRequest.billingCycle,
        status: "active",
        currentPeriodStart: Timestamp.fromDate(periodStart),
        currentPeriodEnd: Timestamp.fromDate(periodEnd),
        gatewayProvider: "manual",
        lastPaymentAmount: currentRequest.amount,
        lastPaymentMethod: currentRequest.method,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      transaction.set(currentEntitlementRef, {
        type: "plan",
        source: "manual_payment",
        planId: currentRequest.planId,
        startDate,
        expirationDate: Timestamp.fromDate(periodEnd),
        adminOverrideBy: admin.uid,
        adminOverrideAt: serverTimestamp(),
        notes: existingEntitlement?.notes || "",
      }, { merge: true });
    });
  },

  /** رفض طلب دفع (مبلغ غلط، التحويل ملوش أصل...) — بدون أي تفعيل. */
  rejectBillingRequest: (requestId, reason = "") =>
    updateDoc(doc(db, COLLECTIONS.BILLING_REQUESTS, requestId), {
      status: BILLING_REQUEST_STATUS.REJECTED,
      rejectReason: reason,
    }),

  /**
   * منح صلاحية يدوياً بدون اشتراك مدفوع أصلاً — Lifetime (بدون تاريخ
   * انتهاء إطلاقاً) أو Complimentary (وصول مجاني، بتاريخ انتهاء اختياري
   * زي تمديد تجربة). القسم 16-17 من التقرير: Lifetime لازم يفضل قرار
   * أدمن يدوي بس، مش خيار عام في صفحة الأسعار.
   */
  grantEntitlement: async ({ uid, type, planId = null, expirationDate = null, notes = "" }) => {
    const admin = auth.currentUser;
    if (!admin) throw new Error("لازم تكون مسجّل دخول كأدمن");
    await setDoc(entitlementRef(uid), {
      type, // "lifetime" | "complimentary" | "plan"
      source: "admin_override",
      planId,
      startDate: Timestamp.fromDate(new Date()),
      expirationDate: expirationDate ? Timestamp.fromDate(expirationDate) : null,
      adminOverrideBy: admin.uid,
      adminOverrideAt: serverTimestamp(),
      notes,
    }, { merge: true });
  },

  /** تمديد يدوي سريع (تعويض تأخير، هدية، صفقة خاصة) — بيمدد من تاريخ
   *  الانتهاء الحالي لو لسه ما جاش، أو من النهاردة لو خلاص انتهى. */
  extendEntitlement: async (uid, extraDays) => {
    const admin = auth.currentUser;
    if (!admin) throw new Error("لازم تكون مسجّل دخول كأدمن");
    const snap = await getDoc(entitlementRef(uid));
    const current = snap.exists() ? snap.data() : null;
    const now = new Date();
    const currentExpiry = current?.expirationDate?.toDate?.() || null;
    const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiry = addDays(base, extraDays);
    await setDoc(entitlementRef(uid), {
      type: current?.type || "plan",
      planId: current?.planId || null,
      expirationDate: Timestamp.fromDate(newExpiry),
      adminOverrideBy: admin.uid,
      adminOverrideAt: serverTimestamp(),
    }, { merge: true });
  },
};
