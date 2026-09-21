const mockSetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...parts) => parts.join("/"),
  doc: (_collectionPath, id) => ({ id, path: `${_collectionPath}/${id}` }),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: () => "server-time",
}));

jest.mock("../config/firebase", () => ({ db: "test-db" }));

import { attendanceService } from "./attendanceService";

describe("attendanceService.add", () => {
  beforeEach(() => mockSetDoc.mockResolvedValue(undefined));

  test("uses one deterministic document id for the same driver and day", async () => {
    const data = { driverId: "driver-1", date: "2026-09-21", status: "present" };
    const first = attendanceService.add("user-1", data);
    const second = attendanceService.add("user-1", { ...data, status: "late" });

    expect(first.id).toBe("driver-1__2026-09-21");
    expect(second.id).toBe(first.id);
    expect(mockSetDoc.mock.calls[0][0].path).toBe(
      "test-db/users/user-1/attendance/driver-1__2026-09-21"
    );
    await Promise.all([first.promise, second.promise]);
  });
});
