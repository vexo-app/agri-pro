// src/contexts/data/reducer.js
//
// نفس الـ reducer وinitialState اللي كانوا جوه DataContext.jsx بالظبط —
// منقولين هنا حرفيًا (نفس الـ cases، نفس الترتيب، نفس التعليقات) من غير
// أي تغيير في السلوك.
import { DEFAULT_FUEL_PRICE } from "../../config/constants";

export const initialState = {
  equipment:     [],
  jobs:          [],
  drivers:       [],
  maintenance:   [],
  equipmentFuelEntries: [],
  payments:      [],
  supplierInvoices: [],
  supplierPayments: [],
  salaryEntries: [],
  attendance:    [],
  custody:       [],
  taxDeductions: [],
  contacts:      [],
  settings:      { fuelPrice: DEFAULT_FUEL_PRICE },
  loading:       true,
  error:         null,
};

// Step 5: إضافة بنفس الـid مرتين (مثلًا rollback بعد ما الـlistener رجّع
// السجل بالفعل، أو استرداد دفعة معلّقة) كانت بتكرر السجل في الشاشة وتعدّ
// مبلغه مرتين لحد أول تحديث. دلوقتي الإضافة upsert: لو الـid موجود بيتحدّث.
const upsertById = (list, item) => {
  if (!item || item.id === undefined) return [item, ...list];
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = list.slice();
  next[i] = { ...list[i], ...item };
  return next;
};

export const reducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING": return { ...state, loading: action.payload };
    case "SET_ERROR":   return { ...state, error: action.payload, loading: false };

    case "ADD_EQUIPMENT":    return { ...state, equipment: upsertById(state.equipment, action.payload) };
    // audit finding O1 (merge لا replace): action.payload ممكن يكون جزئي
    // دلوقتي (شوف mutations/*.js + Form.jsx) — لو استبدلنا السجل كامل بيه
    // زي الأول، أي حقل ما بعتوهوش هيختفي من الشاشة فورًا لحد ما الـlistener
    // يرجّع النسخة الكاملة من السيرفر. الـmerge هنا صفر تأثير على السلوك
    // القديم (لسه كل الاستدعاءات القديمة اللي بتبعت object كامل شغالة
    // 100% زي ما هي، merge مع نفسها بترجع نفس النتيجة).
    case "UPDATE_EQUIPMENT": return { ...state, equipment: state.equipment.map(e => e.id === action.payload.id ? { ...e, ...action.payload } : e) };
    case "DELETE_EQUIPMENT": return { ...state, equipment: state.equipment.filter(e => e.id !== action.payload) };

    case "ADD_JOB":    return { ...state, jobs: upsertById(state.jobs, action.payload) };
    case "UPDATE_JOB": return { ...state, jobs: state.jobs.map(j => j.id === action.payload.id ? { ...j, ...action.payload } : j) };
    case "DELETE_JOB": return { ...state, jobs: state.jobs.filter(j => j.id !== action.payload) };

    case "ADD_DRIVER":    return { ...state, drivers: upsertById(state.drivers, action.payload) };
    case "UPDATE_DRIVER": return { ...state, drivers: state.drivers.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case "DELETE_DRIVER": return { ...state, drivers: state.drivers.filter(d => d.id !== action.payload) };

    case "ADD_MAINTENANCE":    return { ...state, maintenance: upsertById(state.maintenance, action.payload) };
    case "UPDATE_MAINTENANCE": return { ...state, maintenance: state.maintenance.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case "DELETE_MAINTENANCE": return { ...state, maintenance: state.maintenance.filter(m => m.id !== action.payload) };

    case "ADD_EQUIPMENT_FUEL_ENTRY": return { ...state, equipmentFuelEntries: upsertById(state.equipmentFuelEntries, action.payload) };
    case "DELETE_EQUIPMENT_FUEL_ENTRY": return { ...state, equipmentFuelEntries: state.equipmentFuelEntries.filter(e => e.id !== action.payload) };

    case "ADD_PAYMENT":    return { ...state, payments: upsertById(state.payments, action.payload) };
    case "UPDATE_PAYMENT": return { ...state, payments: state.payments.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case "DELETE_PAYMENT": return { ...state, payments: state.payments.filter(p => p.id !== action.payload) };
    // بيحذف كل الدفعات المرتبطة بعملية معينة دفعة واحدة — مستخدمة لما
    // بنحذف عملية من "سجل الشغل" ومعاها كل معلوماتها المالية.
    case "DELETE_PAYMENTS_BY_JOB": return { ...state, payments: state.payments.filter(p => p.jobId !== action.payload) };

    case "ADD_SUPPLIER_INVOICE":    return { ...state, supplierInvoices: upsertById(state.supplierInvoices, action.payload) };
    case "UPDATE_SUPPLIER_INVOICE": return { ...state, supplierInvoices: state.supplierInvoices.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case "DELETE_SUPPLIER_INVOICE": return { ...state, supplierInvoices: state.supplierInvoices.filter(i => i.id !== action.payload) };

    case "ADD_SUPPLIER_PAYMENT":    return { ...state, supplierPayments: upsertById(state.supplierPayments, action.payload) };
    case "UPDATE_SUPPLIER_PAYMENT": return { ...state, supplierPayments: state.supplierPayments.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case "DELETE_SUPPLIER_PAYMENT": return { ...state, supplierPayments: state.supplierPayments.filter(p => p.id !== action.payload) };
    // بيحذف كل الدفعات المرتبطة بفاتورة مورد معينة دفعة واحدة — نفس منطق
    // DELETE_PAYMENTS_BY_JOB بالظبط، مستخدمة لما نحذف فاتورة مورد.
    case "DELETE_SUPPLIER_PAYMENTS_BY_INVOICE":
      return { ...state, supplierPayments: state.supplierPayments.filter(p => p.supplierInvoiceId !== action.payload) };

    case "ADD_SALARY":    return { ...state, salaryEntries: upsertById(state.salaryEntries, action.payload) };
    case "UPDATE_SALARY": return { ...state, salaryEntries: state.salaryEntries.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s) };
    case "DELETE_SALARY": return { ...state, salaryEntries: state.salaryEntries.filter(s => s.id !== action.payload) };

    case "ADD_ATTENDANCE":    return { ...state, attendance: [action.payload, ...state.attendance.filter(a => a.id !== action.payload.id)] };
    case "UPDATE_ATTENDANCE": return { ...state, attendance: state.attendance.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a) };
    case "DELETE_ATTENDANCE": return { ...state, attendance: state.attendance.filter(a => a.id !== action.payload) };

    case "ADD_CUSTODY":    return { ...state, custody: upsertById(state.custody, action.payload) };
    case "UPDATE_CUSTODY": return { ...state, custody: state.custody.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case "DELETE_CUSTODY": return { ...state, custody: state.custody.filter(c => c.id !== action.payload) };

    case "ADD_TAX_DEDUCTION":    return { ...state, taxDeductions: upsertById(state.taxDeductions, action.payload) };
    case "UPDATE_TAX_DEDUCTION": return { ...state, taxDeductions: state.taxDeductions.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) };
    case "DELETE_TAX_DEDUCTION": return { ...state, taxDeductions: state.taxDeductions.filter(t => t.id !== action.payload) };

    case "ADD_CONTACT":    return { ...state, contacts: upsertById(state.contacts, action.payload) };
    case "UPDATE_CONTACT": return { ...state, contacts: state.contacts.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case "DELETE_CONTACT": return { ...state, contacts: state.contacts.filter(c => c.id !== action.payload) };

    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.payload } };
    // Only overwrite the collections that actually loaded successfully this
    // round. Anything that failed keeps its previous value in state instead
    // of being wiped to an empty array — see loadFailed below for why this
    // matters: a failed read must never look like "your data got deleted".
    case "SET_LOADED": return { ...state, ...action.payload, loading: false };
    default: return state;
  }
};
