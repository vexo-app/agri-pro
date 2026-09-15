// src/contexts/data/mutations/contactMutations.js
//
// عمليات جهات اتصال العملاء/الموردين (اسم + نوع + رقم تليفون) — نفس نمط
// driverMutations.js بالظبط.
import { useCallback } from "react";
import toast from "react-hot-toast";
import { contactService } from "../../../services/contactService";

export function useContactMutations({ user, dispatch, stateRef, trackWrite }) {
  const addContact = useCallback(async (c) => {
    const { id, promise } = contactService.add(user.uid, c);
    dispatch({ type: "ADD_CONTACT", payload: { id, ...c } });
    trackWrite(promise, {
      rollback: () => dispatch({ type: "DELETE_CONTACT", payload: id }),
      errorMessage: "تعذر حفظ رقم التواصل، تم التراجع عن الإضافة",
    });
    toast.success("تم حفظ رقم التواصل");
    return id;
  }, [user, dispatch, trackWrite]);

  const updateContact = useCallback(async (id, c) => {
    const previous = stateRef.current.contacts.find((x) => x.id === id);
    dispatch({ type: "UPDATE_CONTACT", payload: { id, ...c } });
    trackWrite(contactService.update(user.uid, id, c), {
      rollback: () => previous && dispatch({ type: "UPDATE_CONTACT", payload: previous }),
      errorMessage: "تعذر حفظ تعديل رقم التواصل، تم التراجع عن التعديل",
    });
    toast.success("تم تحديث رقم التواصل");
  }, [user, dispatch, stateRef, trackWrite]);

  const deleteContact = useCallback(async (id) => {
    const previous = stateRef.current.contacts.find((x) => x.id === id);
    dispatch({ type: "DELETE_CONTACT", payload: id });
    trackWrite(contactService.remove(user.uid, id), {
      rollback: () => previous && dispatch({ type: "ADD_CONTACT", payload: previous }),
      errorMessage: "تعذر حذف رقم التواصل، تم استرجاعه",
    });
    toast.success("تم حذف رقم التواصل");
  }, [user, dispatch, stateRef, trackWrite]);

  return { addContact, updateContact, deleteContact };
}
