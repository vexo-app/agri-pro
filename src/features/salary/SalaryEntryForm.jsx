// src/features/salary/SalaryEntryForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Select, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { SALARY_ENTRY_TYPES, SALARY_ENTRY_LABELS, MAX_MONEY_VALUE } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

// القيد بيبقى إما خصم أو حافز بس — نوع الخصم/الحافز بيتكتب حر جنبه
const TYPE_OPTIONS = [
  { value: SALARY_ENTRY_TYPES.DEDUCTION, label: SALARY_ENTRY_LABELS.deduction },
  { value: SALARY_ENTRY_TYPES.BONUS,     label: SALARY_ENTRY_LABELS.bonus },
];

const SalaryEntryForm = ({ driverId, driverName, onSave, onClose }) => {
  const {
    register, handleSubmit, control, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      type:   SALARY_ENTRY_TYPES.DEDUCTION,
      amount: "",
      reason: "",
      date:   todayISO(),
      notes:  "",
      paid:   true,
    },
  });

  const type = watch("type");
  const isBonus = type === SALARY_ENTRY_TYPES.BONUS;

  const onSubmit = async (data) => {
    await onSave({
      ...data,
      driverId,
      amount: Number(data.amount) || 0,
      paid:   true,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-4 px-3 py-2 bg-brand-900/20 border border-brand-800/40 rounded-xl">
        <p className="text-xs text-brand-400 font-semibold">السائق: {driverName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <Select label="نوع القيد" {...register("type")}>
          {TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        <Controller
          name="amount"
          control={control}
          rules={{
            required: "أدخل المبلغ",
            min: { value: 0, message: "لا يمكن أن يكون سالبًا" },
            max: { value: MAX_MONEY_VALUE, message: `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})` },
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

        <div className="sm:col-span-2">
          <Input
            label={isBonus ? "نوع الحافز" : "نوع الخصم"}
            placeholder={isBonus ? "مثلاً: حافز أداء، بدل وقود..." : "مثلاً: غياب، تأخير..."}
            {...register("reason")}
          />
        </div>

        <Input label="التاريخ" type="date" {...register("date")} />

        <div className="sm:col-span-2">
          <Input label="ملاحظات" placeholder="تفاصيل إضافية..." {...register("notes")} />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل</Button>
      </div>
    </form>
  );
};

export default SalaryEntryForm;
