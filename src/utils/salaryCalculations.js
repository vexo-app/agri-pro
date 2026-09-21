// src/utils/salaryCalculations.js
import { SALARY_ENTRY_TYPES, DRIVER_STATUS } from "../config/constants";

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
 */
export const calcMonthlySalary = (entries, defaultBase = 0) => {
  let base      = 0;
  let bonuses   = 0;
  let deductions = 0;
  let hasBaseEntry = false;

  entries.forEach((e) => {
    const amount = Number(e.amount) || 0;
    switch (e.type) {
      case SALARY_ENTRY_TYPES.BASE:          base += amount; hasBaseEntry = true; break;
      case SALARY_ENTRY_TYPES.BONUS:         bonuses          += amount; break;
      case SALARY_ENTRY_TYPES.DEDUCTION:     deductions       += amount; break;
      default: break; // e.g. legacy "advance"/"advance_repay" entries — ignored, not deleted
    }
  });

  // إذا لم يُسجَّل قيد "راتب أساسي" لهذا الشهر بعد، استخدم الراتب الأساسي
  // المُحدَّد في بيانات السائق نفسه، عشان القيمة تتطابق دايمًا مع كارت
  // "الراتب الأساسي" فوق وميظهرش صفر.
  if (!hasBaseEntry) base = Number(defaultBase) || 0;

  const gross = base + bonuses;
  const net   = gross - deductions;

  return { base, bonuses, deductions, gross, net };
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
 * Net cost = base + bonus - deductions, computed the SAME way as
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
    total += calcMonthlySalary(entries, defaultBase).net;
  });
  return total;
};

/**
 * Absence deduction per day based on base salary and working days.
 */
export const calcDailyRate = (monthlySalary, workingDaysPerMonth = 26) =>
  monthlySalary / workingDaysPerMonth;

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
