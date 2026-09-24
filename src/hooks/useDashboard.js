// src/hooks/useDashboard.js
import { useMemo } from "react";
import { useData } from "../contexts/DataContext";
import {
  aggregateJobs,
  aggregateEquipmentFuelEntries,
  buildDailyRevenue,
  groupByWorkType,
  buildEquipmentReport,
  calcPercentChange,
} from "../utils/calculations";
import { buildPeriodFinancials, monthPrefixOf } from "../utils/financialSummary";

// Step 2: كل أرقام الملخص المالي (كل الوقت + المقارنة الشهرية) بقت من
// buildPeriodFinancials — نفس الدالة اللي بتستخدمها صفحة التقارير وPDF
// الملخص الشهري، فالرقم واحد في كل مكان. "الشهر الحالي" هنا = الشهر
// الجاري لحد النهارده مقابل الشهر اللي فات كامل (نفس التعريف القديم).
export const useDashboard = () => {
  const {
    jobs, equipment, maintenance, equipmentFuelEntries = [], drivers, payments = [],
    supplierInvoices = [], supplierPayments = [],
    settings, salaryEntries = [], taxDeductions = [], loading,
  } = useData();

  const fuelPrice = settings.fuelPrice;
  const currentMonthPrefix = monthPrefixOf(new Date());

  const financialData = useMemo(() => ({
    jobs, payments, maintenance, equipmentFuelEntries, equipment,
    salaryEntries, drivers, taxDeductions, supplierInvoices, supplierPayments, fuelPrice,
  }), [jobs, payments, maintenance, equipmentFuelEntries, equipment,
       salaryEntries, drivers, taxDeductions, supplierInvoices, supplierPayments, fuelPrice]);

  // كل الوقت — راتب الشهر الحالي مستحق لكل عضو نشط (نفس القاعدة القديمة).
  const allTime = useMemo(
    () => buildPeriodFinancials(financialData, { assumeSalaryDueForMonth: currentMonthPrefix }),
    [financialData, currentMonthPrefix]
  );

  const totals = useMemo(() => {
    const jobTotals = aggregateJobs(jobs, fuelPrice, payments);
    const manualFuel = aggregateEquipmentFuelEntries(equipmentFuelEntries, equipment);
    return {
      ...jobTotals,
      totalFuel: allTime.totalFuel,
      totalFuelCost: allTime.totalFuelCost,
      netProfit: jobTotals.netProfit - manualFuel.totalFuelCost,
    };
  }, [jobs, fuelPrice, payments, equipmentFuelEntries, equipment, allTime]);

  const totalMaintCost       = allTime.totalMaintCost;
  const totalSalaries        = allTime.totalSalariesPaid;
  const totalTaxDeductions   = allTime.totalTaxDeductions;
  const totalSupplierPaidOut = allTime.totalSupplierPaidOut;
  const netProfit            = allTime.netProfit;

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

  // "الملخص المالي" row-by-row vs. last month — same figures as netProfit
  // above, scoped to two months.
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const current  = buildPeriodFinancials(financialData, {
      monthPrefix: monthPrefixOf(now), assumeSalaryDueForMonth: monthPrefixOf(now),
    });
    const previous = buildPeriodFinancials(financialData, { monthPrefix: monthPrefixOf(prevMonthDate) });
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
  }, [financialData]);

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
