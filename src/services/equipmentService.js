// src/services/equipmentService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

// كل بيانات المستخدم بقت جوه users/{uid}/... بدل collection عام فيه
// حقل userId — العزل بقى طبيعي بمسار المستند نفسه، مش شرط where بيتكرر
// في كل query (وقاعدة أمان واحدة عامة في firestore.rules بدل تكرارها
// لكل نوع بيانات — شوف users/{uid}/{document=**} هناك).
const col = (uid) => collection(db, "users", uid, "equipment");

export const equipmentService = {
  /** Fetch all equipment for a farm (userId scope). */
  async getAll(userId) {
    const q = query(col(userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /**
   * Add new equipment document.
   * Returns `{ id, promise }` — see DataContext.jsx for why (offline-safe
   * id generation with doc()/setDoc() instead of addDoc()).
   */
  add(userId, data) {
    const ref = doc(col(userId));
    const promise = setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, promise };
  },

  /** Update an existing equipment document. Returns the write promise. */
  update(userId, id, data) {
    return updateDoc(doc(col(userId), id), { ...data, updatedAt: serverTimestamp() });
  },

  /** Delete an equipment document. Returns the write promise. */
  remove(userId, id) {
    return deleteDoc(doc(col(userId), id));
  },
};
