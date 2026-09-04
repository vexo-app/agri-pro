// src/features/profile/ImportModal.jsx
import React, { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { backupService } from "../../services/backupService";
import { exportService } from "../../services/exportService";
import { formatDateTime } from "../../utils/formatters";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { AlertIcon, ChevronLeftIcon, UploadFileIcon } from "../../components/ui/Icons";
import { COUNT_LABELS } from "../../config/constants";

const CONFIRM_WORD = "استرجاع";

const ImportModal = ({ open, onClose }) => {
  const { user } = useAuth();
  const data     = useData();
  const fileInputRef = useRef(null);

  const [picked, setPicked] = useState(null);   // { exportedAt, data, counts }
  const [parseError, setParseError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");

  const currentCounts = {
    equipment:     data.equipment?.length     || 0,
    jobs:          data.jobs?.length          || 0,
    drivers:       data.drivers?.length       || 0,
    maintenance:   data.maintenance?.length   || 0,
    payments:      data.payments?.length      || 0,
    salaryEntries: data.salaryEntries?.length || 0,
    attendance:    data.attendance?.length    || 0,
    custodyTransactions: data.custody?.length || 0,
  };

  const reset = () => {
    setPicked(null);
    setParseError("");
    setConfirmText("");
  };

  const handleClose = () => {
    if (busy) return; // منع الإغلاق أثناء الاسترجاع
    reset();
    onClose();
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // يسمح باختيار نفس الملف تاني لو احتاج
    if (!file) return;
    setParseError("");
    try {
      const result = await exportService.readBackupFile(file);
      setPicked(result);
    } catch (err) {
      setParseError(err.message || "تعذر قراءة الملف");
    }
  };

  const handleRestore = async () => {
    if (!picked || confirmText !== CONFIRM_WORD) return;
    setBusy(true);
    try {
      setBusyLabel("جاري أخذ نسخة أمان من وضعك الحالي...");
      await backupService.createBackup(user.uid, {
        equipment:     data.equipment,
        jobs:          data.jobs,
        drivers:       data.drivers,
        maintenance:   data.maintenance,
        payments:      data.payments,
        salaryEntries: data.salaryEntries,
        attendance:    data.attendance,
        custodyTransactions: data.custody,
        settings:      data.settings,
      });

      setBusyLabel("جاري استرجاع البيانات من الملف...");
      await backupService.restoreSnapshot(user.uid, picked.data);

      toast.success("تم الاسترجاع من الملف بنجاح، جاري إعادة تحميل البرنامج...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error("تعذر إتمام الاسترجاع — بياناتك الحالية لم تتأثر بالكامل، برجاء المحاولة تانية");
      setBusy(false);
      setBusyLabel("");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="استرجاع من ملف محلي" size="lg">
      {busy ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <span className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-gray-300">{busyLabel}</p>
          <p className="text-xs text-gray-500">من فضلك متقفلش البرنامج لحد ما تخلص العملية</p>
        </div>
      ) : !picked ? (
        // ── الخطوة 1: اختيار الملف ──────────────────────
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            اختار ملف النسخة الاحتياطية اللي نزّلته قبل كده من "الملف الشخصي ← تنزيل نسخة على جهازك"
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFilePicked}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 hover:border-brand-600/60 rounded-xl px-4 py-8 text-gray-400 hover:text-brand-400 transition-colors"
          >
            <UploadFileIcon size={28} />
            <span className="text-sm font-semibold">اضغط لاختيار الملف</span>
          </button>
          {parseError && (
            <p className="text-xs text-red-400 text-center">{parseError}</p>
          )}
        </div>
      ) : (
        // ── الخطوة 2: مقارنة وتأكيد ──────────────────────
        <div className="space-y-4">
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            <ChevronLeftIcon size={14} className="rotate-180" />
            اختيار ملف تاني
          </button>

          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 flex gap-3">
            <AlertIcon size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              الاسترجاع هيستبدل بياناتك الحالية بالكامل ببيانات الملف ده. أي بيانات اتضافت بعد تاريخ الملف هتتمسح. هناخد نسخة أمان من وضعك الحالي تلقائيًا قبل ما نبدأ.
            </p>
          </div>

          <div className="bg-surface-2 border border-white/8 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">
              {picked.exportedAt ? `ملف بتاريخ ${formatDateTime(picked.exportedAt)}` : "ملف بدون تاريخ محدد"}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="text-gray-500 font-bold">البيانات</div>
              <div className="text-gray-500 font-bold text-left">الحالي ← بعد الاسترجاع</div>
              {Object.entries(COUNT_LABELS).map(([key, label]) => {
                const before = currentCounts[key];
                const after  = picked.counts?.[key] ?? 0;
                const changed = before !== after;
                return (
                  <React.Fragment key={key}>
                    <div className="text-gray-300">{label}</div>
                    <div className={`text-left font-semibold tabular-nums ${changed ? "text-amber-400" : "text-gray-400"}`}>
                      {before} ← {after}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400">
              اكتب كلمة "{CONFIRM_WORD}" عشان تأكد
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-surface-2 border border-white/10 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
              placeholder={CONFIRM_WORD}
            />
          </div>

          <Button
            type="button"
            variant="danger"
            className="w-full"
            icon={<UploadFileIcon size={16} />}
            disabled={confirmText !== CONFIRM_WORD}
            onClick={handleRestore}
          >
            تأكيد الاسترجاع من الملف
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default ImportModal;
