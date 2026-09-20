// src/features/custody/CustodyTransactionForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Select, NumberInput, Textarea } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import {
  CUSTODY_TYPES, CUSTODY_TYPE_LABELS,
  CUSTODY_EXPENSE_CATEGORIES, CUSTODY_EXPENSE_CATEGORY_LABELS,
  MAX_MONEY_VALUE,
} from "../../config/constants";
import { todayISO } from "../../utils/formatters";

const CustodyTransactionForm = ({ initial, isEdit: isEditProp, drivers, equipment, onSave, onClose }) => {
  // ملحوظة إصلاح: الوضع (إضافة/تعديل) لازم ييجي صراحةً من الصفحة اللي
  // بتفتح الفورم، مش يتحدد بمجرد وجود initial. الصفحة كانت بتبعت كائن
  // initial جاهز حتى في حالة "إضافة حركة جديدة" (عشان يعبّي التاريخ والنوع
  // الافتراضي)، فلو حكمنا هنا بـ !!initial كنا بنعتبرها "تعديل" غلط —
  // ونتيجة كده الفورم كان بيبعت بس الحقول اللي المستخدم لمسها يدويًا
  // (dirtyFields)، فلو محدش لمس حقل التاريخ أو النوع (الحالة الشائعة عند
  // الإضافة، لأنهم أصلاً معبّيين صح) كانت الحركة بتتسجل من غير type ومن
  // غير date — فمكانتش بتتحسب في الرصيد ولا بتظهر بتاريخ صحيح.
  const isEdit = !!isEditProp;
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    defaultValues: initial ?? {
      type:         CUSTODY_TYPES.EXPENSE,
      category:     CUSTODY_EXPENSE_CATEGORIES.EQUIPMENT,
      equipmentId:  "",
      driverId:     "",
      otherLabel:   "",
      amount:       "",
      date:         todayISO(),
      source:       "",
      notes:        "",
    },
  });

  const type     = watch("type");
  const category = watch("category");
  const isExpense = type === CUSTODY_TYPES.EXPENSE;

  const onSubmit = async (data) => {
    if (isEdit) {
      // audit finding O1: نبعت بس الحقول اللي اتغيّرت فعليًا بدل الحركة
      // كاملة (شوف نفس التعليق في JobForm.jsx للتفصيل الكامل). لو النوع
      // (category) نفسه اتغيّر، نبعت الحقل المرتبط بالفرع الجديد زي
      // السلوك الأصلي بالظبط (حتى لو قيمته الافتراضية ما اتلمستش يدويًا).
      //
      // إصلاح إضافي: سجلات قديمة اتسجلت ناقصة بسبب الـbug القديم (شوف
      // CustodyPage.jsx) ممكن يكون فيها type/date/category مش موجودين
      // أصلاً في المستند. لو اعتمدنا على dirtyFields بس، وقتها فتح سجل
      // زي ده وحفظه من غير ما "تلمس" الحقل الناقص (لأنه أصلاً ظاهر بقيمة
      // افتراضية معقولة) هيسيبه ناقص زي ما هو. فأي حقل من التلاتة دي كان
      // غير موجود في السجل الأصلي بيتبعت دايمًا مع الحفظ، حتى لو مالمسوش،
      // عشان أول ضغطة "حفظ" على سجل قديم ناقص تصلّحه تلقائيًا.
      const typeWasMissing     = initial?.type     === undefined;
      const dateWasMissing     = initial?.date     === undefined;
      const categoryWasMissing = initial?.category === undefined;

      const categoryChanged = dirtyFields.category || categoryWasMissing;
      const payload = {};
      if (dirtyFields.type   || typeWasMissing) payload.type   = data.type;
      if (dirtyFields.amount) payload.amount = Number(data.amount) || 0;
      if (dirtyFields.date   || dateWasMissing) payload.date   = data.date;
      if (dirtyFields.notes)  payload.notes  = data.notes || "";

      if (data.type === CUSTODY_TYPES.EXPENSE) {
        if (categoryChanged) payload.category = data.category;
        if (data.category === CUSTODY_EXPENSE_CATEGORIES.EQUIPMENT && (categoryChanged || dirtyFields.equipmentId)) {
          payload.equipmentId = data.equipmentId || "";
        }
        if (data.category === CUSTODY_EXPENSE_CATEGORIES.DRIVER && (categoryChanged || dirtyFields.driverId)) {
          payload.driverId = data.driverId || "";
        }
        if (data.category === CUSTODY_EXPENSE_CATEGORIES.OTHER && (categoryChanged || dirtyFields.otherLabel)) {
          payload.otherLabel = data.otherLabel || "";
        }
      } else if (dirtyFields.source) {
        payload.source = data.source || "";
      }

      await onSave(payload);
      onClose();
      return;
    }

    const payload = {
      type:   data.type,
      amount: Number(data.amount) || 0,
      date:   data.date,
      notes:  data.notes || "",
    };

    if (data.type === CUSTODY_TYPES.EXPENSE) {
      payload.category = data.category;
      if (data.category === CUSTODY_EXPENSE_CATEGORIES.EQUIPMENT) payload.equipmentId = data.equipmentId || "";
      if (data.category === CUSTODY_EXPENSE_CATEGORIES.DRIVER)    payload.driverId    = data.driverId || "";
      if (data.category === CUSTODY_EXPENSE_CATEGORIES.OTHER)     payload.otherLabel  = data.otherLabel || "";
    } else {
      payload.source = data.source || "";
    }

    await onSave(payload);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Select label="نوع الحركة *" {...register("type")}>
            <option value={CUSTODY_TYPES.EXPENSE}>{CUSTODY_TYPE_LABELS.expense}</option>
            <option value={CUSTODY_TYPES.DEPOSIT}>{CUSTODY_TYPE_LABELS.deposit}</option>
          </Select>
        </div>

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

        {isExpense ? (
          <>
            <div className="sm:col-span-2">
              <Select label="بند الصرف" {...register("category")}>
                <option value={CUSTODY_EXPENSE_CATEGORIES.EQUIPMENT}>{CUSTODY_EXPENSE_CATEGORY_LABELS.equipment}</option>
                <option value={CUSTODY_EXPENSE_CATEGORIES.DRIVER}>{CUSTODY_EXPENSE_CATEGORY_LABELS.driver}</option>
                <option value={CUSTODY_EXPENSE_CATEGORIES.OTHER}>{CUSTODY_EXPENSE_CATEGORY_LABELS.other}</option>
              </Select>
            </div>

            {category === CUSTODY_EXPENSE_CATEGORIES.EQUIPMENT && (
              <div className="sm:col-span-2">
                <Select label="المعدة (اختياري)" {...register("equipmentId")}>
                  <option value="">— بدون تحديد —</option>
                  {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </div>
            )}

            {category === CUSTODY_EXPENSE_CATEGORIES.DRIVER && (
              <div className="sm:col-span-2">
                <Select label="السائق (اختياري)" {...register("driverId")}>
                  <option value="">— بدون تحديد —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            )}

            {category === CUSTODY_EXPENSE_CATEGORIES.OTHER && (
              <div className="sm:col-span-2">
                <Input label="اكتب نوع المصروف *" placeholder="مثال: إيجار، مصاريف إدارية..."
                  {...register("otherLabel", {
                    required: category === CUSTODY_EXPENSE_CATEGORIES.OTHER ? "اكتب نوع المصروف" : false,
                  })}
                  error={errors.otherLabel?.message} />
              </div>
            )}
          </>
        ) : (
          <div className="sm:col-span-2">
            <Input label="مصدر المبلغ (اختياري)" placeholder="مثال: رجل الأعمال"
              {...register("source")} />
          </div>
        )}

        <div className="sm:col-span-2">
          <Textarea label="ملاحظات" placeholder="تفاصيل إضافية..." rows={2}
            {...register("notes")} />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" variant={isExpense ? "danger" : "info"} loading={isSubmitting}>
          {isExpense ? "تسجيل الصرف" : "تسجيل الإضافة"}
        </Button>
      </div>
    </form>
  );
};

export default CustodyTransactionForm;
