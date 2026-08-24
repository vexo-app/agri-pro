// src/components/ui/OfflineBanner.jsx
import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { usePWA } from "../../hooks/usePWA";
import { useData } from "../../contexts/DataContext";
import { exportService } from "../../services/exportService";
import { ChevronUpIcon } from "./Icons";

// كل ما فضلت تعديلات معلّقة (مترفعتش) أكتر من الوقت ده، بنعتبرها حالة
// "طول عليها" ونظهر تنبيه أقوى بزرار نسخة احتياطية فورية — بدل ما نسيب
// الشخص يفتكر إن كل حاجة تمام لمجرد إنه مش شايف رسالة خطأ.
const LONG_PENDING_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 ساعات

/**
 * Small "minimize" button shown on the right edge of a banner row — tapping
 * it collapses that specific banner. It's not a permanent dismiss: the
 * banner comes back automatically the next time this *same kind* of status
 * newly kicks in (see useAutoResetMinimize below), so a person who
 * minimizes "غير متصل" now still gets warned the next time they go offline.
 */
const MinimizeButton = ({ onClick, label }) => (
  <button
    onClick={onClick}
    aria-label={label || "تصغير"}
    className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
  >
    <ChevronUpIcon size={14} />
  </button>
);

/**
 * Tracks a minimized/expanded flag for one banner, and automatically
 * resets it back to "expanded" whenever `active` transitions from false to
 * true (a *new* occurrence of that status) — so minimizing is temporary,
 * per-occurrence, not a permanent opt-out.
 */
const useAutoResetMinimize = (active) => {
  const [minimized, setMinimized] = useState(false);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) setMinimized(false);
    wasActive.current = active;
  }, [active]);
  return [minimized, setMinimized];
};

/**
 * Shows a sticky banner when the user is offline, AND/OR when there's a
 * live sync status worth surfacing:
 * - amber "غير متصل": offline, changes are saved locally and queued
 * - blue "بيانات لسه بترفع (N)": online again, Firestore is flushing the
 *   queued writes to the server
 * - a brief green "تم رفع كل البيانات" the moment the queue empties, so the
 *   person gets explicit confirmation nothing was lost — not just silence
 * - red "لسه فيه تعديلات من كذا ساعة": pending writes have been sitting
 *   unsynced for a long time — offers a one-tap local backup download
 *   (works fully offline, writes an actual file outside browser storage)
 *   as a manual safety net on top of the automatic sync
 * Also shows an "Install App" button when the browser supports it.
 *
 * Every row can be minimized with the ↑ button — it slides out of the way
 * but comes back the next time that same status newly happens again.
 */
const OfflineBanner = () => {
  const { isOnline, canInstall, installPrompt } = usePWA();
  const {
    pendingWrites, lastSyncedAt, firstPendingWriteAt, loadError, retryLoad,
    backupFailCount, retryBackupNow,
    equipment, jobs, drivers, maintenance, payments, salaryEntries, attendance, settings, custody,
  } = useData();

  const [showSyncedFlash, setShowSyncedFlash] = useState(false);
  const prevPending = useRef(pendingWrites);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (prevPending.current > 0 && pendingWrites === 0 && lastSyncedAt) {
      setShowSyncedFlash(true);
      const t = setTimeout(() => setShowSyncedFlash(false), 3000);
      return () => clearTimeout(t);
    }
    prevPending.current = pendingWrites;
  }, [pendingWrites, lastSyncedAt]);

  // Only need a ticking clock while something is actually pending, so this
  // doesn't run a timer needlessly in the common case.
  useEffect(() => {
    if (!firstPendingWriteAt) return;
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, [firstPendingWriteAt]);

  const pendingHours = firstPendingWriteAt ? (now - firstPendingWriteAt) / (60 * 60 * 1000) : 0;
  const isLongPending = pendingWrites > 0 && firstPendingWriteAt && (now - firstPendingWriteAt) > LONG_PENDING_THRESHOLD_MS;

  const handleEmergencyBackup = () => {
    try {
      exportService.downloadBackupFile({
        equipment, jobs, drivers, maintenance, payments, salaryEntries, attendance,
        custodyTransactions: custody, settings,
      });
      toast.success("اتنزّل ملف احتياطي على جهازك دلوقتي");
    } catch {
      toast.error("تعذر تنزيل النسخة الاحتياطية");
    }
  };

  const showSyncing = isOnline && pendingWrites > 0 && !isLongPending;
  // "أكتر من مرة" — a single failed attempt is normal noise (it'll just
  // retry next hour), so only surface this once it's failed at least twice
  // in a row without a success in between.
  const showBackupFailing = backupFailCount >= 2;

  // Each row's minimize state resets automatically the next time that row's
  // condition newly becomes true.
  const [loadErrorMin, setLoadErrorMin]         = useAutoResetMinimize(loadError);
  const [backupFailMin, setBackupFailMin]       = useAutoResetMinimize(showBackupFailing);
  const [offlineMin, setOfflineMin]             = useAutoResetMinimize(!isOnline);
  const [syncingMin, setSyncingMin]             = useAutoResetMinimize(showSyncing);
  const [syncedMin, setSyncedMin]               = useAutoResetMinimize(showSyncedFlash);
  const [longPendingMin, setLongPendingMin]     = useAutoResetMinimize(isLongPending);
  const [installMin, setInstallMin]             = useAutoResetMinimize(canInstall && isOnline);

  const showAnything =
    (loadError && !loadErrorMin) ||
    (showBackupFailing && !backupFailMin) ||
    (!isOnline && !offlineMin) ||
    (canInstall && !installMin) ||
    (showSyncing && !syncingMin) ||
    (showSyncedFlash && !syncedMin) ||
    (isLongPending && !longPendingMin);
  if (!showAnything) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex flex-col gap-0" dir="rtl">
      {/* Failed to load data on this open — explicit, not silent. A read
          failure (usually still-offline right after reopening) must never
          look like the data itself was deleted. */}
      {loadError && !loadErrorMin && (
        <div className="flex items-center justify-between gap-3 bg-orange-600 text-white text-xs font-bold py-2 px-4 flex-wrap">
          <span>تعذر تحميل بعض بياناتك دلوقتي — البيانات لسه محفوظة، مش متمسوحة، وهتظهر تاني أول ما الاتصال يرجع</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={retryLoad}
              className="bg-white text-orange-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-gray-100"
            >
              إعادة المحاولة
            </button>
            <MinimizeButton onClick={() => setLoadErrorMin(true)} />
          </div>
        </div>
      )}

      {/* Automatic daily backup has failed more than once in a row. Offers
          both an immediate retry of the cloud backup and the same manual
          local-file backup as a fallback safety net. */}
      {showBackupFailing && !backupFailMin && (
        <div className="flex items-center justify-between gap-3 bg-rose-700 text-white text-xs font-bold py-2 px-4 flex-wrap">
          <span>
            النسخ الاحتياطي التلقائي فشل {backupFailCount} مرات على التوالي — بياناتك مش في خطر (لسه محفوظة عادي)
            بس النسخة الاحتياطية اليومية مش بتتاخد
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={retryBackupNow}
              className="bg-white text-rose-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-gray-100"
            >
              إعادة المحاولة الآن
            </button>
            <button
              onClick={handleEmergencyBackup}
              className="bg-white text-rose-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-gray-100"
            >
              نزّل نسخة على جهازك
            </button>
            <MinimizeButton onClick={() => setBackupFailMin(true)} />
          </div>
        </div>
      )}

      {/* Long-pending urgent warning takes priority over the ordinary offline banner */}
      {isLongPending && !longPendingMin && (
        <div className="flex items-center justify-between gap-3 bg-red-700 text-white text-xs font-bold py-2 px-4 flex-wrap">
          <span>
            فيه {pendingWrites} تعديل لسه محفوظ على جهازك بس من {Math.floor(pendingHours)} ساعة تقريبًا —
            وصّل بالنت أول ما تقدر، أو خد نسخة احتياطية دلوقتي للأمان
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleEmergencyBackup}
              className="bg-white text-red-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-gray-100"
            >
              نزّل نسخة احتياطية الآن
            </button>
            <MinimizeButton onClick={() => setLongPendingMin(true)} />
          </div>
        </div>
      )}

      {/* Offline warning */}
      {!isOnline && !isLongPending && !offlineMin && (
        <div className="flex items-center justify-center gap-2 bg-amber-600 text-white text-xs font-bold py-2 px-4">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
          <span>أنت غير متصل بالإنترنت — البيانات محفوظة على جهازك وهترفع تلقائي لما النت يرجع</span>
          <MinimizeButton onClick={() => setOfflineMin(true)} />
        </div>
      )}

      {/* Syncing (back online, flushing the offline queue) */}
      {showSyncing && !syncingMin && (
        <div className="flex items-center justify-center gap-2 bg-sky-600 text-white text-xs font-bold py-2 px-4">
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>
            {pendingWrites === 1
              ? "بيرفع تعديل واحد لسه محفوظ عندك بس..."
              : `بيرفع ${pendingWrites} تعديلات لسه محفوظة عندك بس...`}
          </span>
          <MinimizeButton onClick={() => setSyncingMin(true)} />
        </div>
      )}

      {/* Just finished syncing */}
      {!showSyncing && !isLongPending && showSyncedFlash && !syncedMin && (
        <div className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-bold py-2 px-4">
          <span className="flex-shrink-0">✓</span>
          <span>تم رفع كل البيانات بنجاح</span>
          <MinimizeButton onClick={() => setSyncedMin(true)} />
        </div>
      )}

      {/* Install prompt */}
      {canInstall && isOnline && !installMin && (
        <div className="flex items-center justify-between gap-3 bg-brand-700 text-white text-xs font-bold py-2 px-4">
          <span>ثبّت التطبيق على شاشتك الرئيسية للوصول السريع</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={installPrompt}
              className="bg-white text-brand-700 rounded-lg px-3 py-1 text-xs font-bold hover:bg-gray-100"
            >
              تثبيت
            </button>
            <MinimizeButton onClick={() => setInstallMin(true)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
