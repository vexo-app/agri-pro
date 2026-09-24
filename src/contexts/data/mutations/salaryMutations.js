// src/contexts/data/mutations/salaryMutations.js
//
// عمليات الرواتب والحضور — منقولة هنا حرفيًا من DataContext.jsx من غير
// أي تغيير في السلوك.
import { useCallback } from "react";
import toast from "react-hot-toast";
import { salaryService } from "../../../services/salaryService";
import { attendanceService } from "../../../services/attendanceService";

export function useSalaryMutations({ user, dispatch, stateRef, trackWrite }) {
  const addSalaryEntry = useCallback(async (d) => {
    const { id, promise } = salaryService.add(user.uid, d);
    dispatch({ type: "ADD_SALARY", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_SALARY", payload: id }),
      errorMessage: "تعذر الحفظ، تم التراجع عن التسجيل",
      successMessage: "تم التسجيل",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const updateSalaryEntry = useCallback(async (id, d) => {
    const previous = stateRef.current.salaryEntries.find((s) => s.id === id);
    dispatch({ type: "UPDATE_SALARY", payload: { id, ...d } });
    trackWrite(salaryService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_SALARY", payload: previous }),
      errorMessage: "تعذر حفظ التعديل، تم التراجع عنه",
      successMessage: "تم التحديث",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteSalaryEntry = useCallback(async (id) => {
    const previous = stateRef.current.salaryEntries.find((s) => s.id === id);
    dispatch({ type: "DELETE_SALARY", payload: id });
    trackWrite(salaryService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_SALARY", payload: previous }),
      errorMessage: "تعذر الحذف، تم استرجاع السجل",
      successMessage: "تم الحذف",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const addAttendance = useCallback(async (d) => {
    const duplicate = stateRef.current.attendance.some(
      (record) => record.driverId === d.driverId && record.date === d.date
    );
    if (duplicate) {
      toast.error("تم تسجيل حضور هذا السائق في اليوم ده بالفعل");
      return null;
    }
    const { id, promise } = attendanceService.add(user.uid, d);
    dispatch({ type: "ADD_ATTENDANCE", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_ATTENDANCE", payload: id }),
      errorMessage: "تعذر حفظ الحضور، تم التراجع عن التسجيل",
      successMessage: "تم تسجيل الحضور",
    });
    return id;
  }, [user, dispatch, stateRef, trackWrite]);

  const updateAttendance = useCallback(async (id, d) => {
    const previous = stateRef.current.attendance.find((a) => a.id === id);
    dispatch({ type: "UPDATE_ATTENDANCE", payload: { id, ...d } });
    trackWrite(attendanceService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_ATTENDANCE", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الحضور، تم التراجع عن التعديل",
      successMessage: "تم تحديث الحضور",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteAttendance = useCallback(async (id) => {
    const previous = stateRef.current.attendance.find((a) => a.id === id);
    dispatch({ type: "DELETE_ATTENDANCE", payload: id });
    trackWrite(attendanceService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_ATTENDANCE", payload: previous }),
      errorMessage: "تعذر حذف السجل، تم استرجاعه",
      successMessage: "تم حذف السجل",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  return {
    addSalaryEntry, updateSalaryEntry, deleteSalaryEntry,
    addAttendance, updateAttendance, deleteAttendance,
  };
}
