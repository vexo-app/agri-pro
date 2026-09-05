// src/utils/pdf/invoice.js
// Client Invoice (letterhead style — logo, watermark, signature/stamp).
// Extracted from the old single pdfGenerator.js — logic unchanged.

import { formatCurrency, formatNumber, formatDateTime } from "../formatters";
import { getJobPaidAmount } from "../calculations";
import { escapeHtml, INVOICE_CSS, printWindow, downloadReportPdf } from "./core";

// رقم فاتورة ثابت لكل عملية (سنة العملية + جزء من معرّفها) — مفيش نظام
// ترقيم تسلسلي في الداتا حاليًا، فده أقرب رقم مرجعي فريد وثابت لنفس العملية
// من غير ما نحتاج تعديل في شكل البيانات المخزّنة.
const buildInvoiceNumber = (job) => {
  const d = new Date(job.createdAt?.toDate?.() || job.createdAt || job.date || Date.now());
  const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const idPart = String(job.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `${year}-${idPart}`;
};

const buildClientInvoiceHtml = ({ job, equipmentName, driverName, fuelPrice, payments = [], maintenance = [], company = {} }) => {
  const revenue   = (job.acres || 0) * (job.pricePerAcre || 0);
  const fuelCost  = (job.fuelUsed || 0) * fuelPrice;
  // مصدر واحد للمدفوع: مجموع سجلات payments، أو job.amountPaid كـ fallback
  // للعمليات القديمة اللي اتسجلت قبل نظام الدفعات — مش الاتنين مع بعض.
  const totalPaid = getJobPaidAmount(job, payments);
  const remaining = Math.max(0, revenue - totalPaid);
  const printedAt = formatDateTime(new Date());
  const maintCost = maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0);

  const companyName = (company.name || "").trim() || "اسم الشركة / المزرعة";
  const logoInitials = companyName.replace(/\s+/g, "").slice(0, 2) || "شر";
  const metaLine2 = [
    company.commercialRegister ? `سجل تجاري: ${escapeHtml(company.commercialRegister)}` : "",
    company.taxNumber ? `الرقم الضريبي: ${escapeHtml(company.taxNumber)}` : "",
  ].filter(Boolean).join(" · ");

  const paymentBadge = remaining <= 0
    ? `<span class="badge badge-green">مدفوع بالكامل</span>`
    : totalPaid > 0
    ? `<span class="badge badge-amber">مدفوع جزئياً</span>`
    : `<span class="badge badge-red">غير مدفوع</span>`;

  const paymentsRows = payments.map((p) => `
    <tr>
      <td>${formatDateTime(p.createdAt || p.date)}</td>
      <td>${escapeHtml(p.notes) || "—"}</td>
      <td>${formatCurrency(p.amount)}</td>
    </tr>
  `).join("");

  const maintRows = maintenance.map((m) => `
    <tr>
      <td>${formatDateTime(m.createdAt || m.date)}</td>
      <td>${escapeHtml(m.type) || "—"}</td>
      <td>${escapeHtml(m.notes) || "—"}</td>
      <td>${formatCurrency(m.cost)}</td>
    </tr>
  `).join("");

  const html = `
    <style>${INVOICE_CSS}</style>
    <div class="page inv-page">
      <div class="inv-watermark">${paymentBadge.includes("badge-green") ? "مدفوعة" : "فاتورة"}</div>

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
          <span class="inv-tag">فاتورة عمل</span>
          <div class="inv-no">رقم ${buildInvoiceNumber(job)}</div>
          <div class="inv-date">صدرت: ${printedAt}</div>
          <div style="margin-top:8px">${paymentBadge}</div>
          <div class="inv-badge-note">
            هذه الفاتورة صادرة إلكترونياً وتُعتمد بتوقيع الطرفين<br>
            رقم الفاتورة ${buildInvoiceNumber(job)} · تم الإصدار ${printedAt}
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box">
          <div class="stat-lbl">اسم العميل / الأرض</div>
          <div class="stat-val">${escapeHtml(job.client) || "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-lbl">نوع العمل</div>
          <div class="stat-val">${escapeHtml(job.workType) || "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-lbl">عدد الأفدنة</div>
          <div class="stat-val">${formatNumber(job.acres)} فدان</div>
        </div>
        <div class="stat-box">
          <div class="stat-lbl">سعر الفدان</div>
          <div class="stat-val">${formatCurrency(job.pricePerAcre)}</div>
        </div>
      </div>

      ${equipmentName || driverName ? `
      <div class="section">
        <h2>تفاصيل التشغيل</h2>
        <table>
          <tr><td style="font-weight:600; width:45%">المعدة المستخدمة</td><td>${escapeHtml(equipmentName) || "—"}</td></tr>
          <tr><td style="font-weight:600">السائق</td><td>${escapeHtml(driverName) || "—"}</td></tr>
          <tr><td style="font-weight:600">الوقود المستخدم</td><td>${formatNumber(job.fuelUsed)} لتر</td></tr>
          <tr><td style="font-weight:600">تكلفة الوقود</td><td style="color:#991b1b">${formatCurrency(fuelCost)}</td></tr>
          ${maintenance.length ? `<tr><td style="font-weight:600">تكلفة الصيانة (المعدة)</td><td style="color:#991b1b">${formatCurrency(maintCost)}</td></tr>` : ""}
          <tr><td style="font-weight:600">تاريخ ووقت العملية</td><td>${formatDateTime(job.createdAt || job.date)}</td></tr>
        </table>
      </div>` : ""}

      <div class="section">
        <h2>الملخص المالي</h2>
        <table>
          <tr><td style="font-weight:600; width:45%">إجمالي الإيراد</td><td style="color:#15803d;font-weight:800">${formatCurrency(revenue)}</td></tr>
          <tr><td style="font-weight:600">المبلغ المدفوع</td><td style="color:#15803d">${formatCurrency(totalPaid)}</td></tr>
          <tr class="total-row"><td>المبلغ المتبقي</td><td style="color:${remaining>0?"#991b1b":"#15803d"}">${formatCurrency(remaining)}</td></tr>
        </table>
      </div>

      ${paymentsRows ? `
      <div class="section">
        <h2>سجل الدفعات (${payments.length})</h2>
        <table>
          <thead><tr><th>التاريخ والوقت</th><th>ملاحظات</th><th>المبلغ</th></tr></thead>
          <tbody>${paymentsRows}</tbody>
        </table>
      </div>` : ""}

      ${maintRows ? `
      <div class="section">
        <h2>سجل صيانة المعدة (${maintenance.length})</h2>
        <table>
          <thead><tr><th>التاريخ والوقت</th><th>نوع الصيانة</th><th>ملاحظات</th><th>التكلفة</th></tr></thead>
          <tbody>${maintRows}</tbody>
          <tr class="total-row"><td colspan="3">إجمالي تكلفة الصيانة</td><td style="color:#991b1b">${formatCurrency(maintCost)}</td></tr>
        </table>
      </div>` : ""}

      <div class="inv-closing">
        <div class="inv-sign-section">
          <div class="inv-sign-box">
            <div class="inv-sign-line"></div>
            <div class="inv-sign-label">توقيع المستلم / العميل</div>
            <div class="inv-sign-sub">${escapeHtml(job.client) || ""}</div>
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

  return { html, title: `فاتورة - ${job.client}`, filename: `فاتورة-${(job.client || "").replace(/[<>:"/\\|?*]/g, "")}` };
};

export const printClientInvoice = (args) => {
  const { html, title } = buildClientInvoiceHtml(args);
  printWindow(html, title);
};

export const downloadClientInvoicePdf = (args) => {
  const { html, filename } = buildClientInvoiceHtml(args);
  return downloadReportPdf(html, filename);
};
