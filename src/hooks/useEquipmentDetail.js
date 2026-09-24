// src/hooks/useEquipmentDetail.js
import { useMemo } from "react";
import { useData } from "../contexts/DataContext";
import { enrichJob, indexPaymentsByJob, buildEquipmentReport } from "../utils/calculations";

export const useEquipmentDetail = (equipmentId) => {
  const { equipment, jobs, maintenance, equipmentFuelEntries, payments, settings, loading } = useData();

  const eq = equipment.find((e) => e.id === equipmentId);

  const paidByJobId = useMemo(() => indexPaymentsByJob(payments), [payments]);

  const eqJobs = useMemo(
    () => jobs
      .filter((j) => j.equipmentId === equipmentId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((job) => enrichJob(job, settings.fuelPrice, paidByJobId)),
    [jobs, equipmentId, settings.fuelPrice, paidByJobId]
  );

  const eqMaint = useMemo(
    () => maintenance
      .filter((m) => m.equipmentId === equipmentId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [maintenance, equipmentId]
  );

  const eqFuelEntries = useMemo(
    () => eq?.category === "attachment"
      ? []
      : equipmentFuelEntries
        .filter((entry) => entry.equipmentId === equipmentId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [equipmentFuelEntries, equipmentId, eq?.category]
  );

  // Step 2: إجماليات المعدة من buildEquipmentReport — نفس الدالة اللي
  // بتبني تقرير المعدات في صفحة التقارير والداشبورد، بدل نسخة محلية منها.
  const row = useMemo(
    () => (eq
      ? buildEquipmentReport([eq], jobs, maintenance, settings.fuelPrice, payments, equipmentFuelEntries)[0]
      : null),
    [eq, jobs, maintenance, settings.fuelPrice, payments, equipmentFuelEntries]
  );
  const stats = {
    totalRevenue:   row?.totalRevenue   ?? 0,
    totalAcres:     row?.totalAcres     ?? 0,
    totalFuel:      row?.totalFuel      ?? 0,
    totalFuelCost:  row?.totalFuelCost  ?? 0,
    totalPaid:      row?.totalPaid      ?? 0,
    totalRemaining: row?.totalRemaining ?? 0,
  };
  const maintCost = row?.maintCost ?? 0;
  const netProfit = row?.netProfit ?? 0;
  const margin    = row?.margin ?? 0;

  return {
    equipment: eq,
    jobs: eqJobs,
    maintenance: eqMaint,
    fuelEntries: eqFuelEntries,
    stats, maintCost, netProfit, margin,
    fuelPrice: settings.fuelPrice,
    loading,
  };
};
