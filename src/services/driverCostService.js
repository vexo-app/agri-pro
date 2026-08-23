// src/services/driverCostService.js
import {
  collection, doc,
  setDoc, updateDoc, deleteDoc,
  getDocs, query, where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLL = "driverCosts";
const col  = () => collection(db, COLL);

export const driverCostService = {
  async getAll(userId) {
    // No orderBy — sort in JS to avoid needing a Firestore index
    const q    = query(col(), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  // ملحوظة: الدالة دي مش بتتنادى حاليًا من أي مكان في التطبيق (الخدمة دي
  // بقت legacy، الغرض منها بس قراءة/تنظيف بيانات قديمة — شوف DataContext).
  // سابتها موحّدة مع باقي الخدمات (doc()/setDoc() بدل addDoc()) احتياطًا،
  // عشان لو حد يوم استخدمها تاني ميقعش في مشكلة تكرار وقت الأوفلاين.
  add(userId, data) {
    const ref = doc(col());
    const promise = setDoc(ref, { ...data, userId, createdAt: serverTimestamp() });
    return { id: ref.id, promise };
  },

  async update(id, data) {
    await updateDoc(doc(db, COLL, id), { ...data, updatedAt: serverTimestamp() });
  },

  async remove(id) {
    await deleteDoc(doc(db, COLL, id));
  },
};
