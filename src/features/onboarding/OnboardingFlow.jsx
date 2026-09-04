// src/features/onboarding/OnboardingFlow.jsx
// ─────────────────────────────────────────────────────────
// P1.1 — Basic professional Arabic (RTL) onboarding for first-time
// users. Three simple screens: welcome → basic setup → completion.
//
// Persistence: reuses the existing settings document that already
// stores company/invoice info (see settingsService / ProfileModal's
// CompanyInvoiceSection) — no new collections or documents. Onboarding
// completion is stored as `settings.onboardingCompleted`, saved with
// the same `saveSettings()` used everywhere else in the app.
// ─────────────────────────────────────────────────────────
import React, { useState } from "react";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { HomeIcon, UserIcon, CheckCircleIcon } from "../../components/ui/Icons";

const Shell = ({ icon, children }) => (
  <div className="min-h-screen bg-dark flex items-center justify-center p-4 font-arabic" dir="rtl">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-900/15 rounded-full blur-3xl" />
    </div>

    <div className="relative w-full max-w-sm">
      <div className="bg-surface border border-white/8 rounded-2xl p-6 text-center shadow-xl shadow-black/30">
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

  const saveBasicSetup = async () => {
    setSaving(true);
    try {
      if (adminName.trim() && adminName.trim() !== (user?.displayName || "")) {
        await updateProfile(auth.currentUser, { displayName: adminName.trim() });
      }
      await saveSettings({
        company: { ...(settings?.company || {}), name: companyName.trim() },
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
      <Shell icon={<HomeIcon size={26} />}>
        <h1 className="text-xl font-extrabold text-gray-100 leading-snug mb-2">
          أهلاً بك في نظام إدارة أعمالك
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
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
          className="w-full text-sm text-gray-500 hover:text-gray-300 py-1 disabled:opacity-50"
        >
          تخطي
        </button>
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell icon={<UserIcon size={24} />}>
        <h1 className="text-lg font-extrabold text-gray-100 mb-2">إعداد بسيط</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          البيانات دي اختيارية وهتفضل تقدر تعدلها بعدين من الملف الشخصي.
        </p>
        <div className="space-y-3 text-right mb-6">
          <Input
            label="اسم الشركة / المؤسسة"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="مزرعة الأمل لتأجير المعدات الزراعية"
          />
          <Input
            label="اسم المسؤول"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="اسمك"
          />
        </div>
        <Button className="w-full" loading={saving} onClick={saveBasicSetup}>
          متابعة
        </Button>
      </Shell>
    );
  }

  return (
    <Shell icon={<CheckCircleIcon size={26} />}>
      <h1 className="text-xl font-extrabold text-gray-100 mb-2">أنت جاهز للبدء!</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        تم إعداد حسابك بنجاح، وتقدر تبدأ تستخدم النظام دلوقتي.
      </p>
      <Button className="w-full" loading={saving} onClick={finishOnboarding}>
        الذهاب إلى لوحة التحكم
      </Button>
    </Shell>
  );
};

export default OnboardingFlow;
