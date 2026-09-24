// src/utils/writeNotifier.js
//
// Step 3 (Offline UX): رسالة النجاح ما بقتش بتظهر قبل ما نعرف مصير الكتابة.
// كتابات Firestore بتتحفظ فورًا في طابور IndexedDB المحلي، والـpromise بتاعها
// ما بيخلصش إلا لما السيرفر يأكد. فالقاعدة:
//   - أونلاين والسيرفر أكد خلال مهلة قصيرة → رسالة النجاح العادية.
//   - أوفلاين (أو السيرفر ما ردش خلال المهلة) → "تم الحفظ على الجهاز —
//     في انتظار المزامنة" (صادقة: الداتا فعلًا في الطابور المحلي).
//   - السيرفر رفض → ما فيش رسالة نجاح خالص (trackWrite بيعرض الخطأ ويرجّع).
//   - requiresServer (زي الحذف المتسلسل اللي محتاج transaction): رسالة
//     "جاري التنفيذ" لحد ما السيرفر يأكد، ومفيش أبدًا "تم الحفظ على الجهاز".
export const LOCAL_SAVE_MESSAGE = "تم الحفظ على الجهاز — في انتظار المزامنة";
export const SERVER_ACK_GRACE_MS = 2500;

const defaultIsOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export const notifyWriteOutcome = (promise, {
  successMessage,
  requiresServer = false,
  pendingMessage = "جاري التنفيذ…",
  toast,
  isOnline = defaultIsOnline,
  graceMs = SERVER_ACK_GRACE_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) => {
  if (!successMessage || !toast) return;
  let settled = false;
  let showedLocal = false;

  if (requiresServer) {
    const id = toast.loading(pendingMessage);
    promise.then(
      () => toast.success(successMessage, { id }),
      () => toast.dismiss(id) // الخطأ نفسه بيتعرض من trackWrite
    );
    return;
  }

  const showLocal = () => {
    if (settled || showedLocal) return;
    showedLocal = true;
    toast(LOCAL_SAVE_MESSAGE, { icon: "💾" });
  };

  let timer = null;
  if (!isOnline()) showLocal();
  else timer = schedule(showLocal, graceMs);

  promise.then(
    () => {
      settled = true;
      if (timer) cancel(timer);
      if (!showedLocal) toast.success(successMessage);
    },
    () => {
      settled = true;
      if (timer) cancel(timer);
    }
  );
};
