// src/utils/calculations.js

// تحويل آمن لأي قيمة لرقم صالح للحسابات المالية. زي Number(x)||0 بالظبط
// (بيرجع 0 لأي قيمة فاسدة: undefined/null/نص عشوائي/NaN)، لكن كمان بيمنع
// Infinity/-Infinity من التسرب لحسابات الإيراد/الربح (لو حقل اتلخبط بقيمة
// غير محدودة، هيتحول لـ 0 بدل ما يفسد كل التجميعات اللي بعده).
const safeNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ─── Job-level ────────────────────────────────────────────────────────────────

export const calcRevenue = (acres, pricePerAcre) =>
  (safeNum(acres)) * (safeNum(pricePerAcre));

export const calcFuelCost = (fuelUsed, fuelPrice) =>
  (safeNum(fuelUsed)) * (safeNum(fuelPrice));

/**
 * Fuel price to use for a given job: the price stored ON the job at the
 * time it was created (fuelPriceAtJob), same idea as pricePerAcre. Falls
 * back to the current settings price only for legacy jobs saved before
 * this field existed, so old jobs don't blow up with a missing price.
 */
export const getJobFuelPrice = (job, fallbackFuelPrice) =>
  job.fuelPriceAtJob ?? fallbackFuelPrice;

/**
 * Full net profit for a single job.
 * maintCostShare = maintenance cost attributed to this job (optional).
 */
export const calcJobNetProfit = (acres, pricePerAcre, fuelUsed, fuelPrice, maintCostShare = 0) => {
  const revenue  = calcRevenue(acres, pricePerAcre);
  const fuelCost = calcFuelCost(fuelUsed, fuelPrice);
  return revenue - fuelCost - (safeNum(maintCostShare));
};

// kept for backward-compat with existing callers
export const calcJobProfit = calcJobNetProfit;

// ─── Payment helpers ──────────────────────────────────────────────────────────

/**
 * amountPaid is stored; remainingAmount is always derived — never stored.
 */
export const calcRemainingAmount = (revenue, amountPaid) =>
  Math.max(0, revenue - (safeNum(amountPaid)));

/**
 * Builds a jobId → total-paid Map in a single O(payments) pass. Used by
 * getJobPaidAmount/aggregateJobs below to avoid re-filtering the full
 * `payments` array once per job (previously O(jobs × payments)).
 */
const buildPaidAmountsByJobId = (payments = []) => {
  const map = new Map();
  for (const p of payments) {
    if (!p || !p.jobId) continue;
    map.set(p.jobId, (map.get(p.jobId) || 0) + safeNum(p.amount));
  }
  return map;
};

/**
 * Single source of truth for "how much has this job been paid so far".
 * The `payments` collection (individual instalments, each with its own date
 * and notes) is the real record. If a job already has payment instalments,
 * we sum those. Older jobs created before the payments system existed don't
 * have any instalment docs, so we fall back to the legacy `job.amountPaid`
 * field for them. Once a job has at least one instalment, that job's
 * `amountPaid` field is no longer read — everything flows through `payments`.
 *
 * `payments` normally accepts the raw payments array (as before, for any
 * single/one-off lookup). Callers that need this for every job in a list
 * (e.g. aggregateJobs) may instead pass a pre-built Map from
 * buildPaidAmountsByJobId so the full array isn't re-filtered per job.
 */
export const getJobPaidAmount = (job, payments = []) => {
  const paidByJobId = payments instanceof Map ? payments : buildPaidAmountsByJobId(payments);
  const total = paidByJobId.get(job.id);
  return total !== undefined ? total : safeNum(job.amountPaid); // legacy fallback
};

export const derivePaymentStatus = (revenue, amountPaid) => {
  const paid = safeNum(amountPaid);
  if (paid <= 0)           return "unpaid";
  if (paid >= revenue)     return "paid";
  return "partial";
};

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregate stats for a list of raw jobs (from Firestore, no enrichment yet).
 * Returns totals used by dashboard, reports, and hooks.
 */
export const aggregateJobs = (jobs, fuelPrice, payments = []) => {
  const totalRevenue  = jobs.reduce((s, j) => s + calcRevenue(j.acres, j.pricePerAcre), 0);
  const totalAcres    = jobs.reduce((s, j) => s + (safeNum(j.acres)), 0);
  const totalFuel     = jobs.reduce((s, j) => s + (safeNum(j.fuelUsed)), 0);
  const totalFuelCost = jobs.reduce(
    (s, j) => s + calcFuelCost(j.fuelUsed, getJobFuelPrice(j, fuelPrice)), 0
  );
  const netProfit     = totalRevenue - totalFuelCost;

  // Payment aggregates — derived from the payments collection (see
  // getJobPaidAmount). The jobId→paid Map is built once here (O(payments))
  // and reused for every job below, instead of each job re-filtering the
  // full payments array (previously O(jobs × payments)).
  const paidByJobId    = buildPaidAmountsByJobId(payments);
  const totalPaid      = jobs.reduce((s, j) => s + getJobPaidAmount(j, paidByJobId), 0);
  const totalRemaining = jobs.reduce((s, j) => {
    const rev = calcRevenue(j.acres, j.pricePerAcre);
    return s + calcRemainingAmount(rev, getJobPaidAmount(j, paidByJobId));
  }, 0);

  return { totalRevenue, totalAcres, totalFuel, totalFuelCost, netProfit, totalPaid, totalRemaining };
};

/**
 * Build per-equipment report: jobs + maintenance costs → full P&L.
 */
export const buildEquipmentReport = (equipment, jobs, maintenance, fuelPrice, payments = [], equipmentFuelEntries = []) =>
  equipment.map((eq) => {
    const eqJobs  = jobs.filter((j) => j.equipmentId === eq.id);
    const eqMaint = maintenance.filter((m) => m.equipmentId === eq.id);
    const eqFuelEntries = equipmentFuelEntries.filter((entry) => entry.equipmentId === eq.id);
    const stats      = aggregateJobs(eqJobs, fuelPrice, payments);
    const manualFuel = eqFuelEntries.reduce((s, entry) => s + safeNum(entry.liters), 0);
    const manualFuelCost = eqFuelEntries.reduce(
      (s, entry) => s + safeNum(entry.liters) * safeNum(entry.pricePerLiter), 0
    );
    stats.totalFuel += manualFuel;
    stats.totalFuelCost += manualFuelCost;
    stats.netProfit -= manualFuelCost;
    const maintCost  = eqMaint.reduce((s, m) => s + (safeNum(m.cost)), 0);
    const netProfit  = stats.netProfit - maintCost;
    const margin     = stats.totalRevenue > 0 ? (netProfit / stats.totalRevenue) * 100 : 0;
    return { ...eq, ...stats, maintCost, netProfit, margin, ops: eqJobs.length };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

/**
 * Build per-driver report.
 */
export const buildDriverReport = (drivers, jobs, fuelPrice, payments = []) =>
  drivers.map((drv) => {
    const drvJobs = jobs.filter((j) => j.driverId === drv.id);
    const stats   = aggregateJobs(drvJobs, fuelPrice, payments);
    return { ...drv, ...stats, ops: drvJobs.length };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

/**
 * Build daily revenue array for the last N days (chart data).
 */
export const buildDailyRevenue = (jobs, days = 7) => {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const revenue = jobs
      .filter((j) => j.date === iso)
      .reduce((s, j) => s + calcRevenue(j.acres, j.pricePerAcre), 0);
    result.push({ date: iso, revenue });
  }
  return result;
};

/**
 * Group jobs by work type, summing acres (pie chart data).
 */
export const groupByWorkType = (jobs) => {
  const map = {};
  jobs.forEach((j) => { map[j.workType] = (map[j.workType] || 0) + (safeNum(j.acres)); });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};

// ─── Client / Debt helpers ────────────────────────────────────────────────────

/**
 * Aggregate all jobs for a single client name.
 * Returns the client's full financial summary.
 */
export const buildClientSummary = (clientName, jobs, fuelPrice, payments = []) => {
  const clientJobs = jobs.filter((j) => j.client === clientName);
  const stats      = aggregateJobs(clientJobs, fuelPrice, payments);
  return {
    client:        clientName,
    jobs:          clientJobs,
    ops:           clientJobs.length,
    totalRevenue:  stats.totalRevenue,
    totalPaid:     stats.totalPaid,
    totalRemaining: stats.totalRemaining,
    totalAcres:    stats.totalAcres,
  };
};

/**
 * Build the full client list from jobs, sorted by debt (descending).
 */
export const buildClientList = (jobs, fuelPrice, payments = []) => {
  const names = [...new Set(jobs.map((j) => j.client).filter(Boolean))];
  return names
    .map((name) => buildClientSummary(name, jobs, fuelPrice, payments))
    .sort((a, b) => b.totalRemaining - a.totalRemaining);
};

// ─── Supplier / Payable helpers ────────────────────────────────────────────
//
// Mirror image of the "Client / Debt" section above, but flipped: here the
// business is the one who OWES money to a supplier/contractor who did work
// for it (jobs/clients = money owed TO the business).
//
// Same single-source-of-truth rule as jobs/payments applies: a supplier
// invoice's "amount" is the total owed, and how much of it has been paid is
// NEVER stored on the invoice itself — it's always derived by summing
// `supplierPayments` for that invoice (see buildPaidAmountsByInvoiceId /
// getInvoicePaidAmount below). Storing a second "amountPaid" field would
// reintroduce the exact split-source-of-truth bug that paymentUtils.js
// warns about for jobs.

/**
 * Builds a supplierInvoiceId → total-paid Map in a single O(supplierPayments)
 * pass, same technique as buildPaidAmountsByJobId above.
 */
const buildPaidAmountsByInvoiceId = (supplierPayments = []) => {
  const map = new Map();
  for (const p of supplierPayments) {
    if (!p || !p.supplierInvoiceId) continue;
    map.set(p.supplierInvoiceId, (map.get(p.supplierInvoiceId) || 0) + safeNum(p.amount));
  }
  return map;
};

/**
 * Single source of truth for "how much of this supplier invoice have we
 * actually paid so far". `supplierPayments` may be the raw array or a
 * pre-built Map (see buildPaidAmountsByInvoiceId) for batch use.
 */
export const getInvoicePaidAmount = (invoice, supplierPayments = []) => {
  const paidByInvoiceId = supplierPayments instanceof Map
    ? supplierPayments
    : buildPaidAmountsByInvoiceId(supplierPayments);
  return paidByInvoiceId.get(invoice.id) || 0;
};

/**
 * How much is still owed on a single supplier invoice. Same shape as
 * calcRemainingAmount(revenue, amountPaid) for jobs.
 */
export const calcSupplierRemaining = (invoiceAmount, amountPaid) =>
  Math.max(0, safeNum(invoiceAmount) - safeNum(amountPaid));

/**
 * Aggregate stats across ALL supplier invoices.
 * - totalPaidOut: cash actually handed to suppliers so far — this is what
 *   the dashboard deducts from net profit (cash basis: money that left
 *   your pocket), so it grows as you pay invoices down.
 * - totalPayable: what's still owed (unpaid remainder) — a separate "debt
 *   you owe" figure shown on its own (see netPosition in DashboardPage.jsx
 *   and "باقي عليك" in SuppliersPage.jsx). It must never be subtracted from
 *   net profit itself — that would mean paying a supplier *raises* your
 *   displayed profit, which is backwards.
 */
export const aggregateSupplierInvoices = (supplierInvoices = [], supplierPayments = []) => {
  const paidByInvoiceId = buildPaidAmountsByInvoiceId(supplierPayments);
  const totalInvoiced = supplierInvoices.reduce((s, inv) => s + safeNum(inv.amount), 0);
  const totalPaidOut  = supplierInvoices.reduce(
    (s, inv) => s + getInvoicePaidAmount(inv, paidByInvoiceId), 0
  );
  const totalPayable  = supplierInvoices.reduce((s, inv) => {
    const paid = getInvoicePaidAmount(inv, paidByInvoiceId);
    return s + calcSupplierRemaining(inv.amount, paid);
  }, 0);
  return { totalInvoiced, totalPaidOut, totalPayable };
};

/**
 * Single source of truth for "صافي الربح", used identically by the
 * dashboard, the Reports page, and the monthly/all-time PDF — so the same
 * period always shows the same number everywhere. Cash-basis on the
 * supplier side (totalSupplierPaidOut, not totalPayable — see
 * aggregateSupplierInvoices above for why).
 */
export const calcNetProfit = ({
  totalRevenue = 0,
  totalFuelCost = 0,
  totalMaintCost = 0,
  totalSalariesPaid = 0,
  totalTaxDeductions = 0,
  totalSupplierPaidOut = 0,
} = {}) =>
  totalRevenue - totalFuelCost - totalMaintCost - totalSalariesPaid - totalTaxDeductions - totalSupplierPaidOut;

/**
 * Percentage change from `previous` to `current`. Returns null when there's
 * no baseline to compare against (previous === 0) — showing "+∞%" or a bare
 * "0%" in that case would be misleading, so callers should hide the change
 * indicator entirely rather than render a null result.
 */
export const calcPercentChange = (current, previous) => {
  const c = safeNum(current);
  const p = safeNum(previous);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
};

// ─── Payment instalments ──────────────────────────────────────────────────────

/**
 * Sum all payments made for a specific job.
 */
export const calcTotalPaidForJob = (payments, jobId) =>
  payments
    .filter((p) => p.jobId === jobId)
    .reduce((s, p) => s + (safeNum(p.amount)), 0);

/**
 * Derive payment status from payments list (not stored amountPaid).
 */
export const derivePaymentStatusFromPayments = (revenue, payments, jobId) => {
  const paid = calcTotalPaidForJob(payments, jobId);
  return {
    paid,
    remaining: Math.max(0, revenue - paid),
    status: derivePaymentStatus(revenue, paid),
  };
};

// ─── Notifications ────────────────────────────────────────────────────────────


/**
 * Check clients with overdue debt (jobs older than X days unpaid).
 */
export const checkOverdueDebts = (jobs, fuelPrice, overdueDays = 30, payments = []) => {
  const today = new Date();
  return jobs
    .filter((j) => {
      const revenue   = calcRevenue(j.acres, j.pricePerAcre);
      const remaining = calcRemainingAmount(revenue, getJobPaidAmount(j, payments));
      if (remaining <= 0) return false;
      const jobDate  = new Date(j.date);
      const daysDiff = Math.floor((today - jobDate) / 86400000);
      return daysDiff >= overdueDays;
    })
    .map((j) => {
      const revenue   = calcRevenue(j.acres, j.pricePerAcre);
      const remaining = calcRemainingAmount(revenue, getJobPaidAmount(j, payments));
      const daysDiff  = Math.floor((today - new Date(j.date)) / 86400000);
      return { job: j, remaining, daysDiff };
    })
    .sort((a, b) => b.remaining - a.remaining);
};
