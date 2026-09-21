// src/features/attendance/AttendanceForm.jsx
import React from "react";
import { useForm } from "react-hook-form";
import { Input, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { ATTENDANCE_STATUS, ATTENDANCE_LABELS } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const AttendanceForm = ({ driverId, driverName, onSave, onClose }) => {
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      date:   todayISO(),
      status: ATTENDANCE_STATUS.PRESENT,
      notes:  "",
    },
  });

  const onSubmit = async (data) => {
    const savedId = await onSave({ ...data, driverId });
    if (savedId) onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-4 px-3 py-2 bg-brand-900/20 border border-brand-800/40 rounded-xl">
        <p className="text-xs text-brand-400 font-semibold">السائق: {driverName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="التاريخ *" type="date"
          error={errors.date?.message}
          {...register("date", { required: "اختر التاريخ" })} />

        <Select label="الحالة" {...register("status")}>
          {Object.entries(ATTENDANCE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>

        <div className="sm:col-span-2">
          <Input label="ملاحظات" placeholder="مثال: غياب بعذر، تأخر ساعة..." {...register("notes")} />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل</Button>
      </div>
    </form>
  );
};

export default AttendanceForm;
