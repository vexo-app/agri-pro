// scripts/integrityScanReadOnly.mjs
// READ-ONLY integrity scan + financial fingerprint for an AgriPro JSON export.
// - Input: the JSON file downloaded from the app (الإعدادات → تصدير نسخة محلية).
// - Never connects to Firebase, never writes anything. Output = stdout only.
// - Uses the app's REAL calculation functions (src/utils/*.js) unchanged.
// Usage:  node scripts/integrityScanReadOnly.mjs <export.json> [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (rel, patch = (s) => s) =>
  import("data:text/javascript;base64," +
    Buffer.from(patch(fs.readFileSync(path.join(root, rel), "utf8"))).toString("base64"));

const calc = await load("src/utils/calculations.js");
const sal = await load("src/utils/salaryCalculations.js", (s) => s.replace(
  /import\s*\{[^}]*\}\s*from\s*["']\.\.\/config\/constants["'];?/,
  'const SALARY_ENTRY_TYPES={BASE:"base",BONUS:"bonus",DEDUCTION:"deduction"};const DRIVER_STATUS={INACTIVE:"inactive"};'
));

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/integrityScanReadOnly.mjs <export.json> [--json]"); process.exit(2); }
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const d = raw.data ?? raw;
const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
const jobs = arr("jobs"), payments = arr("payments"), equipment = arr("equipment"), drivers = arr("drivers");
const maintenance = arr("maintenance"), fuelEntries = arr("equipmentFuelEntries");
const invoices = arr("supplierInvoices"), supPays = arr("supplierPayments");
const salaryEntries = arr("salaryEntries"), attendance = arr("attendance");
const custody = arr("custodyTransactions").length ? arr("custodyTransactions") : arr("custody");
const taxes = arr("taxDeductions");
const fuelPrice = d.settings?.fuelPrice;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const ids = (xs) => xs.map((x) => x.id ?? "(no-id)");
const findings = {};
const add = (key, items, extra) => { findings[key] = { count: items.length, ids: ids(items).slice(0, 20), ...(extra || {}) }; };

// ── Payments per job / invoice
const payByJob = new Map(); payments.forEach((p) => { if (p?.jobId) payByJob.set(p.jobId, [...(payByJob.get(p.jobId) || []), p]); });
const payByInv = new Map(); supPays.forEach((p) => { if (p?.supplierInvoiceId) payByInv.set(p.supplierInvoiceId, [...(payByInv.get(p.supplierInvoiceId) || []), p]); });

// 1. legacy amountPaid + instalments (FIN-2) — since Step 1 these are
// counted additively (legacy + instalments); listed here for manual review.
// sameAmountInstalment = an instalment equals the legacy amount (review for
// possible double entry; not proof of one).
const legacyRows = calc.findLegacyPaidWithPayments(jobs, payments);
add("FIN2_legacyAmountPaidWithPayments", legacyRows.map((r) => ({ id: r.jobId })), {
  legacyTotalNowCounted: legacyRows.reduce((s, r) => s + r.legacyAmountPaid, 0),
});
add("FIN2_reviewSameAmountInstalment", legacyRows.filter((r) => r.sameAmountInstalment).map((r) => ({ id: r.jobId })));
add("legacyAmountPaidOnly_info", jobs.filter((j) => num(j.amountPaid) > 0 && !payByJob.has(j.id)));

// 2/3. overpayments (FIN-4) — same central functions the app uses
const jobOver = calc.aggregateJobOverpayments(jobs, payments);
add("FIN4_clientOverpaidJobs", jobOver.items, { excessTotal: jobOver.totalOverpaid });
const supOver = calc.aggregateSupplierOverpayments(invoices, supPays);
add("FIN4_supplierOverpaidInvoices", supOver.items, { excessTotal: supOver.totalOverpaid });

// 4. partial but remaining < 0.01 (FIN-1)
add("FIN1_partialWithTinyRemaining", jobs.filter((j) => {
  const rev = calc.calcRevenue(j.acres, j.pricePerAcre);
  const paid = calc.getJobPaidAmount(j, payments);
  return calc.derivePaymentStatus(rev, paid) === "partial" && calc.calcRemainingAmount(rev, paid) < 0.01;
}));
add("FIN1_invoicesTinyRemaining", invoices.filter((i) => {
  const r = calc.calcSupplierRemaining(i.amount, calc.getInvoicePaidAmount(i, supPays));
  return r > 0 && r < 0.01;
}));

// 5. stuck deleting flags (any collection)
const deletingAll = Object.entries(d).flatMap(([k, v]) => (Array.isArray(v) ? v.filter((x) => x?.deleting === true).map((x) => ({ id: `${k}/${x.id}` })) : []));
add("stuckDeletingFlags", deletingAll);

// 6. orphans
const has = (list) => { const s = new Set(list.map((x) => x.id)); return (id) => s.has(id); };
const eqOk = has(equipment), drOk = has(drivers), jobOk = has(jobs), invOk = has(invoices);
const ref = (id) => id !== undefined && id !== null && id !== "";
add("orphan_paymentsNoJob", payments.filter((p) => !jobOk(p.jobId)), {
  amountTotal: payments.filter((p) => !jobOk(p.jobId)).reduce((s, p) => s + num(p.amount), 0),
});
add("orphan_supplierPaymentsNoInvoice", supPays.filter((p) => !invOk(p.supplierInvoiceId)));
add("orphan_jobsBadEquipment", jobs.filter((j) => !ref(j.equipmentId) || !eqOk(j.equipmentId)));
add("orphan_jobsBadDriver", jobs.filter((j) => ref(j.driverId) && !drOk(j.driverId)));
add("orphan_maintenanceBadEquipment", maintenance.filter((m) => ref(m.equipmentId) && !eqOk(m.equipmentId)));
add("orphan_fuelEntriesBadEquipment", fuelEntries.filter((f) => !eqOk(f.equipmentId)));
add("orphan_salaryBadDriver", salaryEntries.filter((e) => !drOk(e.driverId)));
add("orphan_attendanceBadDriver", attendance.filter((a) => !drOk(a.driverId)));
add("orphan_custodyBadRef", custody.filter((c) => (ref(c.driverId) && !drOk(c.driverId)) || (ref(c.equipmentId) && !eqOk(c.equipmentId))));
add("orphan_equipmentBadDriverOrParent", equipment.filter((e) => (ref(e.driverId) && !drOk(e.driverId)) || (ref(e.parentEquipmentId) && !eqOk(e.parentEquipmentId))));

// 7. other financial inconsistencies
const bad = (v) => !(Number.isFinite(Number(v)) && Number(v) >= 0);
add("jobs_invalidNumbersOrDate", jobs.filter((j) => bad(j.acres) || bad(j.pricePerAcre) || bad(j.fuelUsed ?? 0) || !/^\d{4}-\d{2}-\d{2}$/.test(j.date || "")));
add("jobs_missingFuelPriceAtJob", jobs.filter((j) => j.fuelPriceAtJob === undefined || j.fuelPriceAtJob === null));
const badAmt = (x) => !(Number.isFinite(Number(x.amount)) && Number(x.amount) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || "");
add("payments_invalidAmountOrDate", payments.filter(badAmt));
add("supplierPayments_invalidAmountOrDate", supPays.filter(badAmt));
add("supplierInvoices_invalidAmount", invoices.filter((i) => !(Number(i.amount) > 0)));
const dupKey = (p, fk) => `${p[fk]}|${num(p.amount)}|${p.date}`;
const dups = (list, fk) => { const m = new Map(); list.forEach((p) => m.set(dupKey(p, fk), [...(m.get(dupKey(p, fk)) || []), p])); return [...m.values()].filter((g) => g.length > 1).flat(); };
add("possibleDuplicatePayments", dups(payments, "jobId"));
add("possibleDuplicateSupplierPayments", dups(supPays, "supplierInvoiceId"));
const byTrim = new Map(); jobs.forEach((j) => { if (!j.client) return; const k = String(j.client).trim().replace(/\s+/g, " "); byTrim.set(k, new Set([...(byTrim.get(k) || []), j.client])); });
const splitClients = [...byTrim.entries()].filter(([, s]) => s.size > 1).map(([k, s]) => ({ id: `${k} ⇐ ${[...s].map((x) => JSON.stringify(x)).join(" / ")}` }));
add("clientNamesSplitByWhitespace", splitClients);
const negMonths = [];
new Set(salaryEntries.map((e) => `${e.driverId}|${(e.date || "").slice(0, 7)}`)).forEach((k) => {
  const [drv, ym] = k.split("|");
  const dr = drivers.find((x) => x.id === drv);
  const r = sal.calcMonthlySalary(sal.getMonthEntries(salaryEntries, drv, ym), sal.getSalaryForMonth(dr, ym));
  if (r.net < 0) negMonths.push({ id: `${drv}@${ym} net=${r.net}` });
});
add("salaryMonthsNegativeNet", negMonths);

// ── Financial fingerprint (compare before/after restore — same inputs as the app)
const jt = calc.aggregateJobs(jobs, fuelPrice, payments);
const mf = calc.aggregateEquipmentFuelEntries(fuelEntries, equipment);
const st = calc.aggregateSupplierInvoices(invoices, supPays);
const maint = maintenance.reduce((s, m) => s + num(m.cost), 0);
const salEntriesOnly = sal.calcTotalSalariesPaid(salaryEntries, drivers);
const tax = taxes.reduce((s, t) => s + num(t.amount), 0);
const dep = custody.filter((c) => c.type === "deposit").reduce((s, c) => s + num(c.amount), 0);
const exp = custody.filter((c) => c.type === "expense").reduce((s, c) => s + num(c.amount), 0);
const r2 = (x) => Math.round(x * 100) / 100;
const fingerprint = {
  counts: Object.fromEntries(Object.entries(d).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])),
  revenue: r2(jt.totalRevenue), paid: r2(jt.totalPaid), remaining_customerDebts: r2(jt.totalRemaining),
  fuelCost: r2(jt.totalFuelCost + mf.totalFuelCost), maintenance: r2(maint),
  salaries_entriesOnly: r2(salEntriesOnly), taxDeductions: r2(tax),
  supplierInvoiced: r2(st.totalInvoiced), supplierPaidOut: r2(st.totalPaidOut), supplierPayables: r2(st.totalPayable),
  netProfit_entriesOnlySalaries: r2(calc.calcNetProfit({
    totalRevenue: jt.totalRevenue, totalFuelCost: jt.totalFuelCost + mf.totalFuelCost, totalMaintCost: maint,
    totalSalariesPaid: salEntriesOnly, totalTaxDeductions: tax, totalSupplierPaidOut: st.totalPaidOut,
  })),
  custodyBalance: r2(dep - exp), fuelPriceSetting: fuelPrice ?? null,
};

const out = { file: path.basename(file), exportedAt: raw.exportedAt ?? null, version: raw.version ?? null, findings, fingerprint };
if (process.argv.includes("--json")) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`AgriPro READ-ONLY integrity scan — ${out.file} (exportedAt ${out.exportedAt})`);
for (const [k, v] of Object.entries(findings)) {
  const extra = Object.entries(v).filter(([x]) => x !== "count" && x !== "ids").map(([x, y]) => `${x}=${r2(y)}`).join(" ");
  console.log(`${v.count ? "⚠" : "✓"} ${k}: ${v.count}${extra ? " (" + extra + ")" : ""}${v.count ? "  ids: " + v.ids.join(", ") + (v.count > 20 ? " …" : "") : ""}`);
}
console.log("\nFINGERPRINT (compare before/after restore):");
console.log(JSON.stringify(fingerprint, null, 2));
