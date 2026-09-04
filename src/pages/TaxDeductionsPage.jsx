// src/pages/TaxDeductionsPage.jsx
import React, { useState } from "react";
import { useTaxDeductions } from "../hooks/useTaxDeductions";
import { useConfirm } from "../hooks/useConfirm";
import TaxDeductionForm from "../features/taxDeductions/TaxDeductionForm";
import Modal          from "../components/ui/Modal";
import ConfirmDialog   from "../components/ui/ConfirmDialog";
import Button          from "../components/ui/Button";
import { Card, StatCard, EmptyState, SummaryRow } from "../components/ui/Card";
import LoadingScreen   from "../components/ui/LoadingScreen";
import {
  ReceiptIcon, TrashIcon, EditIcon, CalendarIcon, PlusIcon,
} from "../components/ui/Icons";
import { formatCurrency, formatDateShort } from "../utils/formatters";
import { TAX_DEDUCTION_TYPE_LABELS } from "../config/constants";

const TaxDeductionsPage = () => {
  const {
    entries, total, totalByType,
    loading, addTaxDeduction, updateTaxDeduction, deleteTaxDeduction,
  } = useTaxDeductions();
  const { confirm, confirmState } = useConfirm();
  const [modal, setModal] = useState(null);

  const handleSave = async (data) => {
    if (modal.mode === "add") await addTaxDeduction(data);
    else await updateTaxDeduction(modal.data.id, data);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteTaxDeduction(id);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <ReceiptIcon size={22} className="text-brand-400" />
            الضرائب والخصومات
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">سجل الضرائب والرسوم والخصومات، بتتخصم من صافي الربح تلقائيًا</p>
        </div>
        <Button variant="danger" onClick={() => setModal({ mode: "add" })} icon={<PlusIcon size={16} />}>
          إضافة حركة
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <StatCard icon={<ReceiptIcon size={24} />} label="إجمالي الضرائب والخصومات" value={formatCurrency(total)} color="red" />
      </div>

      {/* Breakdown by type */}
      {total > 0 && (
        <Card className="mb-6">
          <div className="px-5 pt-5 pb-1">
            <p className="text-sm font-bold text-gray-100">الإجمالي حسب النوع</p>
          </div>
          <div className="px-5 pb-5">
            {Object.entries(TAX_DEDUCTION_TYPE_LABELS).map(([key, label]) => {
              const amount = totalByType[key] || 0;
              if (amount === 0) return null;
              return (
                <SummaryRow key={key} label={label} value={formatCurrency(amount)} valueColor="text-red-400" />
              );
            })}
          </div>
        </Card>
      )}

      {/* List */}
      <Card>
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-bold text-gray-100">سجل الحركات</p>
        </div>

        {entries.length === 0 ? (
          <EmptyState icon={<ReceiptIcon size={48} className="text-gray-600 mx-auto mb-2" />}
            title="لا توجد حركات بعد" description="سجّل أول ضريبة أو خصم" />
        ) : (
          <div className="divide-y divide-white/8 pb-2">
            {entries.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <ReceiptIcon size={18} className="text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-200">
                    {TAX_DEDUCTION_TYPE_LABELS[t.type] || "خصم"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                    <CalendarIcon size={11} />
                    <span>{formatDateShort(t.date)}</span>
                    {t.notes && <span>· {t.notes}</span>}
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums flex-shrink-0 mr-2 text-red-400">
                  -{formatCurrency(t.amount)}
                </span>
                <Button variant="ghost" size="xs" icon={<EditIcon size={13} />} className="px-2"
                  onClick={() => setModal({ mode: "edit", data: t })} />
                <Button variant="ghost" size="xs" icon={<TrashIcon size={13} />} className="px-2"
                  onClick={() => handleDelete(t.id)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.mode === "add" ? "إضافة حركة" : "تعديل الحركة"}>
        {modal && (
          <TaxDeductionForm
            initial={modal.data}
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

export default TaxDeductionsPage;
