// src/config/constants/contacts.js

// ─── Contact Type (أرقام تواصل العملاء والموردين) ──────────────────────────
// العمال (drivers) عندهم حقل phone على مستندهم هما مباشرة. العملاء
// والموردين مش كيانات فعلية في قاعدة البيانات — بيتجمّعوا كأسماء متكررة من
// jobs/supplierInvoices (شوف useClients.js / useSuppliers.js، وملحوظة في
// firestore.rules) — فمفيش مكان تاني يتخزن فيه رقم تليفونهم غير collection
// منفصلة بسيطة زي دي، مربوطة بالاسم + النوع بس (من غير أي أثر على أي حساب
// مالي أو أي collection تانية).
export const CONTACT_TYPE = {
  CLIENT:   "client",
  SUPPLIER: "supplier",
};
