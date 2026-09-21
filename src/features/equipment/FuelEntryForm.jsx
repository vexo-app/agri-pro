import React from "react";
import { Controller, useForm } from "react-hook-form";
import { Input, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { MAX_MONEY_VALUE } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const FuelEntryForm = ({ fuelPrice, onSave, onClose }) => {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { liters: "", pricePerLiter: fuelPrice || "", date: todayISO() },
  });
  const positive = (label) => (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return `أدخل ${label} أكبر من صفر`;
    if (number > MAX_MONEY_VALUE) return `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`;
    return true;
  };
  const submit = async (data) => {
    await onSave({ liters: Number(data.liters), pricePerLiter: Number(data.pricePerLiter), date: data.date });
    onClose();
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller name="liters" control={control} rules={{ validate: positive("عدد لترات") }}
          render={({ field }) => <NumberInput label="عدد اللترات *" placeholder="0" error={errors.liters?.message} {...field}/>} />
        <Controller name="pricePerLiter" control={control} rules={{ validate: positive("سعر") }}
          render={({ field }) => <NumberInput label="سعر اللتر (ج.م) *" placeholder="0" error={errors.pricePerLiter?.message} {...field}/>} />
        <div className="sm:col-span-2">
          <Input label="التاريخ *" type="date" error={errors.date?.message} {...register("date", { required: "أدخل التاريخ" })}/>
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل الوقود</Button>
      </div>
    </form>
  );
};

export default FuelEntryForm;
