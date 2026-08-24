// src/features/payments/PaymentForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { SummaryRow } from "../../components/ui/Card";
import { formatCurrency, todayISO } from "../../utils/formatters";
import { MAX_MONEY_VALUE } from "../../config/constants";

const PaymentForm = ({ jobId, jobRevenue, alreadyPaid, onSave, onClose }) => {
  const maxRemaining = Math.max(0, jobRevenue - alreadyPaid);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { amount: "", date: todayISO(), notes: "" },
  });

  const onSubmit = async (data) => {
    const amount = Number(data.amount) || 0;
    if (amount <= 0) return;
    await onSave({
      jobId,
      amount,
      date:  data.date,
      notes: data.notes,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>

      {/* Job balance summary */}
      <div className="bg-surface-2 rounded-2xl p-4 border border-white/8 mb-5">
        <SummaryRow label="إجمالي الفاتورة"  value={formatCurrency(jobRevenue)}  valueColor="text-amber-400" />
        <SummaryRow label="تم سداده سابقاً"  value={formatCurrency(alreadyPaid)} valueColor="text-green-400" />
        <SummaryRow label="المتبقي للسداد"    value={formatCurrency(maxRemaining)}
          valueColor={maxRemaining > 0 ? "text-red-400" : "text-gray-400"} bold />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="amount"
          control={control}
          rules={{
            required: "أدخل المبلغ",
            validate: (v) =>
              Number(v) > 0 && Number(v) <= MAX_MONEY_VALUE
                ? true
                : Number(v) <= 0 ? "يجب أن يكون أكبر من صفر" : `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`,
          }}
          render={({ field }) => (
            <NumberInput
              label="المبلغ المدفوع (ج.م) *"
              placeholder="0"
              hint={maxRemaining > 0 ? `الحد الأقصى: ${formatCurrency(maxRemaining)}` : undefined}
              error={errors.amount?.message}
              {...field}
            />
          )}
        />

        <Input label="تاريخ الدفع" type="date" {...register("date")} />

        <div className="sm:col-span-2">
          <Input
            label="ملاحظات"
            placeholder="مثال: دفع نقدي، تحويل بنكي..."
            {...register("notes")}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل الدفعة</Button>
      </div>
    </form>
  );
};

export default PaymentForm;
