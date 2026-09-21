// src/services/paymentService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot, query, where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const col = (uid) => collection(db, "users", uid, "payments");

export const paymentService = {
  async getAll(userId) {
    const snap = await getDocs(col(userId));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // Live-subscribe — see equipmentService.js for the full contract. No
  // orderBy in the query itself (matches getAll exactly), so the same
  // client-side date-descending sort is applied on every snapshot.
  subscribe(userId, onData, onError) {
    return onSnapshot(
      col(userId),
      (snap) => onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      ),
      onError
    );
  },

  // Guest-safe subscription: every query is constrained to job ids that
  // the guest has already been allowed to read.
  subscribeByJobIds(userId, jobIds, onData, onError) {
    const ids = [...new Set(jobIds.filter(Boolean))];
    if (ids.length === 0) {
      onData([]);
      return () => {};
    }

    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const results = Array(chunks.length).fill(null);
    const emit = () => {
      if (results.some((items) => items === null)) return;
      onData(results.flat().sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    };
    const unsubscribes = chunks.map((jobIdChunk, index) =>
      onSnapshot(
        query(col(userId), where("jobId", "in", jobIdChunk)),
        (snap) => {
          results[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          emit();
        },
        onError
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  },

  async getByJob(userId, jobId) {
    const q = query(col(userId), where("jobId", "==", jobId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // Returns { id, promise } — see equipmentService.js for why.
  //
  // audit finding F-003 (Phase 5): `id` بقى اختياري — لو اتبعت (من
  // usePendingPaymentsRecovery.js وقت استكمال دفعة معلّقة بنفس رقمها
  // القديم، أو من jobsMutations.js وقت حجز id مقدّماً قبل الكتابة نفسها)
  // بيتكتب المستند بيه بالظبط بدل ما نولّد id عشوائي جديد. من غيرها،
  // نفس السلوك القديم تماماً (id عشوائي تلقائي).
  add(userId, data, id) {
    const ref = id ? doc(col(userId), id) : doc(col(userId));
    // ISO string (not serverTimestamp) — see jobService.js.
    const promise = setDoc(ref, { ...data, createdAt: new Date().toISOString() });
    return { id: ref.id, promise };
  },

  /**
   * بيحجز id جديد لمستند دفعة من غير ما يكتب حاجة فعلياً — بيستخدم لما
   * محتاجين نعرف الـ id مقدّماً قبل بدء الكتابة نفسها (audit finding
   * F-003: تسجيل "نية دفعة معلّقة" في localStorage بنفس الـ id ده قبل
   * ما نستنى تأكيد الكتابة، عشان لو الجلسة اتقفلت فجأة نقدر نكمّل
   * بنفس الرقم من غير أي احتمال تكرار).
   */
  generateId(userId) {
    return doc(col(userId)).id;
  },

  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
