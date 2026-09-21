// src/hooks/useEquipment.js
import { useMemo, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { buildEquipmentReport } from "../utils/calculations";

/**
 * Provides equipment list enriched with computed stats.
 */
export const useEquipment = () => {
  const { equipment, jobs, maintenance, equipmentFuelEntries, custody = [], settings, loading,
          addEquipment, updateEquipment, deleteEquipment } = useData();

  const report = useMemo(
    () => buildEquipmentReport(equipment, jobs, maintenance, settings.fuelPrice, [], equipmentFuelEntries),
    [equipment, jobs, maintenance, equipmentFuelEntries, settings.fuelPrice]
  );

  const getById = (id) => equipment.find((e) => e.id === id);

  // (audit finding B1) Counts of every record that references this
  // equipment — used to BLOCK deletion outright when any exist, instead of
  // just warning and still allowing it. Deleting equipment while jobs/
  // maintenance/custody records still reference its id left those records
  // permanently pointing at a dead id (orphaned), silently breaking
  // per-equipment reporting with no way to fix it after the fact short of
  // manually editing Firestore. Deactivating (status: "inactive", already
  // supported by EquipmentForm) is always available as the non-destructive
  // alternative — it keeps the equipment out of active lists but preserves
  // every reference to it.
  const getEquipmentDependencyCounts = useCallback((equipmentId) => ({
    jobs:        jobs.filter((j) => j.equipmentId === equipmentId).length,
    maintenance: maintenance.filter((m) => m.equipmentId === equipmentId).length,
    fuelEntries: equipmentFuelEntries.filter((entry) => entry.equipmentId === equipmentId).length,
    custody:     custody.filter((c) => c.equipmentId === equipmentId).length,
    // Attachments physically mounted on this base unit (parentEquipmentId)
    // — deleting the base would leave them pointing at a dead parent.
    attachments: equipment.filter((e) => e.parentEquipmentId === equipmentId).length,
  }), [jobs, maintenance, equipmentFuelEntries, custody, equipment]);

  return {
    equipment,
    report,
    loading,
    getById,
    getEquipmentDependencyCounts,
    addEquipment,
    updateEquipment,
    deleteEquipment,
  };
};
