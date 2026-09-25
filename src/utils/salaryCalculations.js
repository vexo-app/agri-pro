// src/utils/salaryCalculations.js
import { SALARY_ENTRY_TYPES, DRIVER_STATUS, SALARY_CARRYOVER_START_MONTH } from "../config/constants";

const monthPrefixOf = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Return the salary rate that was effective for a specific calendar month. */
export const getSalaryForMonth = (driver, yearMonth) => {
  if (!driver) return 0;
  const history = Array.isArray(driver.salaryHistory)
    ? driver.salaryHistory
        .filter((item) => /^\d{4}-\d{2}$/.test(item?.effectiveFrom || ""))
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    : [];

  if (history.length === 0) return Number(driver.salary) || 0;

  const eligible = history.filter((item) => item.effectiveFrom <= yearMonth);
  const effective = eligible[eligible.length - 1];
  return effective ? Number(effective.salary) || 0 : 0;
};

/**
 * Build salary history when the current salary changes. Existing drivers that
 * predate this field get one baseline row preserving their old salary for all
 * past months, then the new rate starts in the current month.
 */
export const buildSalaryHistory = (driver, nextSalary, effectiveFrom = monthPrefixOf()) => {
  const history = Array.isArray(driver?.salaryHistory)
    ? driver.salaryHistory.map((item) => ({ ...item }))
    : [{ effectiveFrom: "0000-01", salary: Number(driver?.salary) || 0 }];
  const next = { effectiveFrom, salary: Number(nextSalary) || 0 };
  const existingIndex = history.findIndex((item) => item.effectiveFrom === effectiveFrom);

  if (existingIndex >= 0) history[existingIndex] = next;
  else history.push(next);

  return history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
};

/**
 * Calculate net salary for a driver in a specific month.
 * entries = all salary entries for that driver in that month
 *
 * قرار المالك:
 * - "خصم" = فلوس خرجت للعامل فعلًا → بتقلل الصافي (الباقي له) بس، مش مصروف الشركة.
 * - "جزاء" = فلوس العامل ما خدهاش → بتقلل الصافي وبتقلل مصروف الشركة.
 * - "خصم مرحّل" = سالب الشهر اللي فات → بيقلل الصافي بس (اتحسب مصروف وقت ما خرج).
 *   `carryIn` هو المبلغ المحسوب تلقائي؛ لو فيه قيد carryover في الشهر، مبلغه
 *   هو اللي بيتاخد بدل المحسوب (تعديل يدوي من المالك).
 * - expense = الراتب + الحوافز − الجزاءات: ده اللي بيدخل في مصروف المرتبات.
 */
export const calcMonthlySalary = (entries, defaultBase = 0, carryIn = 0) => {
  let base      = 0;
  let bonuses   = 0;
  let deductions = 0;
  let penalties = 0;
  let carryOverride = null;
  let hasBaseEntry = false;

  entries.forEach((e) => {
    const amount = Number(e.amount) || 0;
    switch (e.type) {
      case SALARY_ENTRY_TYPES.BASE:          base += amount; hasBaseEntry = true; break;
      case SALARY_ENTRY_TYPES.BONUS:         bonuses          += amount; break;
      case SALARY_ENTRY_TYPES.DEDUCTION:     deductions       += amount; break;
      case SALARY_ENTRY_TYPES.PENALTY:       penalties        += amount; break;
      case SALARY_ENTRY_TYPES.CARRYOVER:     carryOverride = (carryOverride || 0) + amount; break;
      default: break; // e.g. legacy "advance"/"advance_repay" entries — ignored, not deleted
    }
  });

  // إذا لم يُسجَّل قيد "راتب أساسي" لهذا الشهر بعد، استخدم الراتب الأساسي
  // المُحدَّد في بيانات السائق نفسه، عشان القيمة تتطابق دايمًا مع كارت
  // "الراتب الأساسي" فوق وميظهرش صفر.
  if (!hasBaseEntry) base = Number(defaultBase) || 0;

  const carriedDeduction = carryOverride !== null ? carryOverride : Math.max(0, Number(carryIn) || 0);
  const gross   = base + bonuses;
  const net     = gross - deductions - penalties - carriedDeduction;
  const expense = gross - penalties;

  return {
    base, bonuses, deductions, penalties,
    carriedDeduction, carryAuto: Math.max(0, Number(carryIn) || 0), carryEdited: carryOverride !== null,
    gross, net, expense,
  };
};

const prevMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/**
 * ملخص شهر لعضو مع "الخصم المرحّل": لو صافي الشهر اللي فات (من
 * SALARY_CARRYOVER_START_MONTH وبعده) طلع بالسالب، قيمته بتتخصم من الشهر ده.
 * بيتحسب تلقائي من القيود — مفيش حاجة بتتكتب في البيانات.
 */
export const calcMemberMonthSummary = (allEntries = [], driver, yearMonth) => {
  const driverId = driver?.id;
  const byMonth = new Map();
  allEntries.forEach((e) => {
    if (e.driverId !== driverId) return;
    const ym = (e.date || "").slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(e);
  });

  // سلسلة الشهور من شهر بداية الترحيل لحد الشهر المطلوب
  const chain = [];
  let cur = yearMonth;
  while (/^\d{4}-\d{2}$/.test(cur) && cur > SALARY_CARRYOVER_START_MONTH && chain.length < 600) {
    cur = prevMonthOf(cur);
    chain.unshift(cur);
  }

  let carryIn = 0;
  chain.forEach((ym) => {
    const r = calcMonthlySalary(byMonth.get(ym) || [], getSalaryForMonth(driver, ym), carryIn);
    carryIn = r.net < 0 ? -r.net : 0;
  });

  const entries = byMonth.get(yearMonth) || [];
  return { ...calcMonthlySalary(entries, getSalaryForMonth(driver, yearMonth), carryIn), entries };
};

/**
 * Get all salary entries for a driver in a specific month (YYYY-MM).
 */
export const getMonthEntries = (allEntries, driverId, yearMonth) =>
  allEntries.filter(
    (e) => e.driverId === driverId && (e.date || "").startsWith(yearMonth)
  );

/**
 * Total salary paid to ALL drivers (for profit deduction).
 * Cost = base + bonus - penalties (calcMonthlySalary().expense). "خصم" (money already handed to the worker) does NOT reduce the cost; computed the SAME way as
 * calcMonthlySalary (grouped per driver per month, applying each driver's
 * default base salary when a month has no explicit BASE entry). Without
 * this grouping, a driver whose base is never logged explicitly but who
 * has a deduction entry that month would contribute a bare negative number
 * with nothing to net it against, which flips the sign of "مرتبات الفريق"
 * and — because it's subtracted from profit — makes net profit look
 * artificially higher.
 *
 * `drivers` is optional (defaults to []) for backward-compat with existing
 * callers; without it, default-base fallback simply won't apply (same as
 * calcMonthlySalary with defaultBase = 0).
 *
 * `options.assumeDueForMonth` (a "YYYY-MM" string, optional): by default
 * this function only counts a driver+month if at least one salaryEntries
 * row exists for it — a driver added mid-month with a salary but zero
 * entries yet contributes nothing at all for that month, anywhere,
 * including a month that hasn't been touched yet. Pass the CURRENT
 * calendar month here to also count every active, salaried driver's
 * default base for THAT specific month even with zero entries, so a
 * newly-added team member's cost shows up in the live financial summary
 * immediately instead of waiting for a first salary/bonus/deduction entry.
 * Never pass a past month here — a period you've already lived through
 * should reflect what was actually recorded, not an assumption. That's why
 * every other caller of this function (reports for a chosen period, the
 * previous-month side of the dashboard comparison, PDF exports) omits it
 * and keeps the exact old entries-only behavior.
 */
export const calcTotalSalariesPaid = (allEntries, drivers = [], options = {}) => {
  const { assumeDueForMonth = null } = options;
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  // Group entries by driver + month, same unit calcMonthlySalary works on.
  const groups = new Map();
  allEntries.forEach((e) => {
    if (e.type === SALARY_ENTRY_TYPES.CARRYOVER) return; // الترحيل مش مصروف
    const yearMonth = (e.date || "").slice(0, 7) || "_nodate";
    const key = `${e.driverId}|${yearMonth}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });

  // Make sure every active, salaried driver has at least an (empty) group
  // for `assumeDueForMonth` — calcMonthlySalary already falls back to the
  // driver's default base when a group has no BASE entry, so an empty
  // group is enough to make their salary count for that one month.
  // `d.status !== DRIVER_STATUS.INACTIVE` mirrors useDrivers.js's own
  // active/inactive rule exactly (missing/undefined status = active).
  if (assumeDueForMonth) {
    drivers.forEach((d) => {
      if (d.status === DRIVER_STATUS.INACTIVE) return;
      if (!(getSalaryForMonth(d, assumeDueForMonth) > 0)) return;
      const key = `${d.id}|${assumeDueForMonth}`;
      if (!groups.has(key)) groups.set(key, []);
    });
  }

  let total = 0;
  groups.forEach((entries, key) => {
    const [driverId, yearMonth] = key.split("|");
    const defaultBase = getSalaryForMonth(driverById.get(driverId), yearMonth);
    total += calcMonthlySalary(entries, defaultBase).expense;
  });
  return total;
};

/**
 * Attendance summary for a driver in a month.
 */
export const calcAttendanceSummary = (attendanceRecords, driverId, yearMonth) => {
  const records = attendanceRecords.filter(
    (r) => r.driverId === driverId && (r.date || "").startsWith(yearMonth)
  );
  const present  = records.filter((r) => r.status === "present").length;
  const absent   = records.filter((r) => r.status === "absent").length;
  const late     = records.filter((r) => r.status === "late").length;
  const half     = records.filter((r) => r.status === "half").length;
  return { present, absent, late, half, total: records.length };
};

// ─── مصروف الرواتب المستحق (قرار المالك: "المستحق الكامل") ────────────────
//
// كل عضو فريق له راتب بيتحسب له راتب كل شهر من أول شهر ليه في البرنامج
// لحد الشهر الحالي، + الحوافز − الجزاءات (الخصم = فلوس خرجت للعامل، مش بيقلل المصروف). قيد "راتب
// أساسي" متسجل في شهر بيحل محل الراتب الافتراضي للشهر ده (نفس
// calcMonthlySalary بالظبط، ونفس ملخص الشهر في صفحة العضو).
//
// العضو اللي بقى "غير نشط": الشهور اللي فاتت كلها بتفضل محسوبة، والشهور
// اللي بعد إيقافه بس هي اللي ما بتتحسبش (statusHistory). أي قيد متسجل
// فعلًا (حافز/خصم/أساسي) بيتحسب دايمًا، حتى لو في شهر كان فيه موقوف.

const YM_RE = /^\d{4}-\d{2}$/;

const ymOfTimestamp = (ts) => {
  if (!ts) return null;
  let d = null;
  if (typeof ts.toDate === "function") d = ts.toDate();
  else if (typeof ts.seconds === "number") d = new Date(ts.seconds * 1000);
  else if (typeof ts === "string" || typeof ts === "number") d = new Date(ts);
  if (!d || Number.isNaN(d.getTime())) return null;
  return monthPrefixOf(d);
};

export const nextMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** كل الشهور من `from` لـ`to` (شاملة الاتنين). حد أقصى 50 سنة كحماية. */
export const monthRange = (from, to) => {
  const out = [];
  if (!YM_RE.test(from || "") || !YM_RE.test(to || "") || from > to) return out;
  let cur = from;
  while (cur <= to && out.length < 600) { out.push(cur); cur = nextMonthOf(cur); }
  return out;
};

/**
 * سجل تغييرات الحالة: كل عنصر { from: "YYYY-MM", status }. الإيقاف بيبدأ
 * من الشهر اللي بعد الشهر الحالي (شهر الإيقاف نفسه لسه مستحق)، والتفعيل
 * من الشهر الحالي.
 */
export const buildStatusHistory = (driver, nextStatus, month = monthPrefixOf()) => {
  const history = Array.isArray(driver?.statusHistory) ? driver.statusHistory.map((h) => ({ ...h })) : [];
  const from = nextStatus === DRIVER_STATUS.INACTIVE ? nextMonthOf(month) : month;
  const filtered = history.filter((h) => h.from !== from);
  filtered.push({ from, status: nextStatus });
  return filtered.sort((a, b) => a.from.localeCompare(b.from));
};

/** هل العضو كان مستحق راتب في الشهر ده حسب حالته؟ */
export const isMemberDueInMonth = (driver, ym, lastEntryMonth = null) => {
  const history = Array.isArray(driver?.statusHistory)
    ? driver.statusHistory.filter((h) => YM_RE.test(h?.from || "")).sort((a, b) => a.from.localeCompare(b.from))
    : [];
  const applicable = history.filter((h) => h.from <= ym);
  if (applicable.length) return applicable[applicable.length - 1].status !== DRIVER_STATUS.INACTIVE;
  // قبل أول تغيير متسجل للحالة: لو أول تغيير كان "تفعيل"، يبقى كان موقوف قبله.
  const legacyInactive = history.length
    ? history[0].status !== DRIVER_STATUS.INACTIVE
    : driver?.status === DRIVER_STATUS.INACTIVE;
  if (!legacyInactive) return true;
  // عضو موقوف من قبل ما البرنامج يسجل تاريخ الإيقاف: بنعتبره كان شغال
  // لحد آخر شهر ليه فيه أي قيد راتب — ماضيه ما بيتشالش، ومفيش تخمين بعده.
  return !!lastEntryMonth && ym <= lastEntryMonth;
};

/** أول شهر للعضو في البرنامج: الأقدم من تاريخ إضافته، أول راتب حقيقي في سجله، وأول قيد راتب. */
export const getMemberStartMonth = (driver, firstEntryMonth = null) => {
  const candidates = [
    ymOfTimestamp(driver?.createdAt),
    ...(Array.isArray(driver?.salaryHistory)
      ? driver.salaryHistory.map((h) => h?.effectiveFrom).filter((m) => YM_RE.test(m || "") && m !== "0000-01")
      : []),
    firstEntryMonth,
  ].filter((m) => YM_RE.test(m || ""));
  return candidates.length ? candidates.sort()[0] : null;
};

/**
 * إجمالي مصروف الرواتب المستحق.
 * - فترة شهر محدد: fromMonth = toMonth = "YYYY-MM".
 * - كل الوقت: fromMonth = null، toMonth = الشهر الحالي (الاستحقاق بيقف
 *   عنده؛ أي قيد متسجل بيتحسب مهما كان تاريخه).
 */
export const calcSalaryExpense = (allEntries = [], drivers = [], { fromMonth = null, toMonth = monthPrefixOf() } = {}) => {
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const groups = new Map();
  const firstEntry = new Map();
  const lastEntry = new Map();

  allEntries.forEach((e) => {
    if (e.type === SALARY_ENTRY_TYPES.CARRYOVER) return; // الترحيل مش مصروف
    const ym = (e.date || "").slice(0, 7);
    if (YM_RE.test(ym)) {
      if (!firstEntry.has(e.driverId) || ym < firstEntry.get(e.driverId)) firstEntry.set(e.driverId, ym);
      if (!lastEntry.has(e.driverId) || ym > lastEntry.get(e.driverId)) lastEntry.set(e.driverId, ym);
    }
    if (fromMonth && (!YM_RE.test(ym) || ym < fromMonth || ym > toMonth)) return;
    const key = `${e.driverId}|${ym || "_nodate"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });

  drivers.forEach((d) => {
    const start = getMemberStartMonth(d, firstEntry.get(d.id) || null);
    if (!start) return;
    const from = fromMonth && fromMonth > start ? fromMonth : start;
    monthRange(from, toMonth).forEach((ym) => {
      if (!(getSalaryForMonth(d, ym) > 0)) return;
      if (!isMemberDueInMonth(d, ym, lastEntry.get(d.id) || null)) return;
      const key = `${d.id}|${ym}`;
      if (!groups.has(key)) groups.set(key, []);
    });
  });

  let total = 0;
  groups.forEach((entries, key) => {
    const [driverId, yearMonth] = key.split("|");
    const driver = driverById.get(driverId);
    // شهر كان فيه العضو موقوف: القيود المتسجلة بتتحسب زي ما هي، بس من غير
    // ما نفترض راتب أساسي افتراضي للشهر ده.
    const due = !YM_RE.test(yearMonth) || !driver || isMemberDueInMonth(driver, yearMonth, lastEntry.get(driverId) || null);
    total += calcMonthlySalary(entries, due ? getSalaryForMonth(driver, yearMonth) : 0).expense;
  });
  return total;
};
