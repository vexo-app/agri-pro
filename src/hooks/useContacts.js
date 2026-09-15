// src/hooks/useContacts.js
//
// أرقام تواصل العملاء والموردين — الاسم مفيش ليه id حقيقي (شوف useClients.js
// / useSuppliers.js)، فالربط بيتم بمفتاح (النوع + الاسم بعد trim) بالظبط
// زي ما contacts بتتخزن. أي مكان محتاج رقم تليفون عميل/مورد يستخدم getPhone
// بدل ما يقرأ من contacts مباشرة.
import { useMemo, useCallback } from "react";
import { useData } from "../contexts/DataContext";

const contactKey = (name, type) => `${type}::${(name || "").trim()}`;

export const useContacts = () => {
  const { contacts = [], loading, addContact, updateContact, deleteContact } = useData();

  const byKey = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => map.set(contactKey(c.name, c.type), c));
    return map;
  }, [contacts]);

  const getContact = useCallback(
    (name, type) => byKey.get(contactKey(name, type)) || null,
    [byKey]
  );

  const getPhone = useCallback(
    (name, type) => byKey.get(contactKey(name, type))?.phone || "",
    [byKey]
  );

  // بيحفظ أو يحدّث رقم عميل/مورد بالاسم + النوع — الاستخدام الوحيد هو حقل
  // "إضافة/تعديل رقم" على كارت العميل/المورد (مفيش فورم عملاء/موردين
  // منفصل أصلاً في التطبيق).
  const saveContact = useCallback(async (name, type, phone) => {
    const trimmedName = (name || "").trim();
    const existing = getContact(trimmedName, type);
    if (existing) {
      await updateContact(existing.id, { name: trimmedName, type, phone });
    } else {
      await addContact({ name: trimmedName, type, phone });
    }
  }, [getContact, addContact, updateContact]);

  return { contacts, loading, getContact, getPhone, saveContact, deleteContact };
};
