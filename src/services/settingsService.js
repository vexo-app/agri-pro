// src/services/settingsService.js
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { DEFAULT_FUEL_PRICE } from "../config/constants";

// جوه users/{uid}/meta/settings بدل collection مستقل — نفس فكرة باقي
// بيانات المستخدم (equipment, jobs...) دلوقتي.
const settingsDocRef = (userId) => doc(db, "users", userId, "meta", "settings");

export const settingsService = {
  async get(userId) {
    const snap = await getDoc(settingsDocRef(userId));
    if (snap.exists()) return snap.data();
    return { fuelPrice: DEFAULT_FUEL_PRICE };
  },

  async save(userId, data) {
    await setDoc(settingsDocRef(userId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },
};
