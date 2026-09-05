// src/services/paymentService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, query, where,
  serverTimestamp, writeBatch,
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

  async getByJob(userId, jobId) {
    const q = query(col(userId), where("jobId", "==", jobId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // Returns { id, promise } — see equipmentService.js for why.
  add(userId, data) {
    const ref = doc(col(userId));
    // ISO string (not serverTimestamp) — see jobService.js.
    const promise = setDoc(ref, { ...data, createdAt: new Date().toISOString() });
    return { id: ref.id, promise };
  },

  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },

  // بيمسح كل الدفعات المرتبطة بعملية معينة دفعة واحدة (batch) — مستخدمة
  // لما بنحذف عملية من "سجل الشغل" ومعاها كل معلوماتها المالية.
  async removeByJob(userId, jobId) {
    const q = query(col(userId), where("jobId", "==", jobId));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },
};
