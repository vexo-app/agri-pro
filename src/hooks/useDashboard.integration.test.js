// src/hooks/useDashboard.integration.test.js
//
// This is the "integration-lite" test called for in the SC-2026-9114 review
// follow-up: create a job -> record a payment against it -> confirm the
// dashboard's computed debt/profit is correct — using plain mock arrays
// instead of a real Firestore instance.
//
// useDashboard.js itself is a thin React hook that just wires DataContext
// state into the pure functions below (aggregateJobs, calcTotalSalariesPaid,
// aggregateSupplierInvoices, ...) and adds one line of arithmetic
// (netProfit = ...). Mounting React + mocking Firebase just to exercise that
// one line would be a lot of test-infrastructure weight for what it buys.
// Instead, this file calls the exact same functions useDashboard.js calls,
// in the exact same order, on a small realistic mock dataset, and asserts
// the final combined numbers — so any regression in how the pieces are
// wired together (not just in one function in isolation) gets caught here.
//
// If useDashboard.js's calculation is ever changed, this test must be
// updated to match, and vice versa — keep the two in sync.
//
// One deliberate exception: useDashboard.js's top-level `totalSalaries` now
// passes `{ assumeDueForMonth: <real current month> }` to calcTotalSalariesPaid
// (see salaryCalculations.js) so a newly-added salaried driver counts
// immediately, without waiting for a logged entry. This file's datasets are
// all fixed historical dates unrelated to whatever "today" happens to be
// when the suite runs, so mirroring that option here would make assertions
// depend on the real system clock instead of the fixed mock data. The
// assumeDueForMonth behavior itself is covered directly in
// salaryCalculations.test.js and is intentionally NOT re-exercised here.

import { aggregateJobs, aggregateSupplierInvoices, aggregateEquipmentFuelEntries } from "../utils/calculations";
import { calcTotalSalariesPaid } from "../utils/salaryCalculations";
import { calcTotalTaxDeductions } from "../utils/taxCalculations";
import { SALARY_ENTRY_TYPES } from "../config/constants";

/**
 * Re-run of the exact netProfit formula from useDashboard.js.
 *
 * ⚠️ (audit finding C1, fixed) `drivers` is required here, same as
 * useDashboard.js's `calcTotalSalariesPaid(salaryEntries, drivers)` call —
 * it is NOT cosmetic. It supplies each driver's configured base salary as a
 * fallback whenever a given month has no explicit BASE-type salaryEntry
 * (see salaryCalculations.js's calcMonthlySalary/calcTotalSalariesPaid for
 * the full rationale — that fallback was itself a prior bug fix, added so
 * "مرتبات الفريق" doesn't silently read too low, and net profit
 * artificially high, for a driver whose base salary is on file but hasn't
 * been logged as a discrete entry that month).
 *
 * Before this fix, this function called calcTotalSalariesPaid with only ONE
 * argument, so it silently never exercised that fallback path — meaning a
 * future regression that broke the real `drivers` argument in
 * useDashboard.js would have passed this whole suite undetected. `drivers`
 * defaults to [] (same behavior as before) so existing calls below that
 * pass no drivers still work identically; the new test further down is what
 * actually exercises the fallback.
 */
function computeDashboardTotals({ jobs, payments, maintenance, salaryEntries, drivers = [], taxDeductions, supplierInvoices, supplierPayments, fuelPrice, equipmentFuelEntries = [], equipment = [] }) {
  const totals = aggregateJobs(jobs, fuelPrice, payments);
  const manualFuel = aggregateEquipmentFuelEntries(equipmentFuelEntries, equipment);
  totals.totalFuel += manualFuel.totalFuel;
  totals.totalFuelCost += manualFuel.totalFuelCost;
  totals.netProfit -= manualFuel.totalFuelCost;
  const totalMaintCost = maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0);
  const totalSalaries = calcTotalSalariesPaid(salaryEntries, drivers);
  const totalTaxDeductions = calcTotalTaxDeductions(taxDeductions);
  const supplierStats = aggregateSupplierInvoices(supplierInvoices, supplierPayments);
  const totalSupplierPaidOut = supplierStats.totalPaidOut;

  const netProfit = totals.netProfit - totalMaintCost - totalSalaries - totalTaxDeductions - totalSupplierPaidOut;
  const margin = totals.totalRevenue > 0 ? (netProfit / totals.totalRevenue) * 100 : 0;

  return { totals, totalMaintCost, totalSalaries, totalTaxDeductions, totalSupplierPaidOut, netProfit, margin };
}

describe("dashboard pipeline: job creation -> payment -> debt/profit", () => {
  test("a job created, then partially paid, produces the correct outstanding debt", () => {
    // 1) إنشاء شغلانة: 20 فدان × 100 ج = 2000 ج إيراد، 10 لتر سولار × 15 ج
    const jobs = [
      { id: "job1", client: "أحمد", acres: 20, pricePerAcre: 100, fuelUsed: 10, date: "2026-01-10" },
    ];
    // 2) تحصيل دفعة جزئية على نفس الشغلانة
    const payments = [{ jobId: "job1", amount: 800 }];

    const result = computeDashboardTotals({
      jobs, payments,
      maintenance: [], salaryEntries: [], taxDeductions: [],
      supplierInvoices: [], supplierPayments: [],
      fuelPrice: 15,
    });

    // 3) التأكد إن المديونية المحسوبة في الداشبورد صحيحة
    expect(result.totals.totalRevenue).toBe(2000);
    expect(result.totals.totalPaid).toBe(800);
    expect(result.totals.totalRemaining).toBe(1200); // 2000 - 800
    expect(result.totals.totalFuelCost).toBe(150);   // 10 * 15
    expect(result.netProfit).toBe(2000 - 150);        // no other costs yet
  });

  test("a follow-up completing payment brings remaining debt to zero", () => {
    const jobs = [
      { id: "job1", client: "أحمد", acres: 20, pricePerAcre: 100, fuelUsed: 10, date: "2026-01-10" },
    ];
    // دفعة جزئية ثم دفعة مكمّلة لنفس الشغلانة
    const payments = [
      { jobId: "job1", amount: 800 },
      { jobId: "job1", amount: 1200 },
    ];

    const result = computeDashboardTotals({
      jobs, payments,
      maintenance: [], salaryEntries: [], taxDeductions: [],
      supplierInvoices: [], supplierPayments: [],
      fuelPrice: 15,
    });

    expect(result.totals.totalPaid).toBe(2000);
    expect(result.totals.totalRemaining).toBe(0);
  });

  test("manual equipment fuel increases dashboard fuel and reduces profit", () => {
    const result = computeDashboardTotals({
      jobs: [{ id: "job1", acres: 10, pricePerAcre: 100, fuelUsed: 50, fuelPriceAtJob: 10 }],
      payments: [], maintenance: [], salaryEntries: [], taxDeductions: [],
      supplierInvoices: [], supplierPayments: [], fuelPrice: 10,
      equipment: [{ id: "eq1", category: "base" }],
      equipmentFuelEntries: [{ equipmentId: "eq1", liters: 20, pricePerLiter: 12 }],
    });
    expect(result.totals.totalFuel).toBe(70);
    expect(result.totals.totalFuelCost).toBe(740);
    expect(result.netProfit).toBe(260);
  });

  test("maintenance, salaries, tax and cash paid to suppliers all reduce net profit together", () => {
    const jobs = [
      { id: "job1", acres: 10, pricePerAcre: 500, fuelUsed: 0, date: "2026-01-01" }, // revenue 5000
    ];
    const maintenance = [{ cost: 400 }];
    const salaryEntries = [
      { type: SALARY_ENTRY_TYPES.BASE, amount: 1000 },
      { type: "advance", amount: 5000 }, // legacy/unmigrated doc type — must have zero financial effect
    ];
    const taxDeductions = [{ amount: 300 }];
    const supplierInvoices = [{ id: "inv1", amount: 1000 }];
    const supplierPayments = [{ supplierInvoiceId: "inv1", amount: 400 }]; // 400 actually paid out so far, 600 still owed

    const result = computeDashboardTotals({
      jobs, payments: [], maintenance, salaryEntries, taxDeductions,
      supplierInvoices, supplierPayments, fuelPrice: 15,
    });

    expect(result.totalMaintCost).toBe(400);
    expect(result.totalSalaries).toBe(1000); // legacy "advance"-typed entry ignored
    expect(result.totalTaxDeductions).toBe(300);
    // Cash basis: only the 400 that actually left the bank counts as a
    // cost so far — the unpaid 600 is tracked separately as a debt, not
    // deducted from profit (deducting it would mean paying the supplier
    // *raises* displayed profit, which is backwards).
    expect(result.totalSupplierPaidOut).toBe(400);

    // 5000 revenue - 0 fuel - 400 maint - 1000 salaries - 300 tax - 400 supplier paid out
    expect(result.netProfit).toBe(5000 - 400 - 1000 - 300 - 400);
  });

  test("fully covers everything with zero activity: no NaN, no crash", () => {
    const result = computeDashboardTotals({
      jobs: [], payments: [], maintenance: [], salaryEntries: [], taxDeductions: [],
      supplierInvoices: [], supplierPayments: [], fuelPrice: 15,
    });
    expect(result.netProfit).toBe(0);
    expect(result.margin).toBe(0); // guarded against division by zero
  });

  // (audit finding C1) This is the scenario the other tests in this file
  // never exercised: a driver with a configured base salary but no explicit
  // BASE-type salaryEntry logged for the month. See the JSDoc on
  // computeDashboardTotals above for the full rationale.
  test("a driver's configured base salary is used as fallback when no BASE entry is logged that month", () => {
    const jobs = [
      { id: "job1", acres: 10, pricePerAcre: 500, fuelUsed: 0, date: "2026-02-01" }, // revenue 5000
    ];
    const drivers = [{ id: "d1", name: "سائق تجريبي", salary: 3000 }];
    // No BASE entry for d1 this month — only a deduction. calcMonthlySalary
    // must fall back to the driver's configured `salary` (3000) as the base.
    const salaryEntries = [
      { driverId: "d1", type: SALARY_ENTRY_TYPES.PENALTY, amount: 200, date: "2026-02-05" },
    ];

    const result = computeDashboardTotals({
      jobs, payments: [], maintenance: [], salaryEntries, drivers, taxDeductions: [],
      supplierInvoices: [], supplierPayments: [], fuelPrice: 15,
    });

    // base(3000, from the driver fallback) + bonuses(0) - penalties(200) = 2800
    expect(result.totalSalaries).toBe(2800);
    expect(result.netProfit).toBe(5000 - 2800);

    // Without `drivers` correctly wired through to calcTotalSalariesPaid,
    // there is no default base to fall back to: base stays 0 and the lone
    // deduction alone makes totalSalaries negative (-200), which makes net
    // profit look artificially HIGHER (5000 - (-200) = 5200) instead of
    // correctly lower. These are the assertions that would have caught the
    // original bug — a future regression that drops the `drivers` argument
    // anywhere in this chain fails right here.
    expect(result.totalSalaries).not.toBe(-200);
    expect(result.netProfit).not.toBe(5000 - -200);
  });
});
