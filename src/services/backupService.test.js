const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchDelete = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...parts) => parts.join("/"),
  doc: (...parts) => parts.join("/"),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  deleteDoc: jest.fn(),
  query: (value) => value,
  orderBy: () => undefined,
  serverTimestamp: () => undefined,
  writeBatch: () => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }),
  Timestamp: class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  },
}));

jest.mock("../config/firebase", () => ({ db: "test-db" }));

jest.mock("../config/constants", () => ({
  COLLECTIONS: { BACKUPS: "backups" },
  MAX_BACKUPS_KEPT: 7,
  BACKUP_CHUNK_BYTES: 900000,
}));

import { backupService } from "./backupService";

const emptySnapshot = () => ({
  equipment: [],
  jobs: [],
  drivers: [],
  maintenance: [],
  equipmentFuelEntries: [],
  payments: [],
  supplierInvoices: [],
  supplierPayments: [],
  salaryEntries: [],
  attendance: [],
  custodyTransactions: [],
  taxDeductions: [],
});

describe("backupService.restoreSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  test("reports a partial restore when one batch committed before the next batch failed", async () => {
    const snapshot = emptySnapshot();
    snapshot.equipment = Array.from({ length: 451 }, (_, i) => ({
      id: `equipment-${i}`,
      name: `Equipment ${i}`,
    }));
    let commitNumber = 0;
    mockBatchCommit.mockImplementation(async () => {
      commitNumber += 1;
      if (commitNumber === 2) throw new Error("simulated second-batch failure");
    });

    let caught;
    try {
      await backupService.restoreSnapshot("user-1", snapshot);
    } catch (err) {
      caught = err;
    }

    expect(caught?.cause?.message).toBe("simulated second-batch failure");
    expect(caught).toMatchObject({
      isPartialFailure: true,
      completedKeys: [],
      activeKey: "equipment",
      appliedOperations: 450,
    });

    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  test("keeps the clean no-op failure state when no write committed", async () => {
    const snapshot = emptySnapshot();
    snapshot.equipment = [{ id: "equipment-1", name: "Test" }];
    mockBatchCommit.mockRejectedValueOnce(new Error("first batch failed"));

    await expect(backupService.restoreSnapshot("user-1", snapshot)).rejects.toMatchObject({
      isPartialFailure: false,
      completedKeys: [],
      activeKey: "equipment",
      appliedOperations: 0,
    });
  });
});
