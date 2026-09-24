// src/utils/crossModule.e2e.test.js
//
// Step 2 — End-to-end consistency (pure functions, no Firebase): the same
// dataset flows through every screen's calculation path, and each figure
// must be identical wherever it appears.
//   Job → Payment → Customer → Equipment → Driver → Dashboard → Reports
//   Supplier Invoice → Supplier Payment → Dashboard → Reports
import {
  aggregateJobs, buildClientList, buildClientSummary, buildEquipmentReport,
  buildDriverReport, buildSupplierList, buildSupplierSummary, aggregateSupplierInvoices,
  enrichJob, normalizeClientName, findJobsWithMissingEquipment, calcNetProfit,
} from "./calculations";
import { buildPeriodFinancials, calcTotalMaintenanceCost } from "./financialSummary";
import { buildMonthlySummaryHtmlForTest } from "./pdf/monthlySummary";
import { formatProfit } from "./formatters";

const equipment = [{ id: "e1", name: "جرار 1" }, { id: "e2", name: "جرار 2" }];
const drivers = [{ id: "d1", name: "سائق", salary: 3000 }];
const jobs = [
  { id: "j1", client: "أحمد علي", equipmentId: "e1", driverId: "d1", acres: 10, pricePerAcre: 100, fuelUsed: 20, fuelPriceAtJob: 15, date: "2026-08-05" },
  { id: "j2", client: " أحمد  علي ", equipmentId: "e2", driverId: "d1", acres: 1.1, pricePerAcre: 100, fuelUsed: 2, fuelPriceAtJob: 15, date: "2026-08-10" },
  { id: "j3", client: "محمود", equipmentId: "e1", driverId: "d1", acres: 5, pricePerAcre: 200, fuelUsed: 10, date: "2026-07-01", amountPaid: 300 },
  { id: "j4", client: "محمود", equipmentId: "gone", acres: 2, pricePerAcre: 100, fuelUsed: 0, fuelPriceAtJob: 15, date: "2026-08-12" },
];
const payments = [
  { id: "p1", jobId: "j1", amount: 400, date: "2026-08-06" },
  { id: "p2", jobId: "j2", amount: 110, date: "2026-08-10" },
  { id: "p3", jobId: "j3", amount: 200, date: "2026-08-01" },
];
const maintenance = [{ id: "m1", equipmentId: "e1", cost: 150, date: "2026-08-07" }];
const supplierInvoices = [
  { id: "i1", supplierName: "مورد", amount: 1000, date: "2026-08-01" },
  { id: "i2", supplierName: "مورد", amount: 500, date: "2026-07-01" },
];
const supplierPayments = [
  { id: "sp1", supplierInvoiceId: "i1", amount: 600, date: "2026-08-03" },
  { id: "sp2", supplierInvoiceId: "i2", amount: 500, date: "2026-07-02" },
];
const salaryEntries = [{ id: "s1", driverId: "d1", type: "base", amount: 3000, date: "2026-08-28", paid: true }];
const taxDeductions = [{ id: "t1", amount: 50, date: "2026-08-15" }];
const fuelPrice = 20;
const data = {
  jobs, payments, maintenance, equipmentFuelEntries: [], equipment, salaryEntries, drivers,
  taxDeductions, supplierInvoices, supplierPayments, fuelPrice,
};

describe("Job → Payment → Customer", () => {
  test("customer name variants are one customer; debt = sum of its jobs", () => {
    const list = buildClientList(jobs, fuelPrice, payments);
    const ahmed = list.find((c) => c.client === "أحمد علي");
    expect(list.filter((c) => c.client.includes("أحمد"))).toHaveLength(1);
    expect(ahmed.ops).toBe(2);
    expect(ahmed.aliases.sort()).toEqual([" أحمد  علي ", "أحمد علي"].sort());
    // j1: 1000 - 400 = 600 ; j2: 110 paid in full (FIN-1)
    expect(ahmed.totalRemaining).toBe(600);
    expect(buildClientSummary(" أحمد علي", jobs, fuelPrice, payments).totalRemaining).toBe(600);
  });

  test("customer page totals = dashboard job totals", () => {
    const list = buildClientList(jobs, fuelPrice, payments);
    const t = aggregateJobs(jobs, fuelPrice, payments);
    const sum = (k) => list.reduce((s, c) => s + c[k], 0);
    expect(sum("totalRevenue")).toBeCloseTo(t.totalRevenue, 9);
    expect(sum("totalPaid")).toBeCloseTo(t.totalPaid, 9);
    expect(sum("totalRemaining")).toBeCloseTo(t.totalRemaining, 9);
  });

  test("legacy amountPaid + instalment flow through to the customer (FIN-2)", () => {
    const m = buildClientSummary("محمود", jobs, fuelPrice, payments);
    const j3 = m.jobs.find((j) => j.id === "j3");
    expect(j3.amountPaid).toBe(500);
    expect(j3.remainingAmount).toBe(500);
    expect(j3).toEqual(enrichJob(jobs[2], fuelPrice, payments));
  });
});

describe("Job → Equipment → Driver", () => {
  test("equipment report + orphans = all jobs", () => {
    const rep = buildEquipmentReport(equipment, jobs, maintenance, fuelPrice, payments, []);
    const orphans = findJobsWithMissingEquipment(jobs, equipment);
    const t = aggregateJobs(jobs, fuelPrice, payments);
    const orphanRevenue = aggregateJobs(orphans, fuelPrice, payments).totalRevenue;
    expect(orphans.map((j) => j.id)).toEqual(["j4"]);
    expect(rep.reduce((s, e) => s + e.totalRevenue, 0) + orphanRevenue).toBeCloseTo(t.totalRevenue, 9);
    expect(rep.find((e) => e.id === "e1").maintCost).toBe(150);
  });

  test("driver report revenue = jobs with that driver", () => {
    const d = buildDriverReport(drivers, jobs, fuelPrice, payments)[0];
    expect(d.ops).toBe(3);
    expect(d.totalRevenue).toBeCloseTo(1000 + 110.00000000000001 + 1000, 9);
  });
});

describe("Dashboard = Reports = PDF (same source)", () => {
  test("all-time figures", () => {
    const f = buildPeriodFinancials(data, { asOfMonth: "2026-08" });
    const t = aggregateJobs(jobs, fuelPrice, payments);
    expect(f.totalRevenue).toBe(t.totalRevenue);          // includes orphan job j4
    expect(f.totalMaintCost).toBe(calcTotalMaintenanceCost(maintenance));
    expect(f.totalSupplierPaidOut).toBe(1100);
    expect(f.totalSalariesPaid).toBe(3000);
    expect(f.totalTaxDeductions).toBe(50);
    expect(f.netProfit).toBe(calcNetProfit(f));
  });

  test("month scoping (payment date for suppliers)", () => {
    const aug = buildPeriodFinancials(data, { monthPrefix: "2026-08" });
    expect(aug.jobsCount).toBe(3);
    expect(aug.totalSupplierPaidOut).toBe(600);
    expect(aug.totalMaintCost).toBe(150);
    const jul = buildPeriodFinancials(data, { monthPrefix: "2026-07" });
    expect(aug.totalRevenue + jul.totalRevenue).toBeCloseTo(buildPeriodFinancials(data).totalRevenue, 9);
  });

  test("monthly PDF prints exactly the figures it is given", () => {
    const f = buildPeriodFinancials(data, { monthPrefix: "2026-08" });
    const { html } = buildMonthlySummaryHtmlForTest({ jobs, equipment, month: 8, year: 2026, financials: f });
    expect(html).toContain(formatProfit(f.netProfit));
  });
});

describe("Supplier Invoice → Supplier Payment → Dashboard → Reports", () => {
  test("supplier list/summary/dashboard agree", () => {
    const list = buildSupplierList(supplierInvoices, supplierPayments);
    const agg = aggregateSupplierInvoices(supplierInvoices, supplierPayments);
    expect(list).toHaveLength(1);
    expect(list[0].totalPayable).toBe(agg.totalPayable);
    expect(list[0].totalPayable).toBe(400);
    expect(list[0].totalPaidOut).toBe(agg.totalPaidOut);
    expect(buildSupplierSummary("مورد", supplierInvoices, supplierPayments).totalPayable).toBe(400);
    expect(buildPeriodFinancials(data).totalSupplierPaidOut).toBe(agg.totalPaidOut);
  });
});

describe("normalizeClientName", () => {
  test("trims and collapses whitespace, keeps letters", () => {
    expect(normalizeClientName("  أحمد   علي ")).toBe("أحمد علي");
    expect(normalizeClientName(undefined)).toBe("");
    expect(normalizeClientName("Ali")).toBe("Ali");
  });
});
