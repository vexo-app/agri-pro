// src/utils/pdfGenerator.js
// Thin re-export barrel. The actual report builders were split by report
// type into ./pdf/* for readability (core engine, invoice, equipment
// report, monthly summary, driver payslip, custody report) — this file
// only re-exports them so every existing
// `import ... from "../utils/pdfGenerator"` keeps working unchanged.

export { downloadReportPdf } from "./pdf/core";
export { printClientInvoice, downloadClientInvoicePdf } from "./pdf/invoice";
export { printEquipmentReport, downloadEquipmentReportPdf } from "./pdf/equipmentReport";
export { downloadMonthlySummaryPdf } from "./pdf/monthlySummary";
export { printDriverPayslip, downloadDriverPayslipPdf } from "./pdf/driverPayslip";
export { downloadCustodyReportPdf } from "./pdf/custodyReport";
