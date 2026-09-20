// src/utils/pdf/core.js
// Shared engine used by every report builder in this folder: HTML escaping,
// the base print stylesheet, the letterhead ("invoice-style") stylesheet,
// opening the browser's print dialog, and downloading a real .pdf file.
// Split out of the old single pdfGenerator.js — behavior is unchanged,
// this file just holds the parts every report type needs.

// ── HTML escaping ──────────────────────────────────────────────────────────────
// كل نص جاي من المستخدم (اسم عميل، ملاحظات، اسم سائق...) بيتحط جوه الـ HTML
// كـ template string، والـ HTML ده بيتنفذ فعلياً في نافذة الطباعة
// (document.write) وفي التحميل (innerHTML). من غير escaping، نص زي
// "<img src=x onerror=...>" في حقل ملاحظات كان هيتنفذ كـ سكريبت وقت
// الطباعة/التحميل (Stored XSS). الدالة دي بتحول أي رمز خطير لـ HTML entity
// مكافئ بحيث يتعرض كنص عادي بس، من غير ما تغيّر أي حاجة تانية في الشكل.
export const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// ── Shared styles ─────────────────────────────────────────────────────────────
export const BASE_CSS = `
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
  /* رأس الجدول (thead) بيتكرر في كل صفحة جديدة لو الجدول اتقسم، عشان
     يفضل واضح كل عمود بيمثل إيه. */
  thead { display: table-header-group; }
  /* أي صف (حركة صرف/إضافة واحدة، أو صف تاني في أي جدول تقرير) ميتقطعش
     نصين بين صفحتين — لو مش هيكمل كامل في الصفحة الحالية، بينزل كامل في
     اللي بعدها. الاثنين (tr وtd) مطبّقين مع بعض لأن html2pdf أحيانًا
     بيقيس نقطة القطع من الخلية (td) نفسها مش الصف كله، فلو الاعتماد بقى
     على tr بس ممكن الخلية لسه تتقطع. !important عشان يغلب أي تنسيق تاني
     جاي من مكتبة الطباعة نفسها. بتشتغل مع نافذة الطباعة (window.print)
     على طول عن طريق CSS العادي، وبتتفعّل برضه في التحميل كـ PDF
     (html2pdf) عن طريق pagebreak.avoid في downloadReportPdf تحت. */
  tr, td {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* هامش صغير فاضل فوق وتحت كل صفحة مطبوعة (نافذة الطباعة) عشان النص
     ميوصلش لحرف الورقة بالظبط. الملف اللي بيتحمّل كـ PDF بياخد نفس
     الهامش من margin في downloadReportPdf مش من هنا، لأن html2pdf
     بيرندر الصفحة في صورة واحدة طويلة ويقطّعها بنفسه. */
  @page { margin: 14mm 10mm; }
`;

// ── Letterhead styles (client invoice / custody report) ──────────────────────
// عشان الفاتورة/تقرير العهدة يطلعوا "زي دي بالظبط" (تصميم خطاب رسمي معتمد)
// من غير ما نكرر كتابة بيانات الشركة (اسم/عنوان/سجل تجاري/رقم ضريبي) في كل
// عملية — دي بتتحفظ مرة واحدة في الإعدادات (بروفايل المستخدم) وبتتحقن هنا
// تلقائيًا. مشترك بين المُنشئين اللي بيستخدموا شكل "المعتمد" ده (الفاتورة
// وتقرير العهدة).
export const INVOICE_CSS = `
  .inv-page{ position:relative; overflow:hidden; }
  .inv-watermark{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    pointer-events:none; opacity:.04; transform:rotate(-18deg);
    font-size:120px; font-weight:800; color:#0f4c2a; white-space:nowrap;
  }
  .inv-header{
    display:flex; justify-content:space-between; align-items:flex-start;
    gap:20px; padding-bottom:20px; margin-bottom:24px; border-bottom:3px solid #0f4c2a;
  }
  .inv-company{display:flex; gap:14px; align-items:center;}
  .inv-logo-box{
    width:64px; height:64px; border-radius:14px; flex-shrink:0;
    background:linear-gradient(135deg,#16a34a,#0f4c2a);
    display:flex; align-items:center; justify-content:center;
    color:#fff; font-weight:800; font-size:22px;
  }
  .inv-company-name{font-size:19px; font-weight:800; color:#0f4c2a;}
  .inv-company-meta{font-size:11px; color:#6b7280; margin-top:3px; line-height:1.7;}
  .inv-meta{text-align:left; flex-shrink:0;}
  .inv-tag{
    /* لا letter-spacing هنا عمدًا: التباعد بين الحروف بيمنع حروف العربي من
       الاتصال ببعضها (كل حرف بيتفصل عن اللي بعده) بغض النظر عن الفونت
       المستخدم — وده بالظبط سبب تفكك الحروف في الشارة دي (نص عربي جوه
       .inv-tag)، مش مشكلة فونت. */
    display:inline-block; font-size:10px; font-weight:800;
    color:#0f4c2a; background:#dcfce7; padding:3px 10px; border-radius:999px; margin-bottom:6px;
  }
  .inv-no{font-size:20px; font-weight:800; color:#1a1a2e; font-variant-numeric:tabular-nums;}
  .inv-date{font-size:11px; color:#6b7280; margin-top:2px;}
  .inv-sign-section{
    display:grid; grid-template-columns:1fr 1fr; gap:24px;
    margin-top:28px; padding-top:18px; border-top:1px dashed #d1d5db;
  }
  .inv-sign-box{text-align:center;}
  .inv-sign-line{
    height:56px; border-bottom:1.5px solid #9ca3af; margin-bottom:8px;
    display:flex; align-items:flex-end; justify-content:center; position:relative;
  }
  .inv-sign-label{font-size:11px; font-weight:700; color:#374151;}
  .inv-sign-sub{font-size:10px; color:#9ca3af; margin-top:2px;}
  .inv-stamp-hint{
    position:absolute; bottom:6px; left:50%; transform:translateX(-50%) rotate(-8deg);
    width:78px; height:78px; border:2px dashed #16a34a55; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:9px; color:#16a34a99; font-weight:700; text-align:center; line-height:1.3;
  }
  .inv-badge-note{font-size:8.5px; color:#9ca3af; margin-top:5px; line-height:1.55; max-width:170px;}
  .inv-logo-img{
    width:64px; height:64px; border-radius:14px; flex-shrink:0;
    object-fit:contain; background:#fff; border:1px solid #e5e7eb;
  }
`;

// ── Open print window ─────────────────────────────────────────────────────────
export const printWindow = (htmlContent, title) => {
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

// ── Wait for the report font before rasterizing ──────────────────────────────
// BASE_CSS/INVOICE_CSS load Cairo via @import, which fetches asynchronously.
// html2canvas takes a "screenshot" of the container the moment it's called —
// with no wait, that screenshot can be taken before Cairo finishes loading
// (most likely the very first PDF generated after opening the app, or on a
// slow/flaky connection), so the browser falls back to a default font for
// that capture. A fallback font doesn't join Arabic letters into their
// connected forms the way Cairo does, which is exactly the "disconnected
// letters" / reordered-digits look reported on the custody report — the
// report's *numbers* were never wrong, only how that one rasterized
// snapshot drew them.
// document.fonts.ready resolves once every requested font has settled
// (loaded OR failed) — it can never hang waiting on a network that's down,
// so this stays safe under the offline-first requirement; wrapped in
// try/catch so an older browser without the Font Loading API still falls
// through to the previous (unguarded) behavior instead of breaking the
// download entirely.
const waitForReportFonts = async () => {
  try {
    await document.fonts.ready;
    await Promise.all(
      ["400", "600", "700", "800"].map((weight) => document.fonts.load(`${weight} 13px Cairo`))
    );
  } catch {
    // Font Loading API unsupported/failed — proceed with whatever font is
    // currently available rather than blocking the download.
  }
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
    await waitForReportFonts();
    await html2pdf()
      .set({
        // هامش فاضل فوق/تحت كل صفحة (وشوية على الجانبين) — بيتطبق على
        // كل صفحة في الملف (مش بس أول/آخر صفحة)، لأن html2pdf بيحسب
        // ارتفاع الصفحة المتاح كـ (ارتفاع الورقة - الهامش) وبيكرر نفس
        // الهامش مع كل قطع جديدة. [top, left, bottom, right] بوحدة jsPDF
        // (pt) المحددة تحت.
        margin: [28, 14, 28, 14],
        filename: `${filename}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
        // 'legacy' متعمّد مش موجود هنا: ده وضع بيحسب نقطة القطع بمسافة
        // بكسلات بس من غير ما يشوف page-break-inside:avoid خالص، فلو
        // اتحط مع 'css' ممكن يفرض قطع في نص صف حركة رغم إن الـCSS
        // (شوف tr/td في BASE_CSS) طالب صراحةً إنه ميتقطعش. 'css' لوحده
        // هو اللي فعليًا بيحترم القاعدة دي، وavoid هنا بيفرض نفس الحاجة
        // صراحةً على كل <tr> وكل <td> كمان كـ شبكة أمان.
        pagebreak: { mode: ["css"], avoid: ["tr", "td"] },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
};
