// src/utils/pdfGenerator.js
// Uses the browser's built-in print dialog — zero dependencies.
// Creates a styled HTML document, opens it in a new window, triggers print.

import { formatCurrency, formatNumber, formatDate, formatDateTime } from "./formatters";
import { getJobPaidAmount } from "./calculations";
import { sortOilHistory, sortGreaseHistory } from "./serviceHistory";
import { EQUIPMENT_CATEGORY } from "../config/constants";

// ── HTML escaping ──────────────────────────────────────────────────────────────
// كل نص جاي من المستخدم (اسم عميل، ملاحظات، اسم سائق...) بيتحط جوه الـ HTML
// كـ template string، والـ HTML ده بيتنفذ فعلياً في نافذة الطباعة
// (document.write) وفي التحميل (innerHTML). من غير escaping، نص زي
// "<img src=x onerror=...>" في حقل ملاحظات كان هيتنفذ كـ سكريبت وقت
// الطباعة/التحميل (Stored XSS). الدالة دي بتحول أي رمز خطير لـ HTML entity
// مكافئ بحيث يتعرض كنص عادي بس، من غير ما تغيّر أي حاجة تانية في الشكل.
const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Cairo', sans-serif;
    direction: rtl;
    color: #1a1a2e;
    background: #fff;
    font-size: 13px;
    line-height: 1.6;
  }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 28px; }
  h1 { font-size: 22px; font-weight: 800; color: #0f4c2a; }
  h2 { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid #0f4c2a; }
  .brand { color:#0f4c2a; font-size:11px; font-weight:600; margin-top:4px; }
  .meta { text-align:left; font-size:11px; color:#666; }
  .section { margin-bottom:24px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
  .stat-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; }
  .stat-val { font-size:18px; font-weight:800; color:#15803d; }
  .stat-lbl { font-size:10px; color:#666; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th { background:#0f4c2a; color:white; padding:8px 10px; font-size:11px; font-weight:700; text-align:right; }
  td { padding:7px 10px; font-size:11px; border-bottom:1px solid #e5e7eb; }
  tr:nth-child(even) td { background:#f9fafb; }
  .total-row td { font-weight:800; background:#f0fdf4; border-top:2px solid #0f4c2a; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; }
  .badge-green { background:#dcfce7; color:#15803d; }
  .badge-amber { background:#fef3c7; color:#92400e; }
  .badge-red   { background:#fee2e2; color:#991b1b; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; text-align:center; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display:none; }
  }
`;

// ── Open print window ─────────────────────────────────────────────────────────
const printWindow = (htmlContent, title) => {
  const win = window.open("", "_blank", "width=900,height=700");
  win.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <title>${escapeHtml(title)}</title>
      <style>${BASE_CSS}</style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = () => {
          setTimeout(() => { window.print(); }, 600);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
};

// ── Download as an actual PDF file ──────────────────────────────────────────
// Printing above needs zero dependencies (it's just the browser's own print
// dialog). Downloading a real .pdf file straight to disk needs a rendering
// library though, so instead of adding one as a permanent npm dependency
// (which would mean everyone re-runs `npm install` and the app carries the
// extra weight even for people who never use this button), it's loaded
// on-demand from a CDN the first time someone actually taps "download".
// That does mean this button needs an internet connection the first time
// it's used per browser session — the print button above still works
// completely offline regardless.
let html2pdfLoadPromise = null;
const loadHtml2Pdf = () => {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (html2pdfLoadPromise) return html2pdfLoadPromise;
  html2pdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => {
      html2pdfLoadPromise = null; // let a later retry (e.g. once online) try again
      reject(new Error("تعذر تحميل أداة إنشاء ملف PDF — تأكد من اتصالك بالإنترنت وحاول تاني"));
    };
    document.head.appendChild(script);
  });
  return html2pdfLoadPromise;
};

/**
 * Downloads the given report HTML (the exact same markup printXReport()
 * would print) as a .pdf file. Renders it off-screen first — not
 * display:none, since the rendering library can't measure a hidden
 * element's layout — so nothing flashes on screen while the file's built.
 */
export const downloadReportPdf = async (htmlContent, filename) => {
  const html2pdf = await loadHtml2Pdf();

  // NOTE: the element passed to html2pdf() must be completely unpositioned
  // (no position:fixed/absolute, no opacity trick) — confirmed by testing
  // directly against html2pdf.js's source. html2pdf clones exactly the
  // element it's given (inline styles included) into its OWN internal
  // off-screen wrapper before rendering. Any position or opacity we set on
  // OUR element gets cloned along with it and either compounds with
  // html2pdf's own offset (position:fixed/absolute → the clone ends up at
  // an unreachable coordinate, so html2pdf measures its height as 0) or
  // gets rendered as invisible (opacity:0 → captured as blank/white). In
  // both cases the resulting PDF comes out empty.
  //
  // The fix: keep the actual report container fully static (default
  // positioning, exactly as html2pdf expects), and hide it from view by
  // nesting it inside a *separate* wrapper that's clipped to 0×0. That
  // wrapper is never handed to html2pdf, so its clipping has no effect on
  // what gets captured — but it keeps the report from ever painting on
  // screen, so nothing flashes.
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "0";
  wrapper.style.height = "0";
  wrapper.style.overflow = "hidden";

  const container = document.createElement("div");
  container.style.width = "780px";
  container.innerHTML = `<style>${BASE_CSS}</style>${htmlContent}`;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `${filename}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
};

// ── 1. Client Invoice ─────────────────────────────────────────────────────────
const buildClientInvoiceHtml = ({ job, equipmentName, driverName, fuelPrice, payments = [], maintenance = [] }) => {
  const revenue   = (job.acres || 0) * (job.pricePerAcre || 0);
  const fuelCost  = (job.fuelUsed || 0) * fuelPrice;
  // مصدر واحد للمدفوع: مجموع سجلات payments، أو job.amountPaid كـ fallback
  // للعمليات القديمة اللي اتسجلت قبل نظام الدفعات — مش الاتنين مع بعض.
  const totalPaid = getJobPaidAmount(job, payments);
  const remaining = Math.max(0, revenue - totalPaid);
  const today     = new Date().toLocaleDateString("ar-EG");
  const maintCost = maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0);

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
    <div class="page">
      <div class="header">
        <div>
          <h1>فاتورة عمل</h1>
          <p class="brand">زراعي برو · إدارة المعدات الزراعية</p>
        </div>
        <div class="meta">
          <p>تاريخ الطباعة: ${today}</p>
          <p>تاريخ ووقت العملية: ${formatDateTime(job.createdAt || job.date)}</p>
          <p style="margin-top:6px">${paymentBadge}</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box">
          <div class="stat-val">${escapeHtml(job.client) || "—"}</div>
          <div class="stat-lbl">اسم العميل / الأرض</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${escapeHtml(job.workType) || "—"}</div>
          <div class="stat-lbl">نوع العمل</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${formatNumber(job.acres)} فدان</div>
          <div class="stat-lbl">عدد الأفدنة</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${formatCurrency(job.pricePerAcre)}</div>
          <div class="stat-lbl">سعر الفدان</div>
        </div>
      </div>

      ${equipmentName || driverName ? `
      <div class="section">
        <h2>تفاصيل التشغيل</h2>
        <table>
          <tr><td style="font-weight:600">المعدة المستخدمة</td><td>${escapeHtml(equipmentName) || "—"}</td></tr>
          <tr><td style="font-weight:600">السائق</td><td>${escapeHtml(driverName) || "—"}</td></tr>
          <tr><td style="font-weight:600">الوقود المستخدم</td><td>${formatNumber(job.fuelUsed)} لتر</td></tr>
          <tr><td style="font-weight:600">تكلفة الوقود</td><td style="color:#991b1b">${formatCurrency(fuelCost)}</td></tr>
          ${maintenance.length ? `<tr><td style="font-weight:600">تكلفة الصيانة (المعدة)</td><td style="color:#991b1b">${formatCurrency(maintCost)}</td></tr>` : ""}
        </table>
      </div>` : ""}

      <div class="section">
        <h2>الملخص المالي</h2>
        <table>
          <tr><td style="font-weight:600">إجمالي الإيراد</td><td style="color:#15803d;font-weight:800">${formatCurrency(revenue)}</td></tr>
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

      <div class="footer">زراعي برو · تم إنشاء هذه الفاتورة تلقائياً · ${today}</div>
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

// ── 2. Equipment Report ───────────────────────────────────────────────────────
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

// ── 3. Monthly Summary ────────────────────────────────────────────────────────
export const printMonthlySummary = ({ jobs, equipment, maintenance, drivers, fuelPrice, month, year }) => {
  const today = new Date().toLocaleDateString("ar-EG");
  const monthLabel = new Date(year, month - 1).toLocaleDateString("ar-EG", { month:"long", year:"numeric" });

  const prefix = `${year}-${String(month).padStart(2,"0")}`;
  const monthJobs = jobs.filter((j) => j.date?.startsWith(prefix));

  const totalRevenue  = monthJobs.reduce((s, j) => s + (j.acres * j.pricePerAcre), 0);
  const totalAcres    = monthJobs.reduce((s, j) => s + (j.acres || 0), 0);
  const totalFuel     = monthJobs.reduce((s, j) => s + (j.fuelUsed || 0), 0);
  const totalFuelCost = totalFuel * fuelPrice;
  const maintCost     = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
  const netProfit     = totalRevenue - totalFuelCost - maintCost;

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
          <h1>التقرير الشهري</h1>
          <p class="brand">زراعي برو · ${monthLabel}</p>
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
          <tr class="total-row"><td>صافي الربح</td><td style="color:${netProfit>=0?"#15803d":"#991b1b"}">${formatCurrency(netProfit)}</td></tr>
        </table>
      </div>

      <div class="footer">زراعي برو · التقرير الشهري · ${monthLabel} · ${today}</div>
    </div>
  `;

  printWindow(html, `تقرير ${monthLabel}`);
};

// ── 4. Driver Payslip ─────────────────────────────────────────────────────────
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
          <p>السائق: ${escapeHtml(driver.name)}</p>
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

// ── 5. Custody Report (العهدة) ────────────────────────────────────────────────
const buildCustodyReportHtml = ({ transactions, totalExpenses, expensesByCategory, getLinkedName }) => {
  const today = new Date().toLocaleDateString("ar-EG");

  const categoryLabels = { equipment: "ميكنة", driver: "سائقين", other: "أخرى" };

  // التقرير المطبوع بيعرض المصروفات بس (من غير حركات الإضافة/الرصيد) —
  // شاشة العهدة في التطبيق نفسها لسه بتعرض كل الحركات والرصيد زي ما هي،
  // الفلترة دي خاصة بالتقرير المطبوع فقط.
  const expensesOnly = transactions.filter((t) => t.type !== "deposit");

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
    const amount = expensesByCategory?.[key] || 0;
    if (amount === 0) return "";
    return `<tr><td style="font-weight:600">${label}</td><td style="color:#991b1b">${formatCurrency(amount)}</td></tr>`;
  }).join("");

  const html = `
    <div class="page">
      <div class="header">
        <div>
          <h1>تقرير العهدة</h1>
          <p class="brand">زراعي برو · سجل المصروفات من العهدة</p>
        </div>
        <div class="meta">
          <p>تاريخ الطباعة: ${today}</p>
          <p>عدد الحركات: ${sorted.length}</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="stat-box" style="grid-column:1 / -1;">
          <div class="stat-val" style="color:#991b1b">${formatCurrency(totalExpenses)}</div>
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
            <td style="color:#991b1b">${formatCurrency(totalExpenses)}</td>
          </tr>
        </table>
      </div>` : `<div class="section"><p style="color:#666;text-align:center;padding:20px 0;">لا توجد حركات مسجلة بعد</p></div>`}

      <div class="footer">زراعي برو · تقرير العهدة · ${today}</div>
    </div>
  `;

  return { html, title: `تقرير العهدة - ${today}`, filename: `تقرير-العهدة-${today}` };
};

export const printCustodyReport = (args) => {
  const { html, title } = buildCustodyReportHtml(args);
  printWindow(html, title);
};

export const downloadCustodyReportPdf = (args) => {
  const { html, filename } = buildCustodyReportHtml(args);
  return downloadReportPdf(html, filename);
};
