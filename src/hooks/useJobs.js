// src/hooks/useJobs.js
import { useMemo, useState } from "react";
import { useData } from "../contexts/DataContext";
import {
  aggregateJobs, calcRevenue, derivePaymentStatus, getJobPaidAmount,
  enrichJob, indexPaymentsByJob,
} from "../utils/calculations";
import { calcTotalMaintenanceCost } from "../utils/financialSummary";

export const useJobs = () => {
  const { jobs, maintenance = [], payments, settings, loading, addJob, updateJob, deleteJob } = useData();

  const [filters, setFilters] = useState({
    equipmentId:"", driverId:"", workType:"",
    dateFrom:"", dateTo:"", paymentStatus:"",
  });

  const paidByJobId = useMemo(() => indexPaymentsByJob(payments), [payments]);

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => {
        if (filters.equipmentId && j.equipmentId !== filters.equipmentId) return false;
        if (filters.driverId    && j.driverId    !== filters.driverId)    return false;
        if (filters.workType    && j.workType    !== filters.workType)    return false;
        if (filters.dateFrom    && j.date        <  filters.dateFrom)     return false;
        if (filters.dateTo      && j.date        >  filters.dateTo)       return false;
        if (filters.paymentStatus) {
          const rev    = calcRevenue(j.acres, j.pricePerAcre);
          const paid   = getJobPaidAmount(j, paidByJobId);
          const status = derivePaymentStatus(rev, paid);
          if (status !== filters.paymentStatus) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [jobs, filters, paidByJobId]);

  const totals = useMemo(
    () => aggregateJobs(filtered, settings.fuelPrice, payments),
    [filtered, settings.fuelPrice, payments]
  );

  // Maintenance cost scoped to match the jobs currently shown: same
  // equipment + date-range filters as the jobs list (driver/workType/
  // paymentStatus don't apply to maintenance records, so they're ignored
  // here — maintenance isn't tied to a driver or a work type).
  const totalMaintCost = useMemo(() => {
    return calcTotalMaintenanceCost(maintenance
      .filter((m) => {
        if (filters.equipmentId && m.equipmentId !== filters.equipmentId) return false;
        if (filters.dateFrom    && m.date        <  filters.dateFrom)     return false;
        if (filters.dateTo      && m.date        >  filters.dateTo)       return false;
        return true;
      }));
  }, [maintenance, filters.equipmentId, filters.dateFrom, filters.dateTo]);

  const netProfit = totals.netProfit - totalMaintCost;

  const clearFilters = () =>
    setFilters({ equipmentId:"", driverId:"", workType:"", dateFrom:"", dateTo:"", paymentStatus:"" });

  return {
    jobs: filtered.map((j) => enrichJob(j, settings.fuelPrice, paidByJobId)),
    allJobs: jobs,
    totals, totalMaintCost, netProfit,
    filters, setFilters, clearFilters,
    hasActiveFilters: Object.values(filters).some(Boolean),
    loading,
    addJob, updateJob, deleteJob,
    fuelPrice: settings.fuelPrice,
  };
};