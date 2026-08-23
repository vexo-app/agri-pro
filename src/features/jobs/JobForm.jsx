// src/features/jobs/JobForm.jsx
import React, { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { Input, Select, Textarea, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { SummaryRow } from "../../components/ui/Card";
import { WORK_TYPES } from "../../config/constants";
import { calcRevenue, calcFuelCost, calcRemainingAmount } from "../../utils/calculations";
import { formatCurrency, todayISO } from "../../utils/formatters";

const JobForm = ({ initial, equipment, drivers, fuelPrice, onSave, onClose }) => {
  const isEdit = !!initial;
  const isOtherInitially = initial?.workType === "أخرى";
  const [showCustomWorkType, setShowCustomWorkType] = useState(isOtherInitially);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial ?? {
      equipmentId:    "",
      driverId:       "",
      client:         "",
      workType:       "المحراث",
      customWorkType: "",
      acres:          "",
      pricePerAcre:   "",
      fuelUsed:       "",
      date:           todayISO(),
      notes:          "",
      amountPaid:     "",
    },
  });

  // Live calculation
  const [acres, pricePerAcre, fuelUsed, amountPaid] = useWatch({
    control,
    name: ["acres", "pricePerAcre", "fuelUsed", "amountPaid"],
  });

  const revenue      = calcRevenue(acres, pricePerAcre);
  const fuelCost     = calcFuelCost(fuelUsed, fuelPrice);
  const profit       = revenue - fuelCost;
  // في وضع التعديل الحقل مخفي، فبنستخدم القيمة الأصلية للعرض فقط (معلوماتي).
  const displayPaid  = isEdit ? (initial?.amountPaid || 0) : (Number(amountPaid) || 0);
  const remaining    = calcRemainingAmount(revenue, displayPaid);

  const handleEquipmentChange = (e) => {
    const eq = equipment.find((x) => x.id === e.target.value);
    if (eq?.driverId) setValue("driverId", eq.driverId);
  };

  const handleWorkTypeChange = (e) => {
    const val = e.target.value;
    setShowCustomWorkType(val === "أخرى");
    if (val !== "أخرى") setValue("customWorkType", "");
  };

  const onSubmit = async (data) => {
    // if "أخرى" chosen, use customWorkType as the saved workType
    const finalWorkType =
      data.workType === "أخرى" && data.customWorkType?.trim()
        ? data.customWorkType.trim()
        : data.workType;

    await onSave({
      equipmentId:  data.equipmentId,
      driverId:     data.driverId,
      client:       data.client,
      workType:     finalWorkType,
      acres:        Number(data.acres)        || 0,
      pricePerAcre: Number(data.pricePerAcre) || 0,
      fuelUsed:     Number(data.fuelUsed)     || 0,
      date:         data.date,
      notes:        data.notes,
      // على الإنشاء: قيمة أولية تُستخدم لعمل دفعة أولى تلقائياً (شوف JobsPage).
      // على التعديل: بيانات الدفع بقت مصدرها payments collection مش الحقل ده،
      // فبنحافظ على القيمة القديمة زي ما هي وما بنغيّرهاش من هنا.
      amountPaid:   isEdit ? (initial.amountPaid || 0) : (Number(data.amountPaid) || 0),
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Equipment */}
        <Select
          label="المعدة *"
          error={errors.equipmentId?.message}
          {...register("equipmentId", { required: "اختر المعدة" })}
          onChange={(e) => { register("equipmentId").onChange(e); handleEquipmentChange(e); }}
        >
          <option value="">— اختر المعدة —</option>
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name}{eq.category === "attachment" ? " (ملحق)" : ""}
            </option>
          ))}
        </Select>

        {/* Driver */}
        <Select label="السائق" {...register("driverId")}>
          <option value="">— اختر السائق —</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>

        {/* Client */}
        <div className="sm:col-span-2">
          <Input
            label="اسم العميل / الأرض *"
            placeholder="مثال: مزرعة أبو خالد"
            error={errors.client?.message}
            {...register("client", { required: "هذا الحقل مطلوب" })}
          />
        </div>

        {/* Work type select */}
        <Select
          label="نوع العمل"
          {...register("workType")}
          onChange={(e) => { register("workType").onChange(e); handleWorkTypeChange(e); }}
        >
          {WORK_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>

        {/* Custom work type — appears when "أخرى" selected */}
        {showCustomWorkType ? (
          <Input
            label="اكتب نوع العمل *"
            placeholder="مثال: نقل محصول، تقليم أشجار..."
            error={errors.customWorkType?.message}
            {...register("customWorkType", {
              validate: (val) =>
                !showCustomWorkType || (val && val.trim().length > 0)
                  ? true
                  : "اكتب نوع العمل",
            })}
          />
        ) : (
          /* Date shifts here when no custom type */
          <Input label="التاريخ" type="date" {...register("date")} />
        )}

        {/* Date — only shown in its normal position when NOT in custom mode */}
        {showCustomWorkType && (
          <Input label="التاريخ" type="date" {...register("date")} />
        )}

        {/* Acres */}
        <Controller
          name="acres"
          control={control}
          rules={{
            required: "أدخل عدد الأفدنة",
            min: { value: 0.1, message: "يجب أن يكون أكبر من 0" },
          }}
          render={({ field }) => (
            <NumberInput
              label="عدد الأفدنة *"
              placeholder="0"
              error={errors.acres?.message}
              {...field}
            />
          )}
        />

        {/* Price per acre */}
        <Controller
          name="pricePerAcre"
          control={control}
          rules={{ validate: (v) => !v || Number(v) >= 0 || "لا يمكن أن يكون سالبًا" }}
          render={({ field }) => (
            <NumberInput label="سعر الفدان (ج.م)" placeholder="0" error={errors.pricePerAcre?.message} {...field} />
          )}
        />

        {/* Fuel used */}
        <Controller
          name="fuelUsed"
          control={control}
          rules={{ validate: (v) => !v || Number(v) >= 0 || "لا يمكن أن يكون سالبًا" }}
          render={({ field }) => (
            <NumberInput
              label="الوقود المستخدم (لتر)"
              placeholder="0"
              hint={`سعر اللتر: ${fuelPrice} ج.م`}
              error={errors.fuelUsed?.message}
              {...field}
            />
          )}
        />

        {/* Amount paid — only editable at creation time (initial down-payment).
            After creation, payments are tracked via the payments collection
            (صفحة العملاء / "استلام دفعة") so this field is hidden on edit. */}
        {isEdit ? (
          <div className="flex flex-col justify-end">
            <p className="text-xs text-gray-500 mb-1.5">المبلغ المدفوع</p>
            <p className="text-sm text-gray-400 bg-surface-2 border border-white/8 rounded-xl px-3 py-2.5">
              لتسجيل دفعة جديدة استخدم صفحة العملاء
            </p>
          </div>
        ) : (
          <Controller
            name="amountPaid"
            control={control}
            rules={{ validate: (v) => !v || Number(v) >= 0 || "لا يمكن أن يكون سالبًا" }}
            render={({ field }) => (
              <NumberInput
                label="دفعة مقدّمة عند التسجيل (ج.م)"
                placeholder="0"
                hint={revenue > 0 ? `الإجمالي: ${formatCurrency(revenue)}` : undefined}
                error={errors.amountPaid?.message}
                {...field}
              />
            )}
          />
        )}

        {/* Notes */}
        <div className="sm:col-span-2">
          <Textarea
            label="ملاحظات"
            placeholder="أي تفاصيل إضافية..."
            {...register("notes")}
          />
        </div>
      </div>

      {/* Live financial preview */}
      {(revenue > 0 || fuelCost > 0) && (
        <div className="mt-4 bg-surface-2 rounded-2xl p-4 border border-white/8">
          <p className="text-xs font-bold text-gray-400 mb-3">الملخص المالي</p>
          <SummaryRow label="الإيراد"      value={formatCurrency(revenue)}  valueColor="text-amber-400" />
          <SummaryRow label="تكلفة الوقود" value={formatCurrency(fuelCost)} valueColor="text-red-400" />
          <SummaryRow
            label="صافي الربح"
            value={formatCurrency(profit)}
            valueColor={profit >= 0 ? "text-green-400" : "text-red-400"}
            bold
          />
          {revenue > 0 && (
            <>
              <div className="border-t border-white/8 my-2" />
              <SummaryRow label="تم دفعه" value={formatCurrency(displayPaid)} valueColor="text-green-400" />
              <SummaryRow
                label="المتبقي"
                value={formatCurrency(remaining)}
                valueColor={remaining > 0 ? "text-amber-400" : "text-gray-400"}
              />
            </>
          )}
        </div>
      )}

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>حفظ</Button>
      </div>
    </form>
  );
};

export default JobForm;
