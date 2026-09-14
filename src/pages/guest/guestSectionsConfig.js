// src/pages/guest/guestSectionsConfig.js
//
// إعداد عام لصفحة GuestSectionPage.jsx بدل ما نكرر نفس الشكل (كروت +
// حقول) في 6 ملفات منفصلة. أسماء الحقول هنا مطابقة لأسماء الحقول اللي
// firestore.rules بتتحقق منها فعليًا (isValidEquipment/isValidJob/...) —
// مفيش أي منطق جديد هنا، عرض بس.
//
// ⚠️ الصيانة/العهدة/الضرائب/الموردين هنا "قراءة بس" — مفيش أي تعديل ولا
// إضافة ولا حذف، ومفيش صفحات تفاصيل (equipment/:id, drivers/:id...) في
// Phase 2 — لو محتاجين تفاصيل أعمق ممكن تتضاف بعدين لوحدها.
//
// كل الحقول اللي قيمتها الخام إنجليزي (status/type/category/position/role
// من enums الموجودة في src/config/constants) بتتترجم هنا لعربي عن طريق
// نفس ثوابت الـlabels اللي واجهة صاحب الحساب نفسها بتستخدمها — مفيش أي
// ترجمة/تسمية جديدة مخترعة، كلها إعادة استخدام لنفس الـconstants
// الموجودة أصلاً (src/config/constants/team.js, custody.js, equipment.js,
// taxDeductions.js) عشان الضيف ميشوفش أي كلمة إنجليزي خام زي "driver" أو
// "deposit" أو "expense".
import { equipmentService } from "../../services/equipmentService";
import { driverService } from "../../services/driverService";
import { maintenanceService } from "../../services/maintenanceService";
import { custodyService } from "../../services/custodyService";
import { taxDeductionService } from "../../services/taxDeductionService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  EQUIPMENT_STATUS_LABELS,
  DRIVER_STATUS_LABELS, TEAM_ROLE, TEAM_ROLE_LABELS, STAFF_POSITION_LABELS,
  CUSTODY_TYPE_LABELS, CUSTODY_EXPENSE_CATEGORY_LABELS,
  TAX_DEDUCTION_TYPE_LABELS,
} from "../../config/constants";

const money = (v) => formatCurrency(v || 0);
const date  = (v) => v ? formatDate(v) : "—";

// درجة لون كل حالة/نوع — نفس المعنى البصري المستخدم في واجهة صاحب الحساب
// (أخضر = إيجابي/نشط، أحمر = صرف/سلبي، كهرماني = تحذير، رمادي = متوقف).
const EQUIPMENT_STATUS_TONE = { active: "green", maintenance: "amber", inactive: "gray" };
const CUSTODY_TYPE_TONE     = { deposit: "green", expense: "red" };

/**
 * تفاصيل عرض كل قسم لصفحة GuestSectionPage.jsx (كروت بدل جدول):
 * - title(item)    نص عنوان الكارت الرئيسي (بولد).
 * - subtitle(item) سطر فرعي رمادي تحت العنوان (اختياري).
 * - badges(item)   مصفوفة { label, tone } تتعرض كـBadge بجانب العنوان.
 * - fields         مصفوفة { key, label, format?, numeric? } تتعرض كشبكة
 *                  "قيمة كبيرة + تسمية صغيرة" تحت العنوان (نفس أسلوب
 *                  StatItem في SupplierCard.jsx/DriverCard.jsx بتاعة
 *                  صاحب الحساب).
 */
export const GUEST_SECTIONS = {
  equipment: {
    label: "المعدات",
    description: "قائمة المعدات وحالتها ومعدلات استهلاك الوقود",
    service: equipmentService,
    emptyText: "لا يوجد معدات مسجّلة.",
    title:    (i) => i.name,
    subtitle: (i) => i.type,
    badges:   (i) => [{
      label: EQUIPMENT_STATUS_LABELS[i.status] || i.status || "—",
      tone:  EQUIPMENT_STATUS_TONE[i.status] || "gray",
    }],
    fields: [
      { key: "fuelRate", label: "معدل الوقود", format: money, numeric: true },
    ],
  },
  jobs: {
    label: "سجل الشغل",
    description: "عمليات الشغل: التاريخ والعميل والمساحة والسعر والمدفوع",
    // jobs عنده منطق خاص (فلترة عملاء) — بيتحمّل من GuestSectionPage
    // مباشرة عن طريق guestAccessService.subscribeGuestJobs، مش من هنا.
    emptyText: "لا يوجد عمليات مسجّلة.",
    title:    (i) => i.client || "—",
    subtitle: (i) => i.workType,
    fields: [
      { key: "date",         label: "التاريخ",   format: date },
      { key: "acres",        label: "الفدان",     numeric: true },
      { key: "pricePerAcre", label: "سعر الفدان", format: money, numeric: true },
      { key: "amountPaid",   label: "المدفوع",    format: money, numeric: true },
    ],
  },
  drivers: {
    label: "فريق العمل",
    description: "بيانات فريق العمل ورواتبهم — واضح مين سائق ومين إداري/محاسب",
    service: driverService,
    emptyText: "لا يوجد أعضاء فريق مسجّلين.",
    title:    (i) => i.name,
    subtitle: (i) => i.phone,
    // ⚠️ عكس شارة الدور في DriverCard.jsx بتاعة صاحب الحساب (اللي بتخفي
    // شارة "سائق" الافتراضية اختصارًا)، هنا بنعرضها دايمًا صراحةً — طلب
    // صريح إن شاشة الضيف توضّح "مين سائق من مين إداري" من غير ما يحتاج
    // يخمّن. نفس منطق الاشتقاق بالظبط (role/position/TEAM_ROLE) من غير
    // أي حقل أو enum جديد.
    badges: (i) => {
      const role = i.role || TEAM_ROLE.DRIVER;
      const isStaff = role !== TEAM_ROLE.DRIVER;
      const isCustomDriverTitle = !isStaff && i.position && i.position !== "driver";
      const roleLabel = isStaff
        ? (STAFF_POSITION_LABELS[i.position] || TEAM_ROLE_LABELS[role])
        : (isCustomDriverTitle ? i.position : TEAM_ROLE_LABELS.driver);
      const badges = [{ label: roleLabel, tone: "blue" }];
      if (i.status === "inactive") {
        badges.push({ label: DRIVER_STATUS_LABELS.inactive, tone: "gray" });
      }
      return badges;
    },
    fields: [
      { key: "salary", label: "الراتب", format: money, numeric: true },
    ],
  },
  maintenance: {
    label: "الصيانة",
    description: "سجلات الصيانة وتكلفتها لكل معدة",
    service: maintenanceService,
    emptyText: "لا يوجد سجلات صيانة.",
    title:    (i) => i.type || "صيانة",
    subtitle: (i) => date(i.date),
    fields: [
      { key: "cost", label: "التكلفة", format: money, numeric: true },
    ],
  },
  custody: {
    label: "العهدة",
    description: "حركات العهدة الواردة والمنصرفة",
    service: custodyService,
    emptyText: "لا يوجد حركات عهدة.",
    // العنوان = تصنيف المصروف (فين راحت الفلوس) للصرف، أو "إضافة فلوس"
    // للإيداع — أوضح من عرض type الخام. لو التصنيف "أخرى" وفيه otherLabel
    // (نص حر كتبه صاحب الحساب وقت التسجيل)، بنعرضه هو بدل كلمة "أخرى"
    // العامة — معلومة إضافية موجودة أصلاً على نفس المستند، مفيش قراءة
    // لأي collection تانية (equipmentId/driverId ما بنعرضهمش هنا لأن ده
    // هيحتاج صلاحية وصول لقسم المعدات/السواقين بشكل منفصل، وممكن يبقوا
    // مقفولين للضيف حتى لو قسم العهدة نفسه مفتوح). الشارة بتعرض النوع
    // نفسه (إضافة/صرف) بلون مختلف. الكل مُترجم من نفس CUSTODY_*_LABELS
    // الموجودة أصلاً في src/config/constants/custody.js — صفر كلمة
    // إنجليزي.
    title: (i) => i.type === "expense"
      ? (i.category === "other" && i.otherLabel ? i.otherLabel : (CUSTODY_EXPENSE_CATEGORY_LABELS[i.category] || "مصروف"))
      : (CUSTODY_TYPE_LABELS.deposit),
    subtitle: (i) => date(i.date),
    badges: (i) => [{
      label: CUSTODY_TYPE_LABELS[i.type] || i.type || "—",
      tone:  CUSTODY_TYPE_TONE[i.type] || "gray",
    }],
    fields: [
      { key: "amount", label: "المبلغ", format: money, numeric: true },
    ],
  },
  taxDeductions: {
    label: "الضرائب والخصومات",
    description: "الضرائب والخصومات المسجّلة",
    service: taxDeductionService,
    emptyText: "لا يوجد ضرائب أو خصومات مسجّلة.",
    title:    (i) => TAX_DEDUCTION_TYPE_LABELS[i.type] || i.type || "خصم",
    subtitle: (i) => date(i.date),
    fields: [
      { key: "amount", label: "المبلغ", format: money, numeric: true },
    ],
  },
  suppliers: {
    label: "الموردين",
    // العرض هنا مختلف عن باقي الأقسام: مجمّع لكل مورد (إجمالي المستحق/
    // مدفوع له/باقي عليه) بدل ليستة فواتير خام — شوف الفرع الخاص بيها
    // في GuestSectionPage.jsx (subscribeGuestSuppliers) بدل ما تتحمّل من
    // service.subscribe العادي زي باقي الأقسام.
    description: "كل مورد: إجمالي المستحق عليه، اللي اتدفعله، والباقي",
    emptyText: "لا يوجد فواتير موردين.",
  },
};
