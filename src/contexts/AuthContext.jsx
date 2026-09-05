// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { auth } from "../config/firebase";
import { userProfileService } from "../services/userProfileService";

const AuthContext = createContext(null);

// أقل مسافة زمنية بين كتابتين لـ lastActiveAt لنفس المستخدم. من غيرها
// كل فتح تاب/تحديث صفحة كان هيبعت كتابة لـ Firestore (الجلسة محفوظة
// أصلاً وبتفضل مسجلة دخول لأسابيع). 6 ساعات كفاية توضح "آخر نشاط"
// بدقة معقولة للأدمن من غير ما تستهلك من الكوتة اليومية على الفاضي.
const LAST_ACTIVE_THROTTLE_MS = 6 * 60 * 60 * 1000;

const touchLastActive = (firebaseUser) => {
  const key  = `lastActiveWriteAt:${firebaseUser.uid}`;
  const last = Number(localStorage.getItem(key) || 0);
  if (Date.now() - last < LAST_ACTIVE_THROTTLE_MS) return;
  localStorage.setItem(key, String(Date.now()));
  // best-effort — لو الكتابة فشلت (مثلاً أوف لاين)، مش هنمنع المستخدم
  // من استخدام التطبيق عشانها، وهي هتتحاول تاني بعد الـ throttle.
  userProfileService.touch(firebaseUser.uid, {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    lastActiveAt: serverTimestamp(),
  }).catch(() => {});
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) touchLastActive(firebaseUser);
    });
    return unsub;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const register = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    // بروفايل الأدمن — createdAt بيتبعت هنا بس، مرة واحدة طول عمر الحساب.
    // ما بيتوقفش التسجيل لو فشل (مثلاً أوف لاين وقت التسجيل).
    userProfileService.touch(cred.user.uid, {
      uid: cred.user.uid,
      email,
      displayName,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    }).catch(() => {});
    return cred;
  };

  const logout = () => signOut(auth);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  // بيتأكد إن الباسورد المدخل فعلًا هو باسورد صاحب الحساب الحالي — من
  // غير ما يغيّر أي حاجة في الجلسة. مستخدم قبل أي إجراء حساس (زي حذف
  // عملية معاها معلومات مالية). بيرمي error.code = "auth/wrong-password"
  // (أو "auth/invalid-credential" في نسخ SDK الأحدث) لو الباسورد غلط.
  const reauthenticate = (password) => {
    if (!auth.currentUser?.email) {
      return Promise.reject(new Error("لا يوجد مستخدم مسجل دخول"));
    }
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    return reauthenticateWithCredential(auth.currentUser, cred);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, resetPassword, reauthenticate }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
