import { exportService } from "./exportService";

const requiredData = () => ({
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
  settings: {},
});

const jsonFile = (payload) => ({
  name: "backup.json",
  text: async () => JSON.stringify(payload),
});

describe("exportService contact backup compatibility", () => {
  test("accepts an older backup without contacts and marks them as absent", async () => {
    const result = await exportService.readBackupFile(jsonFile({
      version: 2,
      data: requiredData(),
    }));

    expect(result.data.contacts).toBeUndefined();
    expect(result.counts.contacts).toBeUndefined();
  });

  test("rejects duplicate document ids before restore starts", async () => {
    const data = {
      ...requiredData(),
      contacts: [],
      drivers: [
        { id: "driver-1", name: "الأول", salary: 1000 },
        { id: "driver-1", name: "الثاني", salary: 2000 },
      ],
    };

    await expect(exportService.readBackupFile(jsonFile({ version: 3, data })))
      .rejects.toThrow("معرّف مكرر");
  });

  test("rejects invalid nested record fields before restore starts", async () => {
    const data = {
      ...requiredData(),
      contacts: [],
      payments: [{ id: "payment-1", amount: -50, date: "2026-99-40" }],
    };

    await expect(exportService.readBackupFile(jsonFile({ version: 3, data })))
      .rejects.toThrow("الحقل amount غير صالح");
  });

  test("requires contacts in the current backup format", async () => {
    await expect(exportService.readBackupFile(jsonFile({
      version: 3,
      data: requiredData(),
    }))).rejects.toThrow("ناقص أو تالف");
  });

  test("reads contacts from the current backup format", async () => {
    const data = {
      ...requiredData(),
      contacts: [{ id: "contact-1", name: "عميل", type: "client", phone: "01000000000" }],
    };
    const result = await exportService.readBackupFile(jsonFile({ version: 3, data }));

    expect(result.counts.contacts).toBe(1);
    expect(result.data.contacts[0].id).toBe("contact-1");
  });
});
