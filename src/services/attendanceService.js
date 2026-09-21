// src/services/attendanceService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const col = (uid) => collection(db, "users", uid, "attendance");

export const attendanceService = {
  async getAll(userId) {
    const snap = await getDocs(col(userId));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // Live-subscribe — see paymentService.js for why the sort is client-side.
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

  // Returns { id, promise } — see equipmentService.js for why.
  add(userId, data) {
    // A driver can only have one attendance document per calendar day.
    // Using the same Firestore id on every device makes concurrent saves
    // converge to one record instead of creating two random-id records.
    const id = `${data.driverId}__${data.date}`;
    const ref = doc(col(userId), id);
    const promise = setDoc(ref, { ...data, createdAt: serverTimestamp() });
    return { id, promise };
  },

  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
