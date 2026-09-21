// src/utils/salaryCalculations.test.js
import {
  calcMonthlySalary,
  getMonthEntries,
  calcTotalSalariesPaid,
  calcDailyRate,
  calcAttendanceSummary,
  getSalaryForMonth,
  buildSalaryHistory,
} from "./salaryCalculations";
import { SALARY_ENTRY_TYPES, MAX_MONEY_VALUE, DRIVER_STATUS } from "../config/constants";

// ─── calcMonthlySalary ────────────────────────────────────────────────────────

describe("calcMonthlySalary", () => {
  test("sums base, bonus and deduction entries", () => {
    const entries = [
      { type: SALARY_ENTRY_TYPES.BASE, amount: 3000 },
      { type: SALARY_ENTRY_TYPES.BONUS, amount: 500 },
      { type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 200 },
    ];
    const result = calcMonthlySalary(entries, 3000);

    expect(result.base).toBe(3000);
    expect(result.bonuses).toBe(500);
    expect(result.deductions).toBe(200);
    expect(result.gross).toBe(3500);       // base + bonuses
    expect(result.net).toBe(3300);         // gross - deductions
    // The removed "advance" concept must leave no trace on the result shape.
    expect(result.advances).toBeUndefined();
    expect(result.advanceRepayments).toBeUndefined();
  });

  test("falls back to the driver's default base salary when no BASE entry exists this month", () => {
    const entries = [{ type: SALARY_ENTRY_TYPES.BONUS, amount: 200 }];
    const result = calcMonthlySalary(entries, 2500);
    expect(result.base).toBe(2500);
    expect(result.gross).toBe(2700);
  });

  test("does NOT apply the default base when a BASE entry of 0 was explicitly recorded", () => {
    // An explicit base entry means the month has been settled — even if 0,
    // it must not be silently replaced by the driver's default.
    const entries = [{ type: SALARY_ENTRY_TYPES.BASE, amount: 0 }];
    const result = calcMonthlySalary(entries, 2500);
    expect(result.base).toBe(0);
  });

  test("defaultBase defaults to 0 when omitted and no BASE entry exists", () => {
    const result = calcMonthlySalary([]);
    expect(result.base).toBe(0);
    expect(result.net).toBe(0);
  });

  test("unrecognised entry types are ignored rather than throwing (covers legacy advance/advance_repay docs)", () => {
    const entries = [
      { type: "unknown_type", amount: 999 },
      { type: "advance", amount: 1000 },        // legacy, unmigrated doc
      { type: "advance_repay", amount: 300 },   // legacy, unmigrated doc
    ];
    const result = calcMonthlySalary(entries, 1000);
    // base falls back to default since no BASE entry was found; none of the
    // unrecognised entries contribute to anything.
    expect(result.base).toBe(1000);
    expect(result.gross).toBe(1000);
    expect(result.net).toBe(1000);
  });
});

describe("salary history", () => {
  test("keeps old months on the old salary after the current salary changes", () => {
    const driver = {
      salary: 4000,
      salaryHistory: [
        { effectiveFrom: "0000-01", salary: 3000 },
        { effectiveFrom: "2026-09", salary: 4000 },
      ],
    };

    expect(getSalaryForMonth(driver, "2026-08")).toBe(3000);
    expect(getSalaryForMonth(driver, "2026-09")).toBe(4000);
  });

  test("a new driver has no salary before their first effective month", () => {
    const driver = {
      salary: 3000,
      salaryHistory: [{ effectiveFrom: "2026-09", salary: 3000 }],
    };
    expect(getSalaryForMonth(driver, "2026-08")).toBe(0);
  });

  test("first salary change gives an existing driver a past-rate baseline", () => {
    const history = buildSalaryHistory({ salary: 3000 }, 4000, "2026-09");
    expect(history).toEqual([
      { effectiveFrom: "0000-01", salary: 3000 },
      { effectiveFrom: "2026-09", salary: 4000 },
    ]);
  });

  test("another edit in the same month replaces that month's rate", () => {
    const driver = {
      salary: 4000,
      salaryHistory: [
        { effectiveFrom: "0000-01", salary: 3000 },
        { effectiveFrom: "2026-09", salary: 4000 },
      ],
    };
    expect(buildSalaryHistory(driver, 4500, "2026-09")).toEqual([
      { effectiveFrom: "0000-01", salary: 3000 },
      { effectiveFrom: "2026-09", salary: 4500 },
    ]);
  });
});

// ─── Boundary values ────────────────────────────────────────────────────────

describe("calcMonthlySalary — boundary values", () => {
  test("handles a MAX_MONEY_VALUE-scale bonus without losing precision", () => {
    const entries = [
      { type: SALARY_ENTRY_TYPES.BASE, amount: 0 },
      { type: SALARY_ENTRY_TYPES.BONUS, amount: MAX_MONEY_VALUE },
    ];
    const result = calcMonthlySalary(entries);
    expect(result.gross).toBe(MAX_MONEY_VALUE);
  });

  test("net salary can go negative when deductions exceed gross pay", () => {
    const entries = [
      { type: SALARY_ENTRY_TYPES.BASE, amount: 500 },
      { type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 800 },
    ];
    const result = calcMonthlySalary(entries);
    expect(result.net).toBe(-300);
  });
});

// ─── getMonthEntries ──────────────────────────────────────────────────────────

describe("getMonthEntries", () => {
  const entries = [
    { driverId: "d1", date: "2026-01-05" },
    { driverId: "d1", date: "2026-02-01" },
    { driverId: "d2", date: "2026-01-10" },
  ];

  test("filters by both driver and year-month prefix", () => {
    const result = getMonthEntries(entries, "d1", "2026-01");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-01-05");
  });

  test("returns an empty array when no entries match", () => {
    expect(getMonthEntries(entries, "d3", "2026-01")).toEqual([]);
  });
});

// ─── calcTotalSalariesPaid ────────────────────────────────────────────────────

describe("calcTotalSalariesPaid", () => {
  test("nets BASE/BONUS against DEDUCTION", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.BASE, amount: 3000 },
      { driverId: "d2", type: SALARY_ENTRY_TYPES.BONUS, amount: 500 },
      { driverId: "d1", type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 200 },
    ];
    // 3000 + 500 - 200 = 3300
    expect(calcTotalSalariesPaid(entries)).toBe(3300);
  });

  test("ignores legacy advance/advance_repay-typed entries entirely (no financial effect)", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.BASE, amount: 3000 },
      { driverId: "d1", type: "advance", amount: 1000 },
      { driverId: "d1", type: "advance_repay", amount: 300 },
    ];
    expect(calcTotalSalariesPaid(entries)).toBe(3000);
  });

  test("applies each driver's default base salary when no BASE entry was logged that month (bug regression)", () => {
    // d1's base salary is never logged as an explicit entry (relies on the
    // driver's default salary), but a deduction was logged for them this
    // month. Without grouping + default-base fallback, this used to sum to
    // -300 for d1 alone, flipping the sign and inflating "net profit".
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 300, date: "2026-06-05" },
    ];
    const drivers = [{ id: "d1", salary: 3000 }];
    // 3000 (default base) - 300 (deduction) = 2700, never negative.
    expect(calcTotalSalariesPaid(entries, drivers)).toBe(2700);
  });

  test("without a drivers list, falls back to raw entries (defaultBase 0) — same as before", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 300, date: "2026-06-05" },
    ];
    expect(calcTotalSalariesPaid(entries)).toBe(-300);
  });

  test("keeps different drivers/months in separate buckets", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.BASE, amount: 3000, date: "2026-05-01" },
      { driverId: "d1", type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 300, date: "2026-06-05" }, // different month, no BASE
    ];
    const drivers = [{ id: "d1", salary: 3000 }];
    // May: 3000 (explicit BASE). June: 3000 (default) - 300 = 2700.
    expect(calcTotalSalariesPaid(entries, drivers)).toBe(3000 + 2700);
  });

  test("uses the salary rate for each entry month instead of the driver's current salary", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.DEDUCTION, amount: 100, date: "2026-08-05" },
    ];
    const drivers = [{
      id: "d1",
      salary: 4000,
      salaryHistory: [
        { effectiveFrom: "0000-01", salary: 3000 },
        { effectiveFrom: "2026-09", salary: 4000 },
      ],
    }];
    expect(calcTotalSalariesPaid(entries, drivers)).toBe(2900);
  });

  // ── options.assumeDueForMonth ────────────────────────────────────────────
  // New behavior: a driver added with a salary but zero logged entries yet
  // should still count for the CURRENT month when the caller opts in, so
  // the live financial summary reflects them immediately.

  test("assumeDueForMonth: an active salaried driver with zero entries counts their default base for that month", () => {
    const drivers = [{ id: "d1", salary: 3000, status: DRIVER_STATUS.ACTIVE }];
    expect(calcTotalSalariesPaid([], drivers, { assumeDueForMonth: "2026-09" })).toBe(3000);
  });

  test("assumeDueForMonth: without the option, the same zero-entry driver contributes nothing (old behavior preserved)", () => {
    const drivers = [{ id: "d1", salary: 3000, status: DRIVER_STATUS.ACTIVE }];
    expect(calcTotalSalariesPaid([], drivers)).toBe(0);
  });

  test("assumeDueForMonth: inactive drivers are excluded even with a salary set", () => {
    const drivers = [{ id: "d1", salary: 3000, status: DRIVER_STATUS.INACTIVE }];
    expect(calcTotalSalariesPaid([], drivers, { assumeDueForMonth: "2026-09" })).toBe(0);
  });

  test("assumeDueForMonth: drivers with no salary (0/unset) are excluded", () => {
    const drivers = [
      { id: "d1", salary: 0, status: DRIVER_STATUS.ACTIVE },
      { id: "d2", status: DRIVER_STATUS.ACTIVE }, // salary unset
    ];
    expect(calcTotalSalariesPaid([], drivers, { assumeDueForMonth: "2026-09" })).toBe(0);
  });

  test("assumeDueForMonth: does not double-count a driver who already has real entries that month", () => {
    const entries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.BASE, amount: 3500, date: "2026-09-01" },
    ];
    const drivers = [{ id: "d1", salary: 3000, status: DRIVER_STATUS.ACTIVE }];
    // Real BASE entry (3500) wins — the assumption never overrides recorded data.
    expect(calcTotalSalariesPaid(entries, drivers, { assumeDueForMonth: "2026-09" })).toBe(3500);
  });

  test("assumeDueForMonth: never assumed for a month other than the one passed in", () => {
    const drivers = [{ id: "d1", salary: 3000, status: DRIVER_STATUS.ACTIVE }];
    // Driver has zero entries in ANY month; only "2026-09" should be assumed.
    const total = calcTotalSalariesPaid([], drivers, { assumeDueForMonth: "2026-09" });
    expect(total).toBe(3000); // one assumed month only, not one per calendar month
  });
});

// ─── calcDailyRate ────────────────────────────────────────────────────────────

describe("calcDailyRate", () => {
  test("divides monthly salary by working days (default 26)", () => {
    expect(calcDailyRate(2600)).toBe(100);
  });

  test("respects a custom working-days count", () => {
    expect(calcDailyRate(3000, 30)).toBe(100);
  });
});

// ─── calcAttendanceSummary ────────────────────────────────────────────────────

describe("calcAttendanceSummary", () => {
  const records = [
    { driverId: "d1", date: "2026-01-01", status: "present" },
    { driverId: "d1", date: "2026-01-02", status: "absent" },
    { driverId: "d1", date: "2026-01-03", status: "late" },
    { driverId: "d1", date: "2026-01-04", status: "half" },
    { driverId: "d1", date: "2026-02-01", status: "present" }, // different month
    { driverId: "d2", date: "2026-01-01", status: "present" }, // different driver
  ];

  test("counts each status for the given driver and month only", () => {
    const summary = calcAttendanceSummary(records, "d1", "2026-01");
    expect(summary).toEqual({ present: 1, absent: 1, late: 1, half: 1, total: 4 });
  });

  test("returns all zeros when nothing matches", () => {
    const summary = calcAttendanceSummary(records, "d1", "2026-03");
    expect(summary).toEqual({ present: 0, absent: 0, late: 0, half: 0, total: 0 });
  });
});
