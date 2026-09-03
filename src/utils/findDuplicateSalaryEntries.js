// src/utils/findDuplicateSalaryEntries.js
//
// Detects possible duplicate salaryEntries created by the legacy
// driverCosts → salaryEntries migration (see utils/migrateDriverCosts.js
// and the migration block in contexts/DataContext.jsx).
//
// Background: older versions of the migration wrote salaryEntries without
// stamping `legacyDriverCostId` (that field was added later as an
// idempotency guard). If a run's `driverCostService.remove()` call failed
// after an entry had already been created — before the guard existed — the
// leftover legacy doc would get migrated again on a later load, producing a
// second salaryEntry for the same original cost.
//
// This module is read-only: it never mutates data or talks to Firestore. It
// only classifies existing salaryEntries so the app can *report* possible
// duplicates for manual review. It never decides anything should be deleted
// automatically — that stays a human, per-record decision made from the
// driver detail page's existing delete action.
//
// A salaryEntry is only ever considered here if it looks migration-sourced
// (carries the "(منقول من: ...)" marker `driverCostToSalaryEntry` appends to
// `notes`). Manually-entered salary entries are never touched or flagged,
// even if two of them happen to share driver/amount/date/type.

const MIGRATION_MARKER = "(منقول من:";

const looksMigrated = (entry) =>
  typeof entry.notes === "string" && entry.notes.includes(MIGRATION_MARKER);

// Firestore Timestamp (has toMillis), a millis number, or a Date-parseable
// string — normalize to millis, or null if it can't be resolved safely.
const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// Grouping key for "could plausibly be the same migrated cost": same
// driver, same salary-entry type, same amount, same date. This deliberately
// excludes `notes`/`reason` text from the key since the legacy note ("منقول
// من: ...") is stable across duplicates of the same source, but is not by
// itself proof of a match without the other fields agreeing too.
const matchKey = (entry) =>
  [entry.driverId, entry.type, Number(entry.amount) || 0, entry.date || ""].join("|");

/**
 * @param {Array} salaryEntries - state.salaryEntries (each has id, driverId,
 *   type, amount, date, notes, legacyDriverCostId?, createdAt?)
 * @returns {{
 *   highConfidence: Array<{ key, keep, duplicates: Array }>,
 *   needsReview:    Array<{ key, keep, duplicates: Array, reason: string }>,
 *   duplicateCount: number,
 * }}
 *
 * - highConfidence: two or more entries share the exact same non-empty
 *   `legacyDriverCostId` — i.e. the very same legacy record was migrated
 *   more than once. This can only happen from the migration bug, never from
 *   a user action, so it's as close to certain as this app can get.
 * - needsReview: entries that match on driver/type/amount/date and both
 *   look migration-sourced, but don't share a `legacyDriverCostId` (typically
 *   because one predates that field). Plausible, but not certain enough to
 *   ever auto-resolve — flagged for a human to check.
 * - `keep` is only a suggestion (the earliest-created entry in the group,
 *   when creation time can be resolved) — nothing in this module acts on it.
 */
export const findDuplicateSalaryEntries = (salaryEntries = []) => {
  const migrated = salaryEntries.filter(looksMigrated);

  const highConfidence = [];
  const needsReview = [];
  let duplicateCount = 0;

  // Pass 1 — exact legacyDriverCostId collisions (independent of matchKey,
  // since this alone already proves same source).
  const byLegacyId = new Map();
  migrated.forEach((entry) => {
    if (!entry.legacyDriverCostId) return;
    const list = byLegacyId.get(entry.legacyDriverCostId) || [];
    list.push(entry);
    byLegacyId.set(entry.legacyDriverCostId, list);
  });

  const resolvedIds = new Set();
  byLegacyId.forEach((group, legacyDriverCostId) => {
    if (group.length < 2) return;
    const withMillis = group.map((e) => ({ e, ms: toMillis(e.createdAt) }));
    const allResolvable = withMillis.every((g) => g.ms !== null);
    const sorted = allResolvable
      ? [...withMillis].sort((a, b) => a.ms - b.ms).map((g) => g.e)
      : group;
    const [keep, ...duplicates] = sorted;
    group.forEach((e) => resolvedIds.add(e.id));
    duplicateCount += duplicates.length;
    if (allResolvable) {
      highConfidence.push({ key: `legacy:${legacyDriverCostId}`, keep, duplicates });
    } else {
      // Same legacy source, but we can't safely tell which came first —
      // stay cautious and surface it for review instead of guessing.
      needsReview.push({
        key: `legacy:${legacyDriverCostId}`,
        keep,
        duplicates,
        reason: "نفس السجل القديم اتحول أكتر من مرة، لكن تاريخ الإنشاء مش واضح لتحديد الأصلي",
      });
    }
  });

  // Pass 2 — heuristic match (driver/type/amount/date) among migrated
  // entries that weren't already resolved by the legacyDriverCostId pass.
  const remaining = migrated.filter((e) => !resolvedIds.has(e.id));
  const byMatchKey = new Map();
  remaining.forEach((entry) => {
    const key = matchKey(entry);
    const list = byMatchKey.get(key) || [];
    list.push(entry);
    byMatchKey.set(key, list);
  });

  byMatchKey.forEach((group, key) => {
    if (group.length < 2) return;
    const withMillis = group.map((e) => ({ e, ms: toMillis(e.createdAt) }));
    const allResolvable = withMillis.every((g) => g.ms !== null);
    const sorted = allResolvable
      ? [...withMillis].sort((a, b) => a.ms - b.ms).map((g) => g.e)
      : group;
    const [keep, ...duplicates] = sorted;
    duplicateCount += duplicates.length;
    needsReview.push({
      key,
      keep,
      duplicates,
      reason: "نفس السائق والنوع والمبلغ والتاريخ، بدون رابط legacyDriverCostId مشترك",
    });
  });

  return { highConfidence, needsReview, duplicateCount };
};
