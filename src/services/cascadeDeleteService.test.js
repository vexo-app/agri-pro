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
  getDocs: (...args) => mockGetDocs(...args),
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

import { deleteParentWithChildren } from "./cascadeDeleteService";

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
