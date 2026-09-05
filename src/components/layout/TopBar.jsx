// src/components/layout/TopBar.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import NotificationBell from "../../features/notifications/NotificationBell";
import GlobalSearch     from "../../features/search/GlobalSearch";

const TITLES = {
  "/":              "لوحة التحكم",
  "/equipment":     "المعدات",
  "/jobs":          "سجل الشغل",
  "/drivers":       "فريق العمل",
  "/maintenance":   "الصيانة",
  "/reports":       "التقارير",
  "/clients":       "العملاء والديون",
  "/custody":       "العهدة",
  "/notifications": "التنبيهات",
};

const TopBar = ({ onMenuToggle }) => {
  const { pathname } = useLocation();

  let title = TITLES[pathname];
  if (!title) {
    if (pathname.startsWith("/equipment/")) title = "تفاصيل المعدة";
    else if (pathname.startsWith("/clients/"))  title = "تفاصيل العميل";
    else if (pathname.startsWith("/drivers/"))  title = "الرواتب والحضور";
    else title = "زراعي برو";
  }

  return (
    <header className="sticky top-0 z-30 bg-dark/90 backdrop-blur-md border-b border-white/8 px-4 py-3 flex items-center gap-3 lg:px-6">

      {/* Hamburger */}
      <button onClick={onMenuToggle}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-surface-2 border border-white/10 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Title — hidden on mobile when search is focused */}
      <h1 className="text-base font-bold text-gray-100 lg:text-lg flex-shrink-0 hidden sm:block">{title}</h1>

      {/* Search — takes remaining space */}
      <GlobalSearch />

      {/* Notification bell */}
      <NotificationBell />
    </header>
  );
};

export default TopBar;
