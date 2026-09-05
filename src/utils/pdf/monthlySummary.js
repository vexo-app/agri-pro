// src/utils/pdf/monthlySummary.js
// Monthly Summary. Extracted from the old single pdfGenerator.js — logic unchanged.
// buildMonthlySummaryHtml() holds all the markup/calculations for the
// downloadable PDF (current month / previous month / all time).

import { formatCurrency, formatNumber } from "../formatters";
import { escapeHtml, downloadReportPdf } from "./core";

const buildMonthlySummaryHtml = ({ jobs, equipment, maintenance, drivers, fuelPrice, month, year, allTime = false, totalSalariesPaid = 0, totalTaxDeductions = 0 }) => {
  const today = new Date().toLocaleDateString("ar-EG");
  // allTime reuses the exact same report layout/calculations below, just
  // without the date filters on jobs/maintenance — so it lines up with the
  // Reports page's own all-time totals instead of one calendar month.
  // totalSalariesPaid defaults to 0 only for callers that don't pass it;
  // the caller is expected to already scope it to match (month-filtered
  // salary entries for a monthly report, the page's own all-time total for
  // allTime) — this function doesn't filter it itself.
  const periodLabel = allTime
    ? "كل الوقت"
    : new Date(year, month - 1).toLocaleDateString("ar-EG", { month:"long", year:"numeric" });
  const reportTitle = allTime ? "التقرير الشامل" : "التقرير الشهري";

  const prefix = `${year}-${String(month).padStart(2,"0")}`;
  const monthJobs = allTime ? jobs : jobs.filter((j) => j.date?.startsWith(prefix));
  const monthMaintenance = allTime ? maintenance : maintenance.filter((m) => m.date?.startsWith(prefix));

  const totalRevenue  = monthJobs.reduce((s, j) => s + (j.acres * j.pricePerAcre), 0);
  const totalAcres    = monthJobs.reduce((s, j) => s + (j.acres || 0), 0);
  const totalFuel     = monthJobs.reduce((s, j) => s + (j.fuelUsed || 0), 0);
  const totalFuelCost = totalFuel * fuelPrice;
  const maintCost     = monthMaintenance.reduce((s, m) => s + (m.cost || 0), 0);
  const netProfit     = totalRevenue - totalFuelCost - maintCost - totalSalariesPaid - totalTaxDeductions;

  const equip = [...new Set(monthJobs.map((j) => j.equipmentId))].map((id) => {
    const eq       = equipment.find((e) => e.id === id);
    const eqJobs   = monthJobs.filter((j) => j.equipmentId === id);
    const revenue  = eqJobs.reduce((s, j) => s + (j.acres * j.pricePerAcre), 0);
    const acres    = eqJobs.reduce((s, j) => s + j.acres, 0);
    return `<tr><td>${escapeHtml(eq?.name) || "—"}</td><td>${eqJobs.length}</td><td>${formatNumber(acres)}</td><td>${formatCurrency(revenue)}</td></tr>`;
  }).join("");

  const html = `
    <div class="page">
      <div class="header">
        <div>
          <h1>${reportTitle}</h1>
          <p class="brand">زراعي برو · ${periodLabel}</p>
        </div>
        <div class="meta"><p>تاريخ الطباعة: ${today}</p></div>
      </div>

      <div class="grid-2">
        <div class="stat-box"><div class="stat-val">${monthJobs.length} عملية</div><div class="stat-lbl">عدد العمليات</div></div>
        <div class="stat-box"><div class="stat-val">${formatNumber(totalAcres)} فدان</div><div class="stat-lbl">إجمالي الأفدنة</div></div>
        <div class="stat-box"><div class="stat-val">${formatCurrency(totalRevenue)}</div><div class="stat-lbl">إجمالي الإيراد</div></div>
        <div class="stat-box"><div class="stat-val" style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</div><div class="stat-lbl">صافي الربح</div></div>
      </div>

      <div class="section">
        <h2>ملخص المعدات</h2>
        <table>
          <thead><tr><th>المعدة</th><th>العمليات</th><th>الأفدنة</th><th>الإيراد</th></tr></thead>
          <tbody>${equip}</tbody>
          <tr class="total-row">
            <td>الإجمالي</td>
            <td>${monthJobs.length}</td>
            <td>${formatNumber(totalAcres)}</td>
            <td>${formatCurrency(totalRevenue)}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <h2>تفصيل التكاليف</h2>
        <table>
          <tr><td style="font-weight:600">إجمالي الإيراد</td><td style="color:#15803d;font-weight:700">${formatCurrency(totalRevenue)}</td></tr>
          <tr><td style="font-weight:600">تكلفة الوقود</td><td>${formatCurrency(totalFuelCost)}</td></tr>
          <tr><td style="font-weight:600">تكاليف الصيانة</td><td>${formatCurrency(maintCost)}</td></tr>
          ${totalSalariesPaid ? `<tr><td style="font-weight:600">مرتبات الفريق</td><td>${formatCurrency(totalSalariesPaid)}</td></tr>` : ""}
          ${totalTaxDeductions ? `<tr><td style="font-weight:600">ضرائب وخصومات</td><td>${formatCurrency(totalTaxDeductions)}</td></tr>` : ""}
          <tr class="total-row"><td>صافي الربح</td><td style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</td></tr>
        </table>
      </div>

      <div class="footer">زراعي برو · ${reportTitle} · ${periodLabel} · ${today}</div>
    </div>
  `;

  return { html, title: `تقرير ${periodLabel}`, filename: `${reportTitle}-${periodLabel}` };
};

export const downloadMonthlySummaryPdf = (args) => {
  const { html, filename } = buildMonthlySummaryHtml(args);
  return downloadReportPdf(html, filename);
};
