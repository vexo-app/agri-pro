// src/contexts/data/useSyncStatus.js
//
// نفس منطق trackWrite/pendingWrites/lastSyncedAt/firstPendingWriteAt اللي
// كان جوه DataContext.jsx بالظبط — منقول هنا زي ما هو من غير أي تغيير في
// السلوك، بس في ملف مستقل عشان الملف الرئيسي يبقى أصغر وأسهل يتفهم.
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../../config/firebase";
import { notifyWriteOutcome } from "../../utils/writeNotifier";

export const useSyncStatus = () => {
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
  // to track it. Does NOT delay or change what the caller awaits.
  // (Step 3) ملاحظة: الـpromise بتاع كتابة Firestore بيخلص لما السيرفر يأكد
  // (مش فورًا) — وده اللي بيخلّي successMessage هنا صادقة: رسالة النجاح
  // بتظهر بعد التأكيد، أو "تم الحفظ على الجهاز — في انتظار المزامنة" لو
  // أوفلاين/السيرفر اتأخر (شوف utils/writeNotifier.js).
  // The tracking itself happens in the background via waitForPendingWrites,
  // which only resolves once the write is actually acknowledged by the
  // server (or immediately, if there's nothing pending).
  //
  // `rollback`/`errorMessage` (both optional) let a caller undo its earlier
  // optimistic dispatch if the write is genuinely rejected. This is safe to
  // treat as "genuinely rejected, not just offline": while offline, Firestore
  // queues the write locally and this promise simply stays pending until the
  // write reaches the server — it does not reject just because the device is
  // offline. A rejection here means something real (permission-denied,
  // failed validation, etc.), so it's the right moment to reverse the
  // optimistic UI change instead of leaving it looking saved when it isn't.
  const trackWrite = useCallback((promise, { rollback, errorMessage, successMessage, requiresServer } = {}) => {
    setPendingWrites((c) => c + 1);
    notifyWriteOutcome(promise, { successMessage, requiresServer, toast });
    promise
      .catch((err) => {
        console.warn("Firestore write rejected, rolling back optimistic update:", err);
        if (rollback) rollback();
        toast.error(errorMessage || (err?.code === "permission-denied"
          ? "لا يوجد صلاحية للكتابة — تأكد من نشر قواعد Firestore"
          : "فشل حفظ التغيير، وتم التراجع عنه"));
      })
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

  return { pendingWrites, lastSyncedAt, firstPendingWriteAt, trackWrite };
};
