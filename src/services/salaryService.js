// src/services/salaryService.js
// Handles salary entries: base pay, bonuses, deductions, advances
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const col = (uid) => collection(db, "users", uid, "salaryEntries");

export const salaryService = {
  async getAll(userId) {
    const snap = await getDocs(col(userId));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // Returns { id, promise } — see equipmentService.js for why.
  add(userId, data) {
    const ref = doc(col(userId));
    const promise = setDoc(ref, { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, promise };
  },

  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
