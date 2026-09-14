// src/pages/guest/GuestHomePage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { NAV_ITEMS } from "../../components/layout/GuestSidebar";
import { EmptyState } from "../../components/ui/Card";

/** أول صفحة بعد الدخول — ليستة الأقسام المتاحة كزرارات. */
const GuestHomePage = () => {
  const { isSectionOpen } = useGuest();
  const visible = NAV_ITEMS.filter((item) => isSectionOpen(item.section));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon="🔒"
        title="مفيش أقسام متاحة ليك حاليًا"
        description="كلّم صاحب الحساب لو محتاج صلاحيات إضافية."
      />
    );
  }

  return (
    <div dir="rtl">
      <h1 className="text-lg font-bold text-gray-100 mb-4">اختار قسم</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visible.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 bg-surface border border-white/8 rounded-2xl p-5 hover:border-brand-700/50 hover:-translate-y-0.5 transition-all"
          >
            <Icon size={24} className="text-brand-400" />
            <span className="text-sm font-semibold text-gray-200">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GuestHomePage;
