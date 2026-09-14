// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider,
} from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { auth } from "../config/firebase";
import { userProfileService } from "../services/userProfileService";
import { billingService } from "../services/billingService";
import { backupService } from "../services/backupService";
import { identifyUser, resetPostHogUser } from "../config/posthog";

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
      if (firebaseUser) {
        touchLastActive(firebaseUser);
        // PostHog identify — best-effort، مش شرط لتسجيل الدخول (شوف
        // src/config/posthog.js).
        identifyUser(firebaseUser.uid, firebaseUser.email);
      } else {
        resetPostHogUser();
      }
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
    // تجربة مجانية 14 يوم تلقائية — بدون بطاقة، وصول كامل لباقة احترافي
    // (راجع src/services/billingService.js → startTrial). best-effort
    // برضو: لو فشلت (مثلاً أوف لاين وقت التسجيل)، الشركة تفضل في حالة
    // "لسه ما اخترتش باقة" وتقدر تشترك يدويًا زي أي وقت تاني.
    billingService.startTrial(cred.user.uid).catch(() => {});
    // إرسال رابط تحقق البريد الإلكتروني — best-effort زي touch فوق، ما
    // بيوقفش التسجيل لو فشل (أوف لاين، أو حد الإرسال اليومي من Firebase).
    // audit finding F-005: قبل كده مكانش فيه أي تحقق من ملكية البريد
    // الإلكتروني المُدخل وقت التسجيل.
    // ملحوظة تشخيصية مؤقتة: بنسجّل كود الخطأ في الـ console (F12 -> Console)
    // بدل ما نبلعه بصمت زي الأول، عشان لو الإرسال فشل نعرف السبب الحقيقي
    // (auth/too-many-requests، auth/network-request-failed، إلخ) بدل ما
    // نفضل نخمّن.
    sendEmailVerification(cred.user).catch((err) => {
      console.warn("[auth] sendEmailVerification failed:", err?.code, err?.message);
    });
    return cred;
  };

  // بيعيد إرسال رابط التحقق للمستخدم الحالي (لو لسه محتاج تحقق). بيرمي
  // نفس أخطاء Firebase العادية (زي auth/too-many-requests) عشان الواجهة
  // تعرضها للمستخدم.
  const resendVerificationEmail = () => {
    if (!auth.currentUser) {
      return Promise.reject(new Error("لا يوجد مستخدم مسجل دخول"));
    }
    return sendEmailVerification(auth.currentUser);
  };

  // Firebase مبيحدّثش user.emailVerified تلقائيًا في الجلسة الحالية بعد ما
  // المستخدم يضغط على رابط التحقق في إيميله (بيفتح في تاب/جهاز تاني عادة).
  // الدالة دي بتعمل reload لبيانات المستخدم من السيرفر وتحدّث الحالة محليًا
  // عشان البانر يختفي فورًا من غير ما يحتاج المستخدم يعمل logout/login.
  const refreshEmailVerified = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    // auth.currentUser هو نفس الكائن بعد reload، لكن React miss بيحصله
    // update لأنه نفس المرجع — بننسخه في state جديد عشان يتاح إعادة render.
    setUser({ ...auth.currentUser });
    return auth.currentUser.emailVerified;
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

  // audit finding F-006: قبل الدالة دي، مكانش فيه أي مسار في التطبيق يقدر
  // المستخدم بيه يحذف حسابه نهائيًا. بتتطلب كلمة المرور (إعادة تأكيد إجبارية
  // قبل إجراء لا يمكن التراجع عنه)، وبتمسح بيانات Firestore الأول وهو لسه
  // مسجل دخول (لازم يكون كده عشان قواعد الأمان محتاجة isOwner(uid))، وبعدين
  // بتمسح حساب الـ Auth نفسه. `onProgress` اختيارية عشان الواجهة تقدر تعرض
  // تقدم فعلي بدل سبينر واحد غامض لعملية ممكن تاخد شوية ثواني.
  //
  // الحذف كامل فعلًا: backupService.wipeAllData بتمسح كل الـ subcollections
  // + مستند users/{uid} الجذري نفسه (بعد تعديل firestore.rules عمدًا للسماح
  // بذلك) — مفيش أي أثر لحساب اتحذف بالطريقة دي بيفضل قابل للقراءة بعد كده.
  const deleteAccount = async (password, { onProgress } = {}) => {
    if (!auth.currentUser) {
      return Promise.reject(new Error("لا يوجد مستخدم مسجل دخول"));
    }
    await reauthenticate(password);
    const uid = auth.currentUser.uid;
    await backupService.wipeAllData(uid, { onProgress });
    await deleteUser(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, resetPassword, reauthenticate,
      resendVerificationEmail, refreshEmailVerified, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
