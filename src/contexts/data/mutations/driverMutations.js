// src/contexts/data/mutations/driverMutations.js
//
// عمليات السائقين — منقولة هنا حرفيًا من DataContext.jsx من غير أي تغيير
// في السلوك.
import { useCallback } from "react";
import toast from "react-hot-toast";
import { driverService } from "../../../services/driverService";
import { buildSalaryHistory } from "../../../utils/salaryCalculations";

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export function useDriverMutations({ user, dispatch, stateRef, trackWrite }) {
  const addDriver = useCallback(async (d) => {
    const data = {
      ...d,
      salaryHistory: [{ effectiveFrom: currentMonth(), salary: Number(d.salary) || 0 }],
    };
    const { id, promise } = driverService.add(user.uid, data);
    dispatch({ type: "ADD_DRIVER", payload: { id, ...data } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_DRIVER", payload: id }),
      errorMessage: "تعذر حفظ السائق، تم التراجع عن الإضافة",
    });
    toast.success("تم إضافة السائق");
    return id;
  }, [user, dispatch, trackWrite]);

  const updateDriver = useCallback(async (id, d) => {
    const previous = stateRef.current.drivers.find((x) => x.id === id);
    const salaryChanged = Object.prototype.hasOwnProperty.call(d, "salary")
      && Number(d.salary) !== Number(previous?.salary);
    const data = salaryChanged
      ? { ...d, salaryHistory: buildSalaryHistory(previous, d.salary, currentMonth()) }
      : d;
    dispatch({ type: "UPDATE_DRIVER", payload: { id, ...data } });
    trackWrite(driverService.update(user.uid, id, data), {
      rollback: () => previous && dispatch({ type: "UPDATE_DRIVER", payload: previous }),
      errorMessage: "تعذر حفظ تعديل السائق، تم التراجع عن التعديل",
    });
    toast.success("تم تحديث السائق");
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteDriver = useCallback(async (id) => {
    const previous = stateRef.current.drivers.find((x) => x.id === id);
    dispatch({ type: "DELETE_DRIVER", payload: id });
    trackWrite(driverService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_DRIVER", payload: previous }),
      errorMessage: "تعذر حذف السائق، تم استرجاعه",
    });
    toast.success("تم حذف السائق");
  }, [user, dispatch, stateRef, trackWrite]);

  return { addDriver, updateDriver, deleteDriver };
}
