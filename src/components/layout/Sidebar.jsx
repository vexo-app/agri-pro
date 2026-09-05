// src/components/layout/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useNotifications } from "../../hooks/useNotifications";
import { formatInputNumber, parseInputNumber } from "../../utils/formatters";
import { ADMIN_UIDS, MAX_MONEY_VALUE } from "../../config/constants";
import ProfileModal from "../../features/profile/ProfileModal";
import {
  HomeIcon, TractorIcon, ClipboardIcon,
  DriverIcon, WrenchIcon, ChartIcon,
  FuelIcon, LogoutIcon, AlertIcon, WalletIcon, ShieldIcon, BugIcon, MegaphoneIcon, DownloadIcon, ReceiptIcon,
} from "../ui/Icons";

const NAV_ITEMS = [
  { to: "/",              label: "الرئيسية",       Icon: HomeIcon      },
  { to: "/equipment",     label: "المعدات",         Icon: TractorIcon   },
  { to: "/jobs",          label: "سجل الشغل",       Icon: ClipboardIcon },
  { to: "/clients",       label: "العملاء والديون", Icon: AlertIcon     },
  { to: "/drivers",       label: "فريق العمل",      Icon: DriverIcon    },
  { to: "/maintenance",   label: "الصيانة",         Icon: WrenchIcon    },
  { to: "/custody",       label: "العهدة",          Icon: WalletIcon    },
  { to: "/tax-deductions", label: "الضرائب والخصومات", Icon: ReceiptIcon },
  { to: "/notifications", label: "التنبيهات",       Icon: AlertIcon, badge: true },
  { to: "/reports",       label: "التقارير",        Icon: ChartIcon     },
];

const Sidebar = ({ onClose }) => {
  const { user, logout }           = useAuth();
  const { settings, saveSettings } = useData();
  const { totalCount, highCount }  = useNotifications();

  const [profileOpen, setProfileOpen] = React.useState(false);

  const [fuelDisplay, setFuelDisplay] = React.useState(
    () => formatInputNumber(settings.fuelPrice)
  );

  React.useEffect(() => {
    setFuelDisplay(formatInputNumber(settings.fuelPrice));
  }, [settings.fuelPrice]);

  const handleFuelChange = (e) => {
    const raw = parseInputNumber(e.target.value);
    setFuelDisplay(formatInputNumber(raw));
  };

  const handleSaveFuel = () => {
    const val = Number(parseInputNumber(fuelDisplay));
    if (val > 0 && val <= MAX_MONEY_VALUE) saveSettings({ fuelPrice: val });
  };

  return (
    <aside className="flex flex-col h-full bg-surface border-l border-white/8 w-64 select-none">

      {/* Brand */}
      <div className="px-5 py-6 border-b border-white/8 bg-gradient-to-bl from-brand-900/30 to-transparent">
        <img src="/brand-icon.png" alt="زراعي برو" className="w-11 h-11 rounded-2xl mb-3 shadow-lg shadow-brand-900/50" />
        <p className="text-base font-extrabold text-gray-100 leading-tight">زراعي برو</p>
        <p className="text-xs text-brand-400 font-medium mt-0.5">بيانات أوضح. قرارات أذكى. أرباح أكبر.</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">القائمة</p>
        {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                isActive
                  ? "bg-gradient-to-l from-brand-900/60 to-brand-900/20 text-brand-300 border border-brand-800/50 shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? "text-brand-400" : "text-gray-500"} />
                <span className="flex-1">{label}</span>
                {badge && totalCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center text-white ${highCount > 0 ? "bg-red-500" : "bg-amber-500"}`}>
                    {totalCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {ADMIN_UIDS.includes(user?.uid) && (
          <>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2 mt-4">أدمن</p>
            <NavLink
              to="/admin"
              end
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-l from-purple-900/60 to-purple-900/20 text-purple-300 border border-purple-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldIcon size={18} className={isActive ? "text-purple-400" : "text-gray-500"} />
                  <span className="flex-1">حسابات الشركات</span>
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/errors"
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-l from-purple-900/60 to-purple-900/20 text-purple-300 border border-purple-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <BugIcon size={18} className={isActive ? "text-purple-400" : "text-gray-500"} />
                  <span className="flex-1">سجل الأخطاء</span>
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/messages"
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-l from-purple-900/60 to-purple-900/20 text-purple-300 border border-purple-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <MegaphoneIcon size={18} className={isActive ? "text-purple-400" : "text-gray-500"} />
                  <span className="flex-1">إرسال تنبيه</span>
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/backup-to-excel"
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-l from-purple-900/60 to-purple-900/20 text-purple-300 border border-purple-800/50 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <DownloadIcon size={18} className={isActive ? "text-purple-400" : "text-gray-500"} />
                  <span className="flex-1">تحويل نسخة لإكسيل</span>
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Fuel Price */}
      <div className="px-4 pb-3 border-t border-white/8 pt-4">
        <div className="bg-surface-2 rounded-xl p-3 border border-white/8">
          <div className="flex items-center gap-2 mb-2">
            <FuelIcon size={14} className="text-gray-500" />
            <p className="text-[11px] text-gray-500 font-semibold">سعر اللتر (ج.م)</p>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={fuelDisplay}
              onChange={handleFuelChange}
              className="w-20 bg-surface-3 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-gray-100 text-center focus:outline-none focus:border-brand-600"
              style={{ direction:"ltr" }}
            />
            <button onClick={handleSaveFuel}
              className="flex-1 bg-brand-700 hover:bg-brand-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors">
              حفظ
            </button>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 pb-5 pt-2 border-t border-white/8">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full flex items-center gap-3 text-right rounded-xl p-1.5 -m-1.5 transition-colors hover:bg-white/5"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {(user?.displayName || user?.email || "م").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-200 truncate">{user?.displayName || "المستخدم"}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); logout(); }}
            title="تسجيل الخروج"
            className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-900/20 flex-shrink-0"
          >
            <LogoutIcon size={16} />
          </span>
        </button>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
};

export default Sidebar;
