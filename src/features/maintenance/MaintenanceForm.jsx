// src/features/maintenance/MaintenanceForm.jsx
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Select, Textarea, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { MAINTENANCE_TYPES } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const MaintenanceForm = ({ initial, equipment, onSave, onClose }) => {
  const isOtherInitially = initial?.type === "أخرى";
  const [showCustomType, setShowCustomType] = useState(isOtherInitially);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? {
      equipmentId: "",
      type:        "تغيير زيت",
      customType:  "",
      cost:        "",
      date:        todayISO(),
      notes:       "",
    },
  });

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setShowCustomType(val === "أخرى");
    if (val !== "أخرى") setValue("customType", "");
  };

  const onSubmit = async (data) => {
    const finalType = data.type === "أخرى" && data.customType?.trim()
      ? data.customType.trim()
      : data.type;

    await onSave({
      equipmentId: data.equipmentId,
      type:        finalType,
      cost:        Number(data.cost) || 0,
      date:        data.date,
      notes:       data.notes,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Select
            label="المعدة *"
            error={errors.equipmentId?.message}
            {...register("equipmentId", { required: "اختر المعدة" })}
          >
            <option value="">— اختر المعدة —</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </div>

        <Select
          label="نوع الصيانة"
          {...register("type")}
          onChange={(e) => { register("type").onChange(e); handleTypeChange(e); }}
        >
          {MAINTENANCE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>

        {showCustomType ? (
          <Input
            label="اكتب نوع الصيانة *"
            placeholder="مثال: تصليح كباش، تغيير فلتر هواء..."
            error={errors.customType?.message}
            {...register("customType", {
              validate: (val) =>
                !showCustomType || (val && val.trim().length > 0)
                  ? true
                  : "اكتب نوع الصيانة",
            })}
          />
        ) : (
          <div /> // keeps grid balanced
        )}

        <Controller
          name="cost"
          control={control}
          rules={{
            required: "أدخل التكلفة",
            min: { value: 0, message: "لا يمكن أن يكون سالبًا" },
          }}
          render={({ field }) => (
            <NumberInput
              label="التكلفة (ج.م) *"
              placeholder="0"
              error={errors.cost?.message}
              {...field}
            />
          )}
        />

        <Input label="التاريخ" type="date" {...register("date")} />

        <div className="sm:col-span-2">
          <Textarea
            label="ملاحظات"
            placeholder="تفاصيل الصيانة، القطع المستبدلة..."
            {...register("notes")}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>تسجيل</Button>
      </div>
    </form>
  );
};

export default MaintenanceForm;
