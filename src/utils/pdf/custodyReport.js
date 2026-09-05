// src/utils/pdf/custodyReport.js
// Custody Report (العهدة) — letterhead style, same as the client invoice.
// Extracted from the old single pdfGenerator.js — logic unchanged.
// نفس فكرة الفاتورة بالظبط: شعار/بيانات الشركة، شريط مائي، رقم تقرير ثابت،
// وتوقيع/اعتماد في الآخر. البيانات المعروضة (الحركات والإجمالي والتبويب حسب
// البند) هي نفسها بالظبط اللي كانت موجودة قبل كده، من غير أي إضافة أو حذف —
// الفرق هنا في الشكل بس عشان يطلع "معتمد" زي الفاتورة.

import { formatCurrency, formatDate, formatDateTime } from "../formatters";
import { escapeHtml, INVOICE_CSS, downloadReportPdf } from "./core";

const buildCustodyReportNumber = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

const buildCustodyReportHtml = ({ transactions, totalExpenses, expensesByCategory, getLinkedName, company = {}, month = null, allTime = true }) => {
  const today = new Date().toLocaleDateString("ar-EG");
  const printedAt = formatDateTime(new Date());
  const reportNo = buildCustodyReportNumber();

  const categoryLabels = { equipment: "ميكنة", driver: "سائقين", other: "أخرى" };

  // التقرير بيعرض المصروفات بس (من غير حركات الإضافة/الرصيد) — شاشة العهدة
  // في التطبيق نفسها لسه بتعرض كل الحركات والرصيد زي ما هي، الفلترة دي
  // خاصة بملف الـ PDF فقط.
  const allExpenses = transactions.filter((t) => t.type !== "deposit");

  // Month-scoped download (allTime=false + a "YYYY-MM" month): filter by
  // that prefix and recompute the total/category breakdown from the
  // filtered list itself — never from the page's all-time totals passed
  // in — so a monthly download can't accidentally show all-time numbers.
  const expensesOnly = (!allTime && month) ? allExpenses.filter((t) => (t.date || "").startsWith(month)) : allExpenses;
  const periodTotalExpenses = (!allTime && month)
    ? expensesOnly.reduce((s, t) => s + (Number(t.amount) || 0), 0)
    : totalExpenses;
  const periodExpensesByCategory = (!allTime && month)
    ? expensesOnly.reduce((acc, t) => {
        const key = t.category || "other";
        acc[key] = (acc[key] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {})
    : expensesByCategory;

  const periodLabel = (!allTime && month)
    ? new Date(`${month}-01`).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })
    : "كل الوقت";
  const reportTitle = (!allTime && month) ? "تقرير العهدة الشهري" : "تقرير العهدة";

  // Sort oldest → newest for a chronological ledger read
  const sorted = [...expensesOnly].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const rows = sorted.map((t) => {
    const linkedName = getLinkedName ? getLinkedName(t) : null;
    const desc = t.category === "other" && t.otherLabel ? escapeHtml(t.otherLabel) : (categoryLabels[t.category] || "صرف");
    return `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td>
        <span class="badge badge-red">صرف</span>
      </td>
      <td>${desc}${linkedName ? ` · ${escapeHtml(linkedName)}` : ""}</td>
      <td>${escapeHtml(t.notes) || "—"}</td>
      <td style="color:#991b1b;font-weight:700">
        - ${formatCurrency(t.amount)}
      </td>
    </tr>`;
  }).join("");

  const categoryRows = Object.entries(categoryLabels).map(([key, label]) => {
    const amount = periodExpensesByCategory?.[key] || 0;
    if (amount === 0) return "";
    return `<tr><td style="font-weight:600">${label}</td><td style="color:#991b1b">${formatCurrency(amount)}</td></tr>`;
  }).join("");

  const companyName = (company.name || "").trim() || "اسم الشركة / المزرعة";
  const logoInitials = companyName.replace(/\s+/g, "").slice(0, 2) || "شر";
  const metaLine2 = [
    company.commercialRegister ? `سجل تجاري: ${escapeHtml(company.commercialRegister)}` : "",
    company.taxNumber ? `الرقم الضريبي: ${escapeHtml(company.taxNumber)}` : "",
  ].filter(Boolean).join(" · ");

  const html = `
    <style>${INVOICE_CSS}</style>
    <div class="page inv-page">
      <div class="inv-watermark">معتمد</div>

      <div class="inv-header">
        <div class="inv-company">
          ${company.logo
            ? `<img class="inv-logo-img" src="${escapeHtml(company.logo)}" alt="شعار الشركة" />`
            : `<div class="inv-logo-box">${escapeHtml(logoInitials)}</div>`}
          <div>
            <div class="inv-company-name">${escapeHtml(companyName)}</div>
            <div class="inv-company-meta">
              ${company.address ? escapeHtml(company.address) : "أضف عنوان الشركة من الملف الشخصي"}
              ${metaLine2 ? `<br>${metaLine2}` : ""}
            </div>
          </div>
        </div>
        <div class="inv-meta">
          <span class="inv-tag">${reportTitle} · ${periodLabel}</span>
          <div class="inv-no">رقم ${reportNo}</div>
          <div class="inv-date">صدر: ${printedAt}</div>
          <div class="inv-badge-note">
            هذا التقرير صادر إلكترونياً ويُعتمد بتوقيع الطرفين<br>
            رقم التقرير ${reportNo} · تم الإصدار ${printedAt}
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box" style="grid-column:1 / -1;">
          <div class="stat-val" style="color:#991b1b">${formatCurrency(periodTotalExpenses)}</div>
          <div class="stat-lbl">إجمالي المصروف</div>
        </div>
      </div>

      ${categoryRows ? `
      <div class="section">
        <h2>المصروفات حسب البند</h2>
        <table>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>` : ""}

      ${rows ? `
      <div class="section">
        <h2>سجل الحركات بالتواريخ (${sorted.length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>ملاحظات</th><th>المبلغ</th></tr></thead>
          <tbody>${rows}</tbody>
          <tr class="total-row">
            <td colspan="4">إجمالي المصروف</td>
            <td style="color:#991b1b">${formatCurrency(periodTotalExpenses)}</td>
          </tr>
        </table>
      </div>` : `<div class="section"><p style="color:#666;text-align:center;padding:20px 0;">لا توجد حركات مسجلة${(!allTime && month) ? " في هذا الشهر" : " بعد"}</p></div>`}

      <div class="inv-closing">
        <div class="inv-sign-section">
          <div class="inv-sign-box">
            <div class="inv-sign-line"></div>
            <div class="inv-sign-label">توقيع المسؤول عن العهدة</div>
          </div>
          <div class="inv-sign-box">
            <div class="inv-sign-line">
              <div class="inv-stamp-hint">مكان<br>الختم</div>
            </div>
            <div class="inv-sign-label">توقيع واعتماد الشركة</div>
            <div class="inv-sign-sub">${escapeHtml(companyName)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const titleSuffix = (!allTime && month) ? periodLabel : today;
  return { html, title: `${reportTitle} - ${titleSuffix}`, filename: `تقرير-العهدة-${titleSuffix}` };
};

export const downloadCustodyReportPdf = (args) => {
  const { html, filename } = buildCustodyReportHtml(args);
  return downloadReportPdf(html, filename);
};
