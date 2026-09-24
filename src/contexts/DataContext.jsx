// src/contexts/DataContext.jsx
//
// نسخة "مقسّمة" (Phase 1 — إعادة تنظيم بس). الـ API الخارجي (useData())
// بيرجع نفس الحقول والدوال بالحرف الواحد زي الملف الأصلي المكوّن من 1023
// سطر — يعني صفر تعديل مطلوب في أي صفحة من صفحات التطبيق. المنطق نفسه
// اتقسّم لملفات أصغر حسب المسؤولية جوه src/contexts/data/:
//
//   data/reducer.js              → الحالة الأولية + الـ reducer
//   data/useSyncStatus.js        → trackWrite / pendingWrites / lastSyncedAt
//   data/migrations.js           → migrations اللمرة-الواحدة (منطق فقط)
//   data/useDataLoader.js        → التحميل الأولي + استدعاء الـ migrations
//   data/useAutoBackup.js        → النسخ الاحتياطي اليومي
//   data/mutations/*.js          → كل عمليات الإضافة/التعديل/الحذف، مجمّعة
//                                   حسب الترابط المنطقي (jobs+payments مع
//                                   بعض، suppliers+their payments مع بعض...)
//
// تقليل عدد قراءات Firestore نفسه (lazy loading) هو Phase 2 — متعمل
// مقصودة هنا، بعد ما يتأكد إن التقسيم ده وحده مش كسر أي حاجة.
import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { useAuth } from "./AuthContext";
import { reducer, initialState } from "./data/reducer";
import { useSyncStatus } from "./data/useSyncStatus";
import { useDataLoader } from "./data/useDataLoader";
import { useAutoBackup } from "./data/useAutoBackup";
import { usePendingPaymentsRecovery } from "./data/usePendingPaymentsRecovery";
import { useEquipmentMutations } from "./data/mutations/equipmentMutations";
import { useJobsMutations } from "./data/mutations/jobsMutations";
import { useDriverMutations } from "./data/mutations/driverMutations";
import { useSupplierMutations } from "./data/mutations/supplierMutations";
import { useSalaryMutations } from "./data/mutations/salaryMutations";
import { useCustodyMutations } from "./data/mutations/custodyMutations";
import { useSettingsMutations } from "./data/mutations/settingsMutations";
import { useContactMutations } from "./data/mutations/contactMutations";

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Always-current snapshot of state, read (not subscribed to) by mutation
  // callbacks and by useAutoBackup so they can capture "the data as it is
  // right now" without adding `state` to every effect/callback's
  // dependency array (which would recreate all of them on every render).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const { pendingWrites, lastSyncedAt, firstPendingWriteAt, trackWrite } = useSyncStatus();
  const { loadError, retryLoad } = useDataLoader({ user, dispatch });
  const { backupFailCount, retryBackupNow } = useAutoBackup({
    user, loading: state.loading, loadError, stateRef,
  });

  // audit finding F-003 (Phase 5): الهوك ده كان موجود من غير ما يتنادى
  // من أي مكان في التطبيق فعلياً — كود ميت موثّق بالتفصيل بس مش مفعّل.
  // اتفعّل هنا (بدل ما يتحذف) لأنه بيغطي فجوة حقيقية موجودة (فقدان دفعة
  // مقدّمة لو الجلسة اتقفلت في التوقيت الحرج بين تسجيل العملية وتسجيل
  // الدفعة المرتبطة بيها وهي أوفلاين) — شوف usePendingPaymentsRecovery.js
  // لتفاصيل السلوك، وJobsPage.jsx لمكان تسجيل "النية" فعلياً قبل الكتابة.
  usePendingPaymentsRecovery({
    user, loading: state.loading, jobs: state.jobs, payments: state.payments, dispatch, trackWrite,
  });

  const mutationArgs = { user, dispatch, stateRef, trackWrite };
  const equipmentMutations = useEquipmentMutations(mutationArgs);
  const jobsMutations       = useJobsMutations(mutationArgs);
  const driverMutations     = useDriverMutations(mutationArgs);
  const supplierMutations   = useSupplierMutations(mutationArgs);
  const salaryMutations     = useSalaryMutations(mutationArgs);
  const custodyMutations    = useCustodyMutations(mutationArgs);
  const settingsMutations   = useSettingsMutations(mutationArgs);
  const contactMutations    = useContactMutations(mutationArgs);

  const value = {
    ...state,
    pendingWrites, lastSyncedAt, firstPendingWriteAt,
    loadError, retryLoad,
    backupFailCount, retryBackupNow,
    ...equipmentMutations,
    ...jobsMutations,
    ...driverMutations,
    ...supplierMutations,
    ...salaryMutations,
    ...custodyMutations,
    ...settingsMutations,
    ...contactMutations,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Step 4: نسخة مش بترمي خطأ برا الـProvider (لمكونات مشتركة زي EmptyState
// بتتعرض كمان في صفحات الضيف).
export const useDataOptional = () => useContext(DataContext);

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be inside DataProvider");
  return ctx;
};
