// src/components/layout/GuestSidebar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useGuest } from "../../contexts/GuestContext";
import {
  TractorIcon, ClipboardIcon, DriverIcon, WrenchIcon,
  WalletIcon, ReceiptIcon, TruckIcon, LogoutIcon,
} from "../ui/Icons";

// نفس مفاتيح sections في guestAccess (firestore.rules → sectionOpen).
// Exported عشان GuestHomePage.jsx يستخدم نفس الليستة (زرارات الأقسام).
export const NAV_ITEMS = [
  { section: "equipment",     to: "/guest/app/equipment",      label: "المعدات",   Icon: TractorIcon   },
  { section: "jobs",          to: "/guest/app/jobs",           label: "سجل الشغل", Icon: ClipboardIcon },
  { section: "drivers",       to: "/guest/app/drivers",        label: "فريق العمل", Icon: DriverIcon    },
  { section: "maintenance",   to: "/guest/app/maintenance",    label: "الصيانة",   Icon: WrenchIcon    },
  { section: "custody",       to: "/guest/app/custody",        label: "العهدة",    Icon: WalletIcon    },
  { section: "taxDeductions", to: "/guest/app/tax-deductions", label: "الضرائب والخصومات", Icon: ReceiptIcon },
  { section: "suppliers",     to: "/guest/app/suppliers",      label: "الموردين",  Icon: TruckIcon     },
];

const GuestSidebar = ({ onClose }) => {
  const { isSectionOpen } = useGuest();
  const navigate = useNavigate();
  const visible = NAV_ITEMS.filter((item) => isSectionOpen(item.section));

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/guest", { replace: true });
  };

  return (
    <aside className="flex flex-col h-full bg-surface border-l border-white/8 w-64 select-none">
      <div className="px-5 py-6 border-b border-white/8 bg-gradient-to-bl from-brand-900/30 to-transparent">
        <img src="/brand-icon.png" alt="زراعي برو" className="w-11 h-11 rounded-2xl mb-3 shadow-lg shadow-brand-900/50" />
        <p className="text-base font-extrabold text-gray-100 leading-tight">زراعي برو</p>
        <p className="text-xs text-amber-400 font-medium mt-0.5">وضع الضيف — قراءة فقط</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.length === 0 && (
          <p className="text-xs text-gray-500 px-2">مفيش أقسام متاحة ليك حاليًا.</p>
        )}
        {visible.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                isActive
                  ? "bg-gradient-to-l from-brand-900/60 to-brand-900/20 text-brand-300 border border-brand-800/50 shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={clsx("transition-transform duration-150 group-hover:scale-110", isActive ? "text-brand-400" : "text-gray-500")} />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-5 pt-2 border-t border-white/8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-right rounded-xl p-2.5 transition-colors hover:bg-red-900/20 text-gray-400 hover:text-red-400"
        >
          <LogoutIcon size={16} />
          <span className="text-xs font-bold flex-1">خروج</span>
        </button>
      </div>
    </aside>
  );
};

export default GuestSidebar;
