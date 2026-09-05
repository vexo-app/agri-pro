// src/utils/pdf/equipmentReport.js
// Equipment Report. Extracted from the old single pdfGenerator.js — logic unchanged.

import { formatCurrency, formatNumber, formatDate } from "../formatters";
import { sortOilHistory, sortGreaseHistory } from "../serviceHistory";
import { EQUIPMENT_CATEGORY } from "../../config/constants";
import { escapeHtml, printWindow, downloadReportPdf } from "./core";

const buildEquipmentReportHtml = ({ equipment, jobs, maintenance, fuelPrice, driverName }) => {
  const today      = new Date().toLocaleDateString("ar-EG");
  const totalRevenue  = jobs.reduce((s, j) => s + (j.acres * j.pricePerAcre), 0);
  const totalAcres    = jobs.reduce((s, j) => s + (j.acres || 0), 0);
  const totalFuel     = jobs.reduce((s, j) => s + (j.fuelUsed || 0), 0);
  const totalFuelCost = totalFuel * fuelPrice;
  const maintCost     = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
  const netProfit     = totalRevenue - totalFuelCost - maintCost;

  const jobRows = jobs.map((j) => `
    <tr>
      <td>${formatDate(j.date)}</td>
      <td>${escapeHtml(j.client) || "—"}</td>
      <td>${escapeHtml(j.workType) || "—"}</td>
      <td>${formatNumber(j.acres)}</td>
      <td>${formatCurrency(j.acres * j.pricePerAcre)}</td>
    </tr>
  `).join("");

  const maintRows = maintenance.map((m) => `
    <tr>
      <td>${formatDate(m.date)}</td>
      <td>${escapeHtml(m.type)}</td>
      <td>${escapeHtml(m.notes) || "—"}</td>
      <td>${formatCurrency(m.cost)}</td>
    </tr>
  `).join("");

  // Oil-change (base equipment) / grease (attachments) full history —
  // shown as the sequence it happened in, not just the latest value.
  const isAttachment = equipment.category === EQUIPMENT_CATEGORY.ATTACHMENT;
  const oilHistory    = sortOilHistory(equipment.oilChangeHistory || []);
  const greaseHistory = sortGreaseHistory(equipment.greaseHistory || []);

  const oilHistoryRows = oilHistory.map((entry, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${formatNumber(entry.meter)}</td>
      <td>${entry.date ? formatDate(entry.date) : "—"}</td>
    </tr>
  `).join("");

  const greaseHistoryRows = greaseHistory.map((entry, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${formatDate(entry.date)}</td>
    </tr>
  `).join("");

  const html = `
    <div class="page">
      <div class="header">
        <div>
          <h1>تقرير معدة</h1>
          <p class="brand">زراعي برو · ${escapeHtml(equipment.name)}</p>
        </div>
        <div class="meta">
          <p>تاريخ الطباعة: ${today}</p>
          <p>النوع: ${escapeHtml(equipment.type)}</p>
          ${driverName ? `<p>السائق: ${escapeHtml(driverName)}</p>` : ""}
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box"><div class="stat-val">${formatNumber(totalAcres)} فدان</div><div class="stat-lbl">إجمالي الأفدنة</div></div>
        <div class="stat-box"><div class="stat-val">${formatCurrency(totalRevenue)}</div><div class="stat-lbl">إجمالي الإيراد</div></div>
        <div class="stat-box"><div class="stat-val">${formatNumber(totalFuel)} لتر</div><div class="stat-lbl">إجمالي الوقود</div></div>
        <div class="stat-box"><div class="stat-val" style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</div><div class="stat-lbl">صافي الربح</div></div>
      </div>

      <div class="section">
        <h2>تفصيل التكاليف</h2>
        <table>
          <tr><td style="font-weight:600">إجمالي الإيراد</td><td style="color:#15803d;font-weight:700">${formatCurrency(totalRevenue)}</td></tr>
          <tr><td style="font-weight:600">تكلفة الوقود</td><td style="color:#991b1b">${formatCurrency(totalFuelCost)}</td></tr>
          <tr><td style="font-weight:600">تكاليف الصيانة</td><td style="color:#991b1b">${formatCurrency(maintCost)}</td></tr>
          <tr class="total-row"><td>صافي الربح</td><td style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</td></tr>
        </table>
      </div>

      ${jobRows ? `
      <div class="section">
        <h2>سجل العمليات (${jobs.length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>العميل</th><th>نوع العمل</th><th>الأفدنة</th><th>الإيراد</th></tr></thead>
          <tbody>${jobRows}</tbody>
        </table>
      </div>` : ""}

      ${maintRows ? `
      <div class="section">
        <h2>سجل الصيانة</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظات</th><th>التكلفة</th></tr></thead>
          <tbody>${maintRows}</tbody>
        </table>
      </div>` : ""}

      ${!isAttachment && oilHistoryRows ? `
      <div class="section">
        <h2>سجل غيار الزيت (${oilHistory.length})</h2>
        <table>
          <thead><tr><th>#</th><th>عداد الغيار</th><th>التاريخ</th></tr></thead>
          <tbody>${oilHistoryRows}</tbody>
        </table>
      </div>` : ""}

      ${isAttachment && greaseHistoryRows ? `
      <div class="section">
        <h2>سجل التشحيم (${greaseHistory.length})</h2>
        <table>
          <thead><tr><th>#</th><th>التاريخ</th></tr></thead>
          <tbody>${greaseHistoryRows}</tbody>
        </table>
      </div>` : ""}

      <div class="footer">زراعي برو · تقرير معدة: ${escapeHtml(equipment.name)} · ${today}</div>
    </div>
  `;

  return { html, title: `تقرير - ${equipment.name}`, filename: `تقرير-معدة-${(equipment.name || "").replace(/[<>:"/\\|?*]/g, "")}` };
};

export const printEquipmentReport = (args) => {
  const { html, title } = buildEquipmentReportHtml(args);
  printWindow(html, title);
};

export const downloadEquipmentReportPdf = (args) => {
  const { html, filename } = buildEquipmentReportHtml(args);
  return downloadReportPdf(html, filename);
};
