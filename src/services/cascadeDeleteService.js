import {
  collection, doc, getDocsFromServer, query, runTransaction,
  serverTimestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ─── Step 3: Offline guards ───────────────────────────────────────────────────
// الحذف المتسلسل (عملية/فاتورة + دفعاتها) بيستخدم runTransaction، وده لازم
// سيرفر — مش ممكن يتحط في طابور الأوفلاين. فبدل "تم الحذف" وبعدين تراجع،
// الواجهة بتمنعه قبل التنفيذ وتقول ليه.
export const ONLINE_REQUIRED_DELETE_MESSAGE =
  "الحذف ده محتاج اتصال بالإنترنت (بيتأكد من السيرفر إن مفيش دفعات جديدة اتسجلت من جهاز تاني). اتصل بالإنترنت وجرّب تاني.";

export const isOnlineNow = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

// قفل الحذف (`deleting: true`) بيتشال تلقائيًا لو الحذف فشل. لو فك القفل
// نفسه فشل (النت قطع في اللحظة دي)، السجل بيفضل مقفول ويرفض أي دفعة جديدة.
// بعد المدة دي من غير ما الحذف يكمل، القفل يعتبر "عالق" ويتعرض للمستخدم
// زرار يفكه (أو يكمل الحذف).
export const STALE_DELETE_LOCK_MS = 2 * 60 * 1000;

const toMillis = (ts) => {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const n = new Date(ts).getTime();
  return Number.isFinite(n) ? n : null;
};

/** true لو السجل مقفول للحذف من أكتر من STALE_DELETE_LOCK_MS. */
export const isStaleDeleteLock = (record, now = Date.now(), thresholdMs = STALE_DELETE_LOCK_MS) => {
  if (!record || record.deleting !== true) return false;
  const lockedAt = toMillis(record.updatedAt);
  if (lockedAt === null) return false; // لسه ما اتأكدش من السيرفر — مش عالق
  return now - lockedAt > thresholdMs;
};

/** بيفك قفل حذف عالق (كتابة حقل واحد: deleting=false) — ما بيمسحش أي حاجة. */
export const releaseDeleteLock = ({ userId, parentCollection, parentId }) =>
  updateDoc(doc(db, "users", userId, parentCollection, parentId), {
    deleting: false,
    updatedAt: serverTimestamp(),
  });

/**
 * Locks a parent document before querying and deleting its children. Payment
 * rules reject writes while `deleting` is true, closing the cross-device race
 * where a payment could be added after the query but before the delete batch.
 */
export const deleteParentWithChildren = async ({
  userId,
  parentCollection,
  parentId,
  childCollection,
  childForeignKey,
}) => {
  const parentRef = doc(db, "users", userId, parentCollection, parentId);
  let locked = false;

  await runTransaction(db, async (transaction) => {
    const parentSnap = await transaction.get(parentRef);
    if (!parentSnap.exists()) throw new Error("السجل غير موجود أو اتحذف من جهاز تاني");
    if (parentSnap.data()?.deleting === true) throw new Error("جاري حذف السجل من جهاز تاني");
    transaction.update(parentRef, { deleting: true, updatedAt: serverTimestamp() });
  });
  locked = true;

  try {
    // من السيرفر مباشرة (مش الكاش): عشان قائمة الدفعات اللي هتتمسح تبقى
    // كاملة ومؤكدة. لو النت قطع هنا، القراءة تفشل والقفل يتفك تحت.
    const childrenSnap = await getDocsFromServer(
      query(
        collection(db, "users", userId, childCollection),
        where(childForeignKey, "==", parentId)
      )
    );
    // One batch also contains the parent delete. Refuse safely before any
    // delete if the Firestore 500-operation limit would be exceeded.
    if (childrenSnap.docs.length > 499) {
      throw new Error("عدد الدفعات المرتبطة كبير جدًا للحذف دفعة واحدة");
    }

    const batch = writeBatch(db);
    childrenSnap.docs.forEach((child) => batch.delete(child.ref));
    batch.delete(parentRef);
    await batch.commit();
    locked = false;
    return { deletedChildren: childrenSnap.docs.length };
  } catch (err) {
    if (locked) {
      try {
        await updateDoc(parentRef, { deleting: false, updatedAt: serverTimestamp() });
      } catch (unlockError) {
        err.unlockFailed = true;
        err.unlockCause = unlockError;
      }
    }
    throw err;
  }
};
