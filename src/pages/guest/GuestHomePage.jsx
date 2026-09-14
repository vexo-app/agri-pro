// src/pages/guest/GuestHomePage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { NAV_ITEMS } from "../../components/layout/GuestSidebar";
import { GUEST_SECTIONS } from "./guestSectionsConfig";
import { EmptyState } from "../../components/ui/Card";
import { LockIcon } from "../../components/ui/Icons";

/** أول صفحة بعد الدخول — ليستة الأقسام المتاحة كبطاقات، كل واحدة بوصف
 * سطر واحد يوضح محتواها من غير ما الضيف يحتاج يفتحها الأول. */
const GuestHomePage = () => {
  const { isSectionOpen } = useGuest();
  const visible = NAV_ITEMS.filter((item) => isSectionOpen(item.section));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto" />}
        title="مفيش أقسام متاحة ليك حاليًا"
        description="كلّم صاحب الحساب لو محتاج صلاحيات إضافية."
      />
    );
  }

  return (
    <div dir="rtl" className="animate-fade-up">
      <h1 className="text-lg font-bold text-gray-100 mb-1">اختار قسم</h1>
      <p className="text-xs text-gray-500 mb-5">وصول قراءة فقط للأقسام اللي المالك فعّلها ليك.</p>
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(({ to, label, section, Icon, description }, i) => (
          <Link
            key={to}
            to={to}
            style={{ animationDelay: `${i * 40}ms` }}
            className="group flex items-start gap-3.5 bg-surface border border-white/8 rounded-2xl p-4 hover:border-brand-700/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all animate-fade-up"
          >
            <span className="flex-shrink-0 w-11 h-11 rounded-2xl bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-900/50 transition-colors">
              <Icon size={20} className="text-brand-400" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-bold text-gray-100">{label}</span>
              <span className="text-xs text-gray-500 leading-snug">
                {description || GUEST_SECTIONS[section]?.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GuestHomePage;
