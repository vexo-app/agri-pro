// src/contexts/data/mutations/equipmentMutations.js
//
// عمليات المعدات وصيانتها — منقولة هنا حرفيًا من DataContext.jsx (نفس
// نمط optimistic update + rollback عند فشل الكتابة بالظبط) من غير أي
// تغيير في السلوك. IMPORTANT: زي الملف الأصلي، الكتابة الفعلية لـ
// Firestore متعملهاش await قبل ما نحدّث الحالة المحلية — البيانات فعلاً
// آمنة في طابور Firestore المحلي، وtrackWrite() هو اللي بيتابع نجاح
// الكتابة في الخلفية.
import { useCallback } from "react";
import { equipmentService } from "../../../services/equipmentService";
import { maintenanceService } from "../../../services/maintenanceService";
import { equipmentFuelEntryService } from "../../../services/equipmentFuelEntryService";

export function useEquipmentMutations({ user, dispatch, stateRef, trackWrite }) {
  const addEquipment = useCallback(async (d) => {
    const { id, promise } = equipmentService.add(user.uid, d);
    dispatch({ type: "ADD_EQUIPMENT", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_EQUIPMENT", payload: id }),
      errorMessage: "تعذر حفظ المعدة، تم التراجع عن الإضافة",
      successMessage: "تم إضافة المعدة",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const updateEquipment = useCallback(async (id, d) => {
    const previous = stateRef.current.equipment.find((e) => e.id === id);
    dispatch({ type: "UPDATE_EQUIPMENT", payload: { id, ...d } });
    trackWrite(equipmentService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_EQUIPMENT", payload: previous }),
      errorMessage: "تعذر حفظ تعديل المعدة، تم التراجع عن التعديل",
      successMessage: "تم تحديث المعدة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteEquipment = useCallback(async (id) => {
    const previous = stateRef.current.equipment.find((e) => e.id === id);
    dispatch({ type: "DELETE_EQUIPMENT", payload: id });
    trackWrite(equipmentService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_EQUIPMENT", payload: previous }),
      errorMessage: "تعذر حذف المعدة، تم استرجاعها",
      successMessage: "تم حذف المعدة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const addMaintenance = useCallback(async (d) => {
    const { id, promise } = maintenanceService.add(user.uid, d);
    dispatch({ type: "ADD_MAINTENANCE", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_MAINTENANCE", payload: id }),
      errorMessage: "تعذر حفظ سجل الصيانة، تم التراجع عن الإضافة",
      successMessage: "تم تسجيل الصيانة",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const updateMaintenance = useCallback(async (id, d) => {
    const previous = stateRef.current.maintenance.find((m) => m.id === id);
    dispatch({ type: "UPDATE_MAINTENANCE", payload: { id, ...d } });
    trackWrite(maintenanceService.update(user.uid, id, d), {
      rollback: () => previous && dispatch({ type: "UPDATE_MAINTENANCE", payload: previous }),
      errorMessage: "تعذر حفظ تعديل الصيانة، تم التراجع عن التعديل",
      successMessage: "تم تحديث الصيانة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteMaintenance = useCallback(async (id) => {
    const previous = stateRef.current.maintenance.find((m) => m.id === id);
    dispatch({ type: "DELETE_MAINTENANCE", payload: id });
    trackWrite(maintenanceService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_MAINTENANCE", payload: previous }),
      errorMessage: "تعذر حذف سجل الصيانة، تم استرجاعه",
      successMessage: "تم حذف الصيانة",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  const addEquipmentFuelEntry = useCallback(async (d) => {
    const { id, promise } = equipmentFuelEntryService.add(user.uid, d);
    dispatch({ type: "ADD_EQUIPMENT_FUEL_ENTRY", payload: { id, ...d } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_EQUIPMENT_FUEL_ENTRY", payload: id }),
      errorMessage: "تعذر حفظ الوقود، تم التراجع عن الإضافة",
      successMessage: "تم تسجيل الوقود",
    });
    return id;
  }, [user, dispatch, trackWrite]);

  const deleteEquipmentFuelEntry = useCallback(async (id) => {
    const previous = stateRef.current.equipmentFuelEntries.find((e) => e.id === id);
    dispatch({ type: "DELETE_EQUIPMENT_FUEL_ENTRY", payload: id });
    trackWrite(equipmentFuelEntryService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_EQUIPMENT_FUEL_ENTRY", payload: previous }),
      errorMessage: "تعذر حذف سجل الوقود، تم استرجاعه",
      successMessage: "تم حذف سجل الوقود",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  return {
    addEquipment, updateEquipment, deleteEquipment,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addEquipmentFuelEntry, deleteEquipmentFuelEntry,
  };
}
