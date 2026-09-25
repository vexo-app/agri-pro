// Step 5 — full financial + cross-module regression on one realistic dataset.
// Every number must be identical wherever it is shown (Dashboard, Reports,
// PDF, Customer page, Jobs page), and each formula is checked by hand.
import {
  calcRevenue, calcRemainingAmount, derivePaymentStatus, getJobPaidAmount, aggregateJobs,
  aggregateSupplierInvoices, buildClientList, buildClientSummary, buildSupplierList,
  buildEquipmentReport, buildDriverReport, enrichJob, calcNetProfit, calcOverpaidAmount,
  aggregateJobOverpayments, aggregateSupplierOverpayments, roundMoney,
} from "./calculations";
import { buildPeriodFinancials, calcTotalMaintenanceCost } from "./financialSummary";
import { calcSalaryExpense, monthRange } from "./salaryCalculations";
import { calcTotalTaxDeductions } from "./taxCalculations";
import { buildMonthlySummaryHtmlForTest } from "./pdf/monthlySummary";
import { formatProfit, formatCurrency } from "./formatters";
import { reducer, initialState } from "../contexts/data/reducer";

const ts = (y, m) => ({ seconds: Date.UTC(y, m - 1, 3) / 1000 });
const equipment = [{ id: "e1", name: "ماسي" }, { id: "e2", name: "نيو هولاند", category: "tractor" }];
const drivers = [
  { id: "d1", name: "محمود", salary: 3000, createdAt: ts(2026, 7), role: "driver" },
  { id: "d2", name: "سعيد", salary: 2000, createdAt: ts(2026, 7), status: "inactive",
    statusHistory: [{ from: "2026-09", status: "inactive" }], role: "driver" },
];
const jobs = [
  { id: "j1", client: "سالم", equipmentId: "e1", driverId: "d1", acres: 12, pricePerAcre: 250, fuelUsed: 60, fuelPriceAtJob: 15, date: "2026-07-10" },
  { id: "j2", client: "النيل ", equipmentId: "e2", driverId: "d2", acres: 1.1, pricePerAcre: 100, fuelUsed: 4, fuelPriceAtJob: 15, date: "2026-08-02" },
  { id: "j3", client: "الفار", equipmentId: "e1", driverId: "d1", acres: 6, pricePerAcre: 180, fuelUsed: 20, fuelPriceAtJob: 16.5, date: "2026-08-20" },
  { id: "j4", client: "النيل", equipmentId: "e2", driverId: "d1", acres: 15, pricePerAcre: 240, fuelUsed: 70, date: "2026-09-05", amountPaid: 500 },
];
const payments = [
  { id: "p1", jobId: "j1", amount: 1000, date: "2026-07-11" }, { id: "p2", jobId: "j1", amount: 2000, date: "2026-07-20" },
  { id: "p3", jobId: "j2", amount: 110, date: "2026-08-02" },
  { id: "p4", jobId: "j3", amount: 1200, date: "2026-08-21" },
  { id: "p5", jobId: "j4", amount: 1000, date: "2026-09-06" },
];
const maintenance = [{ id: "m1", equipmentId: "e1", cost: 900, date: "2026-08-15" }];
const equipmentFuelEntries = [{ id: "f1", equipmentId: "e2", liters: 10.5, pricePerLiter: 15, date: "2026-09-01" }];
const supplierInvoices = [{ id: "i1", supplierName: "مورد قطع", amount: 1000, date: "2026-08-01" },
  { id: "i2", supplierName: "مورد قطع", amount: 300.25, date: "2026-09-01" }];
const supplierPayments = [{ id: "s1", supplierInvoiceId: "i1", amount: 600, date: "2026-08-03" },
  { id: "s2", supplierInvoiceId: "i1", amount: 400, date: "2026-09-02" },
  { id: "s3", supplierInvoiceId: "i2", amount: 350, date: "2026-09-03" }];
const salaryEntries = [{ id: "e_1", driverId: "d1", type: "bonus", amount: 200, date: "2026-08-10" },
  { id: "e_2", driverId: "d2", type: "deduction", amount: 150, date: "2026-07-20" }];
const taxDeductions = [{ id: "t1", amount: 120.5, date: "2026-08-30" }, { id: "t2", amount: 80, date: "2026-09-01" }];
const fuelPrice = 20;
const data = { jobs, payments, maintenance, equipmentFuelEntries, equipment, salaryEntries, drivers,
  taxDeductions, supplierInvoices, supplierPayments, fuelPrice };
const AS_OF = "2026-09";

describe("FINANCIAL — hand-checked", () => {
  const t = aggregateJobs(jobs, fuelPrice, payments);
  test("revenue", () => expect(roundMoney(t.totalRevenue)).toBe(3000 + 110 + 1080 + 3600));
  test("paid (incl. legacy amountPaid + instalment)", () => {
    expect(getJobPaidAmount(jobs[3], payments)).toBe(1500);
    expect(roundMoney(t.totalPaid)).toBe(3000 + 110 + 1200 + 1500);
  });
  test("remaining / partial / full / overpaid", () => {
    const st = jobs.map((j) => enrichJob(j, fuelPrice, payments).paymentStatus);
    expect(st).toEqual(["paid", "paid", "paid", "partial"]);
    expect(t.totalRemaining).toBe(2100);
    expect(aggregateJobOverpayments(jobs, payments).totalOverpaid).toBe(120);
  });
  test("fuel: frozen price per job, legacy fallback to settings, manual entries", () => {
    const f = buildPeriodFinancials(data, { asOfMonth: AS_OF });
    expect(f.totalFuelCost).toBe(60 * 15 + 4 * 15 + 20 * 16.5 + 70 * 20 + 10.5 * 15);
  });
  test("suppliers: cash paid, payable, overpayment", () => {
    const s = aggregateSupplierInvoices(supplierInvoices, supplierPayments);
    expect(s).toEqual({ totalInvoiced: 1300.25, totalPaidOut: 1350, totalPayable: 0 });
    expect(aggregateSupplierOverpayments(supplierInvoices, supplierPayments).totalOverpaid).toBe(49.75);
  });
  test("salaries: full accrual, inactive stops future only", () => {
    // d1: Jul 3000, Aug 3200, Sep 3000 · d2: Jul 2000 (الخصم 150 = فلوس اتصرفت، مش بيقلل المصروف), Aug 2000, Sep inactive
    expect(calcSalaryExpense(salaryEntries, drivers, { toMonth: AS_OF })).toBe(3000 + 3200 + 3000 + 2000 + 2000);
  });
  test("expenses + tax + profit", () => {
    const f = buildPeriodFinancials(data, { asOfMonth: AS_OF });
    expect(f.totalMaintCost).toBe(calcTotalMaintenanceCost(maintenance));
    expect(f.totalTaxDeductions).toBe(calcTotalTaxDeductions(taxDeductions));
    expect(f.netProfit).toBeCloseTo(7790 - 2847.5 - 900 - 13200 - 200.5 - 1350, 6);
    expect(f.netProfit).toBe(calcNetProfit(f));
  });
  test("large values stay exact to the piaster", () => {
    expect(calcRemainingAmount(999999999.99, 999999999.98)).toBe(0.01);
    expect(derivePaymentStatus(calcRevenue(1000000, 999.99), 999990000)).toBe("paid");
    expect(calcOverpaidAmount(1e9, 1e9 + 0.01)).toBe(0.01);
  });
  test("decimal values (float noise never creates debt)", () => {
    for (const [a, p] of [[1.1, 100], [0.7, 150], [2.3, 330], [12.35, 199.99]]) {
      const rev = calcRevenue(a, p);
      expect(derivePaymentStatus(rev, Number(rev.toFixed(2)))).toBe("paid");
    }
  });
});

describe("CROSS-MODULE — same number everywhere", () => {
  const all = buildPeriodFinancials(data, { asOfMonth: AS_OF });
  test("Dashboard = Reports = PDF (same function, same options)", () => {
    const reports = buildPeriodFinancials(data, { asOfMonth: AS_OF });
    expect(reports).toEqual(all);
    const { html } = buildMonthlySummaryHtmlForTest({ jobs, equipment, allTime: true, financials: all });
    expect(html).toContain(formatProfit(all.netProfit));
    expect(html).toContain(formatCurrency(all.totalRevenue));
  });
  test("sum of monthly reports = all-time (every figure)", () => {
    const months = monthRange("2026-07", AS_OF).map((m) => buildPeriodFinancials(data, { monthPrefix: m }));
    for (const k of ["totalRevenue", "totalFuelCost", "totalMaintCost", "totalSalariesPaid", "totalTaxDeductions", "totalSupplierPaidOut", "netProfit"]) {
      expect(months.reduce((s, m) => s + m[k], 0)).toBeCloseTo(all[k], 6);
    }
  });
  test("Customer page totals = Dashboard job totals (name variants merged)", () => {
    const list = buildClientList(jobs, fuelPrice, payments);
    expect(list.map((c) => c.client).sort()).toEqual(["الفار", "النيل", "سالم"].sort());
    const sum = (k) => list.reduce((s, c) => s + c[k], 0);
    expect(sum("totalRevenue")).toBeCloseTo(all.totalRevenue, 6);
    expect(sum("totalPaid")).toBeCloseTo(all.totalPaid, 6);
    expect(sum("totalRemaining")).toBeCloseTo(all.totalRemaining, 6);
    expect(buildClientSummary("النيل", jobs, fuelPrice, payments).totalRemaining).toBe(2100);
  });
  test("Jobs page cards = aggregate (per-job enrich sums to totals)", () => {
    const e = jobs.map((j) => enrichJob(j, fuelPrice, payments));
    expect(e.reduce((s, j) => s + j.remainingAmount, 0)).toBe(all.totalRemaining);
    expect(e.reduce((s, j) => s + j.revenue, 0)).toBeCloseTo(all.totalRevenue, 6);
  });
  test("Equipment + Driver reports reconcile with totals", () => {
    const eq = buildEquipmentReport(equipment, jobs, maintenance, fuelPrice, payments, equipmentFuelEntries);
    expect(eq.reduce((s, r) => s + r.totalRevenue, 0)).toBeCloseTo(all.totalRevenue, 6);
    expect(eq.reduce((s, r) => s + r.totalFuelCost, 0)).toBeCloseTo(all.totalFuelCost, 6);
    expect(eq.reduce((s, r) => s + r.maintCost, 0)).toBe(all.totalMaintCost);
    const dr = buildDriverReport(drivers, jobs, fuelPrice, payments);
    expect(dr.reduce((s, r) => s + r.totalRevenue, 0)).toBeCloseTo(all.totalRevenue, 6);
  });
  test("Supplier page = Dashboard supplier figures", () => {
    const list = buildSupplierList(supplierInvoices, supplierPayments);
    expect(list[0].totalPaidOut).toBe(all.totalSupplierPaidOut);
  });
});

describe("FUNCTIONAL — state create / edit / delete", () => {
  const run = (actions) => actions.reduce(reducer, { ...initialState });
  test("job + payments lifecycle", () => {
    let s = run([
      { type: "ADD_JOB", payload: { id: "j", acres: 2, pricePerAcre: 100 } },
      { type: "ADD_PAYMENT", payload: { id: "p", jobId: "j", amount: 50 } },
      { type: "UPDATE_JOB", payload: { id: "j", acres: 3 } },
      { type: "UPDATE_PAYMENT", payload: { id: "p", amount: 60 } },
    ]);
    expect(s.jobs[0]).toEqual({ id: "j", acres: 3, pricePerAcre: 100 });
    expect(getJobPaidAmount(s.jobs[0], s.payments)).toBe(60);
    s = reducer(reducer(s, { type: "DELETE_PAYMENTS_BY_JOB", payload: "j" }), { type: "DELETE_JOB", payload: "j" });
    expect(s.jobs).toEqual([]); expect(s.payments).toEqual([]);
  });
  test("supplier invoice + payments cascade", () => {
    let s = run([
      { type: "ADD_SUPPLIER_INVOICE", payload: { id: "i", amount: 100 } },
      { type: "ADD_SUPPLIER_PAYMENT", payload: { id: "sp", supplierInvoiceId: "i", amount: 40 } },
      { type: "DELETE_SUPPLIER_PAYMENTS_BY_INVOICE", payload: "i" },
      { type: "DELETE_SUPPLIER_INVOICE", payload: "i" },
    ]);
    expect(s.supplierInvoices).toEqual([]); expect(s.supplierPayments).toEqual([]);
  });
  test("equipment / drivers edit keeps untouched fields (partial update merge)", () => {
    const s = run([
      { type: "ADD_EQUIPMENT", payload: { id: "e", name: "a", category: "tractor" } },
      { type: "UPDATE_EQUIPMENT", payload: { id: "e", name: "b" } },
      { type: "ADD_DRIVER", payload: { id: "d", name: "x", salary: 100 } },
      { type: "UPDATE_DRIVER", payload: { id: "d", status: "inactive" } },
    ]);
    expect(s.equipment[0]).toEqual({ id: "e", name: "b", category: "tractor" });
    expect(s.drivers[0]).toEqual({ id: "d", name: "x", salary: 100, status: "inactive" });
  });
  test("DUPLICATE PREVENTION: adding the same id twice never double-counts (bug fixed in Step 5)", () => {
    const s = run([
      { type: "ADD_PAYMENT", payload: { id: "p", jobId: "j", amount: 500 } },
      { type: "ADD_PAYMENT", payload: { id: "p", jobId: "j", amount: 500 } },
      { type: "ADD_SUPPLIER_PAYMENT", payload: { id: "q", supplierInvoiceId: "i", amount: 70 } },
      { type: "ADD_SUPPLIER_PAYMENT", payload: { id: "q", supplierInvoiceId: "i", amount: 70 } },
    ]);
    expect(s.payments).toHaveLength(1);
    expect(getJobPaidAmount({ id: "j" }, s.payments)).toBe(500);
    expect(s.supplierPayments).toHaveLength(1);
  });
});
