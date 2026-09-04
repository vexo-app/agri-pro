// src/features/onboarding/OnboardingFlow.jsx
// ─────────────────────────────────────────────────────────
// P1.1 — Professional Arabic (RTL) onboarding for first-time users.
// Full-screen, branded 3-step flow: welcome → account setup → completion.
//
// Persistence: reuses the existing settings document that already
// stores company/invoice info (see settingsService / ProfileModal's
// CompanyInvoiceSection). Onboarding completion is stored as
// `settings.onboardingCompleted`, saved with the same `saveSettings()`
// used everywhere else in the app — no new collections/documents.
//
// Fields: company name, admin name and phone are new attributes
// added onto the *existing* `settings.company` object (same object
// that already held name/address/commercialRegister/taxNumber/logo),
// so they are also editable later from the Profile page.
// `settingsService.save()` merges into Firestore, so adding these keys
// does not require a migration and cannot affect any existing P0 data.
//
// NOTE: currency / fiscal-year-start were intentionally removed (not
// wired into formatCurrency() or any report elsewhere in the app yet,
// so they had no real effect) — see chat history for the removal request.
// ─────────────────────────────────────────────────────────
import React, { useState } from "react";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  HomeIcon, UserIcon, CheckCircleIcon, ChevronLeftIcon,
} from "../../components/ui/Icons";

const TOTAL_STEPS = 3;
const STEP_META = [
  { label: "مرحبًا بك",     icon: HomeIcon },
  { label: "إعداد الحساب",  icon: UserIcon },
  { label: "اكتمل الإعداد", icon: CheckCircleIcon },
];

// ── Branding panel (full-screen identity side) ──────────────
const BrandPanel = ({ step }) => (
  <aside
    className="relative hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between
      bg-dark-2 border-l border-white/8 p-10 xl:p-14 overflow-hidden"
  >
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-900/25 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -left-16 w-72 h-72 bg-blue-900/15 rounded-full blur-3xl" />
    </div>

    <div className="relative">
      <div className="flex items-center gap-3">
        <img
          src="/brand-icon.png"
          alt="زراعي برو"
          className="w-12 h-12 rounded-2xl shadow-xl shadow-brand-900/40"
        />
        <div>
          <h2 className="text-lg font-extrabold text-gray-100 leading-none">زراعي برو</h2>
          <p className="text-[11px] text-gray-500 mt-1">بيانات أوضح. قرارات أذكى. أرباح أكبر.</p>
        </div>
      </div>
    </div>

    <div className="relative space-y-5">
      {STEP_META.map((s, i) => {
        const idx = i + 1;
        const StepIcon = s.icon;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                active
                  ? "bg-brand-600 border-brand-500 text-white"
                  : done
                  ? "bg-brand-900/40 border-brand-700/50 text-brand-400"
                  : "bg-surface-2 border-white/10 text-gray-600"
              }`}
            >
              <StepIcon size={16} />
            </div>
            <span
              className={`text-sm font-semibold transition-colors duration-300 ${
                active ? "text-gray-100" : done ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>

    <p className="relative text-[11px] tracking-wide text-gray-600">MADE BY: ADHAM FATHY</p>
  </aside>
);

// ── Compact brand header (mobile / small screens) ───────────
const MobileBrandHeader = () => (
  <div className="lg:hidden flex items-center gap-2.5 px-5 pt-6 pb-2">
    <img src="/brand-icon.png" alt="زراعي برو" className="w-8 h-8 rounded-xl" />
    <span className="text-sm font-extrabold text-gray-100">زراعي برو</span>
  </div>
);

// ── Progress bar + step counter (form side) ─────────────────
const ProgressBar = ({ step }) => (
  <div className="mb-7">
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
      {step} من {TOTAL_STEPS} · {STEP_META[step - 1].label}
    </p>
  </div>
);

// ── Full-screen shell (form side) ───────────────────────────
const Shell = ({ step, children }) => {
  const StepIcon = STEP_META[step - 1].icon;
  return (
    <div
      className="relative flex-1 min-h-screen bg-dark flex flex-col font-arabic overflow-y-auto"
      dir="rtl"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-brand-900/15 rounded-full blur-3xl" />
      </div>

      <MobileBrandHeader />

      <div className="relative flex-1 flex items-center justify-center p-5 sm:p-8">
        <div key={step} className="w-full max-w-md animate-slide-up">
          <ProgressBar step={step} />
          <div className="w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-700/40 flex items-center justify-center mb-5 text-brand-400">
            <StepIcon size={26} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

const OnboardingFlow = () => {
  const { user } = useAuth();
  const { settings, saveSettings } = useData();

  const [step, setStep] = useState(1);

  // Step 2 — account setup
  const [companyName, setCompanyName] = useState(settings?.company?.name || "");
  const [adminName, setAdminName]     = useState(user?.displayName || "");
  const [phone, setPhone]             = useState(settings?.company?.phone || "");
  const [errors, setErrors]           = useState({});

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

  const skipAll = () => finishOnboarding();

  const validateStep2 = () => {
    const next = {};
    if (!companyName.trim()) next.companyName = "اسم الشركة أو المؤسسة مطلوب";
    if (!adminName.trim())   next.adminName   = "اسم المسؤول مطلوب";
    if (!phone.trim())       next.phone       = "رقم الهاتف مطلوب";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveAccountSetup = async () => {
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
          phone: phone.trim(),
        },
      });
      setStep(3);
    } catch (err) {
      toast.error("تعذر حفظ البيانات، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  // ── Step 1 — Welcome ───────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex min-h-screen" dir="rtl">
        <BrandPanel step={1} />
        <Shell step={1}>
          <h1 className="text-2xl font-extrabold text-gray-100 leading-snug mb-3">
            أهلاً بك في نظام إدارة أعمالك
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            كل أدواتك في مكان واحد لإدارة أعمالك، ومتابعة العمليات، والمدفوعات،
            والرواتب، والمعدات والتقارير بسهولة.
          </p>
          <Button className="w-full mb-3" size="lg" onClick={() => setStep(2)}>
            ابدأ الآن
          </Button>
          <button
            type="button"
            onClick={skipAll}
            disabled={saving}
            className="w-full text-sm text-gray-500 hover:text-gray-300 py-1.5 transition-colors disabled:opacity-50"
          >
            تخطي
          </button>
        </Shell>
      </div>
    );
  }

  // ── Step 2 — Account setup ──────────────────────────────────
  if (step === 2) {
    return (
      <div className="flex min-h-screen" dir="rtl">
        <BrandPanel step={2} />
        <Shell step={2}>
          <h1 className="text-xl font-extrabold text-gray-100 mb-2">لنبدأ بإعداد حسابك</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            أكمل بعض الإعدادات الأساسية لتجهيز النظام بما يناسب طريقة عملك.
          </p>
          <div className="space-y-3.5 text-right mb-7">
            <Input
              label="اسم الشركة / المؤسسة *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="أدخل اسم الشركة أو المؤسسة"
              error={errors.companyName}
            />
            <Input
              label="اسم المسؤول *"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="أدخل اسم المسؤول"
              error={errors.adminName}
            />
            <Input
              label="رقم الهاتف *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="أدخل رقم الهاتف"
              type="tel"
              dir="ltr"
              className="text-right"
              error={errors.phone}
            />
            <Input
              label="البريد الإلكتروني"
              value={user?.email || ""}
              disabled
              dir="ltr"
              className="text-right opacity-60 cursor-not-allowed"
              hint="بريدك المسجّل — لا يمكن تعديله من هنا"
            />
          </div>
          <div className="flex items-center gap-2.5 mb-3">
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
            <Button className="flex-1" loading={saving} onClick={saveAccountSetup}>
              متابعة
            </Button>
          </div>
          <button
            type="button"
            onClick={skipAll}
            disabled={saving}
            className="w-full text-sm text-gray-500 hover:text-gray-300 py-1.5 transition-colors disabled:opacity-50"
          >
            لاحقًا
          </button>
        </Shell>
      </div>
    );
  }

  // ── Step 3 — Completion ──────────────────────────────────────
  return (
    <div className="flex min-h-screen" dir="rtl">
      <BrandPanel step={3} />
      <Shell step={3}>
        <h1 className="text-2xl font-extrabold text-gray-100 mb-3">أنت جاهز للبدء!</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-3">
          تم إعداد حسابك بنجاح. يمكنك الآن إدارة أعمالك ومتابعة كل شيء من لوحة التحكم.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-8">
          يمكنك تعديل إعداداتك في أي وقت من صفحة الإعدادات.
        </p>
        <Button className="w-full" size="lg" loading={saving} onClick={finishOnboarding}>
          الذهاب إلى لوحة التحكم
        </Button>
      </Shell>
    </div>
  );
};

export default OnboardingFlow;
