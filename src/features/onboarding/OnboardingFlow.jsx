// src/features/onboarding/OnboardingFlow.jsx
// ─────────────────────────────────────────────────────────
// P1.1 — Professional Arabic (RTL) onboarding for first-time users.
// Three steps: welcome → business setup → completion.
//
// Persistence: reuses the existing settings document that already
// stores company/invoice info (see settingsService / ProfileModal's
// CompanyInvoiceSection) — no new collections or documents, no new
// fields. Onboarding completion is stored as `settings.onboardingCompleted`,
// saved with the same `saveSettings()` used everywhere else in the app.
//
// Fields shown here are limited to what the data model already
// supports today (checked against CompanyInvoiceSection's `company`
// shape: name, address, commercialRegister, taxNumber, logo — no
// dedicated phone/currency/fiscal-year/business-type fields exist,
// so those are intentionally left out rather than inventing new ones).
// ─────────────────────────────────────────────────────────
import React, { useState } from "react";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { HomeIcon, UserIcon, CheckCircleIcon, ChevronLeftIcon } from "../../components/ui/Icons";

const TOTAL_STEPS = 3;
const STEP_LABELS = ["مرحبًا", "بيانات الشركة", "اكتمل الإعداد"];

// ── Progress indicator ──────────────────────────────────────
const ProgressBar = ({ step }) => (
  <div className="mb-6">
    <div className="flex items-center gap-1.5" dir="ltr">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            i < step ? "bg-brand-500" : "bg-white/10"
          }`}
        />
      ))}
    </div>
    <p className="text-[11px] text-gray-500 mt-2 font-semibold tracking-wide">
      الخطوة {step} من {TOTAL_STEPS} · {STEP_LABELS[step - 1]}
    </p>
  </div>
);

const Shell = ({ step, icon, children }) => (
  <div className="min-h-screen bg-dark flex items-center justify-center p-4 font-arabic" dir="rtl">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-900/15 rounded-full blur-3xl" />
    </div>

    <div className="relative w-full max-w-sm">
      <div
        key={step}
        className="bg-surface border border-white/8 rounded-2xl p-6 sm:p-7 text-center shadow-xl shadow-black/30 animate-slide-up"
      >
        <ProgressBar step={step} />
        <div className="w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-700/40 flex items-center justify-center mx-auto mb-5 text-brand-400">
          {icon}
        </div>
        {children}
      </div>
    </div>
  </div>
);

const OnboardingFlow = () => {
  const { user } = useAuth();
  const { settings, saveSettings } = useData();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState(settings?.company?.name || "");
  const [adminName, setAdminName] = useState(user?.displayName || "");
  const [address, setAddress] = useState(settings?.company?.address || "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await saveSettings({ onboardingCompleted: true });
    } catch (err) {
      // best-effort — لو الحفظ فشل (مثلاً أوف لاين)، متسيبش المستخدم عالق
      // على شاشة الإعداد؛ هيتحاول يتسجل تاني في أقرب فرصة يفتح فيها التطبيق.
      toast.error("تعذر حفظ حالة الإعداد، لكن تقدر تكمل استخدام التطبيق");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => finishOnboarding();

  const validateStep2 = () => {
    const next = {};
    if (!companyName.trim()) next.companyName = "اسم الشركة أو المؤسسة مطلوب";
    if (!adminName.trim()) next.adminName = "اسم المسؤول مطلوب";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveBasicSetup = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    try {
      if (adminName.trim() !== (user?.displayName || "")) {
        await updateProfile(auth.currentUser, { displayName: adminName.trim() });
      }
      await saveSettings({
        company: {
          ...(settings?.company || {}),
          name: companyName.trim(),
          address: address.trim(),
        },
      });
      setStep(3);
    } catch (err) {
      toast.error("تعذر حفظ البيانات، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    return (
      <Shell step={1} icon={<HomeIcon size={26} />}>
        <h1 className="text-xl font-extrabold text-gray-100 leading-snug mb-2">
          أهلاً بك في نظام إدارة أعمالك
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-7">
          نظام بسيط واحترافي لمتابعة المعدات والسائقين والعملاء والمصاريف —
          كل حاجة محتاجها لإدارة شغلك في مكان واحد.
        </p>
        <Button className="w-full mb-3" onClick={() => setStep(2)}>
          ابدأ الآن
        </Button>
        <button
          type="button"
          onClick={skip}
          disabled={saving}
          className="w-full text-sm text-gray-500 hover:text-gray-300 py-1.5 transition-colors disabled:opacity-50"
        >
          تخطي
        </button>
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell step={2} icon={<UserIcon size={24} />}>
        <h1 className="text-lg font-extrabold text-gray-100 mb-2">بيانات الشركة الأساسية</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          هتستخدم في فواتيرك وتقاريرك، وتقدر تعدّلها في أي وقت من الملف الشخصي.
        </p>
        <div className="space-y-3.5 text-right mb-7">
          <Input
            label="اسم الشركة / المؤسسة *"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="مزرعة الأمل لتأجير المعدات الزراعية"
            error={errors.companyName}
          />
          <Input
            label="اسم المسؤول *"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="اسمك"
            error={errors.adminName}
          />
          <Input
            label="العنوان"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="كفر الشيخ، طريق دسوق الزراعي"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            className="flex-shrink-0"
            icon={<ChevronLeftIcon size={16} className="rotate-180" />}
            disabled={saving}
            onClick={() => setStep(1)}
          >
            رجوع
          </Button>
          <Button className="flex-1" loading={saving} onClick={saveBasicSetup}>
            متابعة
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={3} icon={<CheckCircleIcon size={26} />}>
      <h1 className="text-xl font-extrabold text-gray-100 mb-2">أنت جاهز للبدء!</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-7">
        تم إعداد حسابك بنجاح، وتقدر تبدأ تستخدم النظام دلوقتي.
      </p>
      <Button className="w-full" loading={saving} onClick={finishOnboarding}>
        الذهاب إلى لوحة التحكم
      </Button>
    </Shell>
  );
};

export default OnboardingFlow;
