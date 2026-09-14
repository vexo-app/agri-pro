// src/services/guestAccessService.js
//
// كل التعامل مع مستندات guestSessions/guestAccess (Phase 2 — واجهة الضيف)
// مركّز هنا بدل ما يتوزع في الصفحات — نفس مبدأ باقي src/services/*.
// القراءة/الكتابة هنا لازم تفضل مطابقة تمامًا لـfirestore.rules (شوف
// guestCanRead / isValidGuestRedeem / guestSessionValid هناك) — أي تغيير
// هنا من غير تغيير مقابل في القواعد هيرجع permission-denied بس.
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp,
  collection, query, where, orderBy, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const guestAccessService = {
  /** مستند guestSessions/{guestUid} بتاع الضيف الحالي — null لو لسه ماستخدمش كود. */
  async getSession(guestUid) {
    const snap = await getDoc(doc(db, "guestSessions", guestUid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /** مستند users/{ownerUid}/guestAccess/{code} — الصلاحيات والوقت والحالة. */
  async getAccess(ownerUid, code) {
    const snap = await getDoc(doc(db, "users", ownerUid, "guestAccess", code));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  /** بروفايل المالك (اسم/إيميل بس) لعرضه في بانر الضيف. */
  async getOwnerProfile(ownerUid) {
    const snap = await getDoc(doc(db, "users", ownerUid));
    return snap.exists() ? snap.data() : null;
  },

  /**
   * استخدام كود لأول مرة — ترانزاكشن واحدة بتحدّث guestAccess (redeemedByUid)
   * وتنشئ guestSessions مع بعض، بالظبط زي ما firestore.rules
   * (isValidGuestRedeem) متوقعة. لو الكود مش موجود/متسخدم قبل
   * كده/منتهي/ملغي، الترانزاكشن هترمي خطأ permission-denied (أو
   * not-found لو المستند نفسه مش موجود).
   */
  async redeem(guestUid, ownerUid, code) {
    // ⚠️ من غير tx.get(accessRef) هنا عن قصد: قبل أول استخدام، الضيف
    // مفيش عنده أي guestSession لسه، فقاعدة "allow get" الخاصة بمستند
    // guestAccess (الضيف يقرا كوده هو بس بعد ما يبقى عنده session) بترفض
    // أي محاولة قراءة مسبقة. Firestore بيقيّم قاعدة الـupdate مباشرة على
    // حالة المستند في السيرفر (resource.data) من غير ما يحتاج الكلاينت
    // يقراه الأول — لو الكود مش موجود أصلاً، الـupdate نفسها هتفشل
    // (not-found)، ولو موجود بس منتهي/ملغي/مستخدم قبل كده، هتفشل
    // (permission-denied) لأن isValidGuestRedeem في firestore.rules
    // هترفضها.
    const accessRef  = doc(db, "users", ownerUid, "guestAccess", code);
    const sessionRef = doc(db, "guestSessions", guestUid);
    await runTransaction(db, async (tx) => {
      tx.update(accessRef, { redeemedByUid: guestUid, redeemedAt: serverTimestamp() });
      tx.set(sessionRef, { ownerUid, code, createdAt: serverTimestamp() });
    });
  },

  /**
   * اشتراك مباشر في jobs بتاعة قسم "عمليات الشغل" لضيف عنده فلترة عملاء
   * (allowedClients). لازم where('client','in', allowedClients) مطابق
   * تمامًا لشرط guestCanReadJob في firestore.rules — من غيره الطلب
   * هيترفض بالكامل (Firestore Rules مش filters، شوف GUEST_ACCESS_DESIGN.md
   * في المشروع). لو allowedClients فاضية/null، بيرجع كل الـjobs عادي.
   */
  subscribeGuestJobs(ownerUid, allowedClients, onData, onError) {
    const col = collection(db, "users", ownerUid, "jobs");
    const q = allowedClients && allowedClients.length > 0
      ? query(col, where("client", "in", allowedClients.slice(0, 30)))
      : query(col);
    return onSnapshot(
      q,
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  },

  // ── Phase 3 — تاب "الوصول للضيوف" عند صاحب الحساب ─────────────────────

  /** اشتراك في كل أكواد guestAccess بتاعة المالك نفسه — لعرضها في الإعدادات. */
  subscribeOwnerCodes(ownerUid, onData, onError) {
    const col = collection(db, "users", ownerUid, "guestAccess");
    return onSnapshot(
      query(col, orderBy("createdAt", "desc")),
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  },

  /**
   * إنشاء كود جديد. شكل data لازم يطابق isValidNewGuestAccess في
   * firestore.rules بالحرف — أي تعديل هنا من غير تعديل مقابل هناك هيرجع
   * permission-denied بس وقت الحفظ. الـid بيتولّد تلقائيًا من Firestore
   * (auto-id عشوائي وطويل بما يكفي إنه ميتخمنش، فمفيش داعي لمولّد كود
   * منفصل). الرابط اللي المالك بيشاركه = `${origin}/guest?token=${ownerUid}:${code}`
   * (شكل الـtoken المؤقت الموثّق في GUEST_ACCESS_DESIGN.md).
   */
  async createCode(ownerUid, { name, validFrom, validUntil, sections, dailyStartMinute, dailyEndMinute, allowedClients }) {
    const ref = doc(collection(db, "users", ownerUid, "guestAccess"));
    const data = {
      name,
      validFrom: Timestamp.fromDate(validFrom),
      validUntil: Timestamp.fromDate(validUntil),
      sections,
      cancelled: false,
      redeemedByUid: null,
      createdAt: serverTimestamp(),
    };
    if (dailyStartMinute != null && dailyEndMinute != null) {
      data.dailyStartMinute = dailyStartMinute;
      data.dailyEndMinute = dailyEndMinute;
    }
    if (allowedClients && allowedClients.length > 0) {
      data.allowedClients = allowedClients;
    }
    await setDoc(ref, data);
    return ref.id;
  },

  /**
   * تعديل كود موجود (إلغاء/تمديد/تعديل صلاحيات) — patch جزئي بأي حقول
   * غير redeemedByUid/redeemedAt (isValidOwnerGuestAccessUpdate في
   * firestore.rules بترفض لمسهم من هنا — دول بيتغيروا بس جوه ترانزاكشن
   * استخدام الكود نفسها، شوف redeem() فوق).
   */
  async updateCode(ownerUid, code, patch) {
    await updateDoc(doc(db, "users", ownerUid, "guestAccess", code), patch);
  },

  async deleteCode(ownerUid, code) {
    await deleteDoc(doc(db, "users", ownerUid, "guestAccess", code));
  },
};
