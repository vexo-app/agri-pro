// src/components/layout/BottomNav.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useNotifications } from "../../hooks/useNotifications";
import { useEntitlement } from "../../hooks/useEntitlement";
import { HomeIcon, TractorIcon, ClipboardIcon, ChartIcon, UsersGroupIcon } from "../ui/Icons";

// "العملاء" هنا هي التاب الوحيدة من الخمسة المرتبطة بمزية باقة (clients —
// راجع src/config/constants/billing.js) — بتتخفي لو الباقة الحالية مش
// شاملاها (زي الـ Sidebar بالظبط)، ونعدّل grid-cols حسب العدد الفعلي.
const ITEMS = [
  { to: "/",          label: "الرئيسية", Icon: HomeIcon      },
  { to: "/equipment", label: "المعدات",  Icon: TractorIcon   },
  { to: "/jobs",      label: "الشغل",    Icon: ClipboardIcon },
  { to: "/clients",   label: "العملاء",  Icon: UsersGroupIcon, moduleKey: "clients" },
  { to: "/reports",   label: "تقارير",   Icon: ChartIcon     },
];

const BottomNav = () => {
  const { totalCount, highCount } = useNotifications();
  const { modules } = useEntitlement();

  const visibleItems = ITEMS.filter((item) => !item.moduleKey || modules?.[item.moduleKey]);

  return (
    <nav className={clsx(
      "fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-white/10 grid pb-safe lg:hidden",
      visibleItems.length === 5 ? "grid-cols-5" : "grid-cols-4"
    )}>
      {visibleItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors relative",
              isActive ? "text-brand-400" : "text-gray-500 hover:text-gray-300"
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon size={20} className={isActive ? "text-brand-400" : "text-gray-500"} />
                {/* Show notification dot on clients tab */}
                {to === "/clients" && totalCount > 0 && (
                  <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${highCount > 0 ? "bg-red-500" : "bg-amber-500"}`}>
                    {totalCount > 9 ? "+" : totalCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
