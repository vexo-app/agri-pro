// src/features/profile/BackupSection.jsx
//
// قسم "النسخ الاحتياطي" (نسخة داخل Firebase + استرجاع نسخة سابقة) —
// منقول هنا حرفيًا من ProfileModal.jsx من غير أي تغيير في السلوك أو
// الشكل. نافذة RestoreModal لسه بترندر من ProfileModal نفسه (مش من هنا)
// عشان تفضل sibling لـ div الـ "space-y-5" بالظبط زي الأصل — لو رندرناها
// جوه القسم ده، Tailwind's space-y-5 كان هيضيفلها margin-top غلط لما
// تتفتح (لأنها هتبقى مش أول عنصر جوه الحاوية). فبنستقبل onOpenRestore
// كـ callback بس ونستدعيه، والحالة والرندر فعليًا في ProfileModal.
//
// `open`: نفس خاصية "open" بتاعة ProfileModal — بتتمرر هنا عشان نجيب
// تاريخ آخر نسخة احتياطية كل مرة النافذة تتفتح (useEffect تحت).
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { backupService } from "../../services/backupService";
import { formatDateTime } from "../../utils/formatters";
import Button from "../../components/ui/Button";
import { CloudUploadIcon, ClockIcon, RestoreIcon } from "../../components/ui/Icons";
import Section from "./Section";

const BackupSection = ({ open, onOpenRestore }) => {
  const { user } = useAuth();
  const data = useData();

  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const m = await backupService.getMeta(user.uid);
      setMeta(m);
    } catch (err) {
      // silent — non-critical
    } finally {
      setLoadingMeta(false);
    }
  }, [user]);

  useEffect(() => { if (open) loadMeta(); }, [open, loadMeta]);

  const runBackupNow = async () => {
    if (!navigator.onLine) return toast.error("لازم تكون متصل بالإنترنت لعمل نسخة احتياطية");
    setBackingUp(true);
    try {
      await backupService.createBackup(user.uid, {
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
        contacts:      data.contacts,
        settings:      data.settings,
      });
      localStorage.setItem(`lastBackupAt:${user.uid}`, String(Date.now()));
      toast.success("تم عمل نسخة احتياطية بنجاح");
      loadMeta();
    } catch (err) {
      toast.error("تعذر عمل النسخة الاحتياطية");
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <Section icon={<CloudUploadIcon size={16} />} title="النسخ الاحتياطي">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <ClockIcon size={13} className="flex-shrink-0" />
        {loadingMeta ? (
          <span>جاري التحقق...</span>
        ) : meta?.lastBackupAt ? (
          <span>آخر نسخة احتياطية: {formatDateTime(meta.lastBackupAt)}</span>
        ) : (
          <span>لا توجد نسخة احتياطية بعد</span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        يتم عمل نسخة احتياطية تلقائيًا من كل بيانات البرنامج كل 24 ساعة، أول ما يكون فيه اتصال بالإنترنت. تقدر كمان تعمل نسخة يدويًا دلوقتي.
      </p>
      <Button
        type="button" size="sm" variant="secondary" className="w-full"
        icon={<CloudUploadIcon size={15} />}
        loading={backingUp}
        onClick={runBackupNow}
      >
        نسخ احتياطي الآن
      </Button>

      <button
        type="button"
        onClick={onOpenRestore}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 mt-3 transition-colors"
      >
        <RestoreIcon size={13} />
        استرجاع نسخة سابقة
      </button>
    </Section>
  );
};

export default BackupSection;
