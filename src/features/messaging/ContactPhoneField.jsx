// src/features/messaging/ContactPhoneField.jsx
//
// إضافة/تعديل رقم تليفون عميل أو مورد — مفيش فورم "إضافة عميل/مورد" أصلاً
// في التطبيق (بيتولدوا تلقائي من jobs/supplierInvoices)، فده المكان
// الوحيد لتسجيل رقم تواصلهم. بيحفظ في contacts collection عن طريق
// useContacts، من غير أي تأثير على jobs/supplierInvoices ولا أي حساب.
import React, { useState } from "react";
import { PhoneIcon, EditIcon, PlusIcon, SaveIcon, CloseIcon } from "../../components/ui/Icons";
import { useContacts } from "../../hooks/useContacts";

const ContactPhoneField = ({ name, type, phone }) => {
  const { saveContact } = useContacts();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone || "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setValue(phone || ""); setEditing(true); };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await saveContact(name, type, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="tel"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="01xxxxxxxxx"
          className="flex-1 min-w-0 bg-surface-3 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 text-left
            focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600"
        />
        <button type="button" onClick={save} disabled={saving || !value.trim()}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-colors">
          <SaveIcon size={12} />
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-surface-2 border border-white/10 text-gray-400 hover:text-gray-200 transition-colors">
          <CloseIcon size={12} />
        </button>
      </div>
    );
  }

  if (phone) {
    return (
      <button type="button" onClick={startEdit} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors">
        <PhoneIcon size={11} />
        <span className="text-xs" style={{ direction: "ltr" }}>{phone}</span>
        <EditIcon size={10} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="flex items-center justify-center gap-1.5 w-full border border-dashed border-white/18 text-gray-400 hover:text-gray-200 hover:border-white/30 text-[11.5px] font-bold py-2 px-2.5 rounded-xl transition-colors"
    >
      <PlusIcon size={13} />
      إضافة رقم تليفون للتواصل
    </button>
  );
};

export default ContactPhoneField;
