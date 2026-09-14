// src/components/layout/AppLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar      from "./Sidebar";
import TopBar       from "./TopBar";
import BottomNav    from "./BottomNav";
import OfflineBanner from "../ui/OfflineBanner";
import SubscriptionStatusBanner from "./SubscriptionStatusBanner";
import { FOCUS_FUEL_PRICE_EVENT } from "../../utils/uiEvents";
import { trackPageview } from "../../config/posthog";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // PostHog pageview — يبعت المسار بس (منقّى من أي اسم حقيقي، شوف
  // src/config/posthog.js) مع كل تنقل بين الصفحات جوه التطبيق.
  useEffect(() => { trackPageview(pathname); }, [pathname]);

  // audit roadmap Phase 7: على الموبايل حقل سعر الوقود مش ظاهر إلا لو
  // درج القائمة الجانبية مفتوح — فبانر "سعر الوقود" (شوف DashboardPage.jsx)
  // بيبعت نفس الحدث ده كمان عشان الدرج يتفتح تلقائي قبل ما Sidebar.jsx
  // يعمل focus/scroll للحقل نفسه. على الديسكتوب القائمة ظاهرة دايماً،
  // فده مجرد setState من غير أي تأثير فعلي.
  useEffect(() => {
    const handler = () => setSidebarOpen(true);
    window.addEventListener(FOCUS_FUEL_PRICE_EVENT, handler);
    return () => window.removeEventListener(FOCUS_FUEL_PRICE_EVENT, handler);
  }, []);

  return (
    <div className="flex h-screen bg-dark overflow-hidden font-arabic" dir="rtl">

      {/* Offline / Install banner */}
      <OfflineBanner />

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 lg:hidden transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen((s) => !s)} />
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-6">
          <SubscriptionStatusBanner />
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default AppLayout;
