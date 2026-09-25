// src/pages/DriversPage.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useDrivers }     from "../hooks/useDrivers";
import { useSalary }      from "../hooks/useSalary";
import { useConfirm }     from "../hooks/useConfirm";
import { useEntitlement } from "../hooks/useEntitlement";
import { useData }        from "../contexts/DataContext";
import DriverForm         from "../features/drivers/DriverForm";
import DriverCard         from "../features/drivers/DriverCard";
import BulkSendDialog     from "../features/messaging/BulkSendDialog";
import Modal              from "../components/ui/Modal";
import ConfirmDialog      from "../components/ui/ConfirmDialog";
import Button             from "../components/ui/Button";
import { StatCard, EmptyState } from "../components/ui/Card";
import LoadingScreen      from "../components/ui/LoadingScreen";
import PrivacyToggle      from "../components/ui/PrivacyToggle";
import {
  PlusIcon, DriverIcon, UserIcon, RevenueIcon, ClearIcon, CheckCircleIcon, WalletIcon,
  AlertIcon, EditIcon, WhatsAppIcon,
} from "../components/ui/Icons";
import { formatCurrency, todayISO } from "../utils/formatters";
import {
  DRIVER_STATUS, SALARY_ENTRY_TYPES, TEAM_ROLE,
} from "../config/constants";
import { trackEvent } from "../config/posthog";

// ── فريق العمل: تبويبين بيفلتروا نفس القايمة حسب "نوع العضو" ────────────────
// نفس البيانات، نفس الفورم، نفس منطق الرواتب/الحضور — فرق واحد بس بيتفلتر
// عليه (role)، عشان المعمارية تفضل بسيطة (كيان واحد، مش فيتشر جديد).
const TABS = [
  { role: TEAM_ROLE.DRIVER, label: "السائقون",             Icon: DriverIcon },
  { role: TEAM_ROLE.STAFF,  label: "الإداريون والمحاسبون", Icon: UserIcon   },
];

const DriversPage = () => {
  const {
    report, loading, addDriver, updateDriver, deleteDriver,
    getDriverDependencyCounts,
  } = useDrivers();
  const {
    addSalaryEntry, deleteSalaryEntry, salaryEntries, currentMonth,
    getMonthSummary, getDriverAttendance,
  } = useSalary();
  const { settings } = useData();
  const { confirm, confirmState } = useConfirm();
  const { canAddTeamMember, plan: currentPlan } = useEntitlement();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TEAM_ROLE.DRIVER);
  const [modal, setModal]         = useState(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [search, setSearch]       = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [payTarget, setPayTarget]     = useState(null); // driver currently being paid via quick-pay
  const [paying, setPaying]           = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // driver currently having their payment cancelled
  const [cancelling, setCancelling]     = useState(false);
  // (audit finding B2) member with dependent history the user just tried to
  // delete — { drv, counts } | null. Blocks the delete outright instead of
  // just warning and still allowing it (see handleDeleteDriver below).
  const [blockedDeleteTarget, setBlockedDeleteTarget] = useState(null);

  // أعضاء التبويب الحالي بس (السائقين، أو الإداريين والمحاسبين)
  const tabReport = useMemo(
    () => report.filter((d) => (d.role || TEAM_ROLE.DRIVER) === activeTab),
    [report, activeTab]
  );
  const tabMemberIds = useMemo(() => new Set(tabReport.map((d) => d.id)), [tabReport]);

  // Salary-wide totals for THIS MONTH — scoped to the active tab only, so
  // the KPI numbers above always match exactly what's listed below them.
  const salaryTotals = useMemo(() => {
    const activeWithSalary = tabReport.filter(
      (d) => d.status !== DRIVER_STATUS.INACTIVE && Number(d.salary) > 0
    );
    const baseDue = activeWithSalary.reduce((s, d) => s + (Number(d.salary) || 0), 0);

    // الحوافز بتزيد المستحق، والخصومات (وسداد السلف) بتقلله — نفس منطق ملخص
    // الشهر في صفحة السائق، عشان الرقمين يفضلوا متطابقين دايمًا.
    const bonusesThisMonth = salaryEntries
      .filter((e) =>
        e.type === SALARY_ENTRY_TYPES.BONUS &&
        tabMemberIds.has(e.driverId) &&
        (e.date || "").startsWith(currentMonth)
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // الخصم والجزاء الاتنين بيقللوا اللي هيتصرف للعامل، والخصم المرحّل من
    // الشهر اللي فات كمان (نفس صافي صفحة العضو: getMonthSummary).
    const deductionsThisMonth = salaryEntries
      .filter((e) =>
        (e.type === SALARY_ENTRY_TYPES.DEDUCTION || e.type === SALARY_ENTRY_TYPES.PENALTY) &&
        tabMemberIds.has(e.driverId) &&
        (e.date || "").startsWith(currentMonth)
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
      + tabReport.reduce((s, d) => s + (getMonthSummary(d.id, currentMonth).carriedDeduction || 0), 0);

    const due = Math.max(0, baseDue + bonusesThisMonth - deductionsThisMonth);

    const paid = salaryEntries
      .filter((e) =>
        e.type === SALARY_ENTRY_TYPES.BASE &&
        e.paid &&
        tabMemberIds.has(e.driverId) &&
        (e.date || "").startsWith(currentMonth)
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const remaining = Math.max(0, due - paid);

    // baseDue = مجموع الرواتب الأساسية الثابتة للأعضاء النشطين بس — ده اللي
    // بيتعرض في كارت "إجمالي رواتب الشهر المستحقة" عشان يفضل رقم ثابت كل شهر
    // (المالك المفروض يدفع كام). "المتبقي" لسه محسوب من due زي ما هو.
    return { baseDue, due, paid, remaining, deductionsThisMonth };
  }, [tabReport, tabMemberIds, salaryEntries, currentMonth, getMonthSummary]);

  const visibleDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabReport.filter((d) => {
      if (!showInactive && d.status === DRIVER_STATUS.INACTIVE) return false;
      if (!q) return true;
      return d.name?.toLowerCase().includes(q) || d.phone?.toLowerCase().includes(q);
    });
  }, [tabReport, search, showInactive]);

  const handleSaveDriver = async (data) => {
    if (modal.mode === "add") {
      await addDriver(data);
      trackEvent("team_member_created", { team_role: data.role || activeTab });
    } else {
      await updateDriver(modal.data.id, data);
      trackEvent("team_member_updated", { team_role: data.role || activeTab });
    }
    setModal(null);
  };

  // (audit finding B2, hardened per explicit decision) Previously this only
  // warned about jobs/salaryEntries/attendance and still let the delete go
  // through — leaving those relations, plus equipment assignment and
  // custody history (never even counted before), permanently pointing at a
  // dead driver id. Now: ANY dependent record blocks the delete outright.
  // Deactivating (status: "inactive") is the only path for a member with
  // history — it hides them from active lists while keeping every
  // reference to them intact and recoverable.
  const handleDeleteDriver = async (drv) => {
    const counts = getDriverDependencyCounts(drv.id);
    const hasHistory = counts.jobs > 0 || counts.salaryEntries > 0 || counts.attendance > 0
      || counts.equipment > 0 || counts.custody > 0;

    if (hasHistory) {
      setBlockedDeleteTarget({ drv, counts });
      return;
    }

    const ok = await confirm(drv.id, "هل تريد حذف هذا العضو؟");
    if (ok) deleteDriver(drv.id);
  };

  const handleConfirmPaySalary = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await addSalaryEntry({
        driverId: payTarget.id,
        type:     SALARY_ENTRY_TYPES.BASE,
        amount:   Number(payTarget.salary) || 0,
        date:     todayISO(),
        paid:     true,
        reason:   "",
        notes:    "صرف سريع من فريق العمل",
      });
      trackEvent("salary_paid");
      setPayTarget(null);
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmCancelPaySalary = async () => {
    if (!cancelTarget?.lastPaidBaseEntry) return;
    setCancelling(true);
    try {
      await deleteSalaryEntry(cancelTarget.lastPaidBaseEntry.id);
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const isDriverTab = activeTab === TEAM_ROLE.DRIVER;
  const addLabel    = isDriverTab ? "إضافة سائق" : "إضافة إداري أو محاسب";

  // حد عدد أفراد الفريق مرتبط بالباقة (src/config/constants/billing.js) —
  // بيمنع إضافة عضو جديد بس، مش بيلمس أي عضو موجود أصلاً ولا بياناته.
  const handleAddClick = () => {
    if (!canAddTeamMember(report.length)) {
      toast.error(`وصلت للحد الأقصى لباقتك الحالية (${currentPlan?.limits?.teamMax} فرد) — رقّي باقتك عشان تضيف أكتر`);
      navigate("/billing");
      return;
    }
    setModal({ mode: "add" });
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <DriverIcon size={22} className="text-brand-400"/>
            فريق العمل
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{report.length} عضو مسجل</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setBulkSendOpen(true)} icon={<WhatsAppIcon size={16}/>}>
            إرسال جماعي
          </Button>
          <Button onClick={handleAddClick} icon={<PlusIcon size={16}/>}>
            {addLabel}
          </Button>
        </div>
      </div>

      {/* التبويبان: السائقون / الإداريون والمحاسبون */}
      <div className="flex items-center gap-2 mb-5 bg-surface-2 border border-white/8 rounded-2xl p-1.5">
        {TABS.map(({ role, label, Icon }) => (
          <button
            key={role}
            onClick={() => setActiveTab(role)}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl transition-colors ${
              activeTab === role
                ? "bg-brand-600 text-white shadow-lg shadow-brand-900/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <PrivacyToggle />
      </div>

      {/* KPIs — SALARIES this month for the active tab (not machine/job revenue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي رواتب الشهر المستحقة"  value={formatCurrency(salaryTotals.baseDue)}       color="amber" sensitive/>
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي الرواتب المصروفة"       value={formatCurrency(salaryTotals.paid)}      color="green" sensitive/>
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي المتبقي"                value={formatCurrency(salaryTotals.remaining)} color={salaryTotals.remaining > 0 ? "amber" : "green"} sensitive/>
        <StatCard icon={<WalletIcon size={24}/>}  label="إجمالي الخصومات هذا الشهر" value={formatCurrency(salaryTotals.deductionsThisMonth)} color="orange" sensitive/>
      </div>

      {/* Search + inactive toggle */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="w-full bg-surface-2 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <ClearIcon size={14}/>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors ${
            showInactive
              ? "bg-brand-900/40 border-brand-700 text-brand-300"
              : "bg-surface-2 border-white/10 text-gray-400 hover:text-gray-200"
          }`}
        >
          إظهار غير النشطين
        </button>
      </div>

      {visibleDrivers.length === 0 ? (
        tabReport.length === 0 ? (
          <EmptyState
            icon={<DriverIcon size={48} className="text-gray-600 mx-auto mb-2"/>}
            title={isDriverTab ? "لا يوجد سائقون بعد" : "لا يوجد إداريون أو محاسبون بعد"}
            description={isDriverTab ? "أضف سائقيك لتتبع أدائهم وكشف مرتباتهم" : "أضف أعضاء الإدارة والمحاسبة لمتابعة رواتبهم وحضورهم"}
            action={<Button onClick={handleAddClick} icon={<PlusIcon size={16}/>}>{addLabel}</Button>}
          />
        ) : (
          <EmptyState
            icon={<DriverIcon size={48} className="text-gray-600 mx-auto mb-2"/>}
            title="لا توجد نتائج"
            description="جرّب كلمة بحث تانية أو فعّل إظهار غير النشطين"
          />
        )
      ) : (
        <div className="space-y-3">
          {visibleDrivers.map((drv) => (
            <DriverCard
              key={drv.id}
              driver={drv}
              onEdit={() => setModal({ mode:"edit", data:drv })}
              onDelete={() => handleDeleteDriver(drv)}
              onPaySalary={(d) => setPayTarget(d)}
              onCancelPaySalary={(d) => setCancelTarget(d)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={modal?.mode === "add" || modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={modal?.mode === "add" ? "إضافة عضو جديد" : "تعديل بيانات العضو"}>
        {(modal?.mode === "add" || modal?.mode === "edit") && (
          <DriverForm initial={modal.data} defaultRole={activeTab} onSave={handleSaveDriver} onClose={() => setModal(null)}/>
        )}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message={confirmState.message}/>

      {/* إرسال جماعي — على أعضاء التبويب الحالي (السائقين أو الإداريين) بس،
          نفس النطاق المستخدم في KPIs فوق. */}
      <BulkSendDialog
        open={bulkSendOpen}
        onClose={() => setBulkSendOpen(false)}
        members={tabReport}
        companyName={settings?.company?.name || ""}
        getMonthSummary={getMonthSummary}
        currentMonth={currentMonth}
        getDriverAttendance={getDriverAttendance}
      />

      {/* (audit finding B2) Delete blocked — dependent history exists */}
      <Modal open={!!blockedDeleteTarget} onClose={() => setBlockedDeleteTarget(null)}
        title="مينفعش يتمسح" size="sm">
        {blockedDeleteTarget && (
          <>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 flex gap-3 mb-4">
              <AlertIcon size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <span className="font-bold text-amber-200">{blockedDeleteTarget.drv.name}</span> عليه سجلات
                مرتبطة، فمينفعش يتمسح نهائيًا — الحذف كان هيسيب السجلات دي من غير عضو مرتبط بيها.
              </p>
            </div>
            <ul className="list-disc list-inside text-gray-300 text-sm mb-4 space-y-0.5">
              {blockedDeleteTarget.counts.jobs > 0 && <li>{blockedDeleteTarget.counts.jobs} عملية شغل</li>}
              {blockedDeleteTarget.counts.salaryEntries > 0 && <li>{blockedDeleteTarget.counts.salaryEntries} قيد راتب</li>}
              {blockedDeleteTarget.counts.attendance > 0 && <li>{blockedDeleteTarget.counts.attendance} سجل حضور</li>}
              {blockedDeleteTarget.counts.equipment > 0 && <li>{blockedDeleteTarget.counts.equipment} معدة معيّنله حاليًا</li>}
              {blockedDeleteTarget.counts.custody > 0 && <li>{blockedDeleteTarget.counts.custody} سجل عهدة</li>}
            </ul>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              لو سايب الشغل بس عايز تحتفظ بتاريخه، غيّر حالته لـ "غير نشط" بدل الحذف — بيختفي من القوائم
              النشطة وكل سجلاته وتقاريره تفضل زي ما هي بالظبط.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setBlockedDeleteTarget(null)}>إغلاق</Button>
              <Button variant="primary" size="sm" icon={<EditIcon size={14} />}
                onClick={() => {
                  const drv = blockedDeleteTarget.drv;
                  setBlockedDeleteTarget(null);
                  setModal({ mode: "edit", data: drv });
                }}>
                تغيير الحالة لـ "غير نشط"
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Quick "pay salary" confirmation */}
      <Modal open={!!payTarget} onClose={() => !paying && setPayTarget(null)} title="صرف الراتب" size="sm">
        {payTarget && (
          <>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              هل تريد صرف الراتب الأساسي لـ{" "}
              <span className="font-bold text-gray-200">{payTarget.name}</span>{" "}
              بمبلغ{" "}
              <span className="font-bold text-green-400">{formatCurrency(payTarget.salary || 0)}</span>{" "}
              عن شهر {new Date().toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}؟
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" disabled={paying} onClick={() => setPayTarget(null)}>إلغاء</Button>
              <Button variant="primary" size="sm" loading={paying}
                className="!bg-green-600 hover:!bg-green-500 !shadow-green-900/40"
                icon={<CheckCircleIcon size={14} />}
                onClick={handleConfirmPaySalary}>
                تأكيد الصرف
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Quick "cancel pay salary" confirmation */}
      <Modal open={!!cancelTarget} onClose={() => !cancelling && setCancelTarget(null)} title="إلغاء صرف الراتب" size="sm">
        {cancelTarget && (
          <>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              هل تريد إلغاء صرف الراتب الأساسي لـ{" "}
              <span className="font-bold text-gray-200">{cancelTarget.name}</span>{" "}
              بمبلغ{" "}
              <span className="font-bold text-red-400">
                {formatCurrency(cancelTarget.lastPaidBaseEntry?.amount || 0)}
              </span>{" "}
              عن شهر {new Date().toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}؟
              <br />
              هيترجع الراتب "لسه ما اتصرفش" تاني.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" disabled={cancelling} onClick={() => setCancelTarget(null)}>تراجع</Button>
              <Button variant="danger" size="sm" loading={cancelling}
                icon={<ClearIcon size={14} />}
                onClick={handleConfirmCancelPaySalary}>
                تأكيد الإلغاء
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DriversPage;
