// jest.mock() calls must precede the imports they mock (babel-jest hoists them).
/* eslint-disable import/first */
const order = [];
const mockUpdateDoc = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();
const mockGetDocs = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...parts) => parts.join("/"),
  doc: (...parts) => parts.join("/"),
  query: (value) => value,
  where: () => undefined,
  serverTimestamp: () => "server-time",
  updateDoc: (...args) => mockUpdateDoc(...args),
  getDocsFromServer: (...args) => mockGetDocs(...args),
  runTransaction: async (_db, callback) => {
    const transaction = {
      get: async () => ({ exists: () => true, data: () => ({ deleting: false }) }),
      update: () => order.push("lock-written"),
    };
    await callback(transaction);
    order.push("lock-committed");
  },
  writeBatch: () => ({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }),
}));

jest.mock("../config/firebase", () => ({ db: "test-db" }));

import {
  deleteParentWithChildren, isStaleDeleteLock, releaseDeleteLock, STALE_DELETE_LOCK_MS,
} from "./cascadeDeleteService";

describe("deleteParentWithChildren", () => {
  beforeEach(() => {
    order.length = 0;
    jest.clearAllMocks();
    mockGetDocs.mockImplementation(async () => {
      order.push("children-queried");
      return { docs: [{ ref: "payment-1" }] };
    });
    mockBatchCommit.mockImplementation(async () => { order.push("delete-committed"); });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  test("commits the deletion lock before querying payments", async () => {
    await deleteParentWithChildren({
      userId: "user-1",
      parentCollection: "jobs",
      parentId: "job-1",
      childCollection: "payments",
      childForeignKey: "jobId",
    });

    expect(order).toEqual(["lock-written", "lock-committed", "children-queried", "delete-committed"]);
    expect(mockBatchDelete).toHaveBeenCalledWith("payment-1");
    expect(mockBatchDelete).toHaveBeenCalledWith("test-db/users/user-1/jobs/job-1");
  });

  test("unlocks the parent when the delete batch fails", async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error("network failure"));

    await expect(deleteParentWithChildren({
      userId: "user-1",
      parentCollection: "jobs",
      parentId: "job-1",
      childCollection: "payments",
      childForeignKey: "jobId",
    })).rejects.toThrow("network failure");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "test-db/users/user-1/jobs/job-1",
      expect.objectContaining({ deleting: false })
    );
  });
});

// ─── Step 3: stuck delete locks ──────────────────────────────────────────────
describe("isStaleDeleteLock", () => {
  const now = 1_000_000_000_000;
  test("not locked → false", () => {
    expect(isStaleDeleteLock({ deleting: false, updatedAt: { toMillis: () => 0 } }, now)).toBe(false);
    expect(isStaleDeleteLock({}, now)).toBe(false);
  });
  test("fresh lock (another device deleting right now) → false", () => {
    expect(isStaleDeleteLock({ deleting: true, updatedAt: { toMillis: () => now - 30_000 } }, now)).toBe(false);
  });
  test("lock older than threshold → stale", () => {
    expect(isStaleDeleteLock({ deleting: true, updatedAt: { toMillis: () => now - STALE_DELETE_LOCK_MS - 1 } }, now)).toBe(true);
    expect(isStaleDeleteLock({ deleting: true, updatedAt: { seconds: (now - 10 * 60_000) / 1000 } }, now)).toBe(true);
  });
  test("lock with no confirmed server timestamp → not stale (unknown age)", () => {
    expect(isStaleDeleteLock({ deleting: true, updatedAt: null }, now)).toBe(false);
  });
});

describe("releaseDeleteLock", () => {
  test("writes only deleting=false (never deletes anything)", async () => {
    await releaseDeleteLock({ userId: "u1", parentCollection: "jobs", parentId: "j1" });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "test-db/users/u1/jobs/j1",
      { deleting: false, updatedAt: "server-time" }
    );
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });
});
