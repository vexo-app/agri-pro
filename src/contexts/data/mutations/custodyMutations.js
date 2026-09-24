// src/contexts/data/mutations/custodyMutations.js
//
// عمليات العهدة والخصومات الضريبية — منقولة هنا حرفيًا من DataContext.jsx
// من غير أي تغيير في السلوك.
import { useCallback } from "react";
import { custodyService } from "../../../services/custodyService";
import { taxDeductionService } from "../../../services/taxDeductionService";

export function useCustodyMutations({ user, dispatch, stateRef, trackWrite }) {
  // Custody يمر بنفس مسار trackWrite/rollback المركزي زي كل كيان تاني فوق
  // — قبل كده كان عنده .catch() خاص بيه بيعرض رسالة خطأ بس من غير ما يرجع
  // الـ optimistic dispatch فعليًا، فكانت الكتابة المرفوضة تفضل شكلها
  // "متحفظة" لحد أول reload.
  const addCustody = useCallback(async (d) => {
    const { id, promise } = custodyService.add(user.uid, d);
    dispatch({ type: "ADD_CUSTODY", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_CUSTODY", payload: id }),
      errorMessage: "تعذر حفظ الحركة، تم التراجع عنها",
      successMessage: d.type === "expense" ? "تم تسجيل الصرف" : "تم تسجيل الإضافة",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const updateCustody = useCallback(async (id, d) => {
    const previous = stateRef.current.custody.find((c) => c.id === id);
    dispatch({ type: "UPDATE_CUSTODY", payload: { id, ...d } });
    trackWrite(custodyService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_CUSTODY", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الحركة، تم التراجع عنه",
      successMessage: "تم تحديث السجل",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteCustody = useCallback(async (id) => {
    const previous = stateRef.current.custody.find((c) => c.id === id);
    dispatch({ type: "DELETE_CUSTODY", payload: id });
    trackWrite(custodyService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_CUSTODY", payload: previous }),
      errorMessage: "تعذر حذف الحركة، تم استرجاعها",
      successMessage: "تم حذف السجل",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const addTaxDeduction = useCallback(async (d) => {
    const { id, promise } = taxDeductionService.add(user.uid, d);
    dispatch({ type: "ADD_TAX_DEDUCTION", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_TAX_DEDUCTION", payload: id }),
      errorMessage: "تعذر حفظ الحركة، تم التراجع عنها",
      successMessage: "تم تسجيل الحركة",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const updateTaxDeduction = useCallback(async (id, d) => {
    const previous = stateRef.current.taxDeductions.find((t) => t.id === id);
    dispatch({ type: "UPDATE_TAX_DEDUCTION", payload: { id, ...d } });
    trackWrite(taxDeductionService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_TAX_DEDUCTION", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الحركة، تم التراجع عنه",
      successMessage: "تم تحديث السجل",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteTaxDeduction = useCallback(async (id) => {
    const previous = stateRef.current.taxDeductions.find((t) => t.id === id);
    dispatch({ type: "DELETE_TAX_DEDUCTION", payload: id });
    trackWrite(taxDeductionService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_TAX_DEDUCTION", payload: previous }),
      errorMessage: "تعذر حذف الحركة، تم استرجاعها",
      successMessage: "تم حذف السجل",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  return {
    addCustody, updateCustody, deleteCustody,
    addTaxDeduction, updateTaxDeduction, deleteTaxDeduction,
  };
}
