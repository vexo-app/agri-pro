// src/contexts/data/useAutoBackup.js
//
// النسخ الاحتياطي التلقائي اليومي — منقول هنا حرفيًا من DataContext.jsx
// (نفس المنطق، نفس تعليق الـ FIX المهم عن stateRef) من غير أي تغيير في
// السلوك. لسه بيعتمد على state الكامل (مش على أي lazy loading) — وده
// مقصود ومهم: البيانات الاحتياطية اليومية لازم تفضل تاخد نسخة من كل
// البيانات دايمًا، حتى بعد Phase 2 (تقليل القراءة)، عشان مفيش أي احتمال
// إن نسخة احتياطية تطلع ناقصة.
import { useCallback, useEffect, useState } from "react";
import { backupService } from "../../services/backupService";
import { alertService } from "../../services/alertService";
import { BACKUP_INTERVAL_MS } from "../../config/constants";

const backupFailKey = (uid) => `backupFailCount:${uid}`;

export function useAutoBackup({ user, loading, loadError, stateRef }) {
  // Consecutive failures since the last success. A single failed attempt
  // is treated as "will retry on its own" and stays quiet — only once it's
  // failed more than once in a row (i.e. it's not just a one-off blip) do
  // we surface it, so the person isn't alarmed over a transient hiccup.
  const [backupFailCount, setBackupFailCount] = useState(0);
  const [backupRetryTick, setBackupRetryTick] = useState(0);
  const retryBackupNow = useCallback(() => setBackupRetryTick((t) => t + 1), []);

  useEffect(() => {
    // Guard against backing up incomplete/stale data: only proceed once
    // the user is authenticated, the current load has finished, and that
    // load didn't leave any required collection unloaded (loadError).
    // Without this, a failed/partial load would still let a backup run
    // and snapshot whatever partial state happens to be in memory.
    if (!user || loading || loadError) return;
    // ⚠️ FIX (audit finding A1): this effect's deps deliberately do NOT
    // include `state` itself — re-creating the interval/listener on every
    // single data change would be wasteful and pointless. That means
    // `runIfDue` below must read `stateRef.current` (always fresh, updated
    // by the effect at the top of DataContext.jsx) rather than a `state`
    // closed over at effect-creation time (which would go stale the moment
    // any job/payment/etc. is added afterward, silently backing up outdated
    // data with no error shown).
    let cancelled = false;
    let runningNow = false;

    const runIfDue = async () => {
      if (runningNow || cancelled || !navigator.onLine) return;

      const localLast = Number(localStorage.getItem(`lastBackupAt:${user.uid}`) || 0);
      if (Date.now() - localLast < BACKUP_INTERVAL_MS) return;

      runningNow = true;
      try {
        // Cross-check the server in case another device already backed up
        // recently, to avoid redundant writes.
        const meta = await backupService.getMeta(user.uid);
        const serverLast = meta?.lastBackupAt?.toMillis?.() || 0;
        if (Date.now() - serverLast < BACKUP_INTERVAL_MS) {
          localStorage.setItem(`lastBackupAt:${user.uid}`, String(serverLast));
          if (!cancelled) {
            setBackupFailCount(0);
            localStorage.setItem(backupFailKey(user.uid), "0");
          }
          return;
        }

        // stateRef.current, not a closed-over `state` — see the FIX
        // comment above this effect for why.
        const current = stateRef.current;
        await backupService.createBackup(user.uid, {
          equipment:     current.equipment,
          jobs:          current.jobs,
          drivers:       current.drivers,
          maintenance:   current.maintenance,
          equipmentFuelEntries: current.equipmentFuelEntries,
          payments:      current.payments,
          supplierInvoices: current.supplierInvoices,
          supplierPayments: current.supplierPayments,
          salaryEntries: current.salaryEntries,
          attendance:    current.attendance,
          custodyTransactions: current.custody,
          taxDeductions: current.taxDeductions,
          contacts:      current.contacts,
          settings:      current.settings,
        });
        localStorage.setItem(`lastBackupAt:${user.uid}`, String(Date.now()));
        if (!cancelled) {
          setBackupFailCount(0);
          localStorage.setItem(backupFailKey(user.uid), "0");
        }
      } catch (err) {
        console.warn("النسخ الاحتياطي التلقائي فشل:", err);
        if (!cancelled) {
          const next = Number(localStorage.getItem(backupFailKey(user.uid)) || 0) + 1;
          localStorage.setItem(backupFailKey(user.uid), String(next));
          setBackupFailCount(next);
          // audit finding F-017 (الجزء الثاني من Phase 2): العداد ده كان
          // موجود قبل كده لكنه بيتعرض للمستخدم نفسه بس (بانر محلي في
          // OfflineBanner.jsx) — الأدمن معندوش أي فكرة إن نسخة احتياطية
          // بتفشل لشركة معينة إلا لو هي اشتكت بنفسها. بمجرد ما الفشل
          // يتكرر 3 مرات على التوالي (مش مجرد عطلة شبكة عابرة)، تنبيه
          // خارجي حي واحد بيتبعت — مش عند كل محاولة فاشلة بعد كده، عشان
          // منغرقش القناة برسائل متكررة لنفس المشكلة المستمرة لحد ما
          // تتصفر (نجاح جديد أو retryBackupNow يدوي).
          if (next === 3) {
            alertService.notifyAdmin({
              title: "فشل النسخ الاحتياطي التلقائي 3 مرات متتالية",
              message: err?.message || String(err),
              context: { المستخدم: user.email || "—", "معرّف الحساب": user.uid },
              signature: `backup-fail:${user.uid}`,
            });
          }
        }
      } finally {
        runningNow = false;
      }
    };

    // Pick up any failure count left over from a previous session (e.g.
    // the app was closed right after a failed attempt) so the banner still
    // shows up if it's still relevant.
    setBackupFailCount(Number(localStorage.getItem(backupFailKey(user.uid)) || 0));

    runIfDue();
    window.addEventListener("online", runIfDue);
    const interval = setInterval(runIfDue, 60 * 60 * 1000); // re-check hourly

    return () => {
      cancelled = true;
      window.removeEventListener("online", runIfDue);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, loadError, backupRetryTick]);

  return { backupFailCount, retryBackupNow };
}
