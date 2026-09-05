// src/features/drivers/DriverForm.jsx
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, NumberInput, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import {
  DRIVER_STATUS, DRIVER_STATUS_LABELS, TEAM_ROLE, MAX_MONEY_VALUE,
  STAFF_POSITIONS, STAFF_POSITION_LABELS,
} from "../../config/constants";

// قيمة وهمية في قايمة "نوع العضو" لما يكون سائق ومسماه مش "سائق" عادي —
// اختيارها بيفتح خانة يكتب فيها المستخدم المسمى اللي هو عايزه.
const CUSTOM_POSITION = "__custom__";

const DriverForm = ({ initial, defaultRole, onSave, onClose }) => {
  // الدور (role) بقى محدد ضمنيًا من التبويب اللي بتضيف منه، مش اختيار حر
  // في الفورم — عشان كده مبيتغيرش لو انت بتعدّل عضو موجود.
  const role = initial?.role || defaultRole || TEAM_ROLE.DRIVER;
  const isDriverRole = role === TEAM_ROLE.DRIVER;

  const savedPosition = initial?.position || "";
  const isCustomDriverPosition = isDriverRole && savedPosition && savedPosition !== "driver";

  const [position, setPosition] = useState(() => {
    if (isDriverRole) return isCustomDriverPosition ? CUSTOM_POSITION : "driver";
    return savedPosition === STAFF_POSITIONS.ACCOUNTANT
      ? STAFF_POSITIONS.ACCOUNTANT
      : STAFF_POSITIONS.ADMIN;
  });
  const [customPosition, setCustomPosition] = useState(
    isCustomDriverPosition ? savedPosition : ""
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? {
      name: "", phone: "", salary: "",
      status: DRIVER_STATUS.ACTIVE,
    },
  });

  const onSubmit = async (data) => {
    const finalPosition = isDriverRole
      ? (position === CUSTOM_POSITION ? (customPosition.trim() || "أخرى") : "driver")
      : position;

    await onSave({
      ...data,
      salary: Number(data.salary) || 0,
      status: data.status || DRIVER_STATUS.ACTIVE,
      role,
      position: finalPosition,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Input
            label="الاسم *"
            placeholder="الاسم الكامل"
            error={errors.name?.message}
            {...register("name", { required: "الاسم مطلوب" })}
          />
        </div>

        {isDriverRole ? (
          <Select
            label="نوع العضو"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="driver">سائق</option>
            <option value={CUSTOM_POSITION}>أخرى</option>
          </Select>
        ) : (
          <Select
            label="نوع العضو"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value={STAFF_POSITIONS.ADMIN}>{STAFF_POSITION_LABELS.admin}</option>
            <option value={STAFF_POSITIONS.ACCOUNTANT}>{STAFF_POSITION_LABELS.accountant}</option>
          </Select>
        )}

        {isDriverRole && position === CUSTOM_POSITION && (
          <Input
            label="اكتب نوع العضو"
            placeholder="مثال: مشرف، عامل صيانة..."
            value={customPosition}
            onChange={(e) => setCustomPosition(e.target.value)}
          />
        )}

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
