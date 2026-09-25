// Step 5 — the admin Excel archive must show the same numbers as the app.
import * as XLSX from "xlsx";
import { backupToExcelService } from "./backupToExcelService";

const rows = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name]);

test("jobs sheet uses the app's formulas (legacy paid, no negative remaining, float-safe)", () => {
  const wb = backupToExcelService.convert({
    jobs: [
      { id: "a", acres: 10, pricePerAcre: 100, fuelUsed: 2, fuelPriceAtJob: 15, amountPaid: 300 },
      { id: "b", acres: 1.1, pricePerAcre: 100 },
      { id: "c", acres: 1, pricePerAcre: 100 },
    ],
    payments: [{ id: "p1", jobId: "a", amount: 100 }, { id: "p2", jobId: "b", amount: 110 }, { id: "p3", jobId: "c", amount: 150 }],
    settings: { fuelPrice: 20 },
  });
  const j = rows(wb, "العمليات");
  expect(j.map((r) => r["إجمالي المدفوع فعليًا (ج.م)"])).toEqual([400, 110, 150]);
  expect(j.map((r) => r["المتبقي (ج.م)"])).toEqual([600, 0, 0]);
  const summary = Object.fromEntries(rows(wb, "الملخص").map((r) => [r["البيان"], r["القيمة"]]));
  expect(summary["إجمالي المتبقي على العملاء (ج.م)"]).toBe(600);
});

test("supplier invoices, supplier payments and taxes are included", () => {
  const wb = backupToExcelService.convert({
    supplierInvoices: [{ id: "i", supplierName: "س", amount: 500 }],
    supplierPayments: [{ id: "s", supplierInvoiceId: "i", amount: 200 }],
    taxDeductions: [{ id: "t", amount: 50 }],
    settings: {},
  });
  expect(rows(wb, "فواتير الموردين")[0]["المتبقي (ج.م)"]).toBe(300);
  expect(rows(wb, "دفعات الموردين")[0]["المورد"]).toBe("س");
  expect(rows(wb, "الضرائب والخصومات")[0]["المبلغ (ج.م)"]).toBe(50);
});
