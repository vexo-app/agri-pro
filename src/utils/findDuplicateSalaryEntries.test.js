// src/utils/findDuplicateSalaryEntries.test.js
import { findDuplicateSalaryEntries } from "./findDuplicateSalaryEntries";

const migratedEntry = (overrides = {}) => ({
  id: "e1",
  driverId: "d1",
  type: "base",
  amount: 3000,
  date: "2025-01-01",
  notes: "(منقول من: راتب شهري)",
  legacyDriverCostId: "legacy1",
  createdAt: { toMillis: () => 1000 },
  ...overrides,
});

describe("findDuplicateSalaryEntries", () => {
  test("ignores entries with no migration marker, even if they look identical", () => {
    const entries = [
      { id: "a", driverId: "d1", type: "base", amount: 3000, date: "2025-01-01" },
      { id: "b", driverId: "d1", type: "base", amount: 3000, date: "2025-01-01" },
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(0);
    expect(result.needsReview).toHaveLength(0);
    expect(result.duplicateCount).toBe(0);
  });

  test("flags two entries sharing the same legacyDriverCostId as high confidence, keeping the earliest", () => {
    const entries = [
      migratedEntry({ id: "newer", createdAt: { toMillis: () => 2000 } }),
      migratedEntry({ id: "older", createdAt: { toMillis: () => 1000 } }),
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(1);
    expect(result.highConfidence[0].keep.id).toBe("older");
    expect(result.highConfidence[0].duplicates.map((d) => d.id)).toEqual(["newer"]);
    expect(result.needsReview).toHaveLength(0);
    expect(result.duplicateCount).toBe(1);
  });

  test("downgrades a same-legacyDriverCostId match to needsReview when createdAt can't be resolved", () => {
    const entries = [
      migratedEntry({ id: "x", createdAt: null }),
      migratedEntry({ id: "y", createdAt: null }),
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(0);
    expect(result.needsReview).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
  });

  test("flags matching driver/type/amount/date as needsReview when legacyDriverCostId differs (the pre-field-existing case)", () => {
    const entries = [
      migratedEntry({ id: "old-no-id", legacyDriverCostId: undefined, createdAt: { toMillis: () => 1000 } }),
      migratedEntry({ id: "new-with-id", legacyDriverCostId: "legacy1", createdAt: { toMillis: () => 5000 } }),
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(0);
    expect(result.needsReview).toHaveLength(1);
    expect(result.needsReview[0].keep.id).toBe("old-no-id");
    expect(result.needsReview[0].duplicates.map((d) => d.id)).toEqual(["new-with-id"]);
  });

  test("does not flag migrated entries for different drivers, amounts, dates or types", () => {
    const entries = [
      migratedEntry({ id: "a", legacyDriverCostId: undefined }),
      migratedEntry({ id: "b", legacyDriverCostId: undefined, driverId: "d2" }),
      migratedEntry({ id: "c", legacyDriverCostId: undefined, amount: 4000 }),
      migratedEntry({ id: "d", legacyDriverCostId: undefined, date: "2025-02-01" }),
      migratedEntry({ id: "e", legacyDriverCostId: undefined, type: "bonus" }),
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(0);
    expect(result.needsReview).toHaveLength(0);
    expect(result.duplicateCount).toBe(0);
  });

  test("never touches manually-entered entries that merely resemble a migrated one", () => {
    const entries = [
      migratedEntry({ id: "migrated", legacyDriverCostId: undefined }),
      { id: "manual", driverId: "d1", type: "base", amount: 3000, date: "2025-01-01", notes: "دفعة يدوية" },
    ];
    const result = findDuplicateSalaryEntries(entries);
    expect(result.highConfidence).toHaveLength(0);
    expect(result.needsReview).toHaveLength(0);
  });
});
