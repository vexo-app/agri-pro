// src/pages/guest/guestSectionsConfig.js
//
// إعداد عام لصفحة GuestSectionPage.jsx بدل ما نكرر نفس الشكل (قايمة +
// أعمدة) في 6 ملفات منفصلة. الأعمدة هنا مطابقة لأسماء الحقول اللي
// firestore.rules بتتحقق منها فعليًا (isValidEquipment/isValidJob/...) —
// مفيش أي منطق جديد هنا، عرض بس.
//
// ⚠️ الصيانة/العهدة/الضرائب/الموردين هنا "قراءة بس" — مفيش أي تعديل ولا
// إضافة ولا حذف، ومفيش صفحات تفاصيل (equipment/:id, drivers/:id...) في
// Phase 2 — لو محتاجين تفاصيل أعمق ممكن تتضاف بعدين لوحدها.
import { equipmentService } from "../../services/equipmentService";
import { driverService } from "../../services/driverService";
import { maintenanceService } from "../../services/maintenanceService";
import { custodyService } from "../../services/custodyService";
import { taxDeductionService } from "../../services/taxDeductionService";
import { supplierInvoiceService } from "../../services/supplierInvoiceService";
import { formatCurrency, formatDate } from "../../utils/formatters";

const money = (v) => formatCurrency(v || 0);
const date  = (v) => v ? formatDate(v) : "—";

export const GUEST_SECTIONS = {
  equipment: {
    label: "المعدات",
    // وصف قصير — بيتعرض تحت اسم القسم في الصفحة الرئيسية لواجهة الضيف
    // (GuestHomePage.jsx) بس، عشان يوضح محتوى القسم من غير ما يفتحه.
    description: "قائمة المعدات وحالتها ومعدلات استهلاك الوقود",
    service: equipmentService,
    emptyText: "لا يوجد معدات مسجّلة.",
    columns: [
      { key: "name",   label: "الاسم" },
      { key: "type",   label: "النوع" },
      { key: "status", label: "الحالة" },
      // numeric: true — محاذاة يمين + أرقام بعرض ثابت (tabular-nums) في
      // GuestSectionPage.jsx، عشان الأرقام تتقارن بسهولة عمود تحت عمود.
      { key: "fuelRate", label: "معدل الوقود", format: money, numeric: true },
    ],
  },
  jobs: {
    label: "سجل الشغل",
    description: "عمليات الشغل: التاريخ والعميل والمساحة والسعر والمدفوع",
    // jobs عنده منطق خاص (فلترة عملاء) — بيتحمّل من GuestSectionPage
    // مباشرة عن طريق guestAccessService.subscribeGuestJobs، مش من هنا.
    emptyText: "لا يوجد عمليات مسجّلة.",
    columns: [
      { key: "date",         label: "التاريخ", format: date },
      { key: "client",       label: "العميل" },
      { key: "workType",     label: "نوع العمل" },
      { key: "acres",        label: "الفدان", numeric: true },
      { key: "pricePerAcre", label: "سعر الفدان", format: money, numeric: true },
      { key: "amountPaid",   label: "المدفوع", format: money, numeric: true },
    ],
  },
  drivers: {
    label: "فريق العمل",
    description: "بيانات فريق العمل ورواتبهم وحالتهم",
    service: driverService,
    emptyText: "لا يوجد أعضاء فريق مسجّلين.",
    columns: [
      { key: "name",     label: "الاسم" },
      { key: "position", label: "الوظيفة" },
      { key: "phone",    label: "الهاتف" },
      { key: "status",   label: "الحالة" },
      { key: "salary",   label: "الراتب", format: money, numeric: true },
    ],
  },
  maintenance: {
    label: "الصيانة",
    description: "سجلات الصيانة وتكلفتها لكل معدة",
    service: maintenanceService,
    emptyText: "لا يوجد سجلات صيانة.",
    columns: [
      { key: "date", label: "التاريخ", format: date },
      { key: "type", label: "النوع" },
      { key: "cost", label: "التكلفة", format: money, numeric: true },
    ],
  },
  custody: {
    label: "العهدة",
    description: "حركات العهدة الواردة والمنصرفة",
    service: custodyService,
    emptyText: "لا يوجد حركات عهدة.",
    columns: [
      { key: "date",     label: "التاريخ", format: date },
      { key: "type",     label: "النوع" },
      { key: "category", label: "التصنيف" },
      { key: "amount",   label: "المبلغ", format: money, numeric: true },
    ],
  },
  taxDeductions: {
    label: "الضرائب والخصومات",
    description: "الضرائب والخصومات المسجّلة",
    service: taxDeductionService,
    emptyText: "لا يوجد ضرائب أو خصومات مسجّلة.",
    columns: [
      { key: "date",   label: "التاريخ", format: date },
      { key: "type",   label: "النوع" },
      { key: "amount", label: "المبلغ", format: money, numeric: true },
    ],
  },
  suppliers: {
    label: "الموردين",
    description: "فواتير الموردين ومبالغها",
    service: supplierInvoiceService,
    emptyText: "لا يوجد فواتير موردين.",
    note: "الفواتير هنا بس — مدفوعات الموردين هتتضاف لاحقًا لو احتجتوها.",
    columns: [
      { key: "date",         label: "التاريخ", format: date },
      { key: "supplierName", label: "المورد" },
      { key: "description",  label: "الوصف" },
      { key: "amount",       label: "المبلغ", format: money, numeric: true },
    ],
  },
};
