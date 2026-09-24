// src/contexts/data/mutations/supplierMutations.js
//
// عمليات فواتير الموردين ومدفوعاتها + تعديل اسم مورد — منقولة هنا حرفيًا
// من DataContext.jsx. مجمّعين في ملف واحد لنفس سبب jobsMutations.js:
// deleteSupplierInvoice بتمسح الفاتورة وكل الدفعات المرتبطة بيها في batch
// ذرّي واحد.
import { useCallback } from "react";
import toast from "react-hot-toast";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { supplierInvoiceService } from "../../../services/supplierInvoiceService";
import { supplierPaymentService } from "../../../services/supplierPaymentService";
import {
  deleteParentWithChildren, isOnlineNow, releaseDeleteLock, ONLINE_REQUIRED_DELETE_MESSAGE,
} from "../../../services/cascadeDeleteService";

export function useSupplierMutations({ user, dispatch, stateRef, trackWrite }) {
  const addSupplierInvoice = useCallback(async (d) => {
    const { id, promise } = supplierInvoiceService.add(user.uid, d);
    dispatch({ type: "ADD_SUPPLIER_INVOICE", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_SUPPLIER_INVOICE", payload: id }),
      errorMessage: "تعذر حفظ فاتورة المورد، تم التراجع عن التسجيل",
      successMessage: "تم تسجيل الفاتورة",
    });
    return { id, promise };
  }, [user, dispatch, trackWrite]);

  const updateSupplierInvoice = useCallback(async (id, d) => {
    const previous = stateRef.current.supplierInvoices.find((i) => i.id === id);
    dispatch({ type: "UPDATE_SUPPLIER_INVOICE", payload: { id, ...d } });
    trackWrite(supplierInvoiceService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_SUPPLIER_INVOICE", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الفاتورة، تم التراجع عن التعديل",
      successMessage: "تم تحديث الفاتورة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteSupplierInvoice = useCallback(async (id) => {
    // Step 3: الحذف محتاج سيرفر — نرفضه قبل أي تغيير في الشاشة لو أوفلاين.
    if (!isOnlineNow()) {
      toast.error(ONLINE_REQUIRED_DELETE_MESSAGE);
      return false;
    }
    // نفس منطق deleteJob بالظبط: حذف الفاتورة بيمسح معاه كل الدفعات
    // المرتبطة بيها في batch واحد atomic، عشان الشاشة والسيرفر ميختلفوش
    // لو النت اتقطع نص الطريق.
    const previousInvoice = stateRef.current.supplierInvoices.find((i) => i.id === id);
    const relatedPayments = stateRef.current.supplierPayments.filter((p) => p.supplierInvoiceId === id);

    dispatch({ type: "DELETE_SUPPLIER_PAYMENTS_BY_INVOICE", payload: id });
    dispatch({ type: "DELETE_SUPPLIER_INVOICE", payload: id });

    const writePromise = deleteParentWithChildren({
      userId: user.uid,
      parentCollection: "supplierInvoices",
      parentId: id,
      childCollection: "supplierPayments",
      childForeignKey: "supplierInvoiceId",
    });

    trackWrite(writePromise, {
      rollback: () => {
        relatedPayments.forEach((p) => dispatch({ type: "ADD_SUPPLIER_PAYMENT", payload: p }));
        previousInvoice && dispatch({ type: "ADD_SUPPLIER_INVOICE", payload: previousInvoice });
      },
      errorMessage: "تعذر حذف الفاتورة، تم استرجاعها",
      successMessage: relatedPayments.length > 0
        ? `تم حذف الفاتورة و${relatedPayments.length} دفعة مرتبطة بها`
        : "تم حذف الفاتورة",
      requiresServer: true,
    });
    return true;
  }, [user, dispatch, stateRef, trackWrite]);

  // Step 3: فك قفل حذف عالق على فاتورة مورد.
  const releaseSupplierInvoiceDeleteLock = useCallback(async (id) => {
    if (!isOnlineNow()) { toast.error("فك القفل محتاج اتصال بالإنترنت"); return; }
    dispatch({ type: "UPDATE_SUPPLIER_INVOICE", payload: { id, deleting: false } });
    trackWrite(releaseDeleteLock({ userId: user.uid, parentCollection: "supplierInvoices", parentId: id }), {
      errorMessage: "تعذر فك القفل",
      successMessage: "تم فك القفل — الفاتورة رجعت طبيعية",
      requiresServer: true,
    });
  }, [user, dispatch, trackWrite]);

  const addSupplierPayment = useCallback(async (d) => {
    const parentInvoice = stateRef.current.supplierInvoices.find((i) => i.id === d.supplierInvoiceId);
    if (parentInvoice?.deleting === true) {
      toast.error("الفاتورة دي عليها حذف مش مكتمل — كمّل الحذف أو فك القفل الأول");
      return null;
    }
    const { id, promise } = supplierPaymentService.add(user.uid, d);
    dispatch({ type: "ADD_SUPPLIER_PAYMENT", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_SUPPLIER_PAYMENT", payload: id }),
      errorMessage: "تعذر حفظ الدفعة، تم التراجع عن التسجيل",
      successMessage: "تم تسجيل الدفعة",
    });
    return id;
  }, [user, dispatch, stateRef, trackWrite]);

  const updateSupplierPayment = useCallback(async (id, d) => {
    const previous = stateRef.current.supplierPayments.find((p) => p.id === id);
    dispatch({ type: "UPDATE_SUPPLIER_PAYMENT", payload: { id, ...d } });
    trackWrite(supplierPaymentService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_SUPPLIER_PAYMENT", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الدفعة، تم التراجع عن التعديل",
      successMessage: "تم تحديث الدفعة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteSupplierPayment = useCallback(async (id) => {
    const previous = stateRef.current.supplierPayments.find((p) => p.id === id);
    dispatch({ type: "DELETE_SUPPLIER_PAYMENT", payload: id });
    trackWrite(supplierPaymentService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_SUPPLIER_PAYMENT", payload: previous }),
      errorMessage: "تعذر حذف الدفعة، تم استرجاعها",
      successMessage: "تم حذف الدفعة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  // مفيش "مورد" حقيقي بـ id خاص بيه — هو بس اسم متكرر في كل فاتورة (زي
  // العميل بالظبط). فلو اتكتب بغلطة إملائية مختلفة قبل كده، تصحيح الاسم
  // معناه تحديث كل الفواتير اللي عليها الاسم القديم دفعة واحدة، مش فاتورة
  // بفاتورة — عشان الفواتير القديمة تفضل تتجمع تحت نفس المورد بعد التصحيح
  // بدل ما تتقسم بين اسمين. نفس أسلوب batch الذري المستخدم في
  // deleteSupplierInvoice فوق.
  const renameSupplier = useCallback(async (oldName, newName) => {
    const trimmedNewName = (newName || "").trim();
    if (!trimmedNewName || trimmedNewName === oldName) return;

    const affectedInvoices = stateRef.current.supplierInvoices.filter(
      (inv) => inv.supplierName === oldName
    );
    if (affectedInvoices.length === 0) return;

    affectedInvoices.forEach((inv) =>
      dispatch({ type: "UPDATE_SUPPLIER_INVOICE", payload: { ...inv, supplierName: trimmedNewName } })
    );

    const writePromise = (async () => {
      const batch = writeBatch(db);
      affectedInvoices.forEach((inv) => {
        batch.update(doc(db, "users", user.uid, "supplierInvoices", inv.id), {
          supplierName: trimmedNewName,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    })();

    trackWrite(writePromise, {
      rollback: () => {
        affectedInvoices.forEach((inv) =>
          dispatch({ type: "UPDATE_SUPPLIER_INVOICE", payload: inv })
        );
      },
      errorMessage: "تعذر تعديل اسم المورد، تم التراجع عن التغيير",
      successMessage: `تم تغيير الاسم إلى "${trimmedNewName}" في ${affectedInvoices.length} فاتورة`,
    });
  }, [user, dispatch, stateRef, trackWrite]);

  return {
    addSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice, releaseSupplierInvoiceDeleteLock, renameSupplier,
    addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
  };
}
