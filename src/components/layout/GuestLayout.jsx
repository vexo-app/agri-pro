// src/components/layout/GuestLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import GuestSidebar from "./GuestSidebar";
import { MenuIcon, EyeIcon } from "../ui/Icons";

/**
 * الشكل العام لواجهة الضيف: بانر ثابت واضح فوق كل صفحة (البرومبت الأصلي
 * كان صريح في ضرورة وجوده) + قائمة جانبية فيها الأقسام المفعّلة بس.
 */
const GuestLayout = () => {
  const { ownerProfile, access } = useGuest();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const companyLabel = ownerProfile?.displayName || ownerProfile?.email || access?.name || "الحساب";

  return (
    <div className="flex h-screen bg-dark overflow-hidden font-arabic" dir="rtl">
      <div className="hidden lg:flex lg:flex-shrink-0">
        <GuestSidebar />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 right-0 z-50 lg:hidden transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <GuestSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* بانر ثابت — موجود فوق كل صفحة، ثابت لا يختفي مع السكرول */}
        <div className="flex items-center gap-3 bg-amber-900/30 border-b border-amber-700/40 px-4 py-2.5 text-amber-300 text-xs sm:text-sm font-semibold flex-shrink-0">
          <button className="lg:hidden text-amber-300" onClick={() => setSidebarOpen(true)}>
            <MenuIcon size={18} />
          </button>
          <EyeIcon size={16} className="hidden sm:block text-amber-400 flex-shrink-0" />
          <span className="flex-1 truncate">
            انت بتشوف بيانات <span className="font-bold">{companyLabel}</span> — قراءة فقط، مفيش تعديل أو حذف
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default GuestLayout;
