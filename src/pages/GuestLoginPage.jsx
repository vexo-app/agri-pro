// src/pages/GuestLoginPage.jsx
//
// مسار دخول منفصل تمامًا عن /auth (البرومبت الأصلي كان صريح في النقطة
// دي) — الضيف بيوصل هنا إما برابط فيه الكود جاهز (?token=OWNER:CODE أو
// ?owner=..&code=..) أو بيكتب الكود يدوي. راجع GUEST_ACCESS_DESIGN.md في
// المشروع لشرح ليه شكل الكود "OWNER:CODE" — قرار مؤقت لحد Phase 3.
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { guestAccessService } from "../services/guestAccessService";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { LockIcon, UserIcon } from "../components/ui/Icons";
import LoadingScreen from "../components/ui/LoadingScreen";

function parseToken(raw) {
  const cleaned = (raw || "").trim();
  if (!cleaned) return null;
  const parts = cleaned.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { ownerUid: parts[0], code: parts[1] };
}

const ERROR_MESSAGES = {
  GUEST_CODE_NOT_FOUND: "الكود ده مش موجود. تأكد إنك ناسخ الرابط أو الكود صح.",
  "permission-denied":   "الكود ده منتهي أو ملغي أو اتستخدم قبل كده — اطلب كود جديد من صاحب الحساب.",
  "not-found":           "الكود ده مش موجود. تأكد إنك ناسخ الرابط أو الكود صح.",
  INVALID_FORMAT:        "شكل الكود مش صح — انسخ الرابط اللي وصلك بالكامل، أو الكود بالظبط زي ما هو.",
};

const GuestLoginPage = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlToken = searchParams.get("token");
  const urlOwner = searchParams.get("owner");
  const urlCode  = searchParams.get("code");
  const initialManual = urlToken || (urlOwner && urlCode ? `${urlOwner}:${urlCode}` : "");

  const [manualCode, setManualCode] = useState(initialManual);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [autoTried, setAutoTried] = useState(false);

  const isRealUser = !!user && !user.isAnonymous;

  const doRedeem = useCallback(async (token) => {
    const parsed = parseToken(token);
    if (!parsed) { setError("INVALID_FORMAT"); return; }
    setSubmitting(true);
    setError(null);
    try {
      let current = auth.currentUser;
      if (!current || !current.isAnonymous) {
        const cred = await signInAnonymously(auth);
        current = cred.user;
      }
      await guestAccessService.redeem(current.uid, parsed.ownerUid, parsed.code);
      navigate("/guest/app", { replace: true });
    } catch (err) {
      setError(err?.message === "GUEST_CODE_NOT_FOUND" ? "GUEST_CODE_NOT_FOUND" : (err?.code || "permission-denied"));
    } finally {
      setSubmitting(false);
    }
  }, [navigate]);

  // لو الضيف وصل برابط فيه كل حاجة جاهزة، جرّب الاستخدام تلقائيًا مرة
  // واحدة بس (مش عند كل تغيير في الحقل).
  useEffect(() => {
    if (!autoTried && initialManual && !isRealUser) {
      setAutoTried(true);
      doRedeem(initialManual);
    }
  }, [autoTried, initialManual, isRealUser, doRedeem]);

  // لو الضيف أصلاً عنده guestSessions doc من قبل (رجع تاني لنفس اللينك
  // أو عمل refresh)، وجّهه على طول للواجهة المقيّدة بدل ما يطلب منه الكود
  // تاني — GuestRoute هيتأكد إن الجلسة لسه صالحة زمنيًا فعليًا. مهم: الفحص
  // ده لازم يكون على وجود session حقيقي، مش مجرد isAnonymous — وإلا أي
  // anonymous user من غير session (زي بعد محاولة استخدام فشلت) هيعمل
  // redirect loop بين الصفحة دي و/guest/app.
  useEffect(() => {
    let cancelled = false;
    async function checkExistingSession() {
      if (authLoading || !user?.isAnonymous || submitting || autoTried) return;
      const session = await guestAccessService.getSession(user.uid).catch(() => null);
      if (!cancelled && session) navigate("/guest/app", { replace: true });
    }
    checkExistingSession();
    return () => { cancelled = true; };
  }, [authLoading, user, submitting, autoTried, navigate]);

  if (authLoading) return <LoadingScreen message="لحظة..." />;

  // حساب حقيقي (إيميل/باسورد) مسجل دخول ووصل هنا بالغلط — ما نعملوش
  // signInAnonymously من تحته (ده كان هيسجّله خروج من حسابه الحقيقي من
  // غير ما ياخد باله).
  if (isRealUser) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-6 font-arabic" dir="rtl">
        <div className="max-w-sm w-full bg-surface border border-white/8 rounded-2xl p-6 text-center">
          <UserIcon size={32} className="mx-auto text-amber-400 mb-3" />
          <h2 className="text-base font-bold text-gray-100 mb-2">انت مسجل دخول بحساب عادي</h2>
          <p className="text-sm text-gray-400 mb-4">
            عشان تدخل بكود ضيف لازم تسجّل خروج من حسابك الحالي الأول.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => logout()}>تسجيل الخروج</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-6 font-arabic" dir="rtl">
      <div className="max-w-sm w-full bg-surface border border-white/8 rounded-2xl p-6">
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-900/40 flex items-center justify-center mb-3">
            <LockIcon size={22} className="text-brand-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-100">الوصول للضيوف</h1>
          <p className="text-xs text-gray-500 mt-1">وصول قراءة فقط لبيانات صاحب الحساب اللي بعتلك الكود</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); doRedeem(manualCode); }}
          className="flex flex-col gap-3"
        >
          <Input
            label="الكود"
            placeholder="الصق الكود اللي وصلك"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            dir="ltr"
            className="text-center"
          />
          {error && (
            <p className="text-xs text-red-400 text-center">{ERROR_MESSAGES[error] || ERROR_MESSAGES["permission-denied"]}</p>
          )}
          <Button type="submit" className="w-full" loading={submitting} disabled={!manualCode.trim()}>
            دخول
          </Button>
        </form>
      </div>
    </div>
  );
};

export default GuestLoginPage;
