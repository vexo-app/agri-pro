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
//
// Visual language (v2): Arabic-first premium SaaS look — a restrained
// geometric backdrop (diamond lattice + rotated-square accents), a
// diamond-framed icon badge, a numbered stepper that reads naturally
// right-to-left, and grouped, generously-spaced form sections. All of
// it built from tokens/components that already exist in the design
// system (Card, Button, Input, Icons, brand/surface colors, the
// existing `animate-slide-up` keyframe) — no new dependencies, no
// changed data model, no changed validation/persistence logic.
// ─────────────────────────────────────────────────────────
import React, { useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { SummaryRow } from "../../components/ui/Card";
import {
  TractorIcon,
  UserIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  DriverIcon,
  WalletIcon,
} from "../../components/ui/Icons";

const TOTAL_STEPS = 3;
const STEP_LABELS = ["مرحبًا", "بيانات الشركة", "اكتمل الإعداد"];

const FEATURES = [
  { Icon: TractorIcon, label: "المعدات" },
  { Icon: DriverIcon, label: "السائقون" },
  { Icon: WalletIcon, label: "المصاريف" },
];

// ── Decorative geometric backdrop ───────────────────────────
// Soft brand-colored glow blobs (existing pattern) layered with a
// faint diamond lattice and a couple of crisp rotated-square accents.
// Everything is brand-colored, very low opacity, and pointer-events-none —
// pure atmosphere, no new colors, no external assets.
const GeometricBackdrop = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
    <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-900/15 rounded-full blur-3xl" />
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          "linear-gradient(45deg, rgba(74,222,128,0.8) 1px, transparent 1px), linear-gradient(-45deg, rgba(74,222,128,0.8) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
      }}
    />
    <div className="hidden sm:block absolute top-10 left-10 w-16 h-16 border border-brand-500/20 rotate-45 rounded-lg" />
    <div className="hidden sm:block absolute bottom-14 right-10 w-10 h-10 border border-brand-500/15 rotate-45 rounded-md" />
  </div>
);

// ── Diamond-framed icon badge ────────────────────────────────
const IconBadge = ({ icon }) => (
  <div className="relative w-16 h-16 mx-auto mb-6">
    <div className="absolute inset-0 rotate-45 rounded-2xl bg-gradient-to-br from-brand-500/25 via-brand-600/10 to-transparent border border-brand-500/30" />
    <div className="absolute inset-[3px] rounded-xl bg-surface-2/90 border border-white/5 flex items-center justify-center">
      <div className="text-brand-400">{icon}</div>
    </div>
  </div>
);

// ── Numbered SaaS stepper (reads right → left, native to RTL) ──
const Stepper = ({ step }) => (
  <div className="mb-7" role="group" aria-label="مراحل الإعداد">
    <div className="flex items-center">
      {STEP_LABELS.map((label, idx) => {
        const num = idx + 1;
        const isDone = num < step;
        const isCurrent = num === step;
        return (
          <React.Fragment key={label}>
            <div
              className={clsx(
                "w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all duration-300",
                isDone && "bg-brand-500 border-brand-500 text-dark",
                isCurrent &&
                  "bg-brand-500/15 border-brand-500 text-brand-400 ring-4 ring-brand-500/10 scale-105",
                !isDone && !isCurrent && "bg-surface-2 border-white/10 text-gray-500"
              )}
              aria-current={isCurrent ? "step" : undefined}
              title={label}
            >
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                num
              )}
            </div>
            {num < TOTAL_STEPS && (
              <div
                className={clsx(
                  "h-0.5 flex-1 mx-1.5 rounded-full transition-colors duration-300",
                  isDone ? "bg-brand-500" : "bg-white/10"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
    <p
      className="text-[11px] text-gray-500 mt-3 font-semibold tracking-wide text-center"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={step}
    >
      الخطوة {step} من {TOTAL_STEPS} · {STEP_LABELS[step - 1]}
    </p>
  </div>
);

const Shell = ({ step, icon, wide = false, children }) => (
  <div
    className="relative min-h-screen bg-dark flex items-center justify-center p-4 sm:p-6 font-arabic overflow-hidden"
    dir="rtl"
  >
    <GeometricBackdrop />

    <div className={clsx("relative w-full", wide ? "max-w-md sm:max-w-lg" : "max-w-sm")}>
      <div
        key={step}
        className="relative bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-black/40 animate-slide-up overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-brand-400 via-brand-500 to-brand-700" />
        <Stepper step={step} />
        <IconBadge icon={icon} />
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
      <Shell step={1} icon={<TractorIcon size={26} />}>
        <div className="inline-flex items-center gap-2 bg-surface-2/70 border border-white/8 rounded-full px-3 py-1.5 mb-5">
          <img src="/brand-icon.png" alt="" className="w-5 h-5 rounded-md" />
          <span className="text-[11px] font-bold text-gray-300 tracking-wide">زراعي برو</span>
        </div>

        <h1 className="text-2xl sm:text-[26px] font-extrabold text-gray-100 leading-snug mb-3 tracking-tight">
          أهلاً بك في نظام إدارة أعمالك
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-7 px-1">
          نظام بسيط واحترافي لمتابعة المعدات والسائقين والعملاء والمصاريف —
          كل حاجة محتاجها لإدارة شغلك في مكان واحد.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-8">
          {FEATURES.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-2/50 border border-white/5"
            >
              <Icon size={18} className="text-brand-400" />
              <span className="text-[10px] font-semibold text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        <Button className="w-full mb-3" icon={<ChevronLeftIcon size={16} />} onClick={() => setStep(2)}>
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
      <Shell step={2} icon={<UserIcon size={24} />} wide>
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-100 mb-2 tracking-tight">
          بيانات الشركة الأساسية
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          هتستخدم في فواتيرك وتقاريرك، وتقدر تعدّلها في أي وقت من الملف الشخصي.
        </p>

        <div className="text-right mb-7 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
          </div>

          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-semibold text-gray-400 tracking-wide">العنوان</span>
              <span className="text-[10px] text-gray-500 bg-surface-2 border border-white/8 rounded-full px-2 py-0.5">
                اختياري
              </span>
            </div>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="كفر الشيخ، طريق دسوق الزراعي"
            />
          </div>
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
          <Button className="flex-1" loading={saving} icon={<ChevronLeftIcon size={16} />} onClick={saveBasicSetup}>
            متابعة
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={3} icon={<CheckCircleIcon size={26} />}>
      <h1 className="text-xl sm:text-2xl font-extrabold text-gray-100 mb-2 tracking-tight">
        أنت جاهز للبدء!
      </h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        تم إعداد حسابك بنجاح، وتقدر تبدأ تستخدم النظام دلوقتي.
      </p>

      {companyName.trim() && (
        <div className="rounded-xl bg-surface-2/60 border border-white/8 p-4 mb-7 text-right">
          <SummaryRow label="اسم الشركة" value={companyName} />
          <SummaryRow label="المسؤول" value={adminName || "—"} />
        </div>
      )}

      <Button className="w-full" loading={saving} icon={<ChevronLeftIcon size={16} />} onClick={finishOnboarding}>
        الذهاب إلى لوحة التحكم
      </Button>
    </Shell>
  );
};

export default OnboardingFlow;
