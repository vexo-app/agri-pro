// src/features/taxDeductions/TaxDeductionForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Select, NumberInput, Textarea } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import {
  TAX_DEDUCTION_TYPES, TAX_DEDUCTION_TYPE_LABELS,
  MAX_MONEY_VALUE,
} from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const TaxDeductionForm = ({ initial, onSave, onClose }) => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? {
      type:   TAX_DEDUCTION_TYPES.TAX,
      otherLabel: "",
      amount: "",
      date:   todayISO(),
      notes:  "",
    },
  });

  const type = watch("type");
  const isOther = type === TAX_DEDUCTION_TYPES.OTHER;

  const onSubmit = async (data) => {
    const payload = {
      type:   data.type,
      amount: Number(data.amount) || 0,
      date:   data.date,
      notes:  data.notes || "",
    };
    if (data.type === TAX_DEDUCTION_TYPES.OTHER) payload.otherLabel = data.otherLabel || "";
    await onSave(payload);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Select label="النوع *" {...register("type")}>
            {Object.entries(TAX_DEDUCTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>

        {isOther && (
          <div className="sm:col-span-2">
            <Input label="اكتب نوع الخصم *" placeholder="مثال: خصم تأمينات، رسوم بنكية..."
              {...register("otherLabel", {
                required: isOther ? "اكتب نوع الخصم" : false,
              })}
              error={errors.otherLabel?.message} />
          </div>
        )}

        <Controller
          name="amount"
          control={control}
          rules={{
            required: "أدخل المبلغ",
            validate: (v) =>
              Number(v) > 0 && Number(v) <= MAX_MONEY_VALUE
                ? true
                : Number(v) <= 0 ? "أدخل مبلغ أكبر من صفر" : `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`,
          }}
          render={({ field }) => (
            <NumberInput
              label="المبلغ (ج.م) *"
              placeholder="0"
              error={errors.amount?.message}
              {...field}
            />
          )}
        />

        <Input label="التاريخ" type="date" {...register("date")} />

        <div className="sm:col-span-2">
          <Textarea label="ملاحظات" placeholder="تفاصيل إضافية..." rows={2}
            {...register("notes")} />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" variant="danger" loading={isSubmitting}>
          {initial ? "حفظ التعديل" : "تسجيل الحركة"}
        </Button>
      </div>
    </form>
  );
};

export default TaxDeductionForm;
