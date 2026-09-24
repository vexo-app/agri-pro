// src/utils/calculations.js

// تحويل آمن لأي قيمة لرقم صالح للحسابات المالية. زي Number(x)||0 بالظبط
// (بيرجع 0 لأي قيمة فاسدة: undefined/null/نص عشوائي/NaN)، لكن كمان بيمنع
// Infinity/-Infinity من التسرب لحسابات الإيراد/الربح (لو حقل اتلخبط بقيمة
// غير محدودة، هيتحول لـ 0 بدل ما يفسد كل التجميعات اللي بعده).
const safeNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ─── Money precision (audit FIN-1) ───────────────────────────────────────────
// الجنيه بيتحسب لأقرب قرش (0.01). ضرب زي 1.1 × 100 في JavaScript بيطلع
// 110.00000000000001 مش 110، فعملية اتدفعت بالكامل كانت بتفضل "جزئي"
// بباقي 0.00000000000001. التقريب ده بيتطبق بس في مقارنات السداد والمتبقي
// (مش على الإيراد أو المجاميع المعروضة)، فمعنى أي رقم ما بيتغيرش.
export const roundMoney = (value) => {
  const n = safeNum(value);
  return Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
};

/** المبلغ المدفوع الزيادة عن الإجمالي (audit FIN-4) — 0 لو مفيش زيادة. */
export const calcOverpaidAmount = (total, paid) =>
  Math.max(0, roundMoney(safeNum(paid) - safeNum(total)));

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
  Math.max(0, roundMoney(safeNum(revenue) - safeNum(amountPaid)));

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
 * audit FIN-2: `job.amountPaid` القديم (قبل نظام الدفعات) بيتجمع مع الدفعات
 * بدل ما يتجاهل أول ما تتسجل أول دفعة. مراجعة تاريخ git الكامل (من أول
 * commit 2026-03-24) أثبتت إن مفيش أي مسار في الكود كتب دفعة في `payments`
 * بتمثل نفس فلوس `job.amountPaid`: قبل 2026-08-14 الدفع كان بيتسجل في
 * amountPaid بس، وبعدها JobsPage بقت تشيل amountPaid من العملية وتعمل دفعة
 * بداله، وشاشة "تسجيل شغل سريع" في المعدات كانت بتكتب amountPaid بس (من غير
 * دفعة) لحد 2026-09-21. يعني الجمع مفيهوش تكرار. البيانات اللي فيها الاتنين
 * بتظهر في findLegacyPaidWithPayments وفي scripts/integrityScanReadOnly.mjs
 * للمراجعة. لو احتجت ترجع للسلوك القديم: خلي الثابت ده false.
 */
export const LEGACY_PAID_IS_ADDITIVE = true;

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
  const legacy = safeNum(job.amountPaid);
  if (total === undefined) return legacy; // legacy-only job
  return LEGACY_PAID_IS_ADDITIVE ? legacy + total : total;
};

/**
 * audit FIN-2 (detection، read-only): العمليات اللي فيها amountPaid قديم
 * ومعاها دفعات. `sameAmountInstalment` = فيه دفعة بنفس قيمة المبلغ القديم
 * بالظبط — مش دليل تكرار (ممكن تكون دفعة تانية بنفس القيمة)، بس تستاهل
 * مراجعة يدوية.
 */
export const findLegacyPaidWithPayments = (jobs = [], payments = []) => {
  const byJob = new Map();
  for (const p of payments) {
    if (!p || !p.jobId) continue;
    if (!byJob.has(p.jobId)) byJob.set(p.jobId, []);
    byJob.get(p.jobId).push(safeNum(p.amount));
  }
  return jobs
    .filter((j) => safeNum(j.amountPaid) > 0 && byJob.has(j.id))
    .map((j) => {
      const legacy = safeNum(j.amountPaid);
      const amounts = byJob.get(j.id);
      return {
        jobId: j.id,
        legacyAmountPaid: legacy,
        instalmentsTotal: amounts.reduce((s, a) => s + a, 0),
        sameAmountInstalment: amounts.some((a) => roundMoney(a) === roundMoney(legacy)),
      };
    });
};

export const derivePaymentStatus = (revenue, amountPaid) => {
  const paid = roundMoney(amountPaid);
  if (paid <= 0)                  return "unpaid";
  if (paid >= roundMoney(revenue)) return "paid";
  return "partial";
};

/**
 * Step 2: مصدر واحد لكل الأرقام المشتقة لعملية واحدة (كانت متكررة حرفيًا
 * في useJobs/useClients/useEquipmentDetail/DashboardPage/صفحات الضيف).
 * `payments` = مصفوفة الدفعات أو Map جاهز من buildPaidAmountsByJobId.
 */
export const enrichJob = (job, fallbackFuelPrice, payments = []) => {
  const revenue         = calcRevenue(job.acres, job.pricePerAcre);
  const fuelCost        = calcFuelCost(job.fuelUsed, getJobFuelPrice(job, fallbackFuelPrice));
  const profit          = revenue - fuelCost;
  const amountPaid      = getJobPaidAmount(job, payments);
  const remainingAmount = calcRemainingAmount(revenue, amountPaid);
  const paymentStatus   = derivePaymentStatus(revenue, amountPaid);
  return { ...job, revenue, fuelCost, profit, amountPaid, remainingAmount, paymentStatus };
};

/** Pre-builds the jobId → paid Map once, for callers enriching many jobs. */
export const indexPaymentsByJob = (payments = []) =>
  payments instanceof Map ? payments : buildPaidAmountsByJobId(payments);

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

/** Totals for manually recorded fuel, excluding attachments. */
export const aggregateEquipmentFuelEntries = (entries = [], equipment = []) => {
  const attachmentIds = new Set(
    equipment.filter((eq) => eq.category === "attachment").map((eq) => eq.id)
  );
  return entries.reduce((totals, entry) => {
    if (attachmentIds.has(entry.equipmentId)) return totals;
    const liters = safeNum(entry.liters);
    totals.totalFuel += liters;
    totals.totalFuelCost += liters * safeNum(entry.pricePerLiter);
    return totals;
  }, { totalFuel: 0, totalFuelCost: 0 });
};

/**
 * Build per-equipment report: jobs + maintenance costs → full P&L.
 */
export const buildEquipmentReport = (equipment, jobs, maintenance, fuelPrice, payments = [], equipmentFuelEntries = []) =>
  equipment.map((eq) => {
    const eqJobs  = jobs.filter((j) => j.equipmentId === eq.id);
    const eqMaint = maintenance.filter((m) => m.equipmentId === eq.id);
    const eqFuelEntries = eq.category === "attachment"
      ? []
      : equipmentFuelEntries.filter((entry) => entry.equipmentId === eq.id);
    const stats      = aggregateJobs(eqJobs, fuelPrice, payments);
    const manualFuel = aggregateEquipmentFuelEntries(eqFuelEntries, [eq]);
    stats.totalFuel += manualFuel.totalFuel;
    stats.totalFuelCost += manualFuel.totalFuelCost;
    stats.netProfit -= manualFuel.totalFuelCost;
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
 * Step 2 (اسم العميل): `job.client` نص حر، فـ"أحمد" و"أحمد " و"أحمد  علي"
 * كانوا بيتحسبوا عملاء مختلفين ودين العميل بيتقسم. التجميع والمطابقة بقوا
 * على الاسم بعد trim + توحيد المسافات. البيانات المخزنة ما بتتغيرش؛
 * `aliases` = كل الكتابات الأصلية الموجودة للعميل (مهمة لفلتر الضيف في
 * firestore.rules اللي بيطابق النص الأصلي بالحرف).
 */
export const normalizeClientName = (name) =>
  String(name ?? "").trim().replace(/\s+/g, " ");

const summarizeClientJobs = (clientName, clientJobs, fuelPrice, paidByJobId) => {
  const summary = {
    client: clientName, aliases: [], jobs: [], ops: clientJobs.length,
    totalRevenue: 0, totalPaid: 0, totalRemaining: 0, totalAcres: 0,
  };
  const aliases = new Set();
  clientJobs.forEach((job) => {
    const e = enrichJob(job, fuelPrice, paidByJobId);
    aliases.add(job.client);
    summary.totalRevenue   += e.revenue;
    summary.totalPaid      += e.amountPaid;
    summary.totalRemaining += e.remainingAmount;
    summary.totalAcres     += safeNum(job.acres);
    summary.jobs.push(e);
  });
  summary.aliases = [...aliases];
  summary.jobs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return summary;
};

/**
 * Aggregate all jobs for a single client (matched by normalized name).
 * `jobs` in the result are enriched (revenue/amountPaid/remainingAmount/...).
 */
export const buildClientSummary = (clientName, jobs, fuelPrice, payments = []) => {
  const key = normalizeClientName(clientName);
  const clientJobs = jobs.filter((j) => normalizeClientName(j.client) === key);
  return summarizeClientJobs(key, clientJobs, fuelPrice, indexPaymentsByJob(payments));
};

/**
 * Build the full client list from jobs (one pass, grouped by normalized
 * name), sorted by debt (descending).
 */
export const buildClientList = (jobs, fuelPrice, payments = []) => {
  const paidByJobId = indexPaymentsByJob(payments);
  const groups = new Map();
  jobs.forEach((j) => {
    const key = normalizeClientName(j.client);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  });
  return [...groups.entries()]
    .map(([key, clientJobs]) => summarizeClientJobs(key, clientJobs, fuelPrice, paidByJobId))
    .sort((a, b) => b.totalRemaining - a.totalRemaining);
};

/** العمليات المرتبطة بمعدة مش موجودة (بيانات يتيمة) — للعرض والتنبيه بس. */
export const findJobsWithMissingEquipment = (jobs = [], equipment = []) => {
  const ids = new Set(equipment.map((e) => e.id));
  return jobs.filter((j) => !ids.has(j.equipmentId));
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
  Math.max(0, roundMoney(safeNum(invoiceAmount) - safeNum(amountPaid)));

/**
 * audit FIN-4: إجمالي المدفوع الزيادة (العملاء على العمليات، أو إحنا
 * للموردين على الفواتير) — للعرض والتنبيه بس، مش بيدخل في أي معادلة ربح.
 */
export const aggregateJobOverpayments = (jobs = [], payments = []) => {
  const paidByJobId = buildPaidAmountsByJobId(payments);
  const items = jobs
    .map((j) => ({
      id: j.id,
      overpaid: calcOverpaidAmount(calcRevenue(j.acres, j.pricePerAcre), getJobPaidAmount(j, paidByJobId)),
    }))
    .filter((x) => x.overpaid > 0);
  return { totalOverpaid: items.reduce((s, x) => s + x.overpaid, 0), items };
};

export const aggregateSupplierOverpayments = (supplierInvoices = [], supplierPayments = []) => {
  const paidByInvoiceId = buildPaidAmountsByInvoiceId(supplierPayments);
  const items = supplierInvoices
    .map((inv) => ({
      id: inv.id,
      overpaid: calcOverpaidAmount(inv.amount, getInvoicePaidAmount(inv, paidByInvoiceId)),
    }))
    .filter((x) => x.overpaid > 0);
  return { totalOverpaid: items.reduce((s, x) => s + x.overpaid, 0), items };
};

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
 * Step 2: ملخص مورد واحد وقائمة الموردين — كانت محسوبة جوه useSuppliers.
 * التجميع بالاسم الأصلي بالحرف (زي قبل كده) لأن renameSupplier بيطابقه.
 */
const summarizeSupplierInvoices = (supplierName, invoices, paidByInvoiceId) => {
  const summary = { supplierName, ops: invoices.length, invoices: [], totalInvoiced: 0, totalPaidOut: 0, totalPayable: 0 };
  invoices.forEach((inv) => {
    const paid      = getInvoicePaidAmount(inv, paidByInvoiceId);
    const remaining = calcSupplierRemaining(inv.amount, paid);
    summary.totalInvoiced += safeNum(inv.amount);
    summary.totalPaidOut  += paid;
    summary.totalPayable  += remaining;
    summary.invoices.push({ ...inv, amountPaid: paid, remainingAmount: remaining });
  });
  return summary;
};

export const buildSupplierSummary = (supplierName, supplierInvoices = [], supplierPayments = []) =>
  summarizeSupplierInvoices(
    supplierName,
    supplierInvoices.filter((inv) => inv.supplierName === supplierName),
    buildPaidAmountsByInvoiceId(supplierPayments)
  );

export const buildSupplierList = (supplierInvoices = [], supplierPayments = []) => {
  const paidByInvoiceId = buildPaidAmountsByInvoiceId(supplierPayments);
  const groups = new Map();
  supplierInvoices.forEach((inv) => {
    if (!inv.supplierName) return;
    if (!groups.has(inv.supplierName)) groups.set(inv.supplierName, []);
    groups.get(inv.supplierName).push(inv);
  });
  return [...groups.entries()]
    .map(([name, invs]) => summarizeSupplierInvoices(name, invs, paidByInvoiceId))
    .sort((a, b) => b.totalPayable - a.totalPayable);
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

// (Step 2) calcTotalPaidForJob / derivePaymentStatusFromPayments اتشالوا:
// ما كانوش مستخدمين، وكانوا بيحسبوا "المدفوع" من غير amountPaid القديم —
// يعني معادلة موازية مختلفة عن getJobPaidAmount.

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
