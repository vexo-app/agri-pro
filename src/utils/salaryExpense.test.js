// قرار المالك (المستحق الكامل): كل عضو ليه راتب — كل شهر من أول شهر ليه
// لحد الشهر الحالي، + حوافز − خصومات، سواء اتصرف أو لأ. الإيقاف ما يشيلش
// الماضي، يوقف الجاي بس.
import {
  calcSalaryExpense, buildStatusHistory, isMemberDueInMonth, getMemberStartMonth, monthRange,
} from "./salaryCalculations";

const ts = (y, m) => ({ seconds: Date.UTC(y, m - 1, 15) / 1000 });

describe("calcSalaryExpense — full accrual", () => {
  test("the owner's example: Jul none, Aug bonus only, Sep none → 3 full months + bonus", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 7) };
    const entries = [{ driverId: "d1", type: "bonus", amount: 200, date: "2026-08-10" }];
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-09" })).toBe(9200);
  });

  test("month with no entries still counts (was 0 before)", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 6) };
    expect(calcSalaryExpense([], [d], { fromMonth: "2026-07", toMonth: "2026-07" })).toBe(3000);
  });

  test("a recorded BASE entry replaces the default salary for that month", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 8) };
    const entries = [{ driverId: "d1", type: "base", amount: 2500, date: "2026-08-28" }];
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-08" })).toBe(2500);
  });

  test("deductions reduce the month", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 8) };
    const entries = [{ driverId: "d1", type: "deduction", amount: 400, date: "2026-08-05" }];
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-08" })).toBe(2600);
  });

  test("nothing before the member was added", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 9) };
    expect(calcSalaryExpense([], [d], { fromMonth: "2026-08", toMonth: "2026-08" })).toBe(0);
    expect(calcSalaryExpense([], [d], { toMonth: "2026-09" })).toBe(3000);
  });

  test("salary history: each month uses the rate that was in force", () => {
    const d = { id: "d1", salary: 4000, createdAt: ts(2026, 7),
      salaryHistory: [{ effectiveFrom: "0000-01", salary: 3000 }, { effectiveFrom: "2026-09", salary: 4000 }] };
    expect(calcSalaryExpense([], [d], { toMonth: "2026-09" })).toBe(3000 + 3000 + 4000);
  });

  test("member with no salary accrues nothing (entries still count)", () => {
    const d = { id: "d1", salary: 0, createdAt: ts(2026, 7) };
    const entries = [{ driverId: "d1", type: "bonus", amount: 150, date: "2026-08-01" }];
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-09" })).toBe(150);
  });
});

describe("inactive members keep their past", () => {
  test("deactivated in Aug: Jul + Aug counted, Sep onward not", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 7), status: "inactive",
      statusHistory: buildStatusHistory({}, "inactive", "2026-08") };
    expect(d.statusHistory).toEqual([{ from: "2026-09", status: "inactive" }]);
    expect(calcSalaryExpense([], [d], { toMonth: "2026-10" })).toBe(6000);
  });

  test("re-activated later: the gap months are not counted", () => {
    let d = { id: "d1", salary: 3000, createdAt: ts(2026, 5) };
    d = { ...d, status: "inactive", statusHistory: buildStatusHistory(d, "inactive", "2026-06") };
    d = { ...d, status: "active", statusHistory: buildStatusHistory(d, "active", "2026-09") };
    // May, Jun counted · Jul, Aug off · Sep, Oct counted
    expect(calcSalaryExpense([], [d], { toMonth: "2026-10" })).toBe(4 * 3000);
  });

  test("legacy inactive (no recorded date): counted up to its last salary entry, never erased", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 5), status: "inactive" };
    const entries = [{ driverId: "d1", type: "base", amount: 3000, date: "2026-07-01" }];
    // May, Jun (default) + Jul (entry) — nothing after the last entry
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-10" })).toBe(9000);
  });

  test("legacy inactive with no entries accrues nothing (no guessing)", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 5), status: "inactive" };
    expect(calcSalaryExpense([], [d], { toMonth: "2026-10" })).toBe(0);
  });

  test("recorded entries always count, even in a month the member was inactive", () => {
    const d = { id: "d1", salary: 3000, createdAt: ts(2026, 7), status: "inactive",
      statusHistory: [{ from: "2026-08", status: "inactive" }] };
    const entries = [{ driverId: "d1", type: "bonus", amount: 500, date: "2026-09-02" }];
    // Jul 3000 + the recorded Sep bonus 500 (no assumed base while inactive)
    expect(calcSalaryExpense(entries, [d], { toMonth: "2026-10" })).toBe(3500);
  });
});

describe("helpers", () => {
  test("monthRange / start month / due check", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(getMemberStartMonth({ createdAt: ts(2026, 8) }, "2026-06")).toBe("2026-06");
    expect(isMemberDueInMonth({ status: "active" }, "2026-01")).toBe(true);
  });
});
