// src/contexts/data/mutations/jobsMutations.js
//
// عمليات "سجل الشغل" ومدفوعاته — منقولة هنا حرفيًا من DataContext.jsx.
// مجمّعين في ملف واحد (مش ملفين منفصلين) لأن deleteJob بتلمس payments
// مباشرة: العملية وكل الدفعات المرتبطة بيها بيتمسحوا في batch واحد ذرّي
// (يا يتنفذوا مع بعض يا محدش)، عشان لو النت اتقطع نص الطريق ميحصلش
// تضارب دائم بين الشاشة والسيرفر.
import { useCallback } from "react";
import toast from "react-hot-toast";
import { jobService } from "../../../services/jobService";
import { paymentService } from "../../../services/paymentService";
import { deleteParentWithChildren } from "../../../services/cascadeDeleteService";

export function useJobsMutations({ user, dispatch, stateRef, trackWrite }) {
  const addJob = useCallback(async (d) => {
    const { id, promise } = jobService.add(user.uid, d);
    dispatch({ type: "ADD_JOB", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_JOB", payload: id }),
      errorMessage: "تعذر حفظ العملية، تم التراجع عن التسجيل",
    });
    toast.success("تم تسجيل العملية");
    return { id, promise };
  }, [user, dispatch, trackWrite]);

  const updateJob = useCallback(async (id, d) => {
    const previous = stateRef.current.jobs.find((j) => j.id === id);
    dispatch({ type: "UPDATE_JOB", payload: { id, ...d } });
    trackWrite(jobService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_JOB", payload: previous }),
      errorMessage: "تعذر حفظ تعديل العملية، تم التراجع عن التعديل",
    });
    toast.success("تم تحديث العملية");
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteJob = useCallback(async (id) => {
    const previousJob = stateRef.current.jobs.find((j) => j.id === id);
    const relatedPayments = stateRef.current.payments.filter((p) => p.jobId === id);

    dispatch({ type: "DELETE_PAYMENTS_BY_JOB", payload: id });
    dispatch({ type: "DELETE_JOB", payload: id });

    const writePromise = deleteParentWithChildren({
      userId: user.uid,
      parentCollection: "jobs",
      parentId: id,
      childCollection: "payments",
      childForeignKey: "jobId",
    });

    trackWrite(writePromise, {
      rollback: () => {
        relatedPayments.forEach((p) => dispatch({ type: "ADD_PAYMENT", payload: p }));
        previousJob && dispatch({ type: "ADD_JOB", payload: previousJob });
      },
      errorMessage: "تعذر حذف العملية، تم استرجاعها",
    });
    toast.success(
      relatedPayments.length > 0
        ? `تم حذف العملية و${relatedPayments.length} دفعة مرتبطة بها`
        : "تم حذف العملية"
    );
  }, [user, dispatch, stateRef, trackWrite]);

  // audit finding F-003 (Phase 5): `presetId` اختياري — لو اتبعت (من
  // JobsPage.jsx وقت تسجيل دفعة مقدّمة مع عملية جديدة)، بيتكتب المستند
  // بنفس الـ id ده بدل ما paymentService.add يولّد واحد عشوائي — عشان
  // JobsPage تقدر تسجّل "نية دفعة معلّقة" في localStorage بنفس الرقم
  // قبل ما تستدعي الدالة دي أصلاً (شوف usePendingPaymentsRecovery.js).
  const addPayment = useCallback(async (d, presetId) => {
    const { id, promise } = paymentService.add(user.uid, d, presetId);
    dispatch({ type: "ADD_PAYMENT", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_PAYMENT", payload: id }),
      errorMessage: "تعذر حفظ الدفعة، تم التراجع عن التسجيل",
    });
    toast.success("تم تسجيل الدفعة");
    return id;
  }, [user, dispatch, trackWrite]);

  const updatePayment = useCallback(async (id, d) => {
    const previous = stateRef.current.payments.find((p) => p.id === id);
    dispatch({ type: "UPDATE_PAYMENT", payload: { id, ...d } });
    trackWrite(paymentService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_PAYMENT", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الدفعة، تم التراجع عن التعديل",
    });
    toast.success("تم تحديث الدفعة");
  }, [user, dispatch, stateRef, trackWrite]);

  const deletePayment = useCallback(async (id) => {
    const previous = stateRef.current.payments.find((p) => p.id === id);
    dispatch({ type: "DELETE_PAYMENT", payload: id });
    trackWrite(paymentService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_PAYMENT", payload: previous }),
      errorMessage: "تعذر حذف الدفعة، تم استرجاعها",
    });
    toast.success("تم حذف الدفعة");
  }, [user, dispatch, stateRef, trackWrite]);

  return { addJob, updateJob, deleteJob, addPayment, updatePayment, deletePayment };
}
