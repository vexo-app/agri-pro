// src/services/backupToExcelService.js
// ─────────────────────────────────────────────────────────
// أدمن بس: بياخد بيانات نسخة احتياطية يدوية (نفس الشكل اللي بينزله
// exportService.downloadBackupFile — { equipment, jobs, drivers,
// maintenance, payments, salaryEntries, attendance,
// custodyTransactions, settings }) ويحوّلها لملف Excel واحد فيه
// شيتات منفصلة ومترابطة (IDs اتحولت لأسامي حقيقية)، جاهز يتبعت
// للمستخدم كمرجع كامل لبياناته من غير ما يضيع أي حقل من الأصل.
//
// كل شيت بيحتفظ بعمود "معرف" (الـ id الأصلي من قاعدة البيانات) في
// آخر عمود، عشان لو حصل أي لبس يقدر حد يرجع للمصدر بالظبط.
// ─────────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  DRIVER_STATUS_LABELS,
  SALARY_ENTRY_LABELS,
  ATTENDANCE_LABELS,
  CUSTODY_TYPE_LABELS,
  CUSTODY_EXPENSE_CATEGORY_LABELS,
} from "../config/constants";

// ─── Helpers ─────────────────────────────────────────────────────────────

const num = (v) => Number(v) || 0;

const arr = (v) => (Array.isArray(v) ? v : []);

// بيرجع القيمة أو "—" لو فاضية، عشان أي خانة في الإكسيل متبقاش undefined
const orDash = (v) => (v === undefined || v === null || v === "" ? "—" : v);

const formatDate = (d) => {
  if (!d) return "—";
  try {
    // بيدعم كل الأشكال المحتملة: نص ISO، أو Firestore Timestamp لو
    // اتحول لـ JSON فبيبقى { seconds, nanoseconds }
    if (typeof d === "object" && d.seconds) {
      return new Date(d.seconds * 1000).toLocaleDateString("ar-EG");
    }
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString("ar-EG");
  } catch {
    return String(d);
  }
};

const formatDateTime = (d) => {
  if (!d) return "—";
  try {
    if (typeof d === "object" && d.seconds) {
      return new Date(d.seconds * 1000).toLocaleString("ar-EG");
    }
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleString("ar-EG");
  } catch {
    return String(d);
  }
};

// بيبني شيت من مصفوفة صفوف (array of plain objects) مع عرض أعمدة تلقائي
const buildSheet = (rows) => {
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => String(r[h] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
    });
  }
  // تجميد أول صف (العناوين) عشان القراءة تكون أسهل مع القوائم الطويلة
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  return ws;
};

// ─── المحرك الأساسي ──────────────────────────────────────────────────────

const convert = (backupData, meta = {}) => {
  const data = backupData || {};
  const equipment = arr(data.equipment);
  const drivers = arr(data.drivers);
  const jobs = arr(data.jobs);
  const maintenance = arr(data.maintenance);
  const payments = arr(data.payments);
  const salaryEntries = arr(data.salaryEntries);
  const attendance = arr(data.attendance);
  const custody = arr(data.custodyTransactions || data.custody);
  const settings = data.settings || {};

  // ── خرائط بحث سريعة (id → اسم) ─────────────────────────────────────────
  const driverName = (id, customName) => {
    if (!id) return customName ? customName : "—";
    const d = drivers.find((x) => x.id === id);
    return d ? d.name : `سائق محذوف (${id})`;
  };

  const equipmentName = (id, customName) => {
    if (!id) return customName ? customName : "—";
    const e = equipment.find((x) => x.id === id);
    return e ? e.name : `معدة محذوفة (${id})`;
  };

  const jobById = (id) => jobs.find((j) => j.id === id) || null;

  // ── دفعات كل عملية، عشان نحسب "المدفوع فعليًا" من مصدر الحقيقة
  //    (شيت الدفعات) بدل ما نعتمد على حقل قديم على العملية نفسها ───────
  const paidByJobId = {};
  payments.forEach((p) => {
    if (!p.jobId) return;
    paidByJobId[p.jobId] = (paidByJobId[p.jobId] || 0) + num(p.amount);
  });

  // ═══════════════════════ 1) شيت العمليات ═══════════════════════════════
  const fuelPrice = num(settings.fuelPrice) || 12;
  const jobRows = jobs.map((j) => {
    const revenue = num(j.acres) * num(j.pricePerAcre);
    const fuelCost = num(j.fuelUsed) * fuelPrice;
    const paidActual = paidByJobId[j.id] || 0;
    const remaining = revenue - paidActual;
    return {
      "التاريخ": formatDate(j.date),
      "العميل / الأرض": orDash(j.client),
      "المعدة": equipmentName(j.equipmentId),
      "السائق": driverName(j.driverId),
      "نوع العمل": orDash(j.workType),
      "عدد الأفدنة": num(j.acres),
      "سعر الفدان (ج.م)": num(j.pricePerAcre),
      "الإيراد (ج.م)": revenue,
      "الوقود المستخدم (لتر)": num(j.fuelUsed),
      "تكلفة الوقود (ج.م)": fuelCost,
      "صافي الربح (ج.م)": revenue - fuelCost,
      "دفعة أولى عند التسجيل (ج.م)": num(j.amountPaid),
      "إجمالي المدفوع فعليًا (ج.م)": paidActual,
      "المتبقي (ج.م)": remaining,
      "ملاحظات": orDash(j.notes),
      "معرف": j.id,
    };
  });

  // ═══════════════════════ 2) شيت المعدات ═════════════════════════════════
  const equipmentRows = equipment.map((e) => {
    const isAttachment = e.category === "attachment";
    return {
      "الاسم": orDash(e.name),
      "الفئة": EQUIPMENT_CATEGORY_LABELS[e.category] || orDash(e.category),
      "النوع": orDash(e.type),
      "السائق المسؤول": isAttachment ? "—" : driverName(e.driverId, e.customDriverName),
      "معدل استهلاك الوقود (لتر/ساعة)": isAttachment ? "—" : num(e.fuelRate),
      "متعلقة على معدة": isAttachment ? equipmentName(e.parentEquipmentId, e.customParentName) : "—",
      "الحالة": EQUIPMENT_STATUS_LABELS[e.status] || orDash(e.status),
      "آخر قراءة عداد لتغيير الزيت": isAttachment ? "—" : orDash(e.lastOilChangeMeter),
      "عدد مرات تغيير الزيت المسجلة": isAttachment ? "—" : arr(e.oilChangeHistory).length,
      "آخر تاريخ شحم": isAttachment ? orDash(e.lastGreaseDate) : "—",
      "عدد مرات الشحم المسجلة": isAttachment ? arr(e.greaseHistory).length : "—",
      "معرف": e.id,
    };
  });

  // ═══════════════════════ 3) شيت السائقين ════════════════════════════════
  const driverRows = drivers.map((d) => {
    const driverJobs = jobs.filter((j) => j.driverId === d.id);
    const driverEquipment = equipment.filter((e) => e.driverId === d.id);
    return {
      "الاسم": orDash(d.name),
      "رقم الهاتف": orDash(d.phone),
      "الراتب الشهري (ج.م)": num(d.salary),
      "الحالة": DRIVER_STATUS_LABELS[d.status] || orDash(d.status),
      "عدد المعدات المسؤول عنها": driverEquipment.length,
      "عدد العمليات المنفذة": driverJobs.length,
      "معرف": d.id,
    };
  });

  // ═══════════════════════ 4) شيت الصيانة ═════════════════════════════════
  const maintenanceRows = maintenance.map((m) => ({
    "التاريخ": formatDate(m.date),
    "المعدة": equipmentName(m.equipmentId),
    "نوع الصيانة": orDash(m.type),
    "التكلفة (ج.م)": num(m.cost),
    "ملاحظات": orDash(m.notes),
    "معرف": m.id,
  }));

  // ═══════════════════════ 5) شيت الدفعات ═════════════════════════════════
  const paymentRows = payments.map((p) => {
    const job = jobById(p.jobId);
    return {
      "التاريخ": formatDate(p.date),
      "العميل / الأرض": job ? orDash(job.client) : `عملية محذوفة (${p.jobId || "—"})`,
      "المعدة": job ? equipmentName(job.equipmentId) : "—",
      "المبلغ المدفوع (ج.م)": num(p.amount),
      "ملاحظات": orDash(p.notes),
      "معرف العملية": orDash(p.jobId),
      "معرف": p.id,
    };
  });

  // ═══════════════════════ 6) شيت المرتبات ════════════════════════════════
  const salaryRows = salaryEntries.map((s) => ({
    "التاريخ": formatDate(s.date),
    "السائق": driverName(s.driverId),
    "نوع القيد": SALARY_ENTRY_LABELS[s.type] || orDash(s.type),
    "المبلغ (ج.م)": num(s.amount),
    "السبب": orDash(s.reason),
    "تم الدفع": s.paid === false ? "لا" : "نعم",
    "ملاحظات": orDash(s.notes),
    "معرف": s.id,
  }));

  // ═══════════════════════ 7) شيت الحضور ══════════════════════════════════
  const attendanceRows = attendance.map((a) => ({
    "التاريخ": formatDate(a.date),
    "السائق": driverName(a.driverId),
    "الحالة": ATTENDANCE_LABELS[a.status] || orDash(a.status),
    "ملاحظات": orDash(a.notes),
    "معرف": a.id,
  }));

  // ═══════════════════════ 8) شيت العهدة (برصيد تراكمي) ═══════════════════
  const custodySorted = [...custody].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return da - db;
  });
  let runningBalance = 0;
  const custodyRows = custodySorted.map((c) => {
    const isExpense = c.type === "expense";
    const delta = isExpense ? -num(c.amount) : num(c.amount);
    runningBalance += delta;

    let linkedTo = "—";
    if (isExpense) {
      if (c.category === "equipment") linkedTo = equipmentName(c.equipmentId);
      else if (c.category === "driver") linkedTo = driverName(c.driverId);
      else if (c.category === "other") linkedTo = orDash(c.otherLabel);
    }

    return {
      "التاريخ": formatDate(c.date),
      "نوع الحركة": CUSTODY_TYPE_LABELS[c.type] || orDash(c.type),
      "المبلغ (ج.م)": num(c.amount),
      "بند الصرف": isExpense ? (CUSTODY_EXPENSE_CATEGORY_LABELS[c.category] || orDash(c.category)) : "—",
      "مرتبطة بـ": linkedTo,
      "مصدر المبلغ": !isExpense ? orDash(c.source) : "—",
      "الرصيد بعد الحركة (ج.م)": runningBalance,
      "ملاحظات": orDash(c.notes),
      "معرف": c.id,
    };
  });
  const custodyBalance = runningBalance;

  // ═══════════════════════ 9) شيت الإعدادات ═══════════════════════════════
  const settingsRows = Object.entries(settings).map(([key, value]) => ({
    "المفتاح": key,
    "القيمة": typeof value === "object" ? JSON.stringify(value) : orDash(value),
  }));
  if (settingsRows.length === 0) {
    settingsRows.push({ "المفتاح": "—", "القيمة": "لا توجد إعدادات محفوظة" });
  }

  // ═══════════════════════ 0) شيت الملخص (بيتحط أول شيت) ══════════════════
  const totalRevenue = jobRows.reduce((sum, r) => sum + r["الإيراد (ج.م)"], 0);
  const totalPaid = jobRows.reduce((sum, r) => sum + r["إجمالي المدفوع فعليًا (ج.م)"], 0);
  const totalRemaining = totalRevenue - totalPaid;
  const totalMaintenanceCost = maintenanceRows.reduce((sum, r) => sum + r["التكلفة (ج.م)"], 0);
  const totalFuelCost = jobRows.reduce((sum, r) => sum + r["تكلفة الوقود (ج.م)"], 0);

  const summaryRows = [
    { "البيان": "اسم الحساب / المستخدم", "القيمة": orDash(meta.userLabel) },
    { "البيان": "تاريخ تصدير النسخة الاحتياطية الأصلية", "القيمة": meta.exportedAt ? formatDateTime(meta.exportedAt) : "—" },
    { "البيان": "تاريخ تحويل هذا الملف", "القيمة": formatDateTime(new Date().toISOString()) },
    { "البيان": "—", "القيمة": "—" },
    { "البيان": "عدد المعدات", "القيمة": equipmentRows.length },
    { "البيان": "عدد السائقين", "القيمة": driverRows.length },
    { "البيان": "عدد العمليات", "القيمة": jobRows.length },
    { "البيان": "عدد سجلات الصيانة", "القيمة": maintenanceRows.length },
    { "البيان": "عدد الدفعات", "القيمة": paymentRows.length },
    { "البيان": "عدد قيود المرتبات", "القيمة": salaryRows.length },
    { "البيان": "عدد سجلات الحضور", "القيمة": attendanceRows.length },
    { "البيان": "عدد حركات العهدة", "القيمة": custodyRows.length },
    { "البيان": "—", "القيمة": "—" },
    { "البيان": "إجمالي الإيراد (ج.م)", "القيمة": totalRevenue },
    { "البيان": "إجمالي المدفوع فعليًا (ج.م)", "القيمة": totalPaid },
    { "البيان": "إجمالي المتبقي على العملاء (ج.م)", "القيمة": totalRemaining },
    { "البيان": "إجمالي تكلفة الوقود (ج.م)", "القيمة": totalFuelCost },
    { "البيان": "إجمالي تكلفة الصيانة (ج.م)", "القيمة": totalMaintenanceCost },
    { "البيان": "رصيد العهدة الحالي (ج.م)", "القيمة": custodyBalance },
  ];

  // ── بناء الملف ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const addSheet = (rows, name) => {
    XLSX.utils.book_append_sheet(wb, buildSheet(rows), name);
  };

  addSheet(summaryRows, "الملخص");
  addSheet(equipmentRows, "المعدات");
  addSheet(driverRows, "السائقين");
  addSheet(jobRows, "العمليات");
  addSheet(maintenanceRows, "الصيانة");
  addSheet(paymentRows, "الدفعات");
  addSheet(salaryRows, "المرتبات");
  addSheet(attendanceRows, "الحضور");
  addSheet(custodyRows, "العهدة");
  addSheet(settingsRows, "الإعدادات");

  return wb;
};

// اسم ملف آمن (بيشيل الرموز اللي ممكن تبوّظ اسم الملف على أي نظام تشغيل)
const safeFileName = (label) =>
  String(label || "مستخدم")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 60);

const convertAndDownload = (backupData, meta = {}) => {
  const wb = convert(backupData, meta);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `نسخة-${safeFileName(meta.userLabel)}-${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName, { compression: true });
};

export const backupToExcelService = {
  convert,
  convertAndDownload,
};
