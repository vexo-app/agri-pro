import {
  collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const col = (uid) => collection(db, "users", uid, "equipmentFuelEntries");

export const equipmentFuelEntryService = {
  async getAll(userId) {
    const snap = await getDocs(query(col(userId), orderBy("date", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  subscribe(userId, onData, onError) {
    return onSnapshot(
      query(col(userId), orderBy("date", "desc")),
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  },
  add(userId, data) {
    const ref = doc(col(userId));
    return {
      id: ref.id,
      promise: setDoc(ref, { ...data, createdAt: new Date().toISOString(), updatedAt: serverTimestamp() }),
    };
  },
  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
