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
  const totalFuelCost = calcFuelCost(totalFuel, fuelPrice);
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
export const buildEquipmentReport = (equipment, jobs, maintenance, fuelPrice, payments = []) =>
  equipment.map((eq) => {
    const eqJobs  = jobs.filter((j) => j.equipmentId === eq.id);
    const eqMaint = maintenance.filter((m) => m.equipmentId === eq.id);
    const stats      = aggregateJobs(eqJobs, fuelPrice, payments);
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
 * Check which equipment needs maintenance soon.
 * Returns list of { equipment, daysSinceLast, isOverdue }
 */
export const checkMaintenanceDue = (equipment, maintenance, warningDays = 7) => {
  const alerts = [];
  equipment.forEach((eq) => {
    if (!eq.maintenanceIntervalDays) return;
    const lastMaint = maintenance
      .filter((m) => m.equipmentId === eq.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!lastMaint) return;
    const lastDate   = new Date(lastMaint.date);
    const today      = new Date();
    const daysSince  = Math.floor((today - lastDate) / 86400000);
    const daysLeft   = eq.maintenanceIntervalDays - daysSince;
    if (daysLeft <= warningDays) {
      alerts.push({ equipment: eq, daysSince, daysLeft, isOverdue: daysLeft < 0 });
    }
  });
  return alerts;
};

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
