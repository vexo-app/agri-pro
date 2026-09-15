// src/utils/messageTemplates.js
//
// بناء نصوص رسائل الواتساب الجاهزة — تنسيق نص بس، صفر حساب مالي هنا. كل
// دالة بتاخد أرقام جاهزة محسوبة بالفعل من مكانها الأصلي (useSalary،
// useClients، useSuppliers...) وترجع نص جاهز (string) بس، عشان الرقم اللي
// يوصل في واتساب يفضل نفسه بالظبط اللي شايفه في الصفحة، من غير أي حساب
// موازٍ جديد.
import { formatCurrency, formatDayMonth, formatDate, todayISO } from "./formatters";

const SEP = "——————";

const monthLabel = (yearMonth) =>
  new Date(`${yearMonth}-01`).toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

const signature = (companyName) => (companyName ? `\n\n${SEP}\n${companyName}` : "");

// كل عنصر في entries هو salaryEntry خام (نفس اللي useSalary().getMonthSummary
// بيرجعه جوه summary.entries) — بنعرض بس النوع المطلوب (bonus أو deduction)
// كسطر واحد لكل قيد: تاريخ + سبب + مبلغ.
const entryLines = (entries, type) =>
  (entries || [])
    .filter((e) => e.type === type)
    .map((e) => `• ${formatDayMonth(e.date)} — ${e.reason || e.notes || (type === "deduction" ? "خصم" : "حافز")}: *${formatCurrency(e.amount)}*`)
    .join("\n");

// ─── قوالب العامل ────────────────────────────────────────────────────────

/**
 * كشف حساب — الراتب الأساسي + كل حافز وكل خصم لوحده (تاريخ/سبب/مبلغ) +
 * الصافي. `summary` = ناتج useSalary().getMonthSummary(driverId, yearMonth)
 * بالظبط (base/bonuses/deductions/net/entries) — نفس الرقم المعروض في
 * صفحة السائق وكشف الراتب المطبوع، بدون أي إعادة حساب.
 */
export const buildDriverStatementText = ({ driverName, summary, yearMonth, isPaid, companyName }) => {
  const { base, bonuses, deductions, net, entries } = summary;
  const bonusLines = entryLines(entries, "bonus");
  const deductionLines = entryLines(entries, "deduction");

  let text = `*كشف حساب — ${driverName}*\nالفترة: ${monthLabel(yearMonth)}\n\nالراتب الأساسي: *${formatCurrency(base)}*`;

  if (bonusLines) {
    text += `\n\nالحوافز:\n${bonusLines}\nإجمالي الحوافز: *${formatCurrency(bonuses)}*`;
  }
  if (deductionLines) {
    text += `\n\nالخصومات:\n${deductionLines}\nإجمالي الخصومات: *${formatCurrency(deductions)}*`;
  }

  text += `\n\nالصافي المستحق: *${formatCurrency(net)}*\n${isPaid ? "✅ تم الصرف" : "⚠️ لسه ماتصرفش"}`;
  return text + signature(companyName);
};

/** تذكير بالمستحق — الصافي بس، من غير تفاصيل القيود. */
export const buildDriverReminderText = ({ driverName, net, yearMonth, companyName }) =>
  `*تذكير براتب الشهر*\n${driverName}، الصافي المستحق لشهر ${monthLabel(yearMonth)}: *${formatCurrency(net)}*\n⚠️ لسه ماتصرفش`
  + signature(companyName);

/** شكر على التعامل — نص عام، من غير أي رقم مالي. */
export const buildDriverThanksText = ({ driverName, companyName }) =>
  `شكرًا لك يا ${driverName} على مجهودك وتعاملك معانا 🙏\nتقدير كبير لالتزامك في الشغل.`
  + signature(companyName);

/** تنبيه غياب — خاص بالعامل بس. `absenceDate` اختياري (آخر يوم غياب مسجل). */
export const buildDriverAbsenceText = ({ driverName, absenceDate, companyName }) => {
  const dateLine = absenceDate ? ` يوم ${formatDayMonth(absenceDate)}` : " مؤخرًا";
  return `${driverName}، لاحظنا غيابك${dateLine} من غير إذن مسبق.\nبرجاء التواصل معانا لتوضيح السبب.`
    + signature(companyName);
};

// ─── قوالب العميل ────────────────────────────────────────────────────────
// `jobs` = بالظبط useClients().getClientSummary(name).jobs (كل job فيها
// revenue/amountPaid/remainingAmount محسوبة بالفعل من نفس الدالة المستخدمة
// في ClientDetailPage — صفر حساب موازٍ هنا). `totals` = {totalRevenue,
// totalPaid, totalRemaining} من نفس المصدر.

/**
 * كشف حساب عميل — العمليات المدفوعة بالكامل في قسم، واللي عليها متبقي في
 * قسم تاني بتفاصيل الإيراد/المدفوع/المتبقي لكل عملية لوحدها.
 */
export const buildClientStatementText = ({ clientName, jobs, totals, companyName }) => {
  const { totalRevenue, totalPaid, totalRemaining } = totals;
  const sorted   = [...(jobs || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paidJobs = sorted.filter((j) => j.remainingAmount <= 0);
  const dueJobs  = sorted.filter((j) => j.remainingAmount > 0);

  let text = `*كشف حساب — ${clientName}*\nحتى ${formatDate(todayISO())}`;

  if (paidJobs.length) {
    const lines = paidJobs
      .map((j) => `• ${formatDayMonth(j.date)} — ${j.workType || "عملية"}: *${formatCurrency(j.revenue)}* ✅`)
      .join("\n");
    text += `\n\nمدفوعة بالكامل:\n${lines}`;
  }
  if (dueJobs.length) {
    const lines = dueJobs
      .map((j) => `• ${formatDayMonth(j.date)} — ${j.workType || "عملية"}\n  الإيراد ${formatCurrency(j.revenue)}، مدفوع ${formatCurrency(j.amountPaid)}\n  المتبقي: *${formatCurrency(j.remainingAmount)}*`)
      .join("\n");
    text += `\n\nمتبقي عليها:\n${lines}`;
  }

  text += `\n\nإجمالي الإيراد: *${formatCurrency(totalRevenue)}*\nإجمالي المدفوع: *${formatCurrency(totalPaid)}*`;
  text += totalRemaining > 0
    ? `\n⚠️ الإجمالي المتبقي: *${formatCurrency(totalRemaining)}*`
    : `\n✅ لا يوجد مبلغ متبقي`;

  return text + signature(companyName);
};

/** تذكير بالمستحق — إجمالي المتبقي بس. */
export const buildClientReminderText = ({ clientName, totalRemaining, companyName }) =>
  `*تذكير بالمستحق*\n${clientName}، المبلغ المتبقي عليك: *${formatCurrency(totalRemaining)}*\nبرجاء السداد في أقرب وقت 🙏`
  + signature(companyName);

/** شكر على التعامل — نص عام، من غير أي رقم مالي. */
export const buildClientThanksText = ({ clientName, companyName }) =>
  `شكرًا لك يا ${clientName} على تعاملك معانا 🙏\nنتمنى نكون عند حسن ظنك دايمًا.`
  + signature(companyName);

// ─── قوالب المورد ───────────────────────────────────────────────────────
// نفس منطق العميل بالظبط لكن بالاتجاه المعاكس (إحنا المدينين) — `invoices`
// = useSuppliers().getSupplierSummary(name).invoices، `totals` =
// {totalInvoiced, totalPaidOut, totalPayable}.

export const buildSupplierStatementText = ({ supplierName, invoices, totals, companyName }) => {
  const { totalInvoiced, totalPaidOut, totalPayable } = totals;
  const sorted       = [...(invoices || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paidInvoices = sorted.filter((i) => i.remainingAmount <= 0);
  const dueInvoices  = sorted.filter((i) => i.remainingAmount > 0);

  let text = `*كشف حساب — ${supplierName}*\nحتى ${formatDate(todayISO())}`;

  if (paidInvoices.length) {
    const lines = paidInvoices
      .map((i) => `• ${formatDayMonth(i.date)} — ${i.description || "فاتورة"}: *${formatCurrency(i.amount)}* ✅`)
      .join("\n");
    text += `\n\nمدفوعة بالكامل:\n${lines}`;
  }
  if (dueInvoices.length) {
    const lines = dueInvoices
      .map((i) => `• ${formatDayMonth(i.date)} — ${i.description || "فاتورة"}\n  الإجمالي ${formatCurrency(i.amount)}، دفعته ${formatCurrency(i.amountPaid)}\n  باقي عليك: *${formatCurrency(i.remainingAmount)}*`)
      .join("\n");
    text += `\n\nباقي عليك فيها:\n${lines}`;
  }

  text += `\n\nإجمالي المستحق عليك: *${formatCurrency(totalInvoiced)}*\nإجمالي اللي دفعته: *${formatCurrency(totalPaidOut)}*`;
  text += totalPayable > 0
    ? `\n⚠️ إجمالي الباقي عليك: *${formatCurrency(totalPayable)}*`
    : `\n✅ لا يوجد مبلغ باقي`;

  return text + signature(companyName);
};

/** تذكير بالمستحق — طمأنة المورد إن المتبقي ليه متابَع. */
export const buildSupplierReminderText = ({ supplierName, totalPayable, companyName }) =>
  `*تذكير بالمستحق*\n${supplierName}، المبلغ الباقي عليك ليه: *${formatCurrency(totalPayable)}*\nهيتسدد قريبًا إن شاء الله.`
  + signature(companyName);

/** شكر على التعامل — نص عام، من غير أي رقم مالي. */
export const buildSupplierThanksText = ({ supplierName, companyName }) =>
  `شكرًا لك يا ${supplierName} على تعاملك معانا 🙏\nنتطلع لاستمرار التعاون.`
  + signature(companyName);

// ─── قوالب الإرسال الجماعي (رسالة عامة لجروب — من غير اسم شخص) ─────────────
// بتتستخدم بس كنقطة بداية جاهزة للتعديل — الرسالة الجماعية أصلاً لازم تكون
// نص عام/موحد (مش كشف حساب شخصي)، زي ما وضّح السبيك.

export const buildGroupReminderText = ({ companyName }) =>
  `*تذكير عام لفريق العمل*\nبرجاء متابعة مواعيد الحضور والمستحقات المالية أولاً بأول.\nللاستفسار تواصلوا معانا.`
  + signature(companyName);

export const buildGroupThanksText = ({ companyName }) =>
  `شكرًا لكل فريق العمل على المجهود والالتزام 🙏\nتقديرنا لكل واحد فيكم.`
  + signature(companyName);
