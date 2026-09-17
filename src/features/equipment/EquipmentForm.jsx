// src/features/equipment/EquipmentForm.jsx
import React, { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { Input, Select, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import {
  EQUIPMENT_CATEGORY, EQUIPMENT_CATEGORY_LABELS,
  BASE_EQUIPMENT_TYPES, ATTACHMENT_TYPES,
  EQUIPMENT_STATUS_LABELS, MAX_MONEY_VALUE,
} from "../../config/constants";

const OTHER_VALUE = "__other__";

const buildDefaultValues = (initial) => {
  if (!initial) {
    return {
      category:            EQUIPMENT_CATEGORY.BASE,
      name:                "",
      type:                "جرار",
      customType:          "",
      fuelRate:            "",
      driverId:            "",
      customDriverName:    "",
      parentEquipmentId:   "",
      customParentName:    "",
      status:              "active",
      oilChangeIntervalMeter: "",
      greaseIntervalDays:     "",
    };
  }
  const driverIsOther = !initial.driverId && !!initial.customDriverName;
  const parentIsOther = !initial.parentEquipmentId && !!initial.customParentName;
  return {
    category:          EQUIPMENT_CATEGORY.BASE,
    customType:        "",
    customDriverName:  "",
    customParentName:  "",
    ...initial,
    driverId:          driverIsOther ? OTHER_VALUE : (initial.driverId || ""),
    parentEquipmentId: parentIsOther ? OTHER_VALUE : (initial.parentEquipmentId || ""),
  };
};

const EquipmentForm = ({ initial, drivers, baseEquipment = [], onSave, onClose }) => {
  const isEdit = !!initial;
  const initialCategory = initial?.category || EQUIPMENT_CATEGORY.BASE;
  const typeListInitial = initialCategory === EQUIPMENT_CATEGORY.ATTACHMENT ? ATTACHMENT_TYPES : BASE_EQUIPMENT_TYPES;
  const isOtherTypeInitially   = initial ? !typeListInitial.includes(initial?.type) : false;
  const isOtherDriverInitially = !!(initial && !initial.driverId && initial.customDriverName);
  const isOtherParentInitially = !!(initial && !initial.parentEquipmentId && initial.customParentName);

  const [showCustomType,   setShowCustomType]   = useState(isOtherTypeInitially);
  const [showCustomDriver, setShowCustomDriver] = useState(isOtherDriverInitially);
  const [showCustomParent, setShowCustomParent] = useState(isOtherParentInitially);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    defaultValues: buildDefaultValues(initial),
  });

  const category = useWatch({ control, name: "category" }) || EQUIPMENT_CATEGORY.BASE;
  const isAttachment = category === EQUIPMENT_CATEGORY.ATTACHMENT;
  const currentTypeList = isAttachment ? ATTACHMENT_TYPES : BASE_EQUIPMENT_TYPES;

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    const list = val === EQUIPMENT_CATEGORY.ATTACHMENT ? ATTACHMENT_TYPES : BASE_EQUIPMENT_TYPES;
    setValue("type", list[0]);
    setShowCustomType(false);
    setValue("customType", "");
  };

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setShowCustomType(val === "أخرى");
    if (val !== "أخرى") setValue("customType", "");
  };

  const handleDriverChange = (e) => {
    const val = e.target.value;
    setShowCustomDriver(val === OTHER_VALUE);
    if (val !== OTHER_VALUE) setValue("customDriverName", "");
  };

  const handleParentChange = (e) => {
    const val = e.target.value;
    setShowCustomParent(val === OTHER_VALUE);
    if (val !== OTHER_VALUE) setValue("customParentName", "");
  };

  const onSubmit = async (data) => {
    const finalType = data.type === "أخرى" && data.customType?.trim()
      ? data.customType.trim()
      : data.type;

    const driverIsOther = data.driverId === OTHER_VALUE;
    const categoryChanged = dirtyFields.category;

    if (isEdit && !categoryChanged) {
      // audit finding O1: التصنيف نفسه ما اتغيّرش، فمنبعتش كتلة التصفير
      // بتاعته (oilChangeHistory/greaseHistory/lastOilChangeMeter/...) —
      // دي بتتعدّل من صفحة تفاصيل المعدة مباشرة (EquipmentDetailPage.jsx)،
      // وإعادة إرسالها هنا بقيمة قديمة (كانت محمّلة وقت فتح الفورم) كانت
      // بتمسح أي تعديل حصل هناك من جهاز/تاب تاني في نفس الوقت. نبعت بس
      // الحقول الأساسية اللي فعليًا اتغيّرت. لو التصنيف نفسه اتغيّر
      // (base↔attachment) فده تعديل بنائي حقيقي محتاج الكتلة الكاملة —
      // شوف الفرع تحت.
      const payload = {};
      if (dirtyFields.name) payload.name = data.name;
      if (dirtyFields.type || dirtyFields.customType) payload.type = finalType;
      if (dirtyFields.driverId || dirtyFields.customDriverName) {
        payload.driverId         = driverIsOther ? "" : data.driverId;
        payload.customDriverName = driverIsOther ? (data.customDriverName?.trim() || "") : "";
      }
      if (dirtyFields.status) payload.status = data.status;

      if (!isAttachment) {
        if (dirtyFields.fuelRate) payload.fuelRate = Number(data.fuelRate) || 0;
        if (dirtyFields.oilChangeIntervalMeter) {
          payload.oilChangeIntervalMeter = data.oilChangeIntervalMeter === "" ? "" : Number(data.oilChangeIntervalMeter) || "";
        }
      } else {
        if (dirtyFields.greaseIntervalDays) {
          payload.greaseIntervalDays = data.greaseIntervalDays === "" ? "" : Number(data.greaseIntervalDays) || "";
        }
        if (dirtyFields.parentEquipmentId || dirtyFields.customParentName) {
          const parentIsOther = data.parentEquipmentId === OTHER_VALUE;
          payload.parentEquipmentId = parentIsOther ? "" : (data.parentEquipmentId || "");
          payload.customParentName  = parentIsOther ? (data.customParentName?.trim() || "") : "";
        }
      }

      await onSave(payload);
      onClose();
      return;
    }

    // إنشاء جديد، أو تعديل شمل تغيير التصنيف نفسه (base↔attachment) — الحالة
    // دي فعليًا محتاجة الكتلة الكاملة زي الأصل (تصفير حقول النوع التاني).
    const payload = {
      category:         data.category,
      name:             data.name,
      type:             finalType,
      driverId:         driverIsOther ? "" : data.driverId,
      customDriverName: driverIsOther ? (data.customDriverName?.trim() || "") : "",
      status:           data.status,
    };

    if (data.category === EQUIPMENT_CATEGORY.ATTACHMENT) {
      const parentIsOther = data.parentEquipmentId === OTHER_VALUE;
      payload.parentEquipmentId  = parentIsOther ? "" : (data.parentEquipmentId || "");
      payload.customParentName   = parentIsOther ? (data.customParentName?.trim() || "") : "";
      payload.fuelRate           = 0;
      payload.lastOilChangeMeter = "";
      payload.oilChangeHistory   = [];
      // Grease history is managed on the equipment detail page (add/remove
      // entries there), not on this form — carry the existing log through
      // unchanged so a basic-info edit here never wipes it out.
      payload.lastGreaseDate = initial?.lastGreaseDate || "";
      payload.greaseHistory  = initial?.greaseHistory || [];
      // Smart-alerts (Phase 1): optional grease interval — how many days
      // between one greasing and the next. Oil-change fields don't apply
      // to attachments, so they're cleared like the rest of that branch.
      payload.greaseIntervalDays     = data.greaseIntervalDays === "" ? "" : Number(data.greaseIntervalDays) || "";
      payload.oilChangeIntervalMeter = "";
      payload.currentMeter            = "";
    } else {
      payload.fuelRate           = Number(data.fuelRate) || 0;
      payload.parentEquipmentId  = "";
      payload.customParentName   = "";
      payload.lastGreaseDate     = "";
      payload.greaseHistory      = [];
      // Oil-change history is managed on the equipment detail page — carry
      // the existing log through unchanged.
      payload.lastOilChangeMeter = initial?.lastOilChangeMeter ?? "";
      payload.oilChangeHistory   = initial?.oilChangeHistory || [];
      // Smart-alerts (Phase 1): optional interval (كل قد إيه بالعداد) —
      // `currentMeter` itself is updated from the equipment detail page
      // (frequent, quick action), not this form, so it's just carried
      // through unchanged here like the history log above.
      payload.oilChangeIntervalMeter = data.oilChangeIntervalMeter === "" ? "" : Number(data.oilChangeIntervalMeter) || "";
      payload.currentMeter            = initial?.currentMeter ?? "";
      payload.greaseIntervalDays      = "";
    }

    await onSave(payload);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Category — the base/attachment distinction */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5 block">نوع التصنيف *</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: EQUIPMENT_CATEGORY.BASE,       accent: "green"  },
              { value: EQUIPMENT_CATEGORY.ATTACHMENT, accent: "orange" },
            ].map((opt) => {
              const selected = category === opt.value;
              const activeClasses = opt.accent === "green"
                ? "bg-green-900/30 border-green-600 text-green-300"
                : "bg-orange-900/30 border-orange-600 text-orange-300";
              return (
                <label key={opt.value} className={`cursor-pointer text-center text-sm font-bold rounded-xl border px-3 py-3 transition-colors ${
                  selected ? activeClasses : "bg-surface-2 border-white/10 text-gray-400 hover:text-gray-200"
                }`}>
                  <input
                    type="radio"
                    value={opt.value}
                    className="hidden"
                    {...register("category")}
                    onChange={(e) => { register("category").onChange(e); handleCategoryChange(e); }}
                  />
                  {EQUIPMENT_CATEGORY_LABELS[opt.value]}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {isAttachment
              ? "الملحق بيتعلق على معدة أساسية (جرار/عربية) وممكن يتنقل بينهم"
              : "المعدة الأساسية بتتحرك بذاتها وليها سائق مسؤول عنها"}
          </p>
        </div>

        <div className="sm:col-span-2">
          <Input
            label="اسم المعدة *"
            placeholder={isAttachment ? "مثال: محراث قلاب 5 سلاح" : "مثال: جرار ماسي فيرجسون 290"}
            error={errors.name?.message}
            {...register("name", { required: "اسم المعدة مطلوب" })}
          />
        </div>

        {/* Type — with "أخرى" free-text */}
        <Select
          label="النوع *"
          {...register("type")}
          onChange={(e) => { register("type").onChange(e); handleTypeChange(e); }}
        >
          {currentTypeList.map((t) => <option key={t}>{t}</option>)}
        </Select>

        {showCustomType ? (
          <Input
            label="اكتب النوع *"
            placeholder="مثال: رشاشة، مقطورة..."
            error={errors.customType?.message}
            {...register("customType", {
              validate: (val) =>
                !showCustomType || (val && val.trim().length > 0)
                  ? true
                  : "اكتب النوع",
            })}
          />
        ) : (
          <div /> // keeps grid balanced
        )}

        {/* Attachment-only: which base equipment it's mounted on — with "أخرى" free-text */}
        {isAttachment && (
          <Select
            label="متعلقة على معدة *"
            error={errors.parentEquipmentId?.message}
            {...register("parentEquipmentId", { required: isAttachment ? "اختر المعدة أو اكتب اسمها" : false })}
            onChange={(e) => { register("parentEquipmentId").onChange(e); handleParentChange(e); }}
          >
            <option value="">— اختر معدة أساسية —</option>
            {baseEquipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            <option value={OTHER_VALUE}>أخرى (اكتب اسم)</option>
          </Select>
        )}

        {isAttachment && showCustomParent && (
          <Input
            label="اكتب اسم المعدة المتعلق عليها *"
            placeholder="مثال: جرار كمبين المزرعة"
            error={errors.customParentName?.message}
            {...register("customParentName", {
              validate: (val) =>
                !showCustomParent || (val && val.trim().length > 0)
                  ? true
                  : "اكتب اسم المعدة",
            })}
          />
        )}

        {/* Driver — with "أخرى" free-text */}
        <Select
          label="السائق المسؤول"
          {...register("driverId")}
          onChange={(e) => { register("driverId").onChange(e); handleDriverChange(e); }}
        >
          <option value="">— اختر سائقاً —</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value={OTHER_VALUE}>أخرى (اكتب اسم)</option>
        </Select>

        {showCustomDriver ? (
          <Input
            label="اكتب اسم السائق *"
            placeholder="مثال: محمد علي"
            error={errors.customDriverName?.message}
            {...register("customDriverName", {
              validate: (val) =>
                !showCustomDriver || (val && val.trim().length > 0)
                  ? true
                  : "اكتب اسم السائق",
            })}
          />
        ) : (
          !isAttachment && <div /> // keeps grid balanced next to fuel-rate row on base equipment
        )}

        {/* Base-only: fuel rate. Oil-change history is tracked separately
            on the equipment detail page as a full log, not a single field. */}
        {!isAttachment && (
          <Controller
            name="fuelRate"
            control={control}
            rules={{
              validate: (v) =>
                !v || (Number(v) >= 0 && Number(v) <= MAX_MONEY_VALUE) ||
                (Number(v) < 0 ? "لا يمكن أن يكون سالبًا" : `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`),
            }}
            render={({ field }) => (
              <NumberInput
                label="معدل استهلاك الوقود (لتر/ساعة)"
                placeholder="0"
                error={errors.fuelRate?.message}
                {...field}
              />
            )}
          />
        )}

        {/* Smart-alerts (Phase 1) — optional oil-change interval. Purely
            client-side, no push/backend: see utils/maintenanceAlerts.js.
            `currentMeter` (the live reading) is updated from the equipment
            detail page, not here — this is a one-time setup value. */}
        {!isAttachment && (
          <Controller
            name="oilChangeIntervalMeter"
            control={control}
            rules={{ validate: (v) => !v || Number(v) > 0 || "لازم يكون رقم أكبر من صفر" }}
            render={({ field }) => (
              <NumberInput
                label="كل قد إيه (بالعداد) يتغير الزيت"
                placeholder="مثال: 250"
                error={errors.oilChangeIntervalMeter?.message}
                {...field}
              />
            )}
          />
        )}

        {/* Smart-alerts (Phase 1) — optional grease interval, in days. */}
        {isAttachment && (
          <Controller
            name="greaseIntervalDays"
            control={control}
            rules={{ validate: (v) => !v || Number(v) > 0 || "لازم يكون رقم أكبر من صفر" }}
            render={({ field }) => (
              <NumberInput
                label="كل قد إيه (بالأيام) تتشحم"
                placeholder="مثال: 30"
                error={errors.greaseIntervalDays?.message}
                {...field}
              />
            )}
          />
        )}
        {/* Grease history is tracked separately on the equipment detail
            page as a full log, not a single date field. */}

        <Select label="الحالة" {...register("status")}>
          {Object.entries(EQUIPMENT_STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
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

export default EquipmentForm;
