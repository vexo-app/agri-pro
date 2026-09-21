// src/hooks/useDashboard.js
import { useMemo } from "react";
import { useData } from "../contexts/DataContext";
import {
  aggregateJobs,
  aggregateEquipmentFuelEntries,
  buildDailyRevenue,
  groupByWorkType,
  buildEquipmentReport,
  aggregateSupplierInvoices,
  calcNetProfit,
  calcPercentChange,
} from "../utils/calculations";
import { calcTotalSalariesPaid } from "../utils/salaryCalculations";
import { calcTotalTaxDeductions } from "../utils/taxCalculations";

// ─── Month-over-month comparison ───────────────────────────────────────────
// "current month" / "previous month" here mean exactly what ReportsPage's
// monthly PDF download already means for the same labels (full calendar
// month, matched by the "YYYY-MM" prefix on each record's `date`) — so a
// figure never means two different things in two places. Note this is
// month-to-date vs. a full previous month, same tradeoff ReportsPage
// already accepts: early in the month the % swing will look large simply
// because fewer days have posted yet.
const monthPrefixOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * Same six cash-basis figures calcNetProfit/aggregateSupplierInvoices
 * already define as the single source of truth, scoped to one month.
 * Pure function (all data passed in) so it doesn't depend on hook timing.
 */
const buildMonthFinancials = (monthPrefix, {
  jobs, maintenance, salaryEntries, taxDeductions,
  supplierInvoices, supplierPayments, drivers, fuelPrice, payments,
  equipmentFuelEntries, equipment,
}, { assumeSalaryDue = false } = {}) => {
  const inMonth = (d) => (d?.date || "").startsWith(monthPrefix);

  const jobTotals = aggregateJobs(jobs.filter(inMonth), fuelPrice, payments);
  const manualFuel = aggregateEquipmentFuelEntries(equipmentFuelEntries.filter(inMonth), equipment);
  const totalRevenue = jobTotals.totalRevenue;
  const totalAcres = jobTotals.totalAcres;
  const totalFuel = jobTotals.totalFuel + manualFuel.totalFuel;
  const totalFuelCost = jobTotals.totalFuelCost + manualFuel.totalFuelCost;
  const totalMaintCost = maintenance
    .filter(inMonth)
    .reduce((s, m) => s + (Number(m.cost) || 0), 0);
  // assumeSalaryDue بيتفعّل بس لما monthPrefix ده هو الشهر الحالي فعلاً
  // (شوف مكان الاستدعاء تحت) — عشان سائق جديد اتضاف براتب يتحسب فورًا
  // في ملخص الشهر الحالي، من غير ما يأثر على أي شهر سابق.
  const totalSalariesPaid = calcTotalSalariesPaid(
    salaryEntries.filter(inMonth),
    drivers,
    assumeSalaryDue ? { assumeDueForMonth: monthPrefix } : undefined
  );
  const totalTaxDeductions = calcTotalTaxDeductions(taxDeductions.filter(inMonth));
  // Cash basis, scoped by payment date (not invoice date) — same idea as
  // ReportsPage's supplierPaidOutForPeriod.
  const totalSupplierPaidOut = aggregateSupplierInvoices(
    supplierInvoices,
    supplierPayments.filter(inMonth)
  ).totalPaidOut;

  const netProfit = calcNetProfit({
    totalRevenue, totalFuelCost, totalMaintCost,
    totalSalariesPaid, totalTaxDeductions, totalSupplierPaidOut,
  });

  return { totalRevenue, totalFuelCost, totalMaintCost, totalSalariesPaid, totalTaxDeductions, totalSupplierPaidOut, netProfit, totalAcres, totalFuel };
};

export const useDashboard = () => {
  const {
    jobs, equipment, maintenance, equipmentFuelEntries = [], drivers, payments = [],
    supplierInvoices = [], supplierPayments = [],
    settings, salaryEntries = [], taxDeductions = [], loading,
  } = useData();

  const fuelPrice = settings.fuelPrice;

  const totals = useMemo(() => {
    const jobTotals = aggregateJobs(jobs, fuelPrice, payments);
    const manualFuel = aggregateEquipmentFuelEntries(equipmentFuelEntries, equipment);
    return {
      ...jobTotals,
      totalFuel: jobTotals.totalFuel + manualFuel.totalFuel,
      totalFuelCost: jobTotals.totalFuelCost + manualFuel.totalFuelCost,
      netProfit: jobTotals.netProfit - manualFuel.totalFuelCost,
    };
  }, [jobs, fuelPrice, payments, equipmentFuelEntries, equipment]);

  const totalMaintCost = useMemo(
    () => maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0),
    [maintenance]
  );

  // الشهر الحالي بيتحسب بافتراض إن كل سائق نشط وله راتب مستحق عن الشهر
  // ده حتى لو مفيش قيود اتسجّلت له لسه — عشان سائق جديد يظهر في الملخص
  // المالي فورًا لحظة إضافته، مش لما تتسجل عليه أول عملية صرف. الشهور
  // اللي فاتت مش بتتأثر لأن التاريخ الحالي بيتغيّر كل يوم.
  const currentMonthPrefix = monthPrefixOf(new Date());
  const totalSalaries = useMemo(
    () => calcTotalSalariesPaid(salaryEntries, drivers, { assumeDueForMonth: currentMonthPrefix }),
    [salaryEntries, drivers, currentMonthPrefix]
  );

  const totalTaxDeductions = useMemo(
    () => calcTotalTaxDeductions(taxDeductions),
    [taxDeductions]
  );

  // الفاتورة بتدخل في صافي الربح على أساس نقدي (cash basis): اللي بيتخصم
  // هو "الواصل للمورد" فعلاً لحد دلوقتي (totalPaidOut) — يعني الكاش اللي
  // فعلاً خرج من جيبك. لو دفعت نص الفاتورة، نص التكلفة بس اللي بيتخصم من
  // الربح، ولما تكمّل السداد يتخصم الباقي. ده عكس totalPayable (المتبقي
  // غير المدفوع)، واللي معروض لوحده كـ"دين عليك" في تنبيه "مستحقات عليك
  // للموردين" وفي "صافي وضعك المالي" — مينفعش يتخصم من الربح، لأن ده كان
  // معناه إن سداد المورد بيزوّد ربحك الظاهري بدل ما يقلله (باگ سابق).
  const supplierStats = useMemo(
    () => aggregateSupplierInvoices(supplierInvoices, supplierPayments),
    [supplierInvoices, supplierPayments]
  );
  const totalSupplierPaidOut = supplierStats.totalPaidOut;

  const netProfit = calcNetProfit({
    totalRevenue: totals.totalRevenue,
    totalFuelCost: totals.totalFuelCost,
    totalMaintCost,
    totalSalariesPaid: totalSalaries,
    totalTaxDeductions,
    totalSupplierPaidOut,
  });

  const margin = totals.totalRevenue > 0
    ? (netProfit / totals.totalRevenue) * 100
    : 0;

  const dailyRevenue      = useMemo(() => buildDailyRevenue(jobs, 7), [jobs]);
  const workTypeBreakdown = useMemo(() => groupByWorkType(jobs), [jobs]);

  const equipReport = useMemo(
    () => buildEquipmentReport(equipment, jobs, maintenance, fuelPrice, payments, equipmentFuelEntries),
    [equipment, jobs, maintenance, fuelPrice, payments, equipmentFuelEntries]
  );

  const bestEquipment = equipReport[0] ?? null;

  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [jobs]
  );

  const miniRevenue = dailyRevenue.map((d) => d.revenue);

  // "الملخص المالي" row-by-row vs. last month — same six cash-basis figures
  // as netProfit above, just scoped to two months instead of all-time.
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ctx = { jobs, maintenance, salaryEntries, taxDeductions, supplierInvoices, supplierPayments, drivers, fuelPrice, payments, equipmentFuelEntries, equipment };
    const current  = buildMonthFinancials(monthPrefixOf(now), ctx, { assumeSalaryDue: true });
    const previous = buildMonthFinancials(monthPrefixOf(prevMonthDate), ctx);
    const pair = (curr, prev) => ({ current: curr, change: calcPercentChange(curr, prev) });
    return {
      revenue:       pair(current.totalRevenue, previous.totalRevenue),
      fuelCost:      pair(current.totalFuelCost, previous.totalFuelCost),
      maintCost:     pair(current.totalMaintCost, previous.totalMaintCost),
      salaries:      pair(current.totalSalariesPaid, previous.totalSalariesPaid),
      supplierPaid:  pair(current.totalSupplierPaidOut, previous.totalSupplierPaidOut),
      taxDeductions: pair(current.totalTaxDeductions, previous.totalTaxDeductions),
      netProfit:     pair(current.netProfit, previous.netProfit),
      acres:         pair(current.totalAcres, previous.totalAcres),
      fuel:          pair(current.totalFuel, previous.totalFuel),
    };
  }, [jobs, maintenance, salaryEntries, taxDeductions, supplierInvoices, supplierPayments, drivers, fuelPrice, payments, equipmentFuelEntries, equipment]);

  return {
    totals,
    totalMaintCost,
    totalSalaries,
    totalTaxDeductions,
    totalSupplierPaidOut,
    netProfit,
    margin,
    dailyRevenue,
    workTypeBreakdown,
    equipReport,
    bestEquipment,
    recentJobs,
    miniRevenue,
    monthlyComparison,
    equipment,
    drivers,
    payments,
    fuelPrice,
    loading,
  };
};
