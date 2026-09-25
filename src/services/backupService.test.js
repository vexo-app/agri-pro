// jest.mock() calls must precede the imports they mock (babel-jest hoists them).
/* eslint-disable import/first */
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
  MAX_MONEY_VALUE: 1000000000,
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
  contacts: [],
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

  test("restores contacts from new backups", async () => {
    const snapshot = emptySnapshot();
    snapshot.contacts = [{ id: "contact-1", name: "عميل", type: "client", phone: "01000000000" }];
    mockBatchCommit.mockResolvedValue(undefined);

    await backupService.restoreSnapshot("user-1", snapshot);

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.stringContaining("users/user-1/contacts/contact-1"),
      expect.objectContaining({ name: "عميل", type: "client" })
    );
  });

  test("legacy backups without contacts preserve the live contacts collection", async () => {
    const snapshot = emptySnapshot();
    delete snapshot.contacts;
    mockBatchCommit.mockResolvedValue(undefined);

    await backupService.restoreSnapshot("user-1", snapshot);

    expect(mockGetDocs.mock.calls.some(([path]) => String(path).includes("/contacts"))).toBe(false);
  });

  test("rejects a malformed record before any Firestore read or write", async () => {
    const snapshot = emptySnapshot();
    snapshot.payments = [{ id: "payment-1", amount: -10, date: "not-a-date" }];

    await expect(backupService.restoreSnapshot("user-1", snapshot))
      .rejects.toThrow("الحقل amount غير صالح");
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

describe("backupService.prepareRestore", () => {
  test("loads the selected snapshot before creating a safety backup that may prune it", async () => {
    const order = [];
    const targetData = emptySnapshot();
    const currentData = emptySnapshot();
    const getSpy = jest.spyOn(backupService, "getSnapshot").mockImplementation(async () => {
      order.push("load-target");
      return targetData;
    });
    const createSpy = jest.spyOn(backupService, "createBackup").mockImplementation(async () => {
      order.push("create-safety");
      return "safety-1";
    });

    try {
      const result = await backupService.prepareRestore("user-1", "oldest-1", currentData);
      expect(order).toEqual(["load-target", "create-safety"]);
      expect(result).toEqual({ snapshotData: targetData, safetyBackupId: "safety-1" });
    } finally {
      getSpy.mockRestore();
      createSpy.mockRestore();
    }
  });
});

// ─── Step 3: transient delete lock is never restored ─────────────────────────
describe("backupService.restoreSnapshot — deleting flag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockBatchCommit.mockResolvedValue(undefined);
  });
  test("strips `deleting` from restored docs, keeps every other field", async () => {
    const snapshot = emptySnapshot();
    snapshot.jobs = [{ id: "j1", client: "x", acres: 2, date: "2026-01-01", deleting: true }];
    await backupService.restoreSnapshot("user-1", snapshot);
    const jobWrite = mockBatchSet.mock.calls.find(([ref]) => String(ref).includes("/jobs/j1"));
    expect(jobWrite[1]).toEqual({ client: "x", acres: 2, date: "2026-01-01" });
  });
});
