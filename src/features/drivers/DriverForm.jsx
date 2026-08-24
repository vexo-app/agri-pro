// src/features/drivers/DriverForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, NumberInput, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { DRIVER_STATUS, DRIVER_STATUS_LABELS, MAX_MONEY_VALUE } from "../../config/constants";

const DriverForm = ({ initial, onSave, onClose }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? { name: "", phone: "", salary: "", status: DRIVER_STATUS.ACTIVE },
  });

  const onSubmit = async (data) => {
    await onSave({
      ...data,
      salary: Number(data.salary) || 0,
      status: data.status || DRIVER_STATUS.ACTIVE,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Input
            label="اسم السائق *"
            placeholder="الاسم الكامل"
            error={errors.name?.message}
            {...register("name", { required: "اسم السائق مطلوب" })}
          />
        </div>

        <Input
          label="رقم الهاتف"
          placeholder="01xxxxxxxxx"
          style={{ direction: "ltr", textAlign: "right" }}
          error={errors.phone?.message}
          {...register("phone", {
            pattern: { value: /^\d{11}$/, message: "رقم الهاتف لازم يكون 11 رقم بالظبط" },
          })}
        />

        <Controller
          name="salary"
          control={control}
          rules={{
            validate: (v) =>
              !v || (Number(v) >= 0 && Number(v) <= MAX_MONEY_VALUE) ||
              (Number(v) < 0 ? "لا يمكن أن يكون سالبًا" : `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`),
          }}
          render={({ field }) => (
            <NumberInput
              label="الراتب الشهري (ج.م)"
              placeholder="0"
              error={errors.salary?.message}
              {...field}
            />
          )}
        />

        <Select label="الحالة" {...register("status")}>
          {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>حفظ</Button>
      </div>
    </form>
  );
};

export default DriverForm;
