// src/components/layout/Sidebar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useNotifications } from "../../hooks/useNotifications";
import { formatInputNumber, parseInputNumber } from "../../utils/formatters";
import { ADMIN_UIDS, MAX_MONEY_VALUE } from "../../config/constants";
import { FOCUS_FUEL_PRICE_EVENT, FUEL_PRICE_SAVED_EVENT } from "../../utils/uiEvents";
import {
  HomeIcon, TractorIcon, ClipboardIcon,
  DriverIcon, WrenchIcon, ChartIcon,
  FuelIcon, LogoutIcon, AlertIcon, WalletIcon, ShieldIcon, BugIcon, MegaphoneIcon, DownloadIcon, ReceiptIcon, TruckIcon, SearchIcon,
  SettingsIcon, ChevronLeftIcon,
} from "../ui/Icons";
import sidebarBrandBg from "../../assets/landing/sidebar-brand-bg.webp";

// moduleKey يربط العنصر بمزية باقة (راجع src/config/constants/billing.js
// → PLANS[].features وsrc/utils/licenseState.js) — العناصر اللي معاها
// moduleKey بتتخفي تلقائيًا لو الباقة الحالية مش شاملة المزية دي، بنفس
// المنطق اللي بيمنع الوصول المباشر بالرابط في RequireModule.jsx.
const NAV_ITEMS = [
  { to: "/",              label: "الرئيسية",       Icon: HomeIcon      },
  { to: "/equipment",     label: "المعدات",         Icon: TractorIcon   },
  { to: "/jobs",          label: "سجل الشغل",       Icon: ClipboardIcon },
  { to: "/clients",       label: "العملاء والديون", Icon: AlertIcon,    moduleKey: "clients" },
  { to: "/suppliers",     label: "الموردين",        Icon: TruckIcon,    moduleKey: "suppliers" },
  { to: "/drivers",       label: "فريق العمل",      Icon: DriverIcon    },
  { to: "/maintenance",   label: "الصيانة",         Icon: WrenchIcon    },
  { to: "/custody",       label: "العهدة",          Icon: WalletIcon,   moduleKey: "custody" },
  { to: "/tax-deductions", label: "الضرائب والخصومات", Icon: ReceiptIcon },
  { to: "/notifications", label: "التنبيهات",       Icon: AlertIcon, badge: true },
  { to: "/reports",       label: "التقارير",        Icon: ChartIcon     },
  // "الاشتراك" اتنقل جوه صفحة الملف الشخصي (تاب) بدل ما يكون عنصر منفصل
  // هنا — الرابط ده بقى بياخد لصفحة الملف الشخصي نفسها، واسمه هنا
  // "الإعدادات" بدل الاعتماد على زرار اسم المستخدم تحت بس.
  { to: "/profile",       label: "الإعدادات",       Icon: SettingsIcon  },
];

const ADMIN_ITEMS = [
  { to: "/admin",                 label: "حسابات الشركات",     Icon: ShieldIcon,    end: true },
  { to: "/admin/errors",          label: "سجل الأخطاء",         Icon: BugIcon },
  { to: "/admin/messages",        label: "إرسال تنبيه",         Icon: MegaphoneIcon },
  { to: "/admin/backup-to-excel", label: "تحويل نسخة لإكسيل",   Icon: DownloadIcon },
  { to: "/admin/data-integrity",  label: "فحص تكامل البيانات",  Icon: SearchIcon },
];

// onClose: يقفل درج الموبايل بعد أي نقرة (undefined على الديسكتوب).
// collapsed / onToggleCollapse: وضع "أيقونات بس" على الديسكتوب فقط — درج
// الموبايل بيتعمله render من غير الـ props دي فيفضل دايمًا بعرضه الكامل.
const Sidebar = ({ onClose, collapsed = false, onToggleCollapse }) => {
  const { user, logout }           = useAuth();
  const { settings, saveSettings } = useData();
  const { totalCount, highCount }  = useNotifications();
  const { modules } = useEntitlement();

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.moduleKey || modules?.[item.moduleKey]);
  const navigate = useNavigate();
  const isAdmin = ADMIN_UIDS.includes(user?.uid);

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
    if (val > 0 && val <= MAX_MONEY_VALUE) {
      saveSettings({ fuelPrice: val });
      // audit roadmap Phase 7: بلّغ أي بانر تعريفي مرتبط (زي بانر "سعر
      // الوقود" في DashboardPage.jsx) إن المستخدم خلاص حفظ السعر، عشان
      // يقفل نفسه تلقائي بدل ما يستنى قفل يدوي بعد ما الهدف اتحقق.
      window.dispatchEvent(new CustomEvent(FUEL_PRICE_SAVED_EVENT));
    }
  };

  // audit roadmap Phase 7: بانر "سعر الوقود" في الداشبورد بيبعت الحدث ده
  // (بدل ما يعمل navigate لصفحة مش موجودة — حقل سعر الوقود جوه القائمة
  // الجانبية نفسها، مش صفحة منفصلة) عشان يوجّه المستخدم للحقل هنا فعلياً
  // (سكرول + focus + هايلايت مؤقت)، بدل ما يسيبه يدوّر عليه بنفسه.
  //
  // Sidebar.jsx بيترندر مرتين في نفس الوقت (نسخة ديسكتوب دايماً ظاهرة،
  // ونسخة الدرج بتاع الموبايل جوه AppLayout.jsx) — الاتنين بيستقبلوا نفس
  // الحدث، فبنتأكد إن اللي بيرد فعلياً هو بس النسخة الظاهرة فعلاً على
  // الشاشة (offsetWidth > 0)، مش الاتنين مع بعض. لو النسخة الظاهرة كانت
  // مطوية (collapsed) بنوسّعها الأول عشان الحقل يبقى موجود أصلاً.
  const fuelInputRef = React.useRef(null);
  const [fuelHighlight, setFuelHighlight] = React.useState(false);

  React.useEffect(() => {
    const handler = () => {
      if (collapsed) onToggleCollapse?.(false);
      // تأخير بسيط عشان لو درج الموبايل لسه بيتفتح (AppLayout.jsx بيسمع
      // نفس الحدث ده كمان ويفتحه)، أو لو الشريط كان مطوي ولسه بيتوسّع،
      // الـ transition بتاعهم يخلص الأول قبل ما نحسب offsetWidth.
      setTimeout(() => {
        const el = fuelInputRef.current;
        if (!el || el.offsetWidth === 0) return; // النسخة التانية (مش الظاهرة)
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
        setFuelHighlight(true);
        setTimeout(() => setFuelHighlight(false), 2200);
      }, 350);
    };
    window.addEventListener(FOCUS_FUEL_PRICE_EVENT, handler);
    return () => window.removeEventListener(FOCUS_FUEL_PRICE_EVENT, handler);
  }, [collapsed, onToggleCollapse]);

  // عنصر قائمة واحد — بيتصرف مع وضع "مطوي" (أيقونة بس، بدون تسمية) بدل ما
  // نكرر نفس المنطق الشرطي في كل رابط لوحده (كانت 6 نسخ متطابقة تقريبًا).
  const renderNavLink = ({ to, label, Icon, end, badge, adminStyle }) => (
    <NavLink
      key={to}
      to={to}
      end={end ?? to === "/"}
      onClick={onClose}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        clsx(
          "group relative flex items-center rounded-xl text-sm font-semibold transition-all duration-150",
          collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-3 py-2.5",
          isActive
            ? adminStyle
              ? "bg-gradient-to-l from-purple-900/60 to-purple-900/20 text-purple-300 border border-purple-800/50 shadow-sm"
              : "bg-gradient-to-l from-brand-900/60 to-brand-900/20 text-brand-300 border border-brand-800/50 shadow-sm"
            : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={clsx(
              "transition-transform duration-150 group-hover:scale-110 shrink-0",
              isActive ? (adminStyle ? "text-purple-400" : "text-brand-400") : "text-gray-500"
            )}
          />
          {!collapsed && <span className="flex-1">{label}</span>}
          {badge && totalCount > 0 && (
            collapsed ? (
              <span className={clsx(
                "absolute top-1 left-1 w-2 h-2 rounded-full",
                highCount > 0 ? "bg-red-500" : "bg-amber-500"
              )} />
            ) : (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center text-white ${highCount > 0 ? "bg-red-500" : "bg-amber-500"}`}>
                {totalCount}
              </span>
            )
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside className={clsx(
      "relative flex flex-col h-full bg-surface border-l border-white/8 select-none transition-[width] duration-200",
      collapsed ? "w-20" : "w-64"
    )}>

      {/* Collapse toggle — desktop only (onToggleCollapse ماعندوش قيمة على
          نسخة درج الموبايل، فالزرار مايترندرش خالص هناك). */}
      {onToggleCollapse && (
        <button
          onClick={() => onToggleCollapse(!collapsed)}
          title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          className="absolute top-1/2 -translate-y-1/2 -left-3.5 z-20 w-7 h-7 rounded-full bg-surface-3 border border-white/15 flex items-center justify-center text-gray-300 hover:text-brand-400 hover:border-brand-700/50 hover:scale-110 transition-all shadow-lg shadow-black/40"
        >
          <ChevronLeftIcon size={14} className={clsx("transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      )}

      {/* Brand — صورة معدات حقيقية كخلفية بدل التدرج الشفاف البسيط، عشان
          تدي إحساس "منتج SaaS متخصص" بدل خلفية عامة. */}
      <div className={clsx(
        "relative overflow-hidden border-b border-white/8",
        collapsed ? "px-2 py-5" : "px-5 py-6"
      )}>
        <img
          src={sidebarBrandBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark/55 via-dark/80 to-surface" />

        <div className="relative">
          <img
            src="/brand-icon.png"
            alt="زراعي برو"
            className={clsx(
              "rounded-2xl shadow-lg shadow-brand-900/50",
              collapsed ? "w-10 h-10 mx-auto" : "w-11 h-11 mb-3"
            )}
          />
          {!collapsed && (
            <>
              <p className="text-base font-extrabold text-gray-100 leading-tight">زراعي برو</p>
              <p className="text-xs text-brand-400 font-medium mt-0.5">بيانات أوضح. قرارات أذكى. أرباح أكبر.</p>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={clsx("flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">القائمة</p>
        )}
        {visibleNavItems.map(({ to, label, Icon, badge }) => renderNavLink({ to, label, Icon, badge }))}

        {isAdmin && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2 mt-4">أدمن</p>
            )}
            {collapsed && <div className="border-t border-white/8 my-2" />}
            {ADMIN_ITEMS.map((item) => renderNavLink({ ...item, adminStyle: true }))}
          </>
        )}
      </nav>

      {/* Fuel Price — بيتخفي في الوضع المطوي (مساحة صغيرة أوي عشان input +
          label كامل)؛ لو المستخدم محتاجه يوسّع الشريط بنقرة واحدة. */}
      {!collapsed && (
        <div className="px-4 pb-3 border-t border-white/8 pt-4">
          <div className={clsx(
            "bg-surface-2 rounded-xl p-3 border transition-all duration-300",
            fuelHighlight ? "border-amber-500 ring-2 ring-amber-500/40" : "border-white/8"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <FuelIcon size={14} className="text-gray-500" />
              <p className="text-[11px] text-gray-500 font-semibold">سعر اللتر (ج.م)</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fuelInputRef}
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
      )}

      {/* User */}
      <div className={clsx("pb-5 pt-2 border-t border-white/8", collapsed ? "px-2" : "px-4")}>
        <button
          onClick={() => { navigate("/profile"); onClose?.(); }}
          title={collapsed ? (user?.displayName || user?.email || "المستخدم") : undefined}
          className={clsx(
            "w-full flex items-center rounded-xl transition-colors hover:bg-white/5",
            collapsed ? "justify-center p-1.5" : "gap-3 text-right p-1.5 -m-1.5"
          )}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {(user?.displayName || user?.email || "م").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </button>
        {collapsed && (
          <button
            onClick={logout}
            title="تسجيل الخروج"
            className="mt-2 w-full flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-900/20"
          >
            <LogoutIcon size={16} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
