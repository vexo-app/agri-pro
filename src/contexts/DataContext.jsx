// src/contexts/DataContext.jsx
import React, { createContext, useContext, useCallback, useReducer, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth }              from "./AuthContext";
import { equipmentService }    from "../services/equipmentService";
import { jobService }          from "../services/jobService";
import { driverService }       from "../services/driverService";
import { maintenanceService }  from "../services/maintenanceService";
import { settingsService }     from "../services/settingsService";
import { paymentService }      from "../services/paymentService";
// driverCostService is kept only to read/clean up the legacy `driverCosts`
// collection during the one-time migration below — it's no longer exposed
// for creating new records (see migrateDriverCosts.js).
import { driverCostService }   from "../services/driverCostService";
import { salaryService }       from "../services/salaryService";
import { attendanceService }   from "../services/attendanceService";
import { custodyService }      from "../services/custodyService";
import { backupService }       from "../services/backupService";
import { DEFAULT_FUEL_PRICE, BACKUP_INTERVAL_MS } from "../config/constants";
import { driverCostToSalaryEntry } from "../utils/migrateDriverCosts";

const initialState = {
  equipment:     [],
  jobs:          [],
  drivers:       [],
  maintenance:   [],
  payments:      [],
  salaryEntries: [],
  attendance:    [],
  custody:       [],
  settings:      { fuelPrice: DEFAULT_FUEL_PRICE },
  loading:       true,
  error:         null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING": return { ...state, loading: action.payload };
    case "SET_ERROR":   return { ...state, error: action.payload, loading: false };

    case "ADD_EQUIPMENT":    return { ...state, equipment: [action.payload, ...state.equipment] };
    case "UPDATE_EQUIPMENT": return { ...state, equipment: state.equipment.map(e => e.id === action.payload.id ? action.payload : e) };
    case "DELETE_EQUIPMENT": return { ...state, equipment: state.equipment.filter(e => e.id !== action.payload) };

    case "ADD_JOB":    return { ...state, jobs: [action.payload, ...state.jobs] };
    case "UPDATE_JOB": return { ...state, jobs: state.jobs.map(j => j.id === action.payload.id ? action.payload : j) };
    case "DELETE_JOB": return { ...state, jobs: state.jobs.filter(j => j.id !== action.payload) };

    case "ADD_DRIVER":    return { ...state, drivers: [action.payload, ...state.drivers] };
    case "UPDATE_DRIVER": return { ...state, drivers: state.drivers.map(d => d.id === action.payload.id ? action.payload : d) };
    case "DELETE_DRIVER": return { ...state, drivers: state.drivers.filter(d => d.id !== action.payload) };

    case "ADD_MAINTENANCE":    return { ...state, maintenance: [action.payload, ...state.maintenance] };
    case "UPDATE_MAINTENANCE": return { ...state, maintenance: state.maintenance.map(m => m.id === action.payload.id ? action.payload : m) };
    case "DELETE_MAINTENANCE": return { ...state, maintenance: state.maintenance.filter(m => m.id !== action.payload) };

    case "ADD_PAYMENT":    return { ...state, payments: [action.payload, ...state.payments] };
    case "UPDATE_PAYMENT": return { ...state, payments: state.payments.map(p => p.id === action.payload.id ? action.payload : p) };
    case "DELETE_PAYMENT": return { ...state, payments: state.payments.filter(p => p.id !== action.payload) };

    case "ADD_SALARY":    return { ...state, salaryEntries: [action.payload, ...state.salaryEntries] };
    case "UPDATE_SALARY": return { ...state, salaryEntries: state.salaryEntries.map(s => s.id === action.payload.id ? action.payload : s) };
    case "DELETE_SALARY": return { ...state, salaryEntries: state.salaryEntries.filter(s => s.id !== action.payload) };

    case "ADD_ATTENDANCE":    return { ...state, attendance: [action.payload, ...state.attendance] };
    case "UPDATE_ATTENDANCE": return { ...state, attendance: state.attendance.map(a => a.id === action.payload.id ? action.payload : a) };
    case "DELETE_ATTENDANCE": return { ...state, attendance: state.attendance.filter(a => a.id !== action.payload) };

    case "ADD_CUSTODY":    return { ...state, custody: [action.payload, ...state.custody] };
    case "UPDATE_CUSTODY": return { ...state, custody: state.custody.map(c => c.id === action.payload.id ? action.payload : c) };
    case "DELETE_CUSTODY": return { ...state, custody: state.custody.filter(c => c.id !== action.payload) };

    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.payload } };
    // Only overwrite the collections that actually loaded successfully this
    // round. Anything that failed keeps its previous value in state instead
    // of being wiped to an empty array — see loadFailed below for why this
    // matters: a failed read must never look like "your data got deleted".
    case "SET_LOADED": return { ...state, ...action.payload, loading: false };
    default: return state;
  }
};

// Wraps a Firestore read so a failure is reported instead of silently
// swallowed. Previously this caught every error and returned `[]`, which
// meant ANY read failure on app start (e.g. still offline right after
// reopening, before the local cache/tab lock settles) rendered as a
// completely empty dashboard — indistinguishable from "my data got
// deleted" from the user's point of view, even though nothing was
// actually lost. Now a failed collection is reported and simply left out
// of the state update, instead of overwriting real/previous data with [].
const safeFetch = (promise) => promise.then(
  (data) => ({ ok: true, data }),
  (err) => ({ ok: false, err })
);
const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Sync status ────────────────────────────────────────────────────────
  // pendingWrites > 0 means at least one add/update/delete is still sitting
  // in Firestore's local offline queue and hasn't been acknowledged by the
  // server yet. This is what lets the UI honestly say "لسه بترفع" vs
  // "كل حاجة اتزامنت" instead of just assuming a write succeeded because
  // its promise resolved (which happens instantly from the local cache,
  // online or offline).
  const [pendingWrites, setPendingWrites] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  // Timestamp of the moment pendingWrites first went from 0 → 1+. Resets to
  // null the instant everything syncs. Lets the UI tell the difference
  // between "just went offline a second ago" (normal, no action needed) and
  // "been sitting unsynced for hours" (worth nudging the person to either
  // find internet or take a manual backup as an extra safety net).
  const [firstPendingWriteAt, setFirstPendingWriteAt] = useState(null);

  // Wrap any Firestore write promise (from a service's add/update/remove)
  // to track it. Does NOT delay or change what the caller awaits — it
  // still resolves exactly when it always did (instantly, even offline).
  // The tracking itself happens in the background via waitForPendingWrites,
  // which only resolves once the write is actually acknowledged by the
  // server (or immediately, if there's nothing pending).
  const trackWrite = useCallback((promise) => {
    setPendingWrites((c) => c + 1);
    promise
      .catch(() => {}) // don't let an unhandled rejection here mask the real error at the call site
      .finally(() => {
        waitForPendingWrites(db)
          .catch(() => {})
          .finally(() => {
            setPendingWrites((c) => Math.max(0, c - 1));
            setLastSyncedAt(new Date());
          });
      });
    return promise;
  }, []);

  useEffect(() => {
    if (pendingWrites > 0) {
      setFirstPendingWriteAt((prev) => prev ?? Date.now());
    } else {
      setFirstPendingWriteAt(null);
    }
  }, [pendingWrites]);

  // Set whenever the most recent load attempt had at least one collection
  // fail to fetch (e.g. still offline and the local cache read didn't
  // resolve). The UI (OfflineBanner) surfaces this explicitly so a failed
  // load reads as "couldn't load yet, will retry" — never as silence that
  // could be mistaken for "your data is gone".
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const retryLoad = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        // Every collection is fetched independently (safeFetch) so that a
        // single failed read doesn't take down the whole dashboard — but
        // unlike before, a failure is now tracked instead of silently
        // becoming an empty list. A failed collection is simply left out
        // of this load's payload, so the reducer keeps whatever was there
        // before (on a cold start that's still empty — there's nothing to
        // show yet either way — but it will no longer stomp on real data
        // during a retry/reconnect load).
        const results = await Promise.all([
          safeFetch(equipmentService.getAll(user.uid)),
          safeFetch(jobService.getAll(user.uid)),
          safeFetch(driverService.getAll(user.uid)),
          safeFetch(maintenanceService.getAll(user.uid)),
          safeFetch(settingsService.get(user.uid)),
          safeFetch(paymentService.getAll(user.uid)),
          safeFetch(driverCostService.getAll(user.uid)),
          safeFetch(salaryService.getAll(user.uid)),
          safeFetch(attendanceService.getAll(user.uid)),
          safeFetch(custodyService.getAll(user.uid)),
        ]);
        const [
          equipmentR, jobsR, driversR, maintenanceR, settingsR,
          paymentsR, driverCostsR, salaryEntriesR, attendanceR, custodyR,
        ] = results;

        if (cancelled) return;

        const anyFailed = results.some((r) => !r.ok);
        results.filter((r) => !r.ok).forEach((r) => console.warn("فشل تحميل مجموعة بيانات:", r.err));
        setLoadError(anyFailed);

        // One-time merge: fold any leftover legacy driverCosts docs into
        // salaryEntries, then remove the legacy docs so this only runs once.
        // Only attempted when both collections actually loaded — merging
        // against a failed (and therefore unknown) salaryEntries list could
        // duplicate entries next time the real data loads.
        let mergedSalaryEntries = salaryEntriesR.ok ? salaryEntriesR.data : undefined;
        if (driverCostsR.ok && salaryEntriesR.ok && driverCostsR.data.length > 0) {
          try {
            const migrated = await Promise.all(
              driverCostsR.data.map(async (cost) => {
                const payload = driverCostToSalaryEntry(cost);
                const id = await salaryService.add(user.uid, payload);
                await driverCostService.remove(cost.id);
                return { id, ...payload };
              })
            );
            mergedSalaryEntries = [...migrated, ...salaryEntriesR.data];
            toast.success(`تم دمج ${migrated.length} من تكاليف السائقين القديمة داخل نظام الرواتب`);
          } catch (migrateErr) {
            // Non-fatal — leave legacy docs in place, try again next load.
            console.warn("driverCosts migration failed:", migrateErr);
          }
        }

        const payload = {};
        if (equipmentR.ok)    payload.equipment    = equipmentR.data;
        if (jobsR.ok)         payload.jobs         = jobsR.data;
        if (driversR.ok)      payload.drivers      = driversR.data;
        if (maintenanceR.ok)  payload.maintenance  = maintenanceR.data;
        if (settingsR.ok)     payload.settings     = settingsR.data;
        if (paymentsR.ok)     payload.payments     = paymentsR.data;
        if (mergedSalaryEntries !== undefined) payload.salaryEntries = mergedSalaryEntries;
        if (attendanceR.ok)   payload.attendance   = attendanceR.data;
        if (custodyR.ok)      payload.custody      = custodyR.data;

        dispatch({ type: "SET_LOADED", payload });

        if (anyFailed) {
          toast.error("تعذر تحميل بعض البيانات — هيتم إعادة المحاولة تلقائيًا لما النت يرجع");
        }
      } catch (err) {
        if (cancelled) return;
        dispatch({ type: "SET_ERROR", payload: err.message });
        toast.error("خطأ في تحميل البيانات");
      }
    })();
    return () => { cancelled = true; };
  }, [user, reloadTick]);

  // Auto-retry a failed load the moment the browser reports it's back
  // online, so a load that failed while offline recovers on its own
  // without the person needing to manually refresh.
  useEffect(() => {
    if (!loadError) return;
    const handleOnline = () => retryLoad();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadError, retryLoad]);

  // ── Automatic daily backup ───────────────────────────────────────────
  // Takes a full snapshot of the user's data once every 24h while online.
  // Lives here (rather than a separate hook called from AppLayout) so it
  // keeps running for as long as the app/tab is open regardless of which
  // page is mounted, and so its failure/success state can be surfaced by
  // any component via useData() — same pattern as pendingWrites/loadError.
  const backupFailKey = (uid) => `backupFailCount:${uid}`;
  // Consecutive failures since the last success. A single failed attempt
  // is treated as "will retry on its own" and stays quiet — only once it's
  // failed more than once in a row (i.e. it's not just a one-off blip) do
  // we surface it, so the person isn't alarmed over a transient hiccup.
  const [backupFailCount, setBackupFailCount] = useState(0);
  const [backupRetryTick, setBackupRetryTick] = useState(0);
  const retryBackupNow = useCallback(() => setBackupRetryTick((t) => t + 1), []);

  useEffect(() => {
    if (!user || state.loading) return;
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

        await backupService.createBackup(user.uid, {
          equipment:     state.equipment,
          jobs:          state.jobs,
          drivers:       state.drivers,
          maintenance:   state.maintenance,
          payments:      state.payments,
          salaryEntries: state.salaryEntries,
          attendance:    state.attendance,
          custodyTransactions: state.custody,
          settings:      state.settings,
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
  }, [user, state.loading, backupRetryTick]);

  // ── Mutations ─────────────────────────────────────────────────────────
  // IMPORTANT: none of these `await` the Firestore write before updating
  // local state. Firestore's write promises (from setDoc/updateDoc/
  // deleteDoc) don't resolve until the server acknowledges them — and
  // while offline, that simply never happens until connectivity returns,
  // even though the write itself is already queued and safely cached
  // locally. Blocking the UI on that promise is what used to make "أضف"
  // hang for a long time (or seem to do nothing) while offline. Instead:
  // dispatch to local state + show the success toast immediately (the
  // data's already safe in Firestore's local queue), and let trackWrite()
  // follow the real write in the background purely for the sync-status
  // indicator (OfflineBanner / pendingWrites).
  const addEquipment = useCallback(async (d) => {
    const { id, promise } = equipmentService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_EQUIPMENT", payload: { id, ...d } });
    toast.success("تم إضافة المعدة");
    return id;
  }, [user, trackWrite]);
  const updateEquipment = useCallback(async (id, d) => {
    trackWrite(equipmentService.update(id, d));
    dispatch({ type: "UPDATE_EQUIPMENT", payload: { id, ...d } });
    toast.success("تم تحديث المعدة");
  }, [trackWrite]);
  const deleteEquipment = useCallback(async (id) => {
    trackWrite(equipmentService.remove(id));
    dispatch({ type: "DELETE_EQUIPMENT", payload: id });
    toast.success("تم حذف المعدة");
  }, [trackWrite]);

  const addJob = useCallback(async (d) => {
    const { id, promise } = jobService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_JOB", payload: { id, ...d } });
    toast.success("تم تسجيل العملية");
    return id;
  }, [user, trackWrite]);
  const updateJob = useCallback(async (id, d) => {
    trackWrite(jobService.update(id, d));
    dispatch({ type: "UPDATE_JOB", payload: { id, ...d } });
    toast.success("تم تحديث العملية");
  }, [trackWrite]);
  const deleteJob = useCallback(async (id) => {
    trackWrite(jobService.remove(id));
    dispatch({ type: "DELETE_JOB", payload: id });
    toast.success("تم حذف العملية");
  }, [trackWrite]);

  const addDriver = useCallback(async (d) => {
    const { id, promise } = driverService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_DRIVER", payload: { id, ...d } });
    toast.success("تم إضافة السائق");
    return id;
  }, [user, trackWrite]);
  const updateDriver = useCallback(async (id, d) => {
    trackWrite(driverService.update(id, d));
    dispatch({ type: "UPDATE_DRIVER", payload: { id, ...d } });
    toast.success("تم تحديث السائق");
  }, [trackWrite]);
  const deleteDriver = useCallback(async (id) => {
    trackWrite(driverService.remove(id));
    dispatch({ type: "DELETE_DRIVER", payload: id });
    toast.success("تم حذف السائق");
  }, [trackWrite]);

  const addMaintenance = useCallback(async (d) => {
    const { id, promise } = maintenanceService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_MAINTENANCE", payload: { id, ...d } });
    toast.success("تم تسجيل الصيانة");
    return id;
  }, [user, trackWrite]);
  const updateMaintenance = useCallback(async (id, d) => {
    trackWrite(maintenanceService.update(id, d));
    dispatch({ type: "UPDATE_MAINTENANCE", payload: { id, ...d } });
    toast.success("تم تحديث الصيانة");
  }, [trackWrite]);
  const deleteMaintenance = useCallback(async (id) => {
    trackWrite(maintenanceService.remove(id));
    dispatch({ type: "DELETE_MAINTENANCE", payload: id });
    toast.success("تم حذف الصيانة");
  }, [trackWrite]);

  const addPayment = useCallback(async (d) => {
    const { id, promise } = paymentService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_PAYMENT", payload: { id, ...d } });
    toast.success("تم تسجيل الدفعة");
    return id;
  }, [user, trackWrite]);
  const updatePayment = useCallback(async (id, d) => {
    trackWrite(paymentService.update(id, d));
    dispatch({ type: "UPDATE_PAYMENT", payload: { id, ...d } });
    toast.success("تم تحديث الدفعة");
  }, [trackWrite]);
  const deletePayment = useCallback(async (id) => {
    trackWrite(paymentService.remove(id));
    dispatch({ type: "DELETE_PAYMENT", payload: id });
    toast.success("تم حذف الدفعة");
  }, [trackWrite]);

  const addSalaryEntry = useCallback(async (d) => {
    const { id, promise } = salaryService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_SALARY", payload: { id, ...d } });
    toast.success("تم التسجيل");
    return id;
  }, [user, trackWrite]);
  const updateSalaryEntry = useCallback(async (id, d) => {
    trackWrite(salaryService.update(id, d));
    dispatch({ type: "UPDATE_SALARY", payload: { id, ...d } });
    toast.success("تم التحديث");
  }, [trackWrite]);
  const deleteSalaryEntry = useCallback(async (id) => {
    trackWrite(salaryService.remove(id));
    dispatch({ type: "DELETE_SALARY", payload: id });
    toast.success("تم الحذف");
  }, [trackWrite]);

  const addAttendance = useCallback(async (d) => {
    const { id, promise } = attendanceService.add(user.uid, d);
    trackWrite(promise);
    dispatch({ type: "ADD_ATTENDANCE", payload: { id, ...d } });
    toast.success("تم تسجيل الحضور");
    return id;
  }, [user, trackWrite]);
  const updateAttendance = useCallback(async (id, d) => {
    trackWrite(attendanceService.update(id, d));
    dispatch({ type: "UPDATE_ATTENDANCE", payload: { id, ...d } });
    toast.success("تم تحديث الحضور");
  }, [trackWrite]);
  const deleteAttendance = useCallback(async (id) => {
    trackWrite(attendanceService.remove(id));
    dispatch({ type: "DELETE_ATTENDANCE", payload: id });
    toast.success("تم حذف السجل");
  }, [trackWrite]);

  // Custody keeps its extra error-toast handling (e.g. permission-denied)
  // — attached to the write promise itself now (fired in the background)
  // instead of via try/catch around an awaited call, since the promise no
  // longer blocks the optimistic UI update below.
  const addCustody = useCallback(async (d) => {
    const { id, promise } = custodyService.add(user.uid, d);
    trackWrite(promise).catch((err) => {
      toast.error(err?.code === "permission-denied"
        ? "لا يوجد صلاحية للكتابة — تأكد من نشر قواعد Firestore"
        : "حدث خطأ أثناء الحفظ (هيتزامن لما الاتصال يرجع لو كانت المشكلة إنك أوف لاين)");
    });
    dispatch({ type: "ADD_CUSTODY", payload: { id, ...d } });
    toast.success(d.type === "expense" ? "تم تسجيل الصرف" : "تم تسجيل الإضافة");
    return id;
  }, [user, trackWrite]);
  const updateCustody = useCallback(async (id, d) => {
    trackWrite(custodyService.update(id, d)).catch(() => {
      toast.error("حدث خطأ أثناء التحديث (هيتزامن لما الاتصال يرجع لو كانت المشكلة إنك أوف لاين)");
    });
    dispatch({ type: "UPDATE_CUSTODY", payload: { id, ...d } });
    toast.success("تم تحديث السجل");
  }, [trackWrite]);
  const deleteCustody = useCallback(async (id) => {
    trackWrite(custodyService.remove(id)).catch(() => {
      toast.error("حدث خطأ أثناء الحذف (هيتزامن لما الاتصال يرجع لو كانت المشكلة إنك أوف لاين)");
    });
    dispatch({ type: "DELETE_CUSTODY", payload: id });
    toast.success("تم حذف السجل");
  }, [trackWrite]);

  const saveSettings = useCallback(async (d) => {
    trackWrite(settingsService.save(user.uid, d));
    dispatch({ type: "UPDATE_SETTINGS", payload: d });
    toast.success("تم حفظ الإعدادات");
  }, [user, trackWrite]);

  const value = {
    ...state,
    pendingWrites, lastSyncedAt, firstPendingWriteAt,
    loadError, retryLoad,
    backupFailCount, retryBackupNow,
    addEquipment, updateEquipment, deleteEquipment,
    addJob, updateJob, deleteJob,
    addDriver, updateDriver, deleteDriver,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addPayment, updatePayment, deletePayment,
    addSalaryEntry, updateSalaryEntry, deleteSalaryEntry,
    addAttendance, updateAttendance, deleteAttendance,
    addCustody, updateCustody, deleteCustody,
    saveSettings,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be inside DataProvider");
  return ctx;
};
