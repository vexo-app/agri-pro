// src/components/dashboard/OnboardingChecklist.jsx
//
// audit roadmap Phase 7: "قائمة onboarding موجّهة لأول دخول" +
// "بيانات تجريبية اختيارية (demo data)". قائمة بسيطة بتظهر فوق الداشبورد
// لحساب لسه في أول استخدامه، وبتختفي لوحدها أول ما المستخدم يكمّل خطواتها
// أو يقفلها بنفسه (يدوياً، من الزرار فوق) — شوف
// hooks/useOnboardingChecklist.js للمنطق الكامل.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useOnboardingChecklist } from "../../hooks/useOnboardingChecklist";
import { useData } from "../../contexts/DataContext";
import { seedDemoData } from "../../utils/demoDataSeed";
import { FOCUS_FUEL_PRICE_EVENT } from "../../utils/uiEvents";
import { Card } from "../ui/Card";
import Button from "../ui/Button";
import { CheckCircleIcon, CloseIcon, StarIcon } from "../ui/Icons";

const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const { steps, doneCount, totalSteps, visible, dismiss } = useOnboardingChecklist();
  const { addEquipment, addDriver, addJob, addPayment } = useData();
  const [seeding, setSeeding] = useState(false);

  if (!visible) return null;

  // متاحة بس لسه محدش من الخطوات اتعمل — عشان متتلخبطش مع مستخدم دخل
  // بياناته الحقيقية فعلاً وباقيله خطوة واحدة بس (زي فريق العمل مثلاً).
  const canSeedDemo = doneCount === 0;

  // خطوة "سعر الوقود" مالهاش path (صفحة خاصة بيها) — بدل التنقل، بنبعت
  // نفس الحدث اللي كان زرار بانر "سعر الوقود" القديم بيبعته، عشان يوجّه
  // المستخدم لحقل السعر في القائمة الجانبية (سكرول + focus + هايلايت).
  const handleStepClick = (step) => {
    if (step.done) return;
    if (step.path) navigate(step.path);
    else window.dispatchEvent(new CustomEvent(FOCUS_FUEL_PRICE_EVENT));
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoData({ addEquipment, addDriver, addJob, addPayment });
      toast.success("اتضافت بيانات تجريبية — استكشف بيها البرنامج، واحذفها من نفس الصفحات في أي وقت");
    } catch {
      toast.error("تعذر إضافة البيانات التجريبية، جرّب تاني");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="p-5 border-brand-800/40 bg-brand-900/10 relative overflow-visible">
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء قائمة أول خطوات"
        className="absolute left-4 top-4 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <CloseIcon size={16} />
      </button>

      <div className="flex items-center gap-2 mb-1 pl-6">
        <StarIcon size={16} className="text-brand-400 flex-shrink-0" />
        <h3 className="text-sm font-extrabold text-gray-100">أول خطوات مع زراعي برو</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {doneCount} من {totalSteps} خطوات — كمّل عشان تستفيد من البرنامج بالكامل
      </p>

      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${(doneCount / totalSteps) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => handleStepClick(step)}
            disabled={step.done}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-right transition-colors ${
              step.done ? "bg-surface-2/50 cursor-default" : "bg-surface-2 hover:bg-surface-3 cursor-pointer"
            }`}
          >
            {step.done ? (
              <CheckCircleIcon size={20} className="text-green-400 flex-shrink-0" />
            ) : (
              <span className="w-5 h-5 rounded-full border-2 border-gray-600 flex-shrink-0" />
            )}
            <span className={`text-sm flex-1 ${step.done ? "text-gray-500 line-through" : "text-gray-200 font-semibold"}`}>
              {step.label}
            </span>
          </button>
        ))}
      </div>

      {canSeedDemo && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <p className="text-xs text-gray-500 mb-2">مش عايز تدخل بياناتك الحقيقية دلوقتي؟</p>
          <Button type="button" variant="secondary" size="sm" loading={seeding} onClick={handleSeedDemo}>
            جرّب ببيانات تجريبية بدل كده
          </Button>
        </div>
      )}
    </Card>
  );
};

export default OnboardingChecklist;
