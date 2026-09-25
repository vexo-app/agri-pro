// الخصم المرحّل + الجزاء — قرار المالك (2026-09-25)
import { calcMonthlySalary, calcMemberMonthSummary, calcSalaryExpense } from "./salaryCalculations";

const d = { id: "d1", salary: 10000 };
const ded = (amount, date) => ({ driverId: "d1", type: "deduction", amount, date });

describe("calcMonthlySalary — penalty / carry", () => {
  test("خصم يقلل الصافي بس، جزاء يقلل الصافي والمصروف", () => {
    const r = calcMonthlySalary([
      { type: "deduction", amount: 2000 }, { type: "penalty", amount: 500 }, { type: "bonus", amount: 300 },
    ], 10000);
    expect(r.net).toBe(10000 + 300 - 2000 - 500);
    expect(r.expense).toBe(10000 + 300 - 500);
  });
  test("carryIn يقلل الصافي بس، وقيد carryover بيحل محله", () => {
    expect(calcMonthlySalary([], 10000, 1600)).toMatchObject({ net: 8400, expense: 10000, carriedDeduction: 1600, carryEdited: false });
    expect(calcMonthlySalary([{ type: "carryover", amount: 1000 }], 10000, 1600))
      .toMatchObject({ net: 9000, carriedDeduction: 1000, carryAuto: 1600, carryEdited: true });
    expect(calcMonthlySalary([{ type: "carryover", amount: 0 }], 10000, 1600).net).toBe(10000);
  });
});

describe("calcMemberMonthSummary — الترحيل", () => {
  test("سالب أغسطس (قبل بداية الترحيل) ما بيترحّلش", () => {
    const entries = [ded(12260, "2026-08-10")];
    expect(calcMemberMonthSummary(entries, d, "2026-08").net).toBe(-2260);
    expect(calcMemberMonthSummary(entries, d, "2026-09")).toMatchObject({ carriedDeduction: 0, net: 10000 });
  });
  test("سالب سبتمبر بيتخصم من أكتوبر", () => {
    const entries = [ded(11600, "2026-09-10")];
    expect(calcMemberMonthSummary(entries, d, "2026-09").net).toBe(-1600);
    expect(calcMemberMonthSummary(entries, d, "2026-10")).toMatchObject({ carriedDeduction: 1600, net: 8400 });
  });
  test("السالب بيفضل يترحّل لو الشهر الجديد كمان بالسالب", () => {
    const entries = [ded(15000, "2026-09-10"), ded(9000, "2026-10-10")];
    // سبتمبر −5000 → أكتوبر 10000 − 9000 − 5000 = −4000 → نوفمبر 10000 − 4000
    expect(calcMemberMonthSummary(entries, d, "2026-10").net).toBe(-4000);
    expect(calcMemberMonthSummary(entries, d, "2026-11")).toMatchObject({ carriedDeduction: 4000, net: 6000 });
  });
  test("التعديل اليدوي بيأثر على اللي بعده", () => {
    const entries = [ded(15000, "2026-09-10"), { driverId: "d1", type: "carryover", amount: 12000, date: "2026-10-01" }];
    expect(calcMemberMonthSummary(entries, d, "2026-10").net).toBe(-2000);
    expect(calcMemberMonthSummary(entries, d, "2026-11").carriedDeduction).toBe(2000);
  });
  test("قيود عامل تاني ما بتأثرش", () => {
    const entries = [{ driverId: "x", type: "deduction", amount: 50000, date: "2026-09-10" }];
    expect(calcMemberMonthSummary(entries, d, "2026-10").carriedDeduction).toBe(0);
  });
  test("الترحيل ما بيغيرش مصروف المرتبات", () => {
    const dd = { ...d, createdAt: "2026-09-01T00:00:00" };
    const entries = [ded(11600, "2026-09-10")];
    expect(calcSalaryExpense(entries, [dd], { fromMonth: "2026-10", toMonth: "2026-10" })).toBe(10000);
    expect(calcSalaryExpense(entries, [dd], { fromMonth: "2026-09", toMonth: "2026-09" })).toBe(10000);
  });
});
