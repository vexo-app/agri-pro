// src/features/messaging/WhatsAppButton.jsx
//
// زرار واتساب + سهم صغير يفتح قائمة القوالب. لو مفيش رقم صالح، الزرار
// يبقى disabled مع تلميح ("سجّل رقم الأول" أو غيره حسب الاستخدام). كل
// حاجة هنا UI بس — اختيار القالب بيتبعت لـ onPick، والـcaller (عادةً
// WhatsAppAction) هو اللي بيقرر يعمل إيه بيه (يفتح Modal المعاينة).
import React, { useState, useRef, useEffect } from "react";
import { WhatsAppIcon, ChevronDownIcon } from "../../components/ui/Icons";
import { hasValidWhatsappPhone } from "../../utils/whatsapp";

const WhatsAppButton = ({ phone, templates, disabledHint = "سجّل رقم الأول", onPick }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const enabled = hasValidWhatsappPhone(phone) && templates?.length > 0;

  if (!enabled) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-center gap-1.5 bg-surface-2 border border-white/8 text-gray-600 text-xs font-bold py-2 px-3 rounded-xl cursor-not-allowed select-none">
          <WhatsAppIcon size={14} />
          واتساب
        </div>
        <span className="text-[10px] text-gray-600 text-center">{disabledHint}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex rounded-xl overflow-hidden"
      >
        <span className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-500 transition-colors text-white text-xs font-bold py-2 px-3">
          <WhatsAppIcon size={14} />
          واتساب
        </span>
        <span className="w-7 flex items-center justify-center bg-brand-700">
          <ChevronDownIcon size={13} className={`text-brand-50 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1.5 inset-x-0 bg-surface-2 border border-white/10 rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setOpen(false); onPick(t); }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-200 hover:bg-surface-3 transition-colors text-right"
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton;
