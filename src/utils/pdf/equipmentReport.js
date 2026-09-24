// src/utils/pdf/equipmentReport.js
// Equipment Report. Extracted from the old single pdfGenerator.js — logic unchanged.

import { formatCurrency, formatNumber, formatDate } from "../formatters";
import { calcRevenue, calcFuelCost, getJobFuelPrice } from "../calculations";
import { sortOilHistory, sortGreaseHistory } from "../serviceHistory";
import { EQUIPMENT_CATEGORY } from "../../config/constants";
import { escapeHtml, printWindow, downloadReportPdf } from "./core";

const buildEquipmentReportHtml = ({ equipment, jobs, maintenance, fuelEntries = [], fuelPrice, driverName }) => {
  const today      = new Date().toLocaleDateString("ar-EG");
  const totalRevenue  = jobs.reduce((s, j) => s + calcRevenue(j.acres, j.pricePerAcre), 0);
  const totalAcres    = jobs.reduce((s, j) => s + (j.acres || 0), 0);
  const totalFuel     = jobs.reduce((s, j) => s + (Number(j.fuelUsed) || 0), 0)
    + fuelEntries.reduce((s, entry) => s + (Number(entry.liters) || 0), 0);
  const totalFuelCost = jobs.reduce((s, j) => s + calcFuelCost(j.fuelUsed, getJobFuelPrice(j, fuelPrice)), 0)
    + fuelEntries.reduce((s, entry) => s + (Number(entry.liters) || 0) * (Number(entry.pricePerLiter) || 0), 0);
  const maintCost     = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
  const netProfit     = totalRevenue - totalFuelCost - maintCost;

  // فصل غيار الزيت عن باقي الصيانة في العرض بس. نفس السجلات بالظبط
  // متقسمة على قسمين، فـ oilCost + otherMaintCost === maintCost دايمًا
  // وصافي الربح مايتغيرش.
  const isOilMaint     = (m) => Boolean(m.oilChangeId) || m.type === "تغيير زيت";
  const oilMaint       = maintenance.filter(isOilMaint);
  const otherMaint     = maintenance.filter((m) => !isOilMaint(m));
  const oilCost        = oilMaint.reduce((s, m) => s + (m.cost || 0), 0);
  const otherMaintCost = otherMaint.reduce((s, m) => s + (m.cost || 0), 0);

  const jobRows = jobs.map((j) => `
    <tr>
      <td>${formatDate(j.date)}</td>
      <td>${escapeHtml(j.client) || "—"}</td>
      <td>${escapeHtml(j.workType) || "—"}</td>
      <td>${formatNumber(j.acres)}</td>
      <td>${formatCurrency(calcRevenue(j.acres, j.pricePerAcre))}</td>
    </tr>
  `).join("");

  const maintRows = otherMaint.map((m) => `
    <tr>
      <td>${formatDate(m.date)}</td>
      <td>${escapeHtml(m.type)}</td>
      <td>${escapeHtml(m.notes) || "—"}</td>
      <td>${formatCurrency(m.cost)}</td>
    </tr>
  `).join("");

  const fuelRows = fuelEntries.map((entry) => `
    <tr>
      <td>${formatDate(entry.date)}</td>
      <td>${formatNumber(entry.liters)}</td>
      <td>${formatCurrency(entry.pricePerLiter)}</td>
      <td>${formatCurrency(Number(entry.liters) * Number(entry.pricePerLiter))}</td>
    </tr>
  `).join("");

  // Oil-change (base equipment) / grease (attachments) full history —
  // shown as the sequence it happened in, not just the latest value.
  const isAttachment = equipment.category === EQUIPMENT_CATEGORY.ATTACHMENT;
  const oilHistory    = sortOilHistory(equipment.oilChangeHistory || []);
  const greaseHistory = sortGreaseHistory(equipment.greaseHistory || []);

  // كل غيار في السجل + ثمنه من سجل الصيانة المرتبط بيه. وأي سجل صيانة
  // "تغيير زيت" مش مرتبط بغيار (القديم المتسجل من صفحة الصيانة) يظهر
  // كسطر لوحده، علشان كل مليم في إجمالي الزيت يبان مرة واحدة بالظبط.
  const linkedMaintIds = new Set();
  const findLinked = (entry) => oilMaint.find((m) =>
    m.oilChangeId === entry.id || (entry.maintenanceId && m.id === entry.maintenanceId));

  const oilHistoryRows = oilHistory.map((entry, idx) => {
    const linked = findLinked(entry);
    if (linked) linkedMaintIds.add(linked.id);
    const kg = linked?.oilKg ?? entry.oilKg;
    return `
    <tr>
      <td>${idx + 1}</td>
      <td>${formatNumber(entry.meter)}</td>
      <td>${entry.date ? formatDate(entry.date) : "—"}</td>
      <td>${kg ? formatNumber(kg) : "—"}</td>
      <td>${linked ? formatCurrency(linked.cost) : "—"}</td>
    </tr>`;
  }).join("");

  const unlinkedOilMaint = oilMaint.filter((m) => !linkedMaintIds.has(m.id));
  const unlinkedOilRows = unlinkedOilMaint.map((m) => `
    <tr>
      <td>—</td>
      <td>—</td>
      <td>${formatDate(m.date)}</td>
      <td>${m.oilKg ? formatNumber(m.oilKg) : "—"}</td>
      <td>${formatCurrency(m.cost)}</td>
    </tr>
  `).join("");

  const oilCount   = oilHistory.length + unlinkedOilMaint.length;
  const allOilRows = oilHistoryRows + unlinkedOilRows;

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
        <div class="stat-box"><div class="stat-val" style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</div><div class="stat-lbl">ربح المعدة (قبل المصاريف العامة)</div></div>
      </div>

      <div class="section">
        <h2>تفصيل التكاليف</h2>
        <table>
          <tr><td style="font-weight:600">إجمالي الإيراد</td><td style="color:#15803d;font-weight:700">${formatCurrency(totalRevenue)}</td></tr>
          <tr><td style="font-weight:600">تكلفة الوقود</td><td style="color:#991b1b">${formatCurrency(totalFuelCost)}</td></tr>
          <tr><td style="font-weight:600">تكاليف الصيانة</td><td style="color:#991b1b">${formatCurrency(otherMaintCost)}</td></tr>
          ${!isAttachment || oilCost > 0 ? `<tr><td style="font-weight:600">تكاليف غيار الزيت</td><td style="color:#991b1b">${formatCurrency(oilCost)}</td></tr>` : ""}
          <tr><td style="font-weight:700">إجمالي مصاريف المعدة (صيانة + زيت)</td><td style="color:#991b1b;font-weight:700">${formatCurrency(maintCost)}</td></tr>
          <tr class="total-row"><td>ربح المعدة (قبل المصاريف العامة)</td><td style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</td></tr>
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
          <tr class="total-row"><td colspan="3">إجمالي الصيانة</td><td>${formatCurrency(otherMaintCost)}</td></tr>
        </table>
      </div>` : ""}

      ${fuelRows ? `
      <div class="section">
        <h2>سجل الوقود الإضافي (${fuelEntries.length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>اللترات</th><th>سعر اللتر</th><th>الإجمالي</th></tr></thead>
          <tbody>${fuelRows}</tbody>
        </table>
      </div>` : ""}

      ${allOilRows && (!isAttachment || unlinkedOilRows) ? `
      <div class="section">
        <h2>سجل غيار الزيت (${oilCount})</h2>
        <table>
          <thead><tr><th>#</th><th>عداد الغيار</th><th>التاريخ</th><th>الكمية (كيلو)</th><th>الثمن</th></tr></thead>
          <tbody>${isAttachment ? unlinkedOilRows : allOilRows}</tbody>
          <tr class="total-row"><td colspan="4">إجمالي غيار الزيت</td><td>${formatCurrency(oilCost)}</td></tr>
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
