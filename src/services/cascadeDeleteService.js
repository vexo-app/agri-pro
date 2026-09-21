import {
  collection, doc, getDocs, query, runTransaction,
  serverTimestamp, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

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
    const childrenSnap = await getDocs(
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
