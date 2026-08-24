// src/features/driverCosts/DriverCostForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Select, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { DRIVER_COST_TYPES, MAX_MONEY_VALUE } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const DriverCostForm = ({ initial, drivers, onSave, onClose }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? {
      driverId: "",
      type:     "راتب شهري",
      amount:   "",
      date:     todayISO(),
      notes:    "",
    },
  });

  const onSubmit = async (data) => {
    await onSave({ ...data, amount: Number(data.amount) || 0 });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Select label="السائق *" error={errors.driverId?.message}
            {...register("driverId", { required: "اختر السائق" })}>
            <option value="">— اختر السائق —</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>

        <Select label="نوع التكلفة" {...register("type")}>
          {DRIVER_COST_TYPES.map((t) => <option key={t}>{t}</option>)}
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

        <Input label="التاريخ" type="date" {...register("date")} />

        <Input label="ملاحظات" placeholder="تفاصيل إضافية..."
          {...register("notes")} />
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل</Button>
      </div>
    </form>
  );
};

export default DriverCostForm;
