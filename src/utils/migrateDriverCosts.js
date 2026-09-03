// src/utils/migrateDriverCosts.js
//
// The app used to track driver costs (salary/fuel allowance/housing/bonus/
// advance/deduction) in a separate `driverCosts` collection, edited from a
// page that was never wired into navigation. That system has been merged
// into the newer `salaryEntries` + `attendance` system used by the driver
// detail page. This file converts any leftover `driverCosts` docs into
// `salaryEntries` docs (once, per account) so no historical data is lost.

import { SALARY_ENTRY_TYPES } from "../config/constants";

// Maps a legacy driverCosts "type" label to the new salaryEntries schema.
const mapCostType = (type) => {
  switch (type) {
    case "راتب شهري": return { type: SALARY_ENTRY_TYPES.BASE,   reason: "" };
    case "سلفة":       return { type: SALARY_ENTRY_TYPES.ADVANCE, reason: "" };
    case "خصم":        return { type: SALARY_ENTRY_TYPES.DEDUCTION, reason: "أخرى" };
    case "بدل وقود":   return { type: SALARY_ENTRY_TYPES.BONUS, reason: "بدل وقود" };
    case "بدل سكن":    return { type: SALARY_ENTRY_TYPES.BONUS, reason: "بدل سكن" };
    case "حافز":       return { type: SALARY_ENTRY_TYPES.BONUS, reason: "حافز أداء" };
    default:           return { type: SALARY_ENTRY_TYPES.BONUS, reason: "أخرى" };
  }
};

/**
 * Convert one legacy driverCost doc into a salaryEntry payload
 * (no id/userId/timestamps — caller adds those on write).
 */
export const driverCostToSalaryEntry = (cost) => {
  const { type, reason } = mapCostType(cost.type);
  const note = [cost.notes, cost.type ? `(منقول من: ${cost.type})` : null]
    .filter(Boolean)
    .join(" ");
  return {
    driverId: cost.driverId,
    type,
    amount:   Number(cost.amount) || 0,
    reason,
    date:     cost.date || new Date().toISOString().split("T")[0],
    notes:    note,
    paid:     true, // legacy costs had no paid/unpaid concept — treat as settled
    // Ties this entry back to the legacy driverCosts doc it came from, so
    // the migration can detect (and skip) a record it already migrated —
    // see DataContext.jsx's migration block.
    legacyDriverCostId: cost.id,
  };
};
