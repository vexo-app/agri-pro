// src/utils/financialSummary.js
//
// Step 2 — مصدر واحد لـ"الملخص المالي لفترة" (كل الوقت أو شهر محدد).
// قبل كده نفس الأرقام كانت بتتحسب في 4 أماكن بطرق مختلفة شوية:
// useDashboard (كل الوقت + المقارنة الشهرية)، ReportsPage (من تقرير
// المعدات، فالعمليات المرتبطة بمعدة محذوفة كانت بتسقط)، وPDF الملخص الشهري.
// المعادلات نفسها ما اتغيرتش: نفس calcNetProfit ونفس تعريف الرواتب والموردين.
import {
  aggregateJobs,
  aggregateEquipmentFuelEntries,
  aggregateSupplierInvoices,
  calcNetProfit,
} from "./calculations";
import { calcSalaryExpense } from "./salaryCalculations";
import { calcTotalTaxDeductions } from "./taxCalculations";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** إجمالي تكلفة الصيانة (نفس Number(cost)||0 اللي كان متكرر في كل صفحة). */
export const calcTotalMaintenanceCost = (maintenance = []) =>
  maintenance.reduce((s, m) => s + num(m?.cost), 0);

/**
 * @param data  { jobs, payments, maintenance, equipmentFuelEntries, equipment,
 *                salaryEntries, drivers, taxDeductions, supplierInvoices,
 *                supplierPayments, fuelPrice }
 * @param opts.monthPrefix  "YYYY-MM" لشهر محدد، أو null = كل الوقت.
 * @param opts.asOfMonth  "YYYY-MM" — آخر شهر بيتحسب فيه الراتب المستحق لما
 *        الفترة "كل الوقت" (الافتراضي: الشهر الحالي).
 *
 * الرواتب: "المستحق الكامل" (calcSalaryExpense) — كل عضو ليه راتب، كل شهر
 * من أول شهر ليه لحد الشهر الحالي، + حوافز − خصومات، سواء اتصرف أو لأ.
 *
 * الموردين: نقدي حسب تاريخ الدفعة (مش تاريخ الفاتورة) — زي ما كان.
 */
export const buildPeriodFinancials = (data, { monthPrefix = null, asOfMonth = null } = {}) => {
  const {
    jobs = [], payments = [], maintenance = [], equipmentFuelEntries = [], equipment = [],
    salaryEntries = [], drivers = [], taxDeductions = [],
    supplierInvoices = [], supplierPayments = [], fuelPrice,
  } = data;
  const inPeriod = monthPrefix
    ? (d) => (d?.date || "").startsWith(monthPrefix)
    : () => true;

  const jobTotals  = aggregateJobs(jobs.filter(inPeriod), fuelPrice, payments);
  const manualFuel = aggregateEquipmentFuelEntries(equipmentFuelEntries.filter(inPeriod), equipment);
  const totalFuel      = jobTotals.totalFuel + manualFuel.totalFuel;
  const totalFuelCost  = jobTotals.totalFuelCost + manualFuel.totalFuelCost;
  const totalMaintCost = calcTotalMaintenanceCost(maintenance.filter(inPeriod));
  const totalSalariesPaid = calcSalaryExpense(salaryEntries, drivers, {
    fromMonth: monthPrefix,
    toMonth: monthPrefix || asOfMonth || monthPrefixOf(new Date()),
  });
  const totalTaxDeductions   = calcTotalTaxDeductions(taxDeductions.filter(inPeriod));
  const totalSupplierPaidOut = aggregateSupplierInvoices(
    supplierInvoices, supplierPayments.filter(inPeriod)
  ).totalPaidOut;

  const netProfit = calcNetProfit({
    totalRevenue: jobTotals.totalRevenue, totalFuelCost, totalMaintCost,
    totalSalariesPaid, totalTaxDeductions, totalSupplierPaidOut,
  });

  return {
    totalRevenue: jobTotals.totalRevenue,
    totalAcres: jobTotals.totalAcres,
    totalPaid: jobTotals.totalPaid,
    totalRemaining: jobTotals.totalRemaining,
    jobsCount: jobs.filter(inPeriod).length,
    totalFuel, totalFuelCost, totalMaintCost,
    totalSalariesPaid, totalTaxDeductions, totalSupplierPaidOut,
    netProfit,
  };
};

export const monthPrefixOf = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
