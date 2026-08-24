// src/hooks/useNotifications.js
import { useMemo, useState, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { checkMaintenanceDue, checkOverdueDebts } from "../utils/calculations";
import { CUSTODY_TYPES } from "../config/constants";
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
  const { equipment, maintenance, jobs, payments, settings, custody, loading } = useData();
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

  const maintenanceAlerts = useMemo(
    () => checkMaintenanceDue(equipment, maintenance, 14),
    [equipment, maintenance]
  );

  const debtAlerts = useMemo(
    () => checkOverdueDebts(jobs, settings.fuelPrice, 30, payments),
    [jobs, settings.fuelPrice, payments]
  );

  const custodyBalance = useMemo(() => {
    const deposits = custody
      .filter((c) => c.type === CUSTODY_TYPES.DEPOSIT)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const expenses = custody
      .filter((c) => c.type === CUSTODY_TYPES.EXPENSE)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return deposits - expenses;
  }, [custody]);

  const notifications = useMemo(() => {
    const list = [];

    // Maintenance alerts
    maintenanceAlerts.forEach(({ equipment: eq, daysLeft, isOverdue }) => {
      list.push({
        id:       `maint-${eq.id}`,
        type:     "maintenance_due",
        severity: isOverdue ? "high" : "medium",
        title:    isOverdue
          ? `${eq.name} — تجاوز موعد الصيانة`
          : `${eq.name} — موعد الصيانة قريب`,
        body: isOverdue
          ? `تأخر الصيانة بـ ${Math.abs(daysLeft)} يوم`
          : `باقي ${daysLeft} يوم للصيانة`,
        date: new Date(Date.now() + daysLeft * 86400000).toISOString(),
        equipmentId: eq.id,
        actionLabel: "عرض المعدة",
        actionPath:  `/equipment/${eq.id}`,
      });
    });

    // Debt alerts
    debtAlerts.forEach(({ job, remaining, daysDiff }) => {
      list.push({
        id:       `debt-${job.id}`,
        type:     "debt_overdue",
        severity: daysDiff > 60 ? "high" : "medium",
        title:    `${job.client} — مستحق متأخر`,
        body:     `${remaining.toLocaleString("ar-EG")} ج.م متأخر منذ ${daysDiff} يوم`,
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
        body:     `المصروفات تجاوزت المبلغ المُسلَّم بـ ${Math.abs(custodyBalance).toLocaleString("ar-EG")} ج.م`,
        date:     latestCustodyDate,
        actionLabel: "عرض العهدة",
        actionPath:  "/custody",
      });
    }

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
  }, [maintenanceAlerts, debtAlerts, custody, custodyBalance, latestCustodyDate, adminMessages, dismiss, readSet, hiddenSet]);

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
