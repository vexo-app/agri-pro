// src/contexts/data/useDataLoader.js
//
// Phase 2 — تقليل قراءات Firestore: بدل الـ 13 قراءة الواحدة (getDocs)
// اللي كانت بتتعمل من الصفر في كل مرة يفتح فيها التطبيق، دلوقتي كل
// مجموعة بيانات ليها listener دائم (onSnapshot). الفايدة: أول مرة على أي
// جهاز بيتعمل sync كامل زي ما كان بالظبط، لكن بعد كده Firestore بيستخدم
// "resume token" جوه نفس الجهاز فبيبعت بس اللي اتغيّر مش المجموعة كلها
// تاني — وده اللي بيقلل القراءات فعليًا كل ما البرنامج يتفتح تاني على نفس
// الجهاز، من غير أي تغيير في الـ schema أو الـ rules أو أي حسابات.
//
// نفس شروط ونفس سلوك الكود الأصلي اتحافظ عليها بالكامل:
//   • أول تحميل: لسه بيستنى كل الـ 13 مجموعة (أو 12 لو driverCosts
//     خلصت migration) قبل ما يطلع أي حاجة على الشاشة — نفس اللحظة
//     الواحدة اللي كانت بتظهر بيها كل البيانات مع بعض قبل كده (مفيش
//     "فلاش" لأرقام ناقصة أثناء التحميل).
//   • الـ migrations (driverCosts→salaryEntries، fuelPriceAtJob backfill)
//     بتتنفذ مرة واحدة بالظبط لكل محاولة تحميل، بنفس الشروط ونفس ترتيب
//     الكود الأصلي، عن طريق نفس الدوال في migrations.js من غير أي تغيير
//     فيها.
//   • بعد أول تحميل، أي تغيير حقيقي (سواء من الجهاز ده أو جهاز/تاب تاني)
//     بيوصل تلقائيًا لكل المجموعات لحظيًا، من غير ما حد يحتاج يعمل
//     refresh.
//   • loadError/retryLoad اتحافظ على نفس الشكل بالظبط (OfflineBanner
//     وuseAutoBackup مبنيين على السلوك ده حرفيًا).
//   • حل مشكلة جديدة ماكانتش موجودة قبل كده: onSnapshot ممكن ماينده'ش
//     خالص لو الجهاز offline ومفيش نسخة محلية (cache) للمجموعة دي لسه
//     (جهاز جديد، أو IndexedDB اتمسحت) — فبدل ما "loading" يفضل true إلى
//     الأبد بصمت، فيه فحص كل 9 ثواني: لو لسه في مجموعات ماوصلتش وبقى
//     الجهاز offline فعلاً، بتتحسب "فشلت مؤقتًا" (نفس بانر "تعذر التحميل
//     — هيتم إعادة المحاولة" اللي كان موجود أصلاً)، من غير ما الـ listener
//     بتاعها يتقفل — فأول ما النت يرجع، البيانات بتوصل لوحدها تلقائيًا.
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { equipmentService }    from "../../services/equipmentService";
import { jobService }          from "../../services/jobService";
import { driverService }       from "../../services/driverService";
import { maintenanceService }  from "../../services/maintenanceService";
import { settingsService }     from "../../services/settingsService";
import { paymentService }      from "../../services/paymentService";
import { supplierInvoiceService } from "../../services/supplierInvoiceService";
import { supplierPaymentService } from "../../services/supplierPaymentService";
// driverCostService is kept only to read/clean up the legacy `driverCosts`
// collection during the one-time migration below — it's no longer exposed
// for creating new records (see migrateDriverCosts.js).
import { driverCostService }   from "../../services/driverCostService";
import { salaryService }       from "../../services/salaryService";
import { attendanceService }   from "../../services/attendanceService";
import { custodyService }      from "../../services/custodyService";
import { taxDeductionService } from "../../services/taxDeductionService";
import { contactService }      from "../../services/contactService";
import {
  driverCostsMigratedKey, fuelPriceMigratedKey,
  runDriverCostsMigration, runFuelPriceBackfill,
} from "./migrations";

// كل مجموعة بيانات: مفتاحها الداخلي، الـ service بتاعها، واسم الحقل في
// حالة الـ reducer (stateKey). driverCosts وحدها stateKey بتاعها null —
// مش جزء من حالة التطبيق خالص، بتتقرأ بس عشان الـ migration تستخدمها ثم
// تتمسح، بالظبط زي الكود الأصلي.
const COLLECTIONS = [
  { key: "equipment",        service: equipmentService,        stateKey: "equipment" },
  { key: "jobs",              service: jobService,              stateKey: "jobs" },
  { key: "drivers",           service: driverService,           stateKey: "drivers" },
  { key: "maintenance",       service: maintenanceService,      stateKey: "maintenance" },
  { key: "settings",          service: settingsService,         stateKey: "settings" },
  { key: "payments",          service: paymentService,          stateKey: "payments" },
  { key: "supplierInvoices",  service: supplierInvoiceService,  stateKey: "supplierInvoices" },
  { key: "supplierPayments",  service: supplierPaymentService,  stateKey: "supplierPayments" },
  { key: "driverCosts",       service: driverCostService,       stateKey: null },
  { key: "salaryEntries",     service: salaryService,           stateKey: "salaryEntries" },
  { key: "attendance",        service: attendanceService,       stateKey: "attendance" },
  { key: "custody",           service: custodyService,          stateKey: "custody" },
  { key: "taxDeductions",     service: taxDeductionService,     stateKey: "taxDeductions" },
  { key: "contacts",          service: contactService,          stateKey: "contacts" },
];

// لو الجهاز offline ومفيش نسخة محلية للمجموعة، الـ listener مش هينده خالص
// (لا نجاح ولا فشل) — فبنراجع كل المدة دي، ولو لسه فيه مجموعات ماوصلتش
// وكان الجهاز offline فعلاً وقتها، بنعتبرها "فشلت مؤقتًا" (زي ما getDocs
// كان بيرفض بسرعة في نفس الحالة دي قبل كده) من غير ما نقفل الـ listener.
const STUCK_OFFLINE_CHECK_MS = 9000;

export function useDataLoader({ user, dispatch }) {
  // Set whenever the current data is missing at least one collection that
  // failed (or is stuck offline with no local cache yet). The UI
  // (OfflineBanner) surfaces this explicitly so this reads as "couldn't
  // load yet, will retry" — never as silence that could be mistaken for
  // "your data is gone".
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  // A manual retry now means "tear down every listener and re-subscribe
  // from scratch" — mostly useful as a safety net for a listener that died
  // from a terminal error (e.g. permission-denied); a listener that's just
  // stuck offline self-heals on its own the moment connectivity returns,
  // with no need for this at all.
  const retryLoad = useCallback(() => setReloadTick((t) => t + 1), []);

  // Guards the one-time driverCosts→salaryEntries migration against
  // running concurrently (e.g. a retry firing while a previous load's
  // migration is still in flight). Declared outside the effect so it
  // persists across reloadTick/user changes, exactly like before.
  const migratingDriverCostsRef = useRef(false);
  // Same idea, but for the fuelPriceAtJob backfill.
  const migratingFuelPriceRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // `finalizing` flips true the instant finalize() starts (before its
    // migration awaits) — guards against calling it twice. `finalized`
    // flips true only once finalize() has fully completed, including its
    // own single consolidated dispatch. The gap between the two matters: a
    // live snapshot update can arrive WHILE the migrations are still
    // running (e.g. the driverCosts migration's own salaryService.add()
    // write is itself observed by the very listener we're already
    // subscribed to). Dispatching that update standalone the moment it
    // arrives would flip `loading` to false with only that one collection
    // populated and everything else still at its empty default — exactly
    // the "briefly wrong/incomplete financial numbers" flicker this whole
    // migration is supposed to avoid. So updates that land in that window
    // are absorbed into `latest` (finalize's own consolidated dispatch
    // will read the freshest value from there) but not dispatched on their
    // own; only once `finalized` is true do further live updates dispatch
    // immediately again.
    let finalizing = false;
    let finalized = false;
    let stuckCheckIntervalId = null;
    const unsubscribes = [];

    dispatch({ type: "SET_LOADING", payload: true });

    // Skip the legacy driverCosts listener entirely once a previous load
    // on this device already confirmed it's fully drained (flag is only
    // ever set after that confirmation) — otherwise a permanently-idle
    // listener would stay open on an empty collection forever.
    const driverCostsAlreadyMigrated =
      localStorage.getItem(driverCostsMigratedKey(user.uid)) === "1";
    const activeCollections = COLLECTIONS.filter(
      (c) => !(c.key === "driverCosts" && driverCostsAlreadyMigrated)
    );

    // latest[key] holds the most recent { ok, data } | { ok, err } result
    // for that collection — same shape safeFetch used to produce, so the
    // migration helpers below need no changes at all.
    const latest = {};
    if (driverCostsAlreadyMigrated) latest.driverCosts = { ok: true, data: [] };

    // Keys not yet "settled" this load attempt (received their first
    // snapshot, errored, or were declared stuck-offline). Finalization
    // (running the migrations + the single initial dispatch) waits for
    // this to empty out, exactly like the original Promise.all waited for
    // every read to settle before doing anything with the results.
    const pending = new Set(activeCollections.map((c) => c.key));
    // Keys currently failed (error, or stuck-offline) — drives loadError.
    const failedKeys = new Set();

    const clearStuckCheck = () => {
      if (stuckCheckIntervalId !== null) {
        clearInterval(stuckCheckIntervalId);
        stuckCheckIntervalId = null;
      }
    };

    const dispatchIncremental = (key, data) => {
      if (cancelled) return;
      const cfg = activeCollections.find((c) => c.key === key);
      if (!cfg || cfg.stateKey === null) return; // driverCosts — never part of state
      dispatch({ type: "SET_LOADED", payload: { [cfg.stateKey]: data } });
    };

    const finalize = async () => {
      if (finalizing || cancelled) return;
      finalizing = true;
      clearStuckCheck();

      try {
        const driverCostsR   = latest.driverCosts   ?? { ok: false, err: new Error("لم تُحمَّل") };
        const salaryEntriesR = latest.salaryEntries ?? { ok: false, err: new Error("لم تُحمَّل") };
        const jobsR          = latest.jobs          ?? { ok: false, err: new Error("لم تُحمَّل") };
        const settingsR      = latest.settings      ?? { ok: false, err: new Error("لم تُحمَّل") };

        // ── driverCosts → salaryEntries (one-time) ─────────────────────
        const { mergedSalaryEntries, migrationSucceededThisRound, migratedCount } =
          await runDriverCostsMigration({
            userId: user.uid, driverCostsR, salaryEntriesR,
            migratingRef: migratingDriverCostsRef,
          });
        if (cancelled) return;
        if (migratedCount > 0) {
          toast.success(`تم دمج ${migratedCount} من تكاليف السائقين القديمة داخل نظام الرواتب`);
        }

        // Persist "fully migrated" locally, but only once a successful read
        // this round has actually confirmed there's nothing left in
        // driverCosts — either it was already empty, or everything found
        // was just migrated and removed without error.
        if (
          !driverCostsAlreadyMigrated &&
          driverCostsR.ok &&
          (driverCostsR.data.length === 0 || migrationSucceededThisRound)
        ) {
          localStorage.setItem(driverCostsMigratedKey(user.uid), "1");
        }

        // ── fuelPriceAtJob backfill (one-time) ──────────────────────────
        const fuelPriceAlreadyBackfilled =
          localStorage.getItem(fuelPriceMigratedKey(user.uid)) === "1";
        const { mergedJobs, succeeded: fuelBackfillSucceededThisRound } =
          fuelPriceAlreadyBackfilled
            ? { mergedJobs: jobsR.ok ? jobsR.data : undefined, succeeded: false }
            : await runFuelPriceBackfill({
                userId: user.uid, jobsR, settingsR,
                migratingRef: migratingFuelPriceRef,
              });
        if (cancelled) return;
        if (!fuelPriceAlreadyBackfilled && jobsR.ok && settingsR.ok && fuelBackfillSucceededThisRound) {
          localStorage.setItem(fuelPriceMigratedKey(user.uid), "1");
        }

        const payload = {};
        activeCollections.forEach((c) => {
          if (c.stateKey === null) return; // driverCosts
          if (c.key === "jobs") {
            if (mergedJobs !== undefined) payload.jobs = mergedJobs;
            return;
          }
          if (c.key === "salaryEntries") {
            if (mergedSalaryEntries !== undefined) payload.salaryEntries = mergedSalaryEntries;
            return;
          }
          const r = latest[c.key];
          if (r && r.ok) payload[c.stateKey] = r.data;
        });

        dispatch({ type: "SET_LOADED", payload });
        // Only now — after the one consolidated dispatch above has
        // actually fired — do further live updates get dispatched
        // individually. See the comment on `finalizing`/`finalized` above
        // for why this can't simply be "finalizing === true".
        finalized = true;

        if (failedKeys.size > 0) {
          toast.error("تعذر تحميل بعض البيانات — هيتم إعادة المحاولة تلقائيًا لما النت يرجع");
        }
      } catch (err) {
        // Matches the original top-level catch around the whole load: an
        // unexpected error here (not the non-fatal, already-caught
        // migration failures above) must still resolve `loading` to false
        // one way or another — otherwise the app would be stuck on the
        // loading screen forever with no way to recover.
        if (cancelled) return;
        dispatch({ type: "SET_ERROR", payload: err.message });
        toast.error("خطأ في تحميل البيانات");
      }
    };

    const markSettled = (key, result) => {
      if (cancelled) return;
      latest[key] = result;
      pending.delete(key);
      if (result.ok) failedKeys.delete(key); else failedKeys.add(key);
      setLoadError(failedKeys.size > 0);

      if (!finalizing) {
        // Still collecting the initial batch — once every collection has
        // settled (received its first snapshot, errored, or was declared
        // stuck-offline), finalize() runs the one-time migrations and
        // fires a single consolidated dispatch, exactly like the original
        // Promise.all-based load did.
        if (pending.size === 0) finalize();
      } else if (finalized && result.ok) {
        // A live update arriving after the initial load already finished —
        // dispatch it straight away, no migration re-run needed.
        dispatchIncremental(key, result.data);
      }
      // else: finalize() is still running its migration awaits (finalizing
      // but not yet finalized) — this update has already been folded into
      // `latest` above, and finalize()'s own consolidated dispatch will
      // pick up that freshest value when it runs; no separate dispatch here.
    };

    activeCollections.forEach((c) => {
      // driverCostsAlreadyMigrated already pre-filled `latest.driverCosts`
      // above and this collection is excluded from `activeCollections`
      // entirely in that case, so every entry here genuinely needs a live
      // listener.
      const unsubscribe = c.service.subscribe(
        user.uid,
        (data) => markSettled(c.key, { ok: true, data }),
        (err) => {
          console.warn("فشل الاستماع لمجموعة بيانات:", c.key, err);
          markSettled(c.key, { ok: false, err });
        }
      );
      unsubscribes.push(unsubscribe);
    });

    // Safety net for "offline + no local cache yet": without this, a
    // listener with nothing to serve from cache and no connection to reach
    // the server simply never calls back — `loading` would stay true
    // forever, which is worse than the old getDocs-based behavior (that
    // would reject fairly quickly and show the "couldn't load" banner).
    // This never tears down the listener itself — it stays open and will
    // deliver its real data automatically the moment connectivity returns.
    stuckCheckIntervalId = setInterval(() => {
      if (finalizing || cancelled) { clearStuckCheck(); return; }
      if (pending.size === 0) return;
      if (!navigator.onLine) {
        Array.from(pending).forEach((key) => {
          markSettled(key, { ok: false, err: new Error("غير متصل بالإنترنت ولا توجد نسخة محفوظة محليًا بعد") });
        });
      }
    }, STUCK_OFFLINE_CHECK_MS);

    return () => {
      cancelled = true;
      clearStuckCheck();
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user, reloadTick, dispatch]);

  // Extra safety net on top of onSnapshot's own automatic reconnection:
  // force a full teardown-and-resubscribe the moment the browser reports
  // it's back online, in case any listener died from a terminal error
  // (e.g. permission-denied) rather than a transient connectivity blip.
  useEffect(() => {
    if (!loadError) return;
    const handleOnline = () => retryLoad();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadError, retryLoad]);

  return { loadError, retryLoad };
}
