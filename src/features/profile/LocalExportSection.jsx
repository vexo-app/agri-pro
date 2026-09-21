// src/features/profile/LocalExportSection.jsx
//
// قسم "نسخة احتياطية على جهازك" (تنزيل ملف محلي + استرجاع من ملف) —
// منقول هنا حرفيًا من ProfileModal.jsx من غير أي تغيير في السلوك أو
// الشكل. نافذة ImportModal لسه بترندر من ProfileModal نفسه (مش من هنا)
// عشان تفضل sibling لـ div الـ "space-y-5" بالظبط زي الأصل (نفس سبب
// BackupSection.jsx بالظبط — راجع تعليقه). فبنستقبل onOpenImport كـ
// callback بس ونستدعيه.
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { exportService } from "../../services/exportService";
import { formatDateTime } from "../../utils/formatters";
import Button from "../../components/ui/Button";
import { DownloadIcon, ClockIcon, UploadFileIcon } from "../../components/ui/Icons";
import Section from "./Section";

const LocalExportSection = ({ onOpenImport }) => {
  const { user } = useAuth();
  const data = useData();

  const [exporting, setExporting] = useState(false);
  const lastExportKey = user ? `lastLocalExportAt:${user.uid}` : null;
  const [lastExportAt, setLastExportAt] = useState(
    () => (lastExportKey ? localStorage.getItem(lastExportKey) : null)
  );

  const downloadLocalBackup = () => {
    setExporting(true);
    try {
      exportService.downloadBackupFile({
        equipment:     data.equipment,
        jobs:          data.jobs,
        drivers:       data.drivers,
        maintenance:   data.maintenance,
        equipmentFuelEntries: data.equipmentFuelEntries,
        payments:      data.payments,
        supplierInvoices: data.supplierInvoices,
        supplierPayments: data.supplierPayments,
        salaryEntries: data.salaryEntries,
        attendance:    data.attendance,
        custodyTransactions: data.custody,
        taxDeductions: data.taxDeductions,
        settings:      data.settings,
      });
      const now = String(Date.now());
      if (lastExportKey) localStorage.setItem(lastExportKey, now);
      setLastExportAt(now);
      toast.success("اتنزّل ملف النسخة الاحتياطية على جهازك");
    } catch (err) {
      toast.error("تعذر تنزيل النسخة الاحتياطية");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Section icon={<DownloadIcon size={16} />} title="نسخة احتياطية على جهازك">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <ClockIcon size={13} className="flex-shrink-0" />
        {lastExportAt ? (
          <span>آخر تنزيل على الجهاز: {formatDateTime(new Date(Number(lastExportAt)))}</span>
        ) : (
          <span className="text-amber-400 font-semibold">لسه منزّلتش نسخة على جهازك — دي مهمة جدًا</span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        النسخة اللي فوق بتتخزن جوه نفس حساب Firebase. النسخة دي بتنزل ملف فعلي على تليفونك/جهازك، فلو حصلت أي مشكلة في الحساب نفسه، البيانات بتفضل عندك محفوظة برة. يستحسن تنزّل نسخة كل فترة (خصوصًا بعد أي شغل مهم).
      </p>
      <Button
        type="button" size="sm" variant="secondary" className="w-full"
        icon={<DownloadIcon size={15} />}
        loading={exporting}
        onClick={downloadLocalBackup}
      >
        تنزيل نسخة على جهازك
      </Button>

      <button
        type="button"
        onClick={onOpenImport}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 mt-3 transition-colors"
      >
        <UploadFileIcon size={13} />
        استرجاع من ملف محلي
      </button>
    </Section>
  );
};

export default LocalExportSection;
