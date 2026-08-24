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
import {
  WalletIcon, ArrowUpCircleIcon, ArrowDownCircleIcon,
  TrashIcon, EditIcon, CalendarIcon, AlertIcon, TractorIcon, DriverIcon, PrintIcon,
} from "../components/ui/Icons";
import { formatCurrency, formatDateShort, todayISO } from "../utils/formatters";
import {
  CUSTODY_TYPES, CUSTODY_EXPENSE_CATEGORY_LABELS,
} from "../config/constants";
import { printCustodyReport, downloadCustodyReportPdf } from "../utils/pdfGenerator";

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

  const handleSave = async (data) => {
    if (modal.mode === "add") await addCustody(data);
    else await updateCustody(modal.data.id, data);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteCustody(id);
  };

  const handlePrint = () => {
    printCustodyReport({
      transactions: transactions,
      totalDeposits,
      totalExpenses,
      balance,
      expensesByCategory,
      getLinkedName,
      company: settings.company,
    });
  };

  const handleDownload = () => downloadCustodyReportPdf({
    transactions: transactions,
    totalDeposits,
    totalExpenses,
    balance,
    expensesByCategory,
    getLinkedName,
    company: settings.company,
  });

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <WalletIcon size={22} className="text-brand-400" />
            العهدة
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">فلوس رجل الأعمال ومصروفاتها على الميكنة والسائقين</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handlePrint} icon={<PrintIcon size={16} />} title="طباعة تقرير شامل بالعهدة">
            طباعة تقرير
          </Button>
          <DownloadReportButton onDownload={handleDownload} title="تحميل تقرير العهدة PDF" />
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
          <div className="divide-y divide-white/8 pb-2">
            {transactions.map((t) => {
              const isDeposit = t.type === CUSTODY_TYPES.DEPOSIT;
              const linkedName = getLinkedName(t);
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
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
    </div>
  );
};

export default CustodyPage;
