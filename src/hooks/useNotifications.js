// src/hooks/useNotifications.js
import { useMemo, useState, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { checkOverdueDebts } from "../utils/calculations";
import { findDuplicateSalaryEntries } from "../utils/findDuplicateSalaryEntries";
import { findOrphanedPayments, findOrphanedSupplierPayments } from "../utils/findOrphanedPayments";
import { calcCustodyBalance } from "../utils/custodyCalculations";
import { checkEquipmentReminders, checkJobReminders } from "../utils/maintenanceAlerts";
import { EQUIPMENT_CATEGORY } from "../config/constants";
import { formatCurrency, formatDateShort } from "../utils/formatters";
import { useAdminMessages } from "./useAdminMessages";

// حالة "مقروء" و"محذوف" لكل تنبيه متخزنة محلياً على الجهاز (زي فكرة
// dismissedAdminMsgs بالظبط) — عشان التنبيهات دي مُشتقّة من البيانات
// مش موجودة كمستندات في Firestore أصلاً، فمفيش حاجة نحدّثها هناك.
const readKey   = (uid) => `readNotifs:${uid}`;
const hiddenKey = (uid) => `hiddenNotifs:${uid}`;

const loadSet = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
};
const saveSet = (key, set) => localStorage.setItem(key, JSON.stringify([...set]));

/**
 * Derives all active alerts from existing data — no extra Firestore reads.
 * Returns sorted list of notifications with type, severity, date, read state,
 * and action info, plus helpers to mark-read / delete (single or bulk).
 */
export const useNotifications = () => {
  const {
    jobs, payments, settings, custody, salaryEntries = [], drivers = [],
    supplierInvoices = [], supplierPayments = [], equipment = [], loading,
  } = useData();
  const { user } = useAuth();
  const { messages: adminMessages, loading: adminLoading, dismiss } = useAdminMessages();

  const [version, setVersion] = useState(0); // بيتغيّر عشان نجبر إعادة الحساب بعد أي تعديل محلي
  const uid = user?.uid || "anon";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const readSet   = useMemo(() => loadSet(readKey(uid)),   [uid, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hiddenSet = useMemo(() => loadSet(hiddenKey(uid)), [uid, version]);

  const latestCustodyDate = useMemo(
    () => [...custody].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]?.date || null,
    [custody]
  );

  const debtAlerts = useMemo(
    () => checkOverdueDebts(jobs, settings.fuelPrice, 30, payments),
    [jobs, settings.fuelPrice, payments]
  );

  // Same balance calculation useCustody.js uses — pulled from the shared,
  // tested custodyCalculations.js so the two never drift apart (they were a
  // hand-copied duplicate of each other before this change).
  const custodyBalance = useMemo(() => calcCustodyBalance(custody).balance, [custody]);

  // Possible duplicate salaryEntries left over from the old driverCosts
  // migration (see utils/findDuplicateSalaryEntries.js). Detection only —
  // nothing here deletes anything; it just surfaces groups for review on
  // the relevant driver's page, same as any other data-derived alert.
  const salaryDuplicateReport = useMemo(
    () => findDuplicateSalaryEntries(salaryEntries),
    [salaryEntries]
  );

  const salaryDuplicatesByDriver = useMemo(() => {
    const byDriver = new Map();
    [...salaryDuplicateReport.highConfidence, ...salaryDuplicateReport.needsReview].forEach((group) => {
      const driverId = group.keep?.driverId || group.duplicates[0]?.driverId;
      if (!driverId) return;
      const entry = byDriver.get(driverId) || { count: 0, hasHighConfidence: false };
      entry.count += group.duplicates.length;
      if (salaryDuplicateReport.highConfidence.includes(group)) entry.hasHighConfidence = true;
      byDriver.set(driverId, entry);
    });
    return byDriver;
  }, [salaryDuplicateReport]);

  // (audit finding B4/F3) Payments/supplierPayments whose job/invoice no
  // longer exists — see utils/findOrphanedPayments.js for the full
  // background. Detection only, computed purely from data already loaded
  // by the app (no extra Firestore reads); nothing here deletes or
  // changes anything. Expected to be empty in the overwhelming majority
  // of sessions — it only ever finds something after a genuine offline
  // cross-device race on the same job/invoice.
  const orphanedPayments = useMemo(() => findOrphanedPayments(jobs, payments), [jobs, payments]);
  const orphanedSupplierPayments = useMemo(
    () => findOrphanedSupplierPayments(supplierInvoices, supplierPayments),
    [supplierInvoices, supplierPayments]
  );

  // "تنبيهات هامة" — Phase 1 of the smart-alerts feature: purely derived
  // from equipment/job fields the user fills in themselves (see
  // utils/maintenanceAlerts.js for the full rationale). No Cloud Functions,
  // no push, nothing stored beyond the optional fields on equipment/jobs
  // already used to compute these.
  const equipmentReminders = useMemo(() => checkEquipmentReminders(equipment), [equipment]);
  const jobReminders       = useMemo(() => checkJobReminders(jobs), [jobs]);

  const notifications = useMemo(() => {
    const list = [];

    // Debt alerts
    debtAlerts.forEach(({ job, remaining, daysDiff }) => {
      list.push({
        id:       `debt-${job.id}`,
        type:     "debt_overdue",
        severity: daysDiff > 60 ? "high" : "medium",
        title:    `${job.client} — مستحق متأخر`,
        body:     `${remaining.toLocaleString("en-US")} ج.م متأخر منذ ${daysDiff} يوم`,
        date:     job.date,
        jobId:    job.id,
        client:   job.client,
        remaining,
        actionLabel: "عرض العميل",
        actionPath:  `/clients/${encodeURIComponent(job.client)}`,
      });
    });

    // Custody overdrawn alert — only when balance actually goes negative,
    // no arbitrary low-balance threshold.
    if (custody.length > 0 && custodyBalance < 0) {
      list.push({
        id:       "custody-overdrawn",
        type:     "custody_overdrawn",
        severity: "high",
        title:    "رصيد العهدة بالسالب",
        body:     `المصروفات تجاوزت المبلغ المُسلَّم بـ ${Math.abs(custodyBalance).toLocaleString("en-US")} ج.م`,
        date:     latestCustodyDate,
        actionLabel: "عرض العهدة",
        actionPath:  "/custody",
      });
    }

    // Possible duplicate salary entries (from the legacy driverCosts
    // migration) — report-only, one per affected driver, so they can be
    // reviewed and removed manually from the driver's page if confirmed.
    salaryDuplicatesByDriver.forEach((info, driverId) => {
      const driver = drivers.find((d) => d.id === driverId);
      list.push({
        id:       `salary-dup-${driverId}`,
        type:     "duplicate_salary_entries",
        severity: info.hasHighConfidence ? "high" : "medium",
        title:    `${driver?.name || "سائق"} — قيود رواتب مكررة محتملة`,
        body:     `${info.count} قيد ممكن يكون منقول مرتين من نظام التكاليف القديم — راجعها قبل الحذف`,
        date:     null,
        driverId,
        actionLabel: "مراجعة سجل الراتب",
        actionPath:  `/drivers/${driverId}`,
      });
    });

    // Orphaned payments/supplierPayments (audit finding B4/F3) — job or
    // supplier invoice no longer exists for this payment, almost always
    // caused by an offline edit race between two devices. Reported for
    // manual review; the app has no automatic delete for these (unlike
    // the duplicate-salary-entry case above) since the data itself is
    // still a real payment that was actually received — a human decision,
    // not something safe to script.
    orphanedPayments.forEach((p) => {
      list.push({
        id:       `orphan-payment-${p.id}`,
        type:     "orphaned_payment",
        severity: "medium",
        title:    "دفعة بدون عملية مرتبطة",
        body:     `دفعة بمبلغ ${formatCurrency(p.amount)} مش مرتبطة بأي عملية حالية (العملية اتمسحت بعد ما الدفعة دي اتسجلت من جهاز تاني). راجعها يدويًا.`,
        date:     p.date || null,
      });
    });
    orphanedSupplierPayments.forEach((p) => {
      list.push({
        id:       `orphan-supplier-payment-${p.id}`,
        type:     "orphaned_payment",
        severity: "medium",
        title:    "دفعة مورد بدون فاتورة مرتبطة",
        body:     `دفعة بمبلغ ${formatCurrency(p.amount)} مش مرتبطة بأي فاتورة مورد حالية (الفاتورة اتمسحت بعد ما الدفعة دي اتسجلت من جهاز تاني). راجعها يدويًا.`,
        date:     p.date || null,
      });
    });

    // Equipment reminder-date alerts (date-based) — staged by closeness.
    // Same field/logic for base equipment (oil change) and attachments
    // (grease); only the wording differs by category.
    equipmentReminders.forEach(({ equipment: eq, dueDate, daysUntil }) => {
      const overdue = daysUntil < 0;
      const isAttachment = eq.category === EQUIPMENT_CATEGORY.ATTACHMENT;
      const label = isAttachment ? "تشحيم" : "غيار زيت";
      const verb  = isAttachment ? "يتشحم" : "يتغير زيته";
      list.push({
        id:       `equip-reminder-${eq.id}`,
        type:     "equipment_reminder_due",
        severity: overdue || daysUntil <= 1 ? "high" : "medium",
        title:    `${eq.name} — موعد ${label} ${overdue ? "متأخر" : "قريب"}`,
        body:     overdue
          ? `كان مفروض ${verb} في ${formatDateShort(dueDate)} (من ${Math.abs(daysUntil)} يوم)`
          : daysUntil === 0
            ? `موعد ${label} النهاردة`
            : `موعد ${label} بعد ${daysUntil} يوم (${formatDateShort(dueDate)})`,
        date:     null,
        actionLabel: "فتح المعدة",
        actionPath:  `/equipment/${eq.id}`,
      });
    });

    // Job/debt reminder-date alerts — staged the same way as grease alerts.
    jobReminders.forEach(({ job, dueDate, daysUntil }) => {
      const overdue = daysUntil < 0;
      list.push({
        id:       `job-reminder-${job.id}`,
        type:     "job_reminder_due",
        severity: overdue || daysUntil <= 1 ? "high" : "medium",
        title:    `${job.client} — تذكير ${overdue ? "متأخر" : "قريب"}`,
        body:     overdue
          ? `كان مفروض تتابع مع العميل في ${formatDateShort(dueDate)} (من ${Math.abs(daysUntil)} يوم)`
          : daysUntil === 0
            ? "التذكير النهاردة"
            : `التذكير بعد ${daysUntil} يوم (${formatDateShort(dueDate)})`,
        date:     null,
        actionLabel: "عرض العميل",
        actionPath:  `/clients/${encodeURIComponent(job.client)}`,
      });
    });

    // Admin broadcast/targeted messages — دايماً فوق كل حاجة تانية،
    // بترتيبها هي بالتاريخ (الأحدث الأول)، مش متدمجة مع ترتيب severity
    // بتاع باقي التنبيهات عشان تفضل واضحة إنها من الإدارة.
    const adminItems = adminMessages.map((m) => ({
      id:       `admin-${m.id}`,
      type:     "admin_message",
      severity: m.severity || "medium",
      title:    m.title,
      body:     m.body,
      date:     m.createdAt,
      dismissible: true,
      onDismiss: () => dismiss(m.id),
    }));

    // Sort: high severity first, then by title
    const sorted = list.sort((a, b) => {
      if (a.severity === "high" && b.severity !== "high") return -1;
      if (b.severity === "high" && a.severity !== "high") return  1;
      return a.title.localeCompare(b.title, "ar");
    });

    return [...adminItems, ...sorted]
      .filter((n) => !hiddenSet.has(n.id))
      .map((n) => ({ ...n, read: readSet.has(n.id) }));
  }, [debtAlerts, custody, custodyBalance, latestCustodyDate, salaryDuplicatesByDriver, drivers, orphanedPayments, orphanedSupplierPayments, equipmentReminders, jobReminders, adminMessages, dismiss, readSet, hiddenSet]);

  const bump = () => setVersion((v) => v + 1);

  const markRead = useCallback((id) => {
    const s = loadSet(readKey(uid)); s.add(id); saveSet(readKey(uid), s); bump();
  }, [uid]);

  const markAllRead = useCallback(() => {
    const s = loadSet(readKey(uid));
    notifications.forEach((n) => s.add(n.id));
    saveSet(readKey(uid), s); bump();
  }, [uid, notifications]);

  const removeOne = useCallback((n) => {
    if (n.dismissible && n.onDismiss) { n.onDismiss(); return; }
    const s = loadSet(hiddenKey(uid)); s.add(n.id); saveSet(hiddenKey(uid), s); bump();
  }, [uid]);

  const removeAll = useCallback(() => {
    const s = loadSet(hiddenKey(uid));
    notifications.forEach((n) => {
      if (n.dismissible && n.onDismiss) n.onDismiss();
      else s.add(n.id);
    });
    saveSet(hiddenKey(uid), s); bump();
  }, [uid, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const highCount   = notifications.filter((n) => n.severity === "high").length;
  const totalCount  = notifications.length;

  return {
    notifications, highCount, totalCount, unreadCount,
    loading: loading || adminLoading,
    markRead, markAllRead, removeOne, removeAll,
  };
};