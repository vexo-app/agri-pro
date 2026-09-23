// src/utils/serviceHistory.js
// Helpers for the oil-change / grease *history* sequences kept on each
// equipment doc:
//   oilChangeHistory: [{ id, meter, date }]   — base equipment
//   greaseHistory:    [{ id, date }]          — attachments
// Older records saved before this feature existed only have the single
// legacy fields `lastOilChangeMeter` / `lastGreaseDate` (no history array),
// so every helper here falls back to those when the history is empty.

/**
 * Sort oil-change entries by meter reading (ascending — the natural order
 * they happened in, since the odometer/hour-meter only ever goes up).
 */
export const sortOilHistory = (history = []) =>
  [...history].sort((a, b) => Number(a.meter) - Number(b.meter));

/**
 * Sort grease entries by date (ascending).
 */
export const sortGreaseHistory = (history = []) =>
  [...history].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

/**
 * Latest oil-change entry for a piece of base equipment.
 * Returns { meter, date } or null.
 */
export const getLastOilChange = (equipment) => {
  const history = equipment?.oilChangeHistory || [];
  if (history.length > 0) {
    const sorted = sortOilHistory(history);
    return sorted[sorted.length - 1];
  }
  if (equipment?.lastOilChangeMeter || equipment?.lastOilChangeMeter === 0) {
    return { meter: equipment.lastOilChangeMeter, date: null };
  }
  return null;
};

/**
 * Latest grease date for an attachment. Returns a date string or null.
 */
export const getLastGreaseDate = (equipment) => {
  const history = equipment?.greaseHistory || [];
  if (history.length > 0) {
    const sorted = sortGreaseHistory(history);
    return sorted[sorted.length - 1].date || null;
  }
  return equipment?.lastGreaseDate || null;
};

/**
 * Patch that removes one oil-change entry from an equipment doc and
 * recomputes lastOilChangeMeter. Used by both the equipment page and the
 * maintenance page so the two stay identical.
 */
export const removeOilEntryPatch = (equipment, entryId) => {
  const oilChangeHistory = (equipment?.oilChangeHistory || []).filter((e) => e.id !== entryId);
  const last = getLastOilChange({ oilChangeHistory });
  return { oilChangeHistory, lastOilChangeMeter: last?.meter ?? "" };
};

/**
 * The maintenance record linked to an oil-change entry (or undefined).
 * The maintenance record is the ONLY place the oil money lives.
 */
export const findLinkedOilMaintenance = (maintenance = [], entry) =>
  entry ? maintenance.find((m) =>
    m.oilChangeId === entry.id || (entry.maintenanceId && m.id === entry.maintenanceId)) : undefined;

/**
 * Small unique id for a new history entry — good enough for a
 * client-generated array item id (not a Firestore document id).
 */
export const newHistoryEntryId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
