jest.mock("firebase/firestore", () => ({
  doc: jest.fn((...parts) => parts.slice(1).join("/")), getDoc: jest.fn(), getDocs: jest.fn(), setDoc: jest.fn(),
  addDoc: jest.fn(), updateDoc: jest.fn(), collection: jest.fn(), query: jest.fn(),
  orderBy: jest.fn(), onSnapshot: jest.fn(), serverTimestamp: jest.fn(),
  runTransaction: jest.fn(),
  Timestamp: { fromDate: (date) => ({ toDate: () => date }) },
}));

jest.mock("../config/firebase", () => ({ db: {}, auth: { currentUser: null } }));

import { runTransaction } from "firebase/firestore";
import { auth } from "../config/firebase";
import { billingService, calculateBillingPeriod } from "./billingService";

describe("calculateBillingPeriod", () => {
  test("a renewal starts after the current paid period and preserves remaining days", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const currentEnd = new Date("2026-09-11T00:00:00Z");
    const result = calculateBillingPeriod({
      now,
      billingCycle: "monthly",
      entitlement: { expirationDate: { toDate: () => currentEnd } },
      subscription: null,
    });

    expect(result.periodStart).toEqual(currentEnd);
    expect(result.periodEnd).toEqual(new Date("2026-10-11T00:00:00Z"));
  });

  test("an expired subscription starts a new period today", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const result = calculateBillingPeriod({
      now,
      billingCycle: "annual",
      entitlement: { expirationDate: { toDate: () => new Date("2026-08-01T00:00:00Z") } },
      subscription: null,
    });

    expect(result.periodStart).toEqual(now);
    expect(result.periodEnd).toEqual(new Date("2027-09-01T00:00:00Z"));
  });
});

describe("confirmBillingRequestAndActivate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = { uid: "admin-1" };
  });

  test("confirms the request, subscription and entitlement in one transaction", async () => {
    const transaction = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
    transaction.get
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: "company-1", planId: "professional", billingCycle: "monthly",
          amount: 1199, method: "instapay", status: "pending_review",
        }),
      })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => false });
    runTransaction.mockImplementationOnce((_db, callback) => callback(transaction));

    await billingService.confirmBillingRequestAndActivate({ id: "request-1" });

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(2);
  });

  test("does not activate a request that was already reviewed", async () => {
    const transaction = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
    transaction.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: "confirmed" }),
    });
    runTransaction.mockImplementationOnce((_db, callback) => callback(transaction));

    await expect(
      billingService.confirmBillingRequestAndActivate({ id: "request-1" })
    ).rejects.toThrow("تمت مراجعته بالفعل");
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
