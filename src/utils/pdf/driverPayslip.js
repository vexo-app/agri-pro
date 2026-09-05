// src/utils/pdf/driverPayslip.js
// Driver Payslip. Extracted from the old single pdfGenerator.js — logic unchanged.

import { formatCurrency, formatDate } from "../formatters";
import { escapeHtml, printWindow, downloadReportPdf } from "./core";

const buildDriverPayslipHtml = ({ driver, month, summary, entries, attendance }) => {
  const today      = new Date().toLocaleDateString("ar-EG");
  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-EG", { month:"long", year:"numeric" });

  const entryRows = entries.map((e) => {
    const isDeduct = e.type === "deduction" || e.type === "advance_repay";
    const typeLabels = {
      base:"راتب أساسي", bonus:"حافز", deduction:"خصم",
      advance:"سلفة", advance_repay:"سداد سلفة",
    };
    return `<tr>
      <td>${formatDate(e.date)}</td>
      <td>${typeLabels[e.type] || escapeHtml(e.type)}</td>
      <td>${escapeHtml(e.reason || e.notes) || "—"}</td>
      <td style="color:${isDeduct?"#991b1b":"#15803d"};font-weight:700">
        ${isDeduct ? "-" : "+"} ${formatCurrency(e.amount)}
      </td>
    </tr>`;
  }).join("");

  const attendRows = attendance.map((r) => {
    const labels = { present:"حضر", absent:"غياب", late:"تأخير", half:"نصف يوم" };
    const colors  = { present:"#15803d", absent:"#991b1b", late:"#92400e", half:"#1d4ed8" };
    return `<tr>
      <td>${formatDate(r.date)}</td>
      <td style="color:${colors[r.status]||"#1a1a2e"};font-weight:700">${labels[r.status] || escapeHtml(r.status)}</td>
      <td>${escapeHtml(r.notes) || "—"}</td>
    </tr>`;
  }).join("");

  const html = `
    <div class="page">
      <div class="header">
        <div>
          <h1>كشف راتب</h1>
          <p class="brand">زراعي برو · ${monthLabel}</p>
        </div>
        <div class="meta">
          <p>تاريخ الطباعة: ${today}</p>
          <p>${driver.role === "staff" ? "الاسم" : "السائق"}: ${escapeHtml(driver.name)}</p>
          ${driver.phone ? `<p>الهاتف: ${escapeHtml(driver.phone)}</p>` : ""}
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box"><div class="stat-val">${formatCurrency(summary.base)}</div><div class="stat-lbl">الراتب الأساسي</div></div>
        <div class="stat-box"><div class="stat-val" style="color:#1d4ed8">${formatCurrency(summary.bonuses)}</div><div class="stat-lbl">الحوافز والزيادات</div></div>
        <div class="stat-box"><div class="stat-val" style="color:#991b1b">${formatCurrency(summary.deductions)}</div><div class="stat-lbl">الخصومات</div></div>
        <div class="stat-box"><div class="stat-val" style="color:${summary.net>=0?"#15803d":"#991b1b"}">${formatCurrency(summary.net)}</div><div class="stat-lbl">صافي الراتب</div></div>
      </div>

      ${entryRows ? `
      <div class="section">
        <h2>تفصيل القيود</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>النوع</th><th>السبب</th><th>المبلغ</th></tr></thead>
          <tbody>${entryRows}</tbody>
          <tr class="total-row">
            <td colspan="3">صافي الراتب</td>
            <td style="color:${summary.net>=0?"#15803d":"#991b1b"}">${formatCurrency(summary.net)}</td>
          </tr>
        </table>
      </div>` : ""}

      ${attendRows ? `
      <div class="section">
        <h2>سجل الحضور والغياب</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
          <tbody>${attendRows}</tbody>
        </table>
      </div>` : ""}

      <div class="footer">زراعي برو · كشف راتب: ${escapeHtml(driver.name)} · ${monthLabel} · ${today}</div>
    </div>
  `;

  return { html, title: `كشف راتب - ${driver.name} - ${monthLabel}`, filename: `كشف-راتب-${(driver.name || "").replace(/[<>:"/\\|?*]/g, "")}-${monthLabel}` };
};

export const printDriverPayslip = (args) => {
  const { html, title } = buildDriverPayslipHtml(args);
  printWindow(html, title);
};

export const downloadDriverPayslipPdf = (args) => {
  const { html, filename } = buildDriverPayslipHtml(args);
  return downloadReportPdf(html, filename);
};
