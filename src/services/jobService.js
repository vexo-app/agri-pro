// src/services/jobService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const col = (uid) => collection(db, "users", uid, "jobs");

export const jobService = {
  async getAll(userId) {
    const q = query(col(userId), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // Returns { id, promise } — see equipmentService.js for why.
  add(userId, data) {
    const ref = doc(col(userId));
    const promise = setDoc(ref, {
      ...data,
      // ISO string (not serverTimestamp) so the exact creation moment is
      // available immediately in local state — no reload needed to see it
      // (serverTimestamp() resolves to null until Firestore round-trips it).
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, promise };
  },

  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
