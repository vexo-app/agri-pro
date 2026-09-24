// src/pages/CustodyPage.jsx
import React, { useState } from "react";
import { useCustody } from "../hooks/useCustody";
import { useData }    from "../contexts/DataContext";
import { useConfirm } from "../hooks/useConfirm";
import CustodyTransactionForm from "../features/custody/CustodyTransactionForm";
import Modal          from "../components/ui/Modal";
import ConfirmDialog   from "../components/ui/ConfirmDialog";
import Button          from "../components/ui/Button";
import DownloadReportButton from "../components/ui/DownloadReportButton";
import { Card, StatCard, EmptyState, SummaryRow } from "../components/ui/Card";
import LoadingScreen   from "../components/ui/LoadingScreen";
import FeatureIntroBanner from "../components/common/FeatureIntroBanner";
import {
  WalletIcon, ArrowUpCircleIcon, ArrowDownCircleIcon,
  TrashIcon, EditIcon, CalendarIcon, AlertIcon, TractorIcon, DriverIcon,
  DownloadIcon,
} from "../components/ui/Icons";
import { formatCurrency, formatDateShort, todayISO } from "../utils/formatters";
import {
  CUSTODY_TYPES, CUSTODY_EXPENSE_CATEGORY_LABELS,
} from "../config/constants";
import { downloadCustodyReportPdf } from "../utils/pdfGenerator";
import { trackEvent } from "../config/posthog";

// نفس فكرة صفحة التقارير بالظبط: تلات اختيارات — الشهر الحالي، الشهر
// السابق، أو كل الشهور (كل الوقت).
const MONTH_DOWNLOAD_OPTIONS = [
  { value: "current",  label: "الشهر الحالي"  },
  { value: "previous", label: "الشهر السابق" },
  { value: "all",      label: "كل الشهور"     },
  { value: "range",    label: "نطاق مخصص (من يوم لـ يوم)" },
];

// بيرجع "YYYY-MM" بالظبط زي الـ prefix اللي بتتفلتر بيه الحركات في باقي
// التطبيق — نفس الهيلبر المستخدم في صفحة التقارير، عشان الاختيارين ميختلفوش
// عن بعض بين الصفحتين. مش بينادَى لـ "all" (مفيش شهر واحد في الحالة دي).
const resolveMonthPrefix = (choice) => {
  const now = new Date();
  const base = choice === "previous"
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : now;
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
};

const CATEGORY_ICONS = {
  equipment: TractorIcon,
  driver:    DriverIcon,
  other:     WalletIcon,
};

const CustodyPage = () => {
  const {
    transactions, balance, totalDeposits, totalExpenses,
    isOverdrawn, expensesByCategory, getLinkedName,
    loading, addCustody, updateCustody, deleteCustody,
  } = useCustody();
  const { drivers, equipment, settings } = useData();
  const { confirm, confirmState } = useConfirm();
  const [modal, setModal] = useState(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadMonth, setDownloadMonth] = useState("current");
  const [downloadType, setDownloadType] = useState(CUSTODY_TYPES.EXPENSE);
  const [rangeFrom, setRangeFrom] = useState(() => todayISO().slice(0, 8) + "01");
  const [rangeTo, setRangeTo] = useState(() => todayISO());
  const rangeInvalid = downloadMonth === "range" && (!rangeFrom || !rangeTo || rangeFrom > rangeTo);

  const handleSave = async (data) => {
    if (modal.mode === "add") {
      await addCustody(data);
      trackEvent("custody_transaction_recorded", { transaction_type: data.type });
    } else {
      await updateCustody(modal.data.id, data);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteCustody(id);
  };

  // تحميل تقرير العهدة PDF — نفس منطق الفلترة القديم بالظبط، بس مضاف له
  // اختيار نوع الحركة (منصرف/واصل) اللي بيتحدد من نافذة التحميل: "كل الشهور"
  // بتستخدم إجماليات الصفحة الجاهزة (totalExpenses/totalDeposits/expensesByCategory)
  // زي ما هي، وشهر محدد (حالي/سابق) بيتفلتر بالـ month prefix وبيتحسب من جوه
  // buildCustodyReportHtml نفسها من قايمة الحركات مباشرة، عشان الرقم يبقى
  // مطابق 100% لهذا الشهر بس. بعد نجاح التحميل، النافذة بتقفل لوحدها.
  const handleDownload = async () => {
    if (rangeInvalid) throw new Error("اختار تاريخ البداية والنهاية، والبداية لازم تكون قبل النهاية");
    const args = downloadMonth === "range"
      ? {
          transactions: transactions,
          getLinkedName,
          company: settings.company,
          allTime: false,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          reportType: downloadType,
        }
      : downloadMonth === "all"
      ? {
          transactions: transactions,
          totalDeposits,
          totalExpenses,
          balance,
          expensesByCategory,
          getLinkedName,
          company: settings.company,
          reportType: downloadType,
        }
      : {
          transactions: transactions,
          getLinkedName,
          company: settings.company,
          month: resolveMonthPrefix(downloadMonth),
          allTime: false,
          reportType: downloadType,
        };

    await downloadCustodyReportPdf(args);
    trackEvent("custody_report_downloaded", {
      report_period: downloadMonth,
      transaction_type: downloadType,
    });
    setDownloadModalOpen(false);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      <FeatureIntroBanner
        id="custody"
        title="العهدة"
        description="العهدة هي المبالغ اللي بتسلّمها لمعدة أو سائق مقدّماً (بنزين، مصاريف تشغيل...)، ومصاريفه بتُخصم منها أول بأول. الرصيد هنا بيوريك كام فاضل معاه، وبيبان بالأحمر لو المصاريف عدّت المبلغ المُسلَّم."
      />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <WalletIcon size={22} className="text-brand-400" />
            العهدة
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">فلوس رجل الأعمال ومصروفاتها على الميكنة والسائقين</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* تحميل تقرير العهدة — زرار واحد بيفتح نافذة فيها اختيار نوع
              الحركة (منصرف/واصل) واختيار الفترة مع بعض، بدل ما يكون
              اختيار الفترة select منفصل وبعيد عن الزرار. */}
          <Button variant="secondary" size="sm" icon={<DownloadIcon size={16} />}
            onClick={() => setDownloadModalOpen(true)}>
            تحميل تقرير
          </Button>

          <Button variant="info" onClick={() => setModal({ mode: "add", type: CUSTODY_TYPES.DEPOSIT })}
            icon={<ArrowUpCircleIcon size={16} />}>
            إضافة فلوس
          </Button>
          <Button variant="danger" onClick={() => setModal({ mode: "add", type: CUSTODY_TYPES.EXPENSE })}
            icon={<ArrowDownCircleIcon size={16} />}>
            صرف فلوس
          </Button>
        </div>
      </div>

      {/* Overdrawn alert */}
      {isOverdrawn && (
        <div className="flex items-center gap-3 rounded-2xl p-4 mb-6 border bg-red-900/20 border-red-800/50">
          <AlertIcon size={20} className="text-red-400" />
          <p className="text-sm font-semibold text-red-300">
            رصيد العهدة دخل بالسالب — المصروفات تجاوزت المبلغ المُسلَّم
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={<ArrowUpCircleIcon size={24} />} label="إجمالي المُضاف" value={formatCurrency(totalDeposits)} color="green" />
        <StatCard icon={<ArrowDownCircleIcon size={24} />} label="إجمالي المصروف" value={formatCurrency(totalExpenses)} color="red" />
        <StatCard icon={<WalletIcon size={24} />} label="الرصيد المتبقي" value={formatCurrency(balance)} color={isOverdrawn ? "red" : "blue"} />
      </div>

      {/* Breakdown by category */}
      {totalExpenses > 0 && (
        <Card className="mb-6">
          <div className="px-5 pt-5 pb-1">
            <p className="text-sm font-bold text-gray-100">المصروفات حسب البند</p>
          </div>
          <div className="px-5 pb-5">
            {Object.entries(CUSTODY_EXPENSE_CATEGORY_LABELS).map(([key, label]) => {
              const Icon = CATEGORY_ICONS[key];
              const amount = expensesByCategory[key] || 0;
              if (amount === 0) return null;
              return (
                <SummaryRow
                  key={key}
                  label={<span className="flex items-center gap-2"><Icon size={14} className="text-gray-500" />{label}</span>}
                  value={formatCurrency(amount)}
                  valueColor="text-red-400"
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Transaction list */}
      <Card>
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-bold text-gray-100">سجل الحركات</p>
        </div>

        {transactions.length === 0 ? (
          <EmptyState icon={<WalletIcon size={48} className="text-gray-600 mx-auto mb-2" />}
            title="لا توجد حركات بعد" description="سجّل أول إضافة أو مصروف للعهدة" />
        ) : (
          <div className="pb-2">
            {transactions.map((t, idx) => {
              const isDeposit = t.type === CUSTODY_TYPES.DEPOSIT;
              const linkedName = getLinkedName(t);
              // خط فاصل شكلي بس بين كل شهر وشهر — القايمة أصلاً مرتبة
              // بالأحدث أولاً (useCustody)، فمقارنة أول 7 حروف من تاريخ
              // الحركة الحالية بالحركة اللي قبلها كافية لمعرفة إننا دخلنا
              // شهر جديد. مفيش أي تغيير في الترتيب أو الحسابات هنا.
              const monthKey = (t.date || "").slice(0, 7);
              const prevMonthKey = idx > 0 ? (transactions[idx - 1].date || "").slice(0, 7) : monthKey;
              const isNewMonth = idx > 0 && monthKey !== prevMonthKey;
              return (
                <div key={t.id}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    idx === 0 ? "" : isNewMonth ? "border-t-2 border-white/20" : "border-t border-white/8"
                  }`}>
                  {isDeposit
                    ? <ArrowUpCircleIcon size={18} className="text-green-400 flex-shrink-0" />
                    : <ArrowDownCircleIcon size={18} className="text-red-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200">
                      {isDeposit
                        ? (t.source || "إضافة فلوس")
                        : (t.category === "other" && t.otherLabel ? t.otherLabel : (CUSTODY_EXPENSE_CATEGORY_LABELS[t.category] || "صرف"))}
                      {linkedName && <span className="text-gray-500 font-normal"> · {linkedName}</span>}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <CalendarIcon size={11} />
                      <span>{formatDateShort(t.date)}</span>
                      {t.notes && <span>· {t.notes}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums flex-shrink-0 mr-2 ${isDeposit ? "text-green-400" : "text-red-400"}`}>
                    {isDeposit ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                  <Button variant="ghost" size="xs" icon={<EditIcon size={13} />} className="px-2"
                    onClick={() => setModal({ mode: "edit", data: t })} />
                  <Button variant="ghost" size="xs" icon={<TrashIcon size={13} />} className="px-2"
                    onClick={() => handleDelete(t.id)} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.mode === "add"
          ? (modal.type === CUSTODY_TYPES.DEPOSIT ? "إضافة فلوس" : "تسجيل مصروف")
          : "تعديل الحركة"}>
        {modal && (
          <CustodyTransactionForm
            // إصلاح: الوضع بيتحدد صراحةً من modal.mode، مش من وجود initial —
            // initial بيتبعت في الحالتين (إضافة وتعديل) عشان يعبّي القيم
            // الافتراضية، فمكانش يصح نستنتج منه وحده إن إحنا في وضع تعديل.
            isEdit={modal.mode === "edit"}
            initial={modal.data || (modal.type
              ? { type: modal.type, category: "equipment", equipmentId: "", driverId: "", otherLabel: "", amount: "", date: todayISO(), source: "", notes: "" }
              : undefined)}
            drivers={drivers}
            equipment={equipment}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message="هل تريد حذف هذه الحركة؟" />

      <Modal open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)}
        title="تحميل تقرير العهدة" size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">نوع الحركة</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => setDownloadType(CUSTODY_TYPES.EXPENSE)}
                className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  downloadType === CUSTODY_TYPES.EXPENSE
                    ? "bg-red-900/30 border-red-700 text-red-300"
                    : "bg-surface-2 border-white/10 text-gray-400"
                }`}>
                المنصرف
              </button>
              <button type="button"
                onClick={() => setDownloadType(CUSTODY_TYPES.DEPOSIT)}
                className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  downloadType === CUSTODY_TYPES.DEPOSIT
                    ? "bg-green-900/30 border-green-700 text-green-300"
                    : "bg-surface-2 border-white/10 text-gray-400"
                }`}>
                الواصل
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">الفترة</label>
            <select
              value={downloadMonth}
              onChange={(e) => setDownloadMonth(e.target.value)}
              aria-label="اختر الفترة"
              className="w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
            >
              {MONTH_DOWNLOAD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {downloadMonth === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">من يوم</label>
                <input type="date" value={rangeFrom} max={rangeTo || undefined}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">إلى يوم</label>
                <input type="date" value={rangeTo} min={rangeFrom || undefined}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600" />
              </div>
              {rangeInvalid && (
                <p className="col-span-2 text-xs text-red-400">اختار تاريخ البداية والنهاية، والبداية لازم تكون قبل النهاية.</p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 mt-1 border-t border-white/8">
            <DownloadReportButton onDownload={handleDownload} title="تحميل تقرير العهدة PDF" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustodyPage;
