// src/utils/calculations.test.js
//
// Unit tests for the money math in calculations.js. These functions drive
// every revenue/profit/debt number shown in the app, so a silent regression
// here is the most expensive kind of bug — this file exists to catch that
// before it reaches a real client's account.

import {
  calcRevenue,
  calcFuelCost,
  calcJobNetProfit,
  calcJobProfit,
  calcRemainingAmount,
  getJobPaidAmount,
  derivePaymentStatus,
  aggregateJobs,
  aggregateEquipmentFuelEntries,
  buildEquipmentReport,
  buildDriverReport,
  groupByWorkType,
  buildClientSummary,
  buildClientList,
  calcTotalPaidForJob,
  derivePaymentStatusFromPayments,
  checkOverdueDebts,
  calcSupplierRemaining,
  getInvoicePaidAmount,
  aggregateSupplierInvoices,
} from "./calculations";
import { MAX_MONEY_VALUE } from "../config/constants";

// ─── calcRevenue / calcFuelCost ────────────────────────────────────────────

describe("calcRevenue", () => {
  test("multiplies acres by price per acre", () => {
    expect(calcRevenue(10, 150)).toBe(1500);
  });

  test("treats missing/invalid values as 0 instead of NaN", () => {
    expect(calcRevenue(undefined, 150)).toBe(0);
    expect(calcRevenue(10, null)).toBe(0);
    expect(calcRevenue("", "")).toBe(0);
  });

  test("coerces numeric strings", () => {
    expect(calcRevenue("10", "150")).toBe(1500);
  });
});

describe("calcFuelCost", () => {
  test("multiplies fuel used by fuel price", () => {
    expect(calcFuelCost(20, 12)).toBe(240);
  });

  test("defaults invalid input to 0", () => {
    expect(calcFuelCost(undefined, 12)).toBe(0);
    expect(calcFuelCost(20, undefined)).toBe(0);
  });
});

// ─── Job profit ─────────────────────────────────────────────────────────────

describe("calcJobNetProfit", () => {
  test("revenue minus fuel cost minus maintenance share", () => {
    // revenue = 10*150=1500, fuel = 20*12=240, maint = 100
    expect(calcJobNetProfit(10, 150, 20, 12, 100)).toBe(1160);
  });

  test("maintCostShare defaults to 0 when omitted", () => {
    expect(calcJobNetProfit(10, 150, 20, 12)).toBe(1260);
  });

  test("calcJobProfit is an alias of calcJobNetProfit", () => {
    expect(calcJobProfit).toBe(calcJobNetProfit);
  });
});

// ─── Remaining amount ───────────────────────────────────────────────────────

describe("calcRemainingAmount", () => {
  test("revenue minus amount paid", () => {
    expect(calcRemainingAmount(1000, 400)).toBe(600);
  });

  test("never goes negative when overpaid", () => {
    expect(calcRemainingAmount(1000, 1500)).toBe(0);
  });

  test("treats missing amountPaid as 0", () => {
    expect(calcRemainingAmount(1000, undefined)).toBe(1000);
  });
});

// ─── getJobPaidAmount (instalments vs legacy fallback) ─────────────────────

describe("getJobPaidAmount", () => {
  test("sums instalments from the payments collection when present", () => {
    const job = { id: "job1" };
    const payments = [
      { jobId: "job1", amount: 200 },
      { jobId: "job1", amount: 150 },
      { jobId: "job2", amount: 500 }, // unrelated job, must not be counted
    ];
    expect(getJobPaidAmount(job, payments)).toBe(350);
  });

  // audit FIN-2: قبل الإصلاح كانت بترجع 350 وتضيّع الـ999 القديمة.
  test("adds legacy job.amountPaid to later instalments (FIN-2)", () => {
    const job = { id: "job1", amountPaid: 999 };
    const payments = [
      { jobId: "job1", amount: 200 },
      { jobId: "job1", amount: 150 },
      { jobId: "job2", amount: 500 },
    ];
    expect(getJobPaidAmount(job, payments)).toBe(1349);
  });

  test("falls back to legacy job.amountPaid when no instalments exist", () => {
    const job = { id: "oldJob", amountPaid: 700 };
    expect(getJobPaidAmount(job, [])).toBe(700);
  });

  test("falls back to 0 when neither instalments nor legacy field exist", () => {
    const job = { id: "job3" };
    expect(getJobPaidAmount(job, [])).toBe(0);
  });

  test("defaults payments to an empty array when omitted", () => {
    const job = { id: "job4", amountPaid: 50 };
    expect(getJobPaidAmount(job)).toBe(50);
  });
});

// ─── Payment status ──────────────────────────────────────────────────────────

describe("derivePaymentStatus", () => {
  test("unpaid when nothing has been paid", () => {
    expect(derivePaymentStatus(1000, 0)).toBe("unpaid");
  });

  test("partial when paid is between 0 and revenue", () => {
    expect(derivePaymentStatus(1000, 500)).toBe("partial");
  });

  test("paid when the full revenue has been paid", () => {
    expect(derivePaymentStatus(1000, 1000)).toBe("paid");
  });

  test("paid when overpaid", () => {
    expect(derivePaymentStatus(1000, 1200)).toBe("paid");
  });
});

// ─── aggregateJobs ───────────────────────────────────────────────────────────

describe("aggregateJobs", () => {
  const jobs = [
    { id: "a", acres: 10, pricePerAcre: 100, fuelUsed: 5, date: "2026-01-01" }, // revenue 1000
    { id: "b", acres: 5, pricePerAcre: 200, fuelUsed: 3, date: "2026-01-02" },  // revenue 1000
  ];
  const payments = [{ jobId: "a", amount: 1000 }]; // job a fully paid, job b unpaid

  test("sums revenue, acres and fuel across jobs", () => {
    const totals = aggregateJobs(jobs, 12, payments);
    expect(totals.totalRevenue).toBe(2000);
    expect(totals.totalAcres).toBe(15);
    expect(totals.totalFuel).toBe(8);
    expect(totals.totalFuelCost).toBe(96); // 8 * 12
    expect(totals.netProfit).toBe(2000 - 96);
  });

  test("computes totalPaid and totalRemaining from the payments collection", () => {
    const totals = aggregateJobs(jobs, 12, payments);
    expect(totals.totalPaid).toBe(1000);
    expect(totals.totalRemaining).toBe(1000); // job b's full revenue still owed
  });

  test("uses each job's own stored fuelPriceAtJob, not the current settings price", () => {
    const historicalJobs = [
      { id: "a", acres: 10, pricePerAcre: 100, fuelUsed: 5, fuelPriceAtJob: 10 }, // priced when fuel was 10/L
      { id: "b", acres: 5, pricePerAcre: 200, fuelUsed: 3 }, // legacy job, no stored price yet
    ];
    // current settings price is now 20, but job "a" must stay locked at 10
    const totals = aggregateJobs(historicalJobs, 20, []);
    // 5*10 (job a, historical) + 3*20 (job b, legacy fallback) = 110
    expect(totals.totalFuelCost).toBe(110);
  });

  test("returns all-zero totals for an empty job list", () => {
    const totals = aggregateJobs([], 12, []);
    expect(totals).toEqual({
      totalRevenue: 0, totalAcres: 0, totalFuel: 0, totalFuelCost: 0,
      netProfit: 0, totalPaid: 0, totalRemaining: 0,
    });
  });
});

// ─── Equipment / driver reports ──────────────────────────────────────────────

describe("buildEquipmentReport", () => {
  const equipment = [{ id: "eq1", name: "Tractor 1" }, { id: "eq2", name: "Tractor 2" }];
  const jobs = [
    { id: "j1", equipmentId: "eq1", acres: 10, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-01" },
    { id: "j2", equipmentId: "eq2", acres: 20, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-02" },
  ];
  const maintenance = [{ id: "m1", equipmentId: "eq1", cost: 300 }];

  test("attributes jobs and maintenance cost to the right equipment", () => {
    const report = buildEquipmentReport(equipment, jobs, maintenance, 12, []);
    const eq1 = report.find((r) => r.id === "eq1");
    const eq2 = report.find((r) => r.id === "eq2");
    expect(eq1.totalRevenue).toBe(1000);
    expect(eq1.maintCost).toBe(300);
    expect(eq1.netProfit).toBe(700); // 1000 revenue - 0 fuel - 300 maint
    expect(eq2.maintCost).toBe(0);
    expect(eq1.ops).toBe(1);
  });

  test("sorts by total revenue descending", () => {
    const report = buildEquipmentReport(equipment, jobs, maintenance, 12, []);
    expect(report[0].id).toBe("eq2"); // 2000 revenue > 1000 revenue
  });

  test("margin is 0 (not NaN) when equipment has no revenue", () => {
    const report = buildEquipmentReport(
      [{ id: "eqX" }], [], [], 12, []
    );
    expect(report[0].margin).toBe(0);
  });

  test("adds manual fuel liters and cost to the equipment totals", () => {
    const report = buildEquipmentReport(
      [{ id: "eq1" }],
      [{ equipmentId: "eq1", acres: 1, pricePerAcre: 1000, fuelUsed: 50, fuelPriceAtJob: 10 }],
      [],
      10,
      [],
      [{ equipmentId: "eq1", liters: 20, pricePerLiter: 12 }]
    );
    expect(report[0].totalFuel).toBe(70);
    expect(report[0].totalFuelCost).toBe(740);
    expect(report[0].netProfit).toBe(260);
  });

  test("does not count manual fuel entries for attachments", () => {
    const report = buildEquipmentReport(
      [{ id: "att1", category: "attachment" }],
      [],
      [],
      10,
      [],
      [{ equipmentId: "att1", liters: 20, pricePerLiter: 12 }]
    );
    expect(report[0].totalFuel).toBe(0);
    expect(report[0].totalFuelCost).toBe(0);
  });
});

describe("aggregateEquipmentFuelEntries", () => {
  test("adds manual fuel to global liters and cost and excludes attachments", () => {
    const totals = aggregateEquipmentFuelEntries(
      [
        { equipmentId: "eq1", liters: 20, pricePerLiter: 12 },
        { equipmentId: "att1", liters: 100, pricePerLiter: 12 },
      ],
      [
        { id: "eq1", category: "base" },
        { id: "att1", category: "attachment" },
      ]
    );
    expect(totals).toEqual({ totalFuel: 20, totalFuelCost: 240 });
  });
});

describe("buildDriverReport", () => {
  test("attributes jobs to the right driver and sorts by revenue", () => {
    const drivers = [{ id: "d1" }, { id: "d2" }];
    const jobs = [
      { id: "j1", driverId: "d1", acres: 1, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-01" },
      { id: "j2", driverId: "d2", acres: 5, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-01" },
    ];
    const report = buildDriverReport(drivers, jobs, 12, []);
    expect(report[0].id).toBe("d2");
    expect(report[0].ops).toBe(1);
    expect(report[1].id).toBe("d1");
  });
});

// ─── groupByWorkType ─────────────────────────────────────────────────────────

describe("groupByWorkType", () => {
  test("sums acres per work type", () => {
    const jobs = [
      { workType: "حرث", acres: 10 },
      { workType: "حرث", acres: 5 },
      { workType: "رش", acres: 3 },
    ];
    const grouped = groupByWorkType(jobs);
    expect(grouped).toEqual(
      expect.arrayContaining([
        { name: "حرث", value: 15 },
        { name: "رش", value: 3 },
      ])
    );
  });
});

// ─── Client summary / list ──────────────────────────────────────────────────

describe("buildClientSummary and buildClientList", () => {
  const jobs = [
    { id: "j1", client: "أحمد", acres: 10, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-01" },
    { id: "j2", client: "أحمد", acres: 5, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-02" },
    { id: "j3", client: "محمد", acres: 20, pricePerAcre: 100, fuelUsed: 0, date: "2026-01-03" },
  ];
  const payments = [{ jobId: "j3", amount: 2000 }]; // محمد fully paid

  test("buildClientSummary aggregates only that client's jobs", () => {
    const summary = buildClientSummary("أحمد", jobs, 12, payments);
    expect(summary.ops).toBe(2);
    expect(summary.totalRevenue).toBe(1500);
    expect(summary.totalRemaining).toBe(1500); // nothing paid
  });

  test("buildClientList sorts clients by outstanding debt descending", () => {
    const list = buildClientList(jobs, 12, payments);
    expect(list[0].client).toBe("أحمد"); // owes 1500
    expect(list.find((c) => c.client === "محمد").totalRemaining).toBe(0);
  });

  test("buildClientList ignores jobs with no client name", () => {
    const withBlank = [...jobs, { id: "j4", client: "", acres: 1, pricePerAcre: 1, date: "2026-01-04" }];
    const list = buildClientList(withBlank, 12, payments);
    expect(list.some((c) => c.client === "")).toBe(false);
  });
});

// ─── Payment instalments ──────────────────────────────────────────────────────

describe("calcTotalPaidForJob", () => {
  test("sums only the instalments for the given job", () => {
    const payments = [
      { jobId: "j1", amount: 100 },
      { jobId: "j1", amount: 50 },
      { jobId: "j2", amount: 999 },
    ];
    expect(calcTotalPaidForJob(payments, "j1")).toBe(150);
  });
});

describe("derivePaymentStatusFromPayments", () => {
  test("returns paid/remaining/status derived from the payments list", () => {
    const payments = [{ jobId: "j1", amount: 400 }];
    const result = derivePaymentStatusFromPayments(1000, payments, "j1");
    expect(result).toEqual({ paid: 400, remaining: 600, status: "partial" });
  });
});

// ─── Overdue debts ─────────────────────────────────────────────────────────────

describe("checkOverdueDebts", () => {
  test("flags unpaid jobs older than the overdue threshold", () => {
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 45);
    const isoOld = oldDate.toISOString().split("T")[0];

    const jobs = [
      { id: "j1", date: isoOld, acres: 10, pricePerAcre: 100 }, // old + unpaid
      { id: "j2", date: new Date().toISOString().split("T")[0], acres: 10, pricePerAcre: 100 }, // recent + unpaid
    ];

    const overdue = checkOverdueDebts(jobs, 12, 30, []);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].job.id).toBe("j1");
  });

  test("excludes jobs that are already fully paid, regardless of age", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 90);
    const isoOld = oldDate.toISOString().split("T")[0];

    const jobs = [{ id: "j1", date: isoOld, acres: 10, pricePerAcre: 100 }];
    const payments = [{ jobId: "j1", amount: 1000 }];

    expect(checkOverdueDebts(jobs, 12, 30, payments)).toEqual([]);
  });

  test("sorts results by remaining amount descending", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60);
    const isoOld = oldDate.toISOString().split("T")[0];

    const jobs = [
      { id: "small", date: isoOld, acres: 1, pricePerAcre: 100 },  // remaining 100
      { id: "big",   date: isoOld, acres: 10, pricePerAcre: 100 }, // remaining 1000
    ];

    const overdue = checkOverdueDebts(jobs, 12, 30, []);
    expect(overdue[0].job.id).toBe("big");
    expect(overdue[1].job.id).toBe("small");
  });
});

// ─── Supplier invoices/payments (money the business owes OUT) ─────────────────
// Mirror of the client-side tests above, flipped direction. These back the
// "مستحقات الموردين" figure on the dashboard and its net-profit deduction,
// so a silent regression here directly misstates the business's profit.

describe("calcSupplierRemaining", () => {
  test("subtracts what's been paid from the invoice amount", () => {
    expect(calcSupplierRemaining(10000, 4000)).toBe(6000);
  });

  test("never goes negative, even if overpaid", () => {
    expect(calcSupplierRemaining(1000, 1500)).toBe(0);
  });

  test("treats missing/invalid values as zero", () => {
    expect(calcSupplierRemaining(undefined, undefined)).toBe(0);
    expect(calcSupplierRemaining(1000, "not-a-number")).toBe(1000);
  });
});

describe("getInvoicePaidAmount", () => {
  const payments = [
    { supplierInvoiceId: "inv1", amount: 3000 },
    { supplierInvoiceId: "inv1", amount: 2000 },
    { supplierInvoiceId: "inv2", amount: 500 },
  ];

  test("sums every payment linked to that invoice id", () => {
    expect(getInvoicePaidAmount({ id: "inv1" }, payments)).toBe(5000);
  });

  test("returns 0 for an invoice with no payments yet", () => {
    expect(getInvoicePaidAmount({ id: "inv3" }, payments)).toBe(0);
  });

  test("also accepts a pre-built Map (used internally by aggregateSupplierInvoices)", () => {
    const map = new Map([["inv1", 5000]]);
    expect(getInvoicePaidAmount({ id: "inv1" }, map)).toBe(5000);
  });
});

// ─── Boundary values (0 / negative / MAX_MONEY_VALUE-scale) ────────────────────
// These exist specifically because item #6 of the SC-2026-9114 review asked
// to confirm edge values are covered, not just the happy path.

describe("boundary values across the money-math functions", () => {
  test("calcRevenue/calcFuelCost handle a value at MAX_MONEY_VALUE without overflow", () => {
    expect(calcRevenue(1, MAX_MONEY_VALUE)).toBe(MAX_MONEY_VALUE);
    expect(calcFuelCost(1, MAX_MONEY_VALUE)).toBe(MAX_MONEY_VALUE);
  });

  test("negative acres/price still multiply normally (validation happens at the form layer, not here)", () => {
    expect(calcRevenue(-10, 100)).toBe(-1000);
  });

  test("calcRemainingAmount clamps to 0 at the exact boundary (paid === revenue)", () => {
    expect(calcRemainingAmount(1000, 1000)).toBe(0);
  });

  test("derivePaymentStatus at the exact zero boundary is 'unpaid', not 'partial'", () => {
    expect(derivePaymentStatus(1000, 0)).toBe("unpaid");
  });

  test("aggregateJobs handles a very large single job without losing precision", () => {
    const jobs = [{ id: "big", acres: 1, pricePerAcre: MAX_MONEY_VALUE, fuelUsed: 0, date: "2026-01-01" }];
    const totals = aggregateJobs(jobs, 0, []);
    expect(totals.totalRevenue).toBe(MAX_MONEY_VALUE);
    expect(totals.totalRemaining).toBe(MAX_MONEY_VALUE);
  });

  test("checkOverdueDebts treats exactly `overdueDays` old as overdue (inclusive boundary)", () => {
    const boundaryDate = new Date();
    boundaryDate.setDate(boundaryDate.getDate() - 30);
    const iso = boundaryDate.toISOString().split("T")[0];
    const jobs = [{ id: "j1", date: iso, acres: 10, pricePerAcre: 100 }];
    const overdue = checkOverdueDebts(jobs, 12, 30, []);
    expect(overdue).toHaveLength(1);
  });
});

describe("aggregateSupplierInvoices", () => {
  const invoices = [
    { id: "inv1", supplierName: "ورشة السيد", amount: 10000 },
    { id: "inv2", supplierName: "محمد النجار", amount: 4000 },
  ];

  test("with no payments at all, everything invoiced is still payable", () => {
    const stats = aggregateSupplierInvoices(invoices, []);
    expect(stats).toEqual({ totalInvoiced: 14000, totalPaidOut: 0, totalPayable: 14000 });
  });

  // This is the exact scenario behind the dashboard bug: a 10,000 invoice
  // partially paid down to 5,000 must show as 5,000 payable everywhere,
  // not stay stuck at the original 10,000.
  test("a partial payment shrinks totalPayable immediately (cash basis, not accrual)", () => {
    const payments = [{ supplierInvoiceId: "inv1", amount: 5000 }];
    const stats = aggregateSupplierInvoices(invoices, payments);
    expect(stats.totalInvoiced).toBe(14000); // historical total never changes
    expect(stats.totalPaidOut).toBe(5000);
    expect(stats.totalPayable).toBe(9000);   // 5,000 left on inv1 + all of inv2
  });

  test("a fully paid invoice contributes nothing to totalPayable", () => {
    const payments = [{ supplierInvoiceId: "inv1", amount: 10000 }];
    const stats = aggregateSupplierInvoices(invoices, payments);
    expect(stats.totalPayable).toBe(4000); // only inv2 left
  });
});

// ─── Step 1 financial fixes (audit FIN-1 / FIN-2 / FIN-4) ─────────────────────
import {
  roundMoney,
  calcOverpaidAmount,
  findLegacyPaidWithPayments,
  aggregateJobOverpayments,
  aggregateSupplierOverpayments,
  checkOverdueDebts as _checkOverdueDebts,
  calcSupplierRemaining as _calcSupplierRemaining,
  derivePaymentStatusFromPayments as _derivePaymentStatusFromPayments,
  aggregateJobs as _aggregateJobs,
} from "./calculations";

describe("FIN-1 floating-point: full payment must be 'paid'", () => {
  test("1.1 acres × 100 paid 110 → paid, remaining 0", () => {
    const revenue = calcRevenue(1.1, 100); // 110.00000000000001 in raw JS
    expect(revenue).not.toBe(110);          // documents the root cause
    expect(derivePaymentStatus(revenue, 110)).toBe("paid");
    expect(calcRemainingAmount(revenue, 110)).toBe(0);
  });

  test("brute force: paying the exact 2-dp amount always gives 'paid'", () => {
    for (let a = 1; a <= 1000; a++) {
      for (let p = 50; p <= 3000; p += 50) {
        const revenue = calcRevenue(a / 10, p);
        const typed = Number(revenue.toFixed(2));
        expect(derivePaymentStatus(revenue, typed)).toBe("paid");
        expect(calcRemainingAmount(revenue, typed)).toBe(0);
      }
    }
  });

  test("real partial payments are unchanged", () => {
    expect(derivePaymentStatus(832.5, 832.49)).toBe("partial");
    expect(calcRemainingAmount(832.5, 832.49)).toBe(0.01);
    expect(derivePaymentStatus(1000, 400)).toBe("partial");
    expect(calcRemainingAmount(1000, 400)).toBe(600);
    expect(derivePaymentStatus(1000, 0)).toBe("unpaid");
  });

  test("job no longer shows up as overdue debt or in totalRemaining", () => {
    const job = { id: "j", acres: 1.1, pricePerAcre: 100, date: "2020-01-01" };
    const payments = [{ jobId: "j", amount: 110 }];
    expect(_checkOverdueDebts([job], 10, 30, payments)).toEqual([]);
    expect(_aggregateJobs([job], 10, payments).totalRemaining).toBe(0);
    expect(_derivePaymentStatusFromPayments(calcRevenue(1.1, 100), payments, "j").status).toBe("paid");
  });

  test("supplier invoice paid by float-summed instalments has 0 remaining", () => {
    expect(0.7 + 0.2 + 0.1).not.toBe(1);
    expect(_calcSupplierRemaining(1, 0.7 + 0.2 + 0.1)).toBe(0);
  });

  test("roundMoney rounds to piasters", () => {
    expect(roundMoney(110.00000000000001)).toBe(110);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney("abc")).toBe(0);
    expect(roundMoney(-2.345)).toBe(-2.35);
  });
});

describe("FIN-2 legacy amountPaid", () => {
  test("legacy-only job still reads amountPaid", () => {
    expect(getJobPaidAmount({ id: "j", amountPaid: 300 }, [])).toBe(300);
  });

  test("legacy 300 + new instalment 100 = 400 everywhere", () => {
    const job = { id: "j", acres: 10, pricePerAcre: 100, amountPaid: 300 };
    const payments = [{ jobId: "j", amount: 100 }];
    expect(getJobPaidAmount(job, payments)).toBe(400);
    const t = _aggregateJobs([job], 10, payments);
    expect(t.totalPaid).toBe(400);
    expect(t.totalRemaining).toBe(600);
  });

  test("detection lists legacy+instalment jobs and flags equal amounts for review", () => {
    const jobs = [
      { id: "a", amountPaid: 300 },
      { id: "b", amountPaid: 500 },
      { id: "c" },
      { id: "d", amountPaid: 200 }, // legacy only → not listed
    ];
    const payments = [
      { jobId: "a", amount: 100 },
      { jobId: "b", amount: 500 },
      { jobId: "c", amount: 50 },
    ];
    expect(findLegacyPaidWithPayments(jobs, payments)).toEqual([
      { jobId: "a", legacyAmountPaid: 300, instalmentsTotal: 100, sameAmountInstalment: false },
      { jobId: "b", legacyAmountPaid: 500, instalmentsTotal: 500, sameAmountInstalment: true },
    ]);
  });
});

describe("FIN-4 overpayments are visible", () => {
  test("calcOverpaidAmount", () => {
    expect(calcOverpaidAmount(1000, 1200)).toBe(200);
    expect(calcOverpaidAmount(1000, 1000)).toBe(0);
    expect(calcOverpaidAmount(1000, 400)).toBe(0);
    expect(calcOverpaidAmount(calcRevenue(1.1, 100), 110)).toBe(0); // float noise ≠ overpayment
  });

  test("client overpayment aggregated per job", () => {
    const jobs = [
      { id: "j1", acres: 10, pricePerAcre: 100 },
      { id: "j2", acres: 1, pricePerAcre: 100 },
    ];
    const payments = [
      { jobId: "j1", amount: 600 }, { jobId: "j1", amount: 600 },
      { jobId: "j2", amount: 50 },
    ];
    expect(aggregateJobOverpayments(jobs, payments)).toEqual({
      totalOverpaid: 200, items: [{ id: "j1", overpaid: 200 }],
    });
  });

  test("supplier overpayment aggregated per invoice", () => {
    const invoices = [{ id: "i1", amount: 500 }, { id: "i2", amount: 300 }];
    const sp = [{ supplierInvoiceId: "i1", amount: 700 }, { supplierInvoiceId: "i2", amount: 100 }];
    expect(aggregateSupplierOverpayments(invoices, sp)).toEqual({
      totalOverpaid: 200, items: [{ id: "i1", overpaid: 200 }],
    });
  });
});
