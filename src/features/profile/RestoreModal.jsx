// src/features/profile/RestoreModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { backupService } from "../../services/backupService";
import { formatDateTime } from "../../utils/formatters";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { AlertIcon, ChevronLeftIcon, ClockIcon, RestoreIcon } from "../../components/ui/Icons";

const COUNT_LABELS = {
  equipment:     "المعدات",
  jobs:          "سجل الشغل",
  drivers:       "السائقين",
  maintenance:   "الصيانة",
  equipmentFuelEntries: "سجل وقود المعدات",
  payments:      "الدفعات",
  supplierInvoices: "فواتير الموردين",
  supplierPayments: "دفعات الموردين",
  salaryEntries: "المرتبات",
  attendance:    "الحضور",
  custodyTransactions: "العهدة",
  taxDeductions: "الضرائب والخصومات",
  settings:      "الإعدادات",
};

const CONFIRM_WORD = "استرجاع";

const RestoreModal = ({ open, onClose }) => {
  const { user } = useAuth();
  const data     = useData();

  const [snapshots, setSnapshots] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState(null); // snapshot meta (id, counts, createdAt)
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  // null = no failure yet. Otherwise: { isPartialFailure, completedKeys,
  // totalKeys, safetyBackupId } — see handleRestore/handleRecoverFromSafety
  // below. A partial failure gets its own persistent screen (not just a
  // toast, which disappears) because it's the one outcome where staying
  // silent about exactly what happened could cost the user real data.
  const [restoreError, setRestoreError] = useState(null);

  const currentCounts = {
    equipment:     data.equipment?.length     || 0,
    jobs:          data.jobs?.length          || 0,
    drivers:       data.drivers?.length       || 0,
    maintenance:   data.maintenance?.length   || 0,
    equipmentFuelEntries: data.equipmentFuelEntries?.length || 0,
    payments:      data.payments?.length      || 0,
    supplierInvoices: data.supplierInvoices?.length || 0,
    supplierPayments: data.supplierPayments?.length || 0,
    salaryEntries: data.salaryEntries?.length || 0,
    attendance:    data.attendance?.length    || 0,
    custodyTransactions: data.custody?.length || 0,
    taxDeductions: data.taxDeductions?.length || 0,
  };

  const loadList = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const list = await backupService.list(user.uid);
      setSnapshots(list);
    } catch (err) {
      toast.error("تعذر تحميل قائمة النسخ الاحتياطية");
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setConfirmText("");
      setRestoreError(null);
      loadList();
    }
  }, [open, loadList]);

  const handleClose = () => {
    if (busy) return; // don't allow closing mid-restore
    onClose();
  };

  const currentDataPayload = () => ({
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

  const handleRestore = async () => {
    if (!selected || confirmText !== CONFIRM_WORD) return;
    setBusy(true);
    setRestoreError(null);
    let safetyBackupId = null;
    try {
      setBusyLabel("جاري أخذ نسخة أمان من وضعك الحالي...");
      safetyBackupId = await backupService.createBackup(user.uid, currentDataPayload());

      setBusyLabel("جاري تحميل النسخة المطلوبة...");
      const snapshotData = await backupService.getSnapshot(user.uid, selected.id);

      setBusyLabel("جاري استرجاع البيانات...");
      await backupService.restoreSnapshot(user.uid, snapshotData, {
        onProgress: ({ completedKeys, totalKeys, activeKey, batchNumber, batchCount }) =>
          setBusyLabel(
            batchCount > 1
              ? `جاري استرجاع ${COUNT_LABELS[activeKey] || activeKey}... (دفعة ${batchNumber}/${batchCount})`
              : `جاري استرجاع البيانات... (${completedKeys.length}/${totalKeys})`
          ),
      });

      toast.success("تم الاسترجاع بنجاح، جاري إعادة تحميل البرنامج...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      // isPartialFailure/completedKeys/totalKeys only exist on errors thrown
      // by restoreSnapshot itself (see backupService.js) — an error from
      // createBackup (the safety backup) or getSnapshot above means restore
      // never started at all, so the user's live data is untouched either
      // way; err.isPartialFailure is simply undefined/false in that case,
      // which correctly falls into the "nothing changed" branch below.
      setRestoreError({
        isPartialFailure: !!err.isPartialFailure,
        completedKeys: err.completedKeys || [],
        totalKeys: err.totalKeys || Object.keys(COUNT_LABELS).length,
        activeKey: err.activeKey || null,
        appliedOperations: err.appliedOperations || 0,
        safetyBackupId,
      });
      setBusy(false);
      setBusyLabel("");
    }
  };

  // One-click recovery for the partial-failure case: restore the safety
  // snapshot taken seconds ago, right before this attempt — putting the
  // account back to exactly where it was before anything went wrong. This
  // is itself a normal restoreSnapshot call (same function, same
  // guarantees), so if IT also fails partway, the same explicit
  // partial-failure reporting applies again rather than silently retrying.
  const handleRecoverFromSafety = async () => {
    if (!restoreError?.safetyBackupId) return;
    setBusy(true);
    setBusyLabel("جاري الرجوع لوضعك قبل محاولة الاسترجاع...");
    try {
      const safetyData = await backupService.getSnapshot(user.uid, restoreError.safetyBackupId);
      await backupService.restoreSnapshot(user.uid, safetyData, {
        onProgress: ({ completedKeys, totalKeys, activeKey, batchNumber, batchCount }) =>
          setBusyLabel(
            batchCount > 1
              ? `جاري الرجوع لنسخة الأمان — ${COUNT_LABELS[activeKey] || activeKey} (دفعة ${batchNumber}/${batchCount})`
              : `جاري الرجوع لوضعك قبل المحاولة... (${completedKeys.length}/${totalKeys})`
          ),
      });
      toast.success("تم الرجوع لوضعك قبل محاولة الاسترجاع، جاري إعادة تحميل البرنامج...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setRestoreError({
        isPartialFailure: !!err.isPartialFailure,
        completedKeys: err.completedKeys || [],
        totalKeys: err.totalKeys || Object.keys(COUNT_LABELS).length,
        activeKey: err.activeKey || null,
        appliedOperations: err.appliedOperations || 0,
        safetyBackupId: restoreError.safetyBackupId,
        recoveryAlsoFailed: true,
      });
      setBusy(false);
      setBusyLabel("");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="استرجاع نسخة احتياطية" size="lg">
      {busy ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <span className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-gray-300">{busyLabel}</p>
          <p className="text-xs text-gray-500">من فضلك متقفلش البرنامج لحد ما تخلص العملية</p>
        </div>
      ) : restoreError ? (
        // ── Explicit failure state — never phrased as "restore succeeded",
        // and never lumps a partial failure in with a clean no-op failure.
        <div className="space-y-4">
          {restoreError.isPartialFailure ? (
            <>
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex gap-3">
                <AlertIcon size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-300 leading-relaxed space-y-1">
                  <p className="font-bold text-red-200">
                    الاسترجاع توقف في المنتصف ولم يكتمل
                  </p>
                  <p>
                    تم تطبيق {restoreError.appliedOperations} تعديل فعلي
                    {restoreError.activeKey ? `، وتوقف أثناء استرجاع ${COUNT_LABELS[restoreError.activeKey] || restoreError.activeKey}` : ""}.
                    {" "}اكتملت {restoreError.completedKeys.length} من {restoreError.totalKeys} مجموعة بيانات بالكامل —
                    يعني بياناتك الحالية دلوقتي خليط بين القديم والنسخة اللي كنت بتسترجعها.
                  </p>
                </div>
              </div>

              {restoreError.safetyBackupId && !restoreError.recoveryAlsoFailed && (
                <div className="bg-surface-2 border border-white/8 rounded-xl px-4 py-3 space-y-3">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    أخدنا نسخة أمان من وضعك <span className="font-bold text-gray-100">قبل ما نبدأ المحاولة دي</span> —
                    تقدر ترجع لها دلوقتي علشان تنهي حالة الخليط دي وترجع لوضعك الأصلي.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="w-full"
                    icon={<RestoreIcon size={16} />}
                    onClick={handleRecoverFromSafety}
                  >
                    ارجع لوضعك قبل المحاولة دي (نسخة الأمان)
                  </Button>
                </div>
              )}

              {restoreError.recoveryAlsoFailed && (
                <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-300 leading-relaxed">
                    محاولة الرجوع لنسخة الأمان فشلت هي كمان بعد تطبيق {restoreError.appliedOperations} تعديل
                    {restoreError.activeKey ? ` أثناء ${COUNT_LABELS[restoreError.activeKey] || restoreError.activeKey}` : ""}.
                    متقفلش الشاشة دي — كلم الدعم الفني دلوقتي، وخليك متصل بالإنترنت وسيب البرنامج مفتوح
                    لحد ما يتأكد من حالة بياناتك.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex gap-3">
              <AlertIcon size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                تعذر إتمام الاسترجاع قبل أي تعديل فعلي — بياناتك الحالية <span className="font-bold">لم تتأثر إطلاقًا</span>،
                برجاء التأكد من الاتصال بالإنترنت والمحاولة تاني.
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => { setRestoreError(null); setSelected(null); setConfirmText(""); loadList(); }}
          >
            رجوع لقائمة النسخ الاحتياطية
          </Button>
        </div>
      ) : !selected ? (
        // ── Step 1: choose a snapshot ──────────────────────
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">اختار النسخة اللي عايز ترجعلها</p>
          {loadingList ? (
            <p className="text-sm text-gray-500 text-center py-8">جاري التحميل...</p>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">لا توجد نسخ احتياطية بعد</p>
          ) : (
            snapshots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center justify-between gap-3 bg-surface-2 hover:bg-surface-3 border border-white/8 rounded-xl px-4 py-3 text-right transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <ClockIcon size={14} className="text-gray-500 flex-shrink-0" />
                  {formatDateTime(s.createdAt)}
                </div>
                <ChevronLeftIcon size={16} className="text-gray-500 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      ) : (
        // ── Step 2: compare + confirm ──────────────────────
        <div className="space-y-4">
          <button
            onClick={() => { setSelected(null); setConfirmText(""); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            <ChevronLeftIcon size={14} className="rotate-180" />
            رجوع لاختيار نسخة تانية
          </button>

          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 flex gap-3">
            <AlertIcon size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              الاسترجاع هيستبدل بياناتك الحالية بالكامل بالنسخة اللي هتختارها. أي بيانات اتضافت بعد تاريخ النسخة دي هتتمسح. هناخد نسخة أمان من وضعك الحالي تلقائيًا قبل ما نبدأ، فلو حصل غلط تقدر ترجع تاني.
            </p>
          </div>

          <div className="bg-surface-2 border border-white/8 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">
              نسخة {formatDateTime(selected.createdAt)}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="text-gray-500 font-bold">البيانات</div>
              <div className="text-gray-500 font-bold text-left">الحالي ← بعد الاسترجاع</div>
              {Object.entries(COUNT_LABELS).map(([key, label]) => {
                const before = currentCounts[key];
                const after  = selected.counts?.[key] ?? 0;
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
            icon={<RestoreIcon size={16} />}
            disabled={confirmText !== CONFIRM_WORD}
            onClick={handleRestore}
          >
            تأكيد الاسترجاع نهائيًا
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default RestoreModal;
