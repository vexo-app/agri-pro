import { createJobWithInitialPayment } from "./jobCreation";
import { paymentService } from "../services/paymentService";
import { savePendingJobPayment, clearPendingJobPayment } from "./pendingJobPayments";

jest.mock("../services/paymentService", () => ({
  paymentService: { generateId: jest.fn() },
}));

jest.mock("./pendingJobPayments", () => ({
  savePendingJobPayment: jest.fn(),
  clearPendingJobPayment: jest.fn(),
}));

describe("createJobWithInitialPayment", () => {
  beforeEach(() => jest.clearAllMocks());

  test("keeps equipment, driver and historical fuel price on a quick job", async () => {
    const addJob = jest.fn(() => ({ id: "job-1", promise: Promise.resolve() }));

    await createJobWithInitialPayment({
      formData: {
        equipmentId: "equipment-1",
        driverId: "driver-1",
        client: "عميل تجريبي",
        acres: 10,
        pricePerAcre: 100,
        fuelUsed: 5,
        fuelPriceAtJob: 17,
        date: "2026-09-21",
        amountPaid: 0,
      },
      userId: "user-1",
      addJob,
      addPayment: jest.fn(),
      deletePayment: jest.fn(),
    });

    expect(addJob).toHaveBeenCalledWith(expect.objectContaining({
      equipmentId: "equipment-1",
      driverId: "driver-1",
      fuelPriceAtJob: 17,
    }));
    expect(addJob.mock.calls[0][0]).not.toHaveProperty("amountPaid");
  });

  test("records a quick-job initial payment in the payment ledger", async () => {
    paymentService.generateId.mockReturnValue("payment-1");
    const addJob = jest.fn(() => ({ id: "job-1", promise: Promise.resolve() }));
    const addPayment = jest.fn();

    const result = await createJobWithInitialPayment({
      formData: { equipmentId: "equipment-1", date: "2026-09-21", amountPaid: 250 },
      userId: "user-1",
      addJob,
      addPayment,
      deletePayment: jest.fn(),
    });

    const expectedPayment = {
      jobId: "job-1",
      amount: 250,
      date: "2026-09-21",
      notes: "دفعة مقدّمة عند تسجيل العملية",
    };
    expect(savePendingJobPayment).toHaveBeenCalledWith("user-1", {
      paymentId: "payment-1",
      ...expectedPayment,
    });
    expect(addPayment).toHaveBeenCalledWith(expectedPayment, "payment-1");
    expect(clearPendingJobPayment).toHaveBeenCalledWith("user-1", "payment-1");
    expect(result).toEqual({ jobId: "job-1", hasInitialPayment: true });
  });
});
