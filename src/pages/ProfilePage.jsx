// src/pages/ProfilePage.jsx
//
// صفحة كاملة للملف الشخصي بدل نافذة صغيرة (ProfileModal القديمة، بقت
// غير مستخدمة واتشالت) — بنفس تخطيط أي صفحة تانية في التطبيق (هيدر +
// تبويبات، زي نمط ReportsPage.jsx بالظبط) عشان تبقى شكلها زي أي برنامج
// SaaS احترافي.
//
// أهم حاجة هنا: صفر منطق جديد. كل قسم (بيانات الفاتورة/الأمان/النسخ
// الاحتياطي/حذف الحساب) هو نفسه الكومبوننت الموجود أصلاً في
// src/features/profile/*.jsx بالحرف الواحد، بنفس الـ props اللي كانت
// بتتبعتله من ProfileModal.jsx — الملف ده بس بيغيّر "الغلاف" (Modal
// واحدة ← صفحة بتبويبات)، مش أي حاجة جوه الأقسام نفسها. ده اللي بيخلي
// المعمارية مبسطة: تعديل واجهة بحت، بدون تكرار أي كود أو حساب.
import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import IdentityHeader from "../features/profile/IdentityHeader";
import CompanyInvoiceSection from "../features/profile/CompanyInvoiceSection";
import PasswordSection from "../features/profile/PasswordSection";
import BackupSection from "../features/profile/BackupSection";
import LocalExportSection from "../features/profile/LocalExportSection";
import DeleteAccountSection from "../features/profile/DeleteAccountSection";
import RestoreModal from "../features/profile/RestoreModal";
import ImportModal from "../features/profile/ImportModal";
import GuestAccessSection from "../features/profile/GuestAccessSection";
import BillingPage from "./BillingPage";
import { PrintIcon, LockIcon, CloudUploadIcon, TrashIcon, WalletIcon, UsersGroupIcon } from "../components/ui/Icons";

const TABS = [
  { id: "billing",     label: "الاشتراك",          Icon: WalletIcon      },
  { id: "invoice",     label: "بيانات الفاتورة",   Icon: PrintIcon       },
  { id: "security",    label: "الأمان",            Icon: LockIcon        },
  { id: "backup",      label: "النسخ الاحتياطي",   Icon: CloudUploadIcon },
  { id: "guestAccess", label: "الوصول للضيوف",     Icon: UsersGroupIcon  },
  { id: "danger",      label: "منطقة الخطر",       Icon: TrashIcon       },
];

const ProfilePage = () => {
  const { user } = useAuth();
  const { settings, saveSettings } = useData();
  // بيدعم فتح تاب معين مباشرة (زي تنبيه "النسخ الاحتياطي متوقف" اللي بيودّي
  // هنا على تاب "النسخ الاحتياطي" تحديدًا) عبر navigate("/profile", { state:
  // { tab: "..." } }) — لو مفيش state، بيفتح على "الاشتراك" زي ما كان.
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab || "billing");

  // نفس فكرة RestoreModal/ImportModal في ProfileModal.jsx القديمة —
  // البيبقوا sibling للتاب المفتوح، مش جوه BackupSection/LocalExportSection
  // نفسهم، لنفس السبب الموثّق في تعليقات الملفين دول.
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // تاب "الاشتراك" محتاج عرض أوسع (زي صفحة /billing المستقلة بالظبط)
  // عشان بطاقات الباقات التلاتة تتعرض جنب بعض من غير ما تتزنق.
  return (
    <div className={`p-4 lg:p-6 mx-auto ${tab === "billing" ? "max-w-5xl" : "max-w-3xl"}`} dir="rtl">
      {/* Header — زي هيدر أي صفحة تانية في التطبيق */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-100 mb-4">الملف الشخصي</h1>
        {/* open={true} ثابتة بدل الحالة المتغيرة اللي كانت جاية من
            ProfileModal — الغرض الوحيد منها هناك كان إعادة ضبط الاسم
            المعروض كل مرة "النافذة" تتفتح؛ هنا الصفحة بتتفتح (تتماونت)
            مرة واحدة زي أي صفحة تانية، فنفس الـ useEffect جوه
            IdentityHeader بيشتغل تلقائيًا عند أول تحميل. */}
        <IdentityHeader open={true} />
      </div>

      {/* Tabs — نفس نمط التبويب المستخدم فعليًا في ReportsPage.jsx */}
      <div className="flex bg-surface-2 rounded-2xl p-1 mb-5 gap-1 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              tab === id ? "bg-surface text-gray-100 shadow-md" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon size={16} className={tab === id ? (id === "danger" ? "text-red-400" : "text-brand-400") : "text-gray-500"} />
            {label}
          </button>
        ))}
      </div>

      {tab === "billing" && <BillingPage embedded />}

      {tab === "invoice" && (
        <CompanyInvoiceSection user={user} settings={settings} saveSettings={saveSettings} />
      )}

      {tab === "security" && <PasswordSection />}

      {tab === "backup" && (
        <div className="space-y-5">
          <BackupSection open={true} onOpenRestore={() => setRestoreOpen(true)} />
          <LocalExportSection onOpenImport={() => setImportOpen(true)} />
        </div>
      )}

      {tab === "guestAccess" && <GuestAccessSection />}

      {tab === "danger" && <DeleteAccountSection />}

      <RestoreModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
};

export default ProfilePage;
