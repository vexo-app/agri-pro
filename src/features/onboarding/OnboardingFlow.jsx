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
// Visual language (v3 — official brand identity pass):
// Brings in the *official* زراعي برو brand kit (see /brand-identity
// deliverable): the real App Icon asset (used as-is, byte-for-byte,
// copied to public/brand/app-icon.png — never redrawn/recolored/
// stretched), the exact documented palette (Primary #8CFF00 used
// sparingly as the CTA accent, Secondary #22C55E — which is simply
// this app's existing `brand-500` token, so no new color for that
// role — for success/active states, Dark Background #0F172A for the
// onboarding canvas), and the single approved tagline
// "بيانات أوضح. قرارات أذكى. أرباح أكبر." on the welcome step only
// (brand screens shouldn't repeat the full lockup on every step).
// Everything else — the numbered RTL stepper, grouped form, subtle
// geometric backdrop, Card/Button/Input components, validation,
// Firebase calls — is unchanged from the previous visual pass.
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
  UserIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  TractorIcon,
  DriverIcon,
  AlertIcon,
  ChartIcon,
} from "../../components/ui/Icons";

const TOTAL_STEPS = 3;
const STEP_LABELS = ["مرحبًا", "بيانات الشركة", "اكتمل الإعداد"];

// Official brand tokens (from the زراعي برو brand-identity kit).
// Primary is intentionally NOT added to tailwind.config.js — it is
// used in exactly the few spots the brand guide calls out (main CTA,
// active step, subtle glows), scoped to this screen only.
const BRAND_PRIMARY = "#8CFF00"; // Primary Green — CTA / active accents only
const BRAND_TAGLINE = "بيانات أوضح. قرارات أذكى. أرباح أكبر.";

// Quick "basics" tour shown on the welcome step — a short, interactive
// introduction to the app's core sections before the user ever signs
// in to the real dashboard. Pure local UI state (no persistence, no
// navigation) so it can't affect onboarding's own data flow.
const TOUR_SLIDES = [
  {
    Icon: TractorIcon,
    title: "المعدات",
    desc: "سجّل معداتك وتابع حالتها وساعات تشغيلها بسهولة.",
  },
  {
    Icon: DriverIcon,
    title: "السائقون",
    desc: "اربط كل سائق بمعداته وتابع أداءه ومستحقاته أول بأول.",
  },
  {
    Icon: AlertIcon,
    title: "العملاء والديون",
    desc: "تابع فواتير عملائك ومديونياتهم من مكان واحد.",
  },
  {
    Icon: ChartIcon,
    title: "التقارير",
    desc: "شوف أرباحك ومصاريفك في تقارير واضحة وجاهزة.",
  },
];

// Primary-accent button styling, applied on top of the existing
// Button component via `!important` utilities so the shared component
// itself stays untouched — used only for this flow's main CTAs, per
// the brand guide's "Primary = main CTA button, used sparingly" rule.
const PRIMARY_CTA_CLASS =
  "!bg-[#8CFF00] hover:!bg-[#a6ff4d] !text-[#0F172A] !shadow-[0_0_22px_rgba(140,255,0,0.35)]";

// ── Decorative geometric backdrop ───────────────────────────
// Soft brand-colored glow blobs layered with a faint diamond lattice
// and a couple of crisp rotated-square accents — pure atmosphere,
// pointer-events-none, no external assets.
const GeometricBackdrop = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
    <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-900/15 rounded-full blur-3xl" />
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          "linear-gradient(45deg, rgba(140,255,0,0.7) 1px, transparent 1px), linear-gradient(-45deg, rgba(140,255,0,0.7) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
      }}
    />
    <div className="hidden sm:block absolute top-10 left-10 w-16 h-16 border border-brand-500/20 rotate-45 rounded-lg" />
    <div className="hidden sm:block absolute bottom-14 right-10 w-10 h-10 border border-brand-500/15 rotate-45 rounded-md" />
  </div>
);

// ── Brand lockup for the welcome step ───────────────────────
// The official App Icon (used exactly as shipped — no recolor, no
// crop of the artwork, no rotation) mounted on the brand's own
// documented light surface tone, with the icon-glow effect the
// brand guide documents for the icon's lime frame. Name + the single
// approved tagline sit underneath, per "شاشات الترحيب: Primary Logo
// + Tagline" in logo-usage.md.
const BrandLockup = () => (
  <div className="mb-6">
    <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#F1F5F9] p-2 shadow-[0_0_22px_rgba(140,255,0,0.3)]">
      <img
        src="/brand/app-icon.png"
        alt="زراعي برو"
        className="w-full h-full object-contain rounded-xl"
      />
    </div>
    <p className="text-xl font-extrabold text-gray-100 tracking-tight mb-1">زراعي برو</p>
    <p className="text-xs sm:text-[13px] font-semibold text-brand-500 leading-relaxed">
      {BRAND_TAGLINE}
    </p>
  </div>
);

// ── Icon badge for steps 2 & 3 ──────────────────────────────
// Echoes the App Icon's own signature — a dark rounded square with a
// thin lime frame — without reusing the literal logo artwork on every
// screen (the brand guide explicitly discourages repeating the full
// graphic on each step).
const IconBadge = ({ icon }) => (
  <div
    className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-2 border-2 flex items-center justify-center shadow-[0_0_16px_rgba(140,255,0,0.15)]"
    style={{ borderColor: "rgba(140,255,0,0.45)" }}
  >
    <div className="text-brand-400">{icon}</div>
  </div>
);

// ── Interactive "basics" carousel (welcome step) ────────────
// Small, self-contained tour of the app's core sections: dots +
// arrows the user can drive themselves, with a gentle auto-advance
// that pauses the moment the user interacts. Local state only.
const IntroCarousel = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = TOUR_SLIDES.length;

  React.useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 3800);
    return () => clearInterval(timer);
  }, [paused, count]);

  const goTo = (next) => {
    setIndex(((next % count) + count) % count);
    setPaused(true);
  };

  const slide = TOUR_SLIDES[index];

  return (
    <div className="mb-8">
      <div
        className="relative rounded-2xl bg-surface-2/50 border border-white/5 px-10 py-5 min-h-[136px] flex items-center justify-center text-center overflow-hidden"
        role="group"
        aria-roledescription="carousel"
        aria-label="جولة سريعة على أساسيات البرنامج"
      >
        <div key={index} className="flex flex-col items-center gap-2 animate-slide-up">
          <div
            className="w-11 h-11 rounded-xl bg-surface-3 border flex items-center justify-center"
            style={{ borderColor: "rgba(140,255,0,0.35)" }}
          >
            <slide.Icon size={20} className="text-brand-400" />
          </div>
          <p className="text-sm font-extrabold text-gray-100">{slide.title}</p>
          <p className="text-xs text-gray-400 leading-relaxed px-2">{slide.desc}</p>
        </div>

        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="الشريحة السابقة"
          className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full bg-surface-2 border border-white/10 flex items-center justify-center text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
        >
          <ChevronLeftIcon size={14} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="الشريحة التالية"
          className="absolute top-1/2 -translate-y-1/2 left-2 w-7 h-7 rounded-full bg-surface-2 border border-white/10 flex items-center justify-center text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
        >
          <ChevronLeftIcon size={14} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="مؤشر الشرائح">
        {TOUR_SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.title}
            onClick={() => goTo(i)}
            className={clsx(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-5 bg-[#8CFF00]" : "w-1.5 bg-white/15"
            )}
          />
        ))}
      </div>
    </div>
  );
};

// ── Numbered SaaS stepper (reads right → left, native to RTL) ──
// Completed = brand-500 (the brand's own Secondary Green, used for
// success/positive states). Current = the brand's Primary lime,
// matching the guide's "Primary = active state" rule.
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
                isCurrent && "bg-[#8CFF00]/15 border-[#8CFF00] text-[#8CFF00] ring-4 ring-[#8CFF00]/15 scale-105",
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

const Shell = ({ step, badge, wide = false, children }) => (
  <div
    className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 font-arabic overflow-hidden"
    style={{ backgroundColor: "#0F172A" }}
    dir="rtl"
  >
    <GeometricBackdrop />

    <div className={clsx("relative w-full", wide ? "max-w-md sm:max-w-lg" : "max-w-sm")}>
      <div
        key={step}
        className="relative bg-surface border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-black/40 animate-slide-up overflow-hidden"
      >
        <div
          className="absolute top-0 inset-x-0 h-1"
          style={{ background: `linear-gradient(to left, ${BRAND_PRIMARY}, #22C55E, #15803D)` }}
        />
        <Stepper step={step} />
        {badge}
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
      <Shell step={1} badge={<BrandLockup />}>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-100 leading-snug mb-3 tracking-tight">
          أهلاً بك 👋
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-7 px-1">
          نظام بسيط واحترافي لمتابعة المعدات والسائقين والعملاء والمصاريف —
          كل حاجة محتاجها لإدارة شغلك في مكان واحد.
        </p>

        <IntroCarousel />

        <Button
          className={clsx("w-full mb-3", PRIMARY_CTA_CLASS)}
          icon={<ChevronLeftIcon size={16} />}
          onClick={() => setStep(2)}
        >
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
      <Shell step={2} badge={<IconBadge icon={<UserIcon size={24} />} />} wide>
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
          <Button
            className={clsx("flex-1", PRIMARY_CTA_CLASS)}
            loading={saving}
            icon={<ChevronLeftIcon size={16} />}
            onClick={saveBasicSetup}
          >
            متابعة
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={3} badge={<IconBadge icon={<CheckCircleIcon size={26} />} />}>
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

      <Button
        className={clsx("w-full", PRIMARY_CTA_CLASS)}
        loading={saving}
        icon={<ChevronLeftIcon size={16} />}
        onClick={finishOnboarding}
      >
        الذهاب إلى لوحة التحكم
      </Button>
    </Shell>
  );
};

export default OnboardingFlow;
