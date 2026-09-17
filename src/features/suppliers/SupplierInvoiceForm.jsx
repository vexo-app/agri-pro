// src/features/suppliers/SupplierInvoiceForm.jsx
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { Input, Textarea, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { MAX_MONEY_VALUE } from "../../config/constants";
import { todayISO } from "../../utils/formatters";

// Registers a new debt TO a supplier/contractor — e.g. someone did a repair
// or made/supplied something for the business. "amount" is the FULL amount
// owed, recorded immediately (accrual) — paying it off later is tracked
// separately via SupplierPaymentForm, never by editing this amount.
//
// A supplier isn't a real entity with its own id — it's just whatever name
// gets typed here, grouped later by exact string match (see useSuppliers.js).
// That means a typo creates a brand-new "supplier" instead of adding to an
// existing one. `existingSupplierNames` backs a browser autocomplete
// (<datalist>) so re-typing an existing supplier's name suggests the exact
// spelling already on file instead of inviting a near-duplicate.
const SupplierInvoiceForm = ({ initial, existingSupplierNames = [], onSave, onClose }) => {
  const isEdit = !!initial;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    defaultValues: initial ?? {
      supplierName: "",
      description:  "",
      amount:       "",
      date:         todayISO(),
      notes:        "",
    },
  });

  const onSubmit = async (data) => {
    if (isEdit) {
      // audit finding O1: نبعت بس الحقول اللي اتغيّرت فعليًا بدل الفاتورة
      // كاملة (شوف نفس التعليق في JobForm.jsx للتفصيل الكامل).
      const payload = {};
      if (dirtyFields.supplierName) payload.supplierName = data.supplierName.trim();
      if (dirtyFields.description)  payload.description  = data.description.trim();
      if (dirtyFields.amount)       payload.amount        = Number(data.amount) || 0;
      if (dirtyFields.date)         payload.date          = data.date;
      if (dirtyFields.notes)        payload.notes         = data.notes;
      await onSave(payload);
      onClose();
      return;
    }

    await onSave({
      supplierName: data.supplierName.trim(),
      description:  data.description.trim(),
      amount:       Number(data.amount) || 0,
      date:         data.date,
      notes:        data.notes,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <Input
            label="اسم المورد / الشخص *"
            placeholder="مثال: ورشة السيد، محمد النجار..."
            list="supplier-name-options"
            error={errors.supplierName?.message}
            {...register("supplierName", { required: "هذا الحقل مطلوب" })}
          />
          {existingSupplierNames.length > 0 && (
            <datalist id="supplier-name-options">
              {existingSupplierNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          )}
        </div>

        <div className="sm:col-span-2">
          <Input
            label="الشغل اللي عمله *"
            placeholder="مثال: صيانة كباش الجرار، تصنيع قطعة غيار..."
            error={errors.description?.message}
            {...register("description", { required: "هذا الحقل مطلوب" })}
          />
        </div>

        <Controller
          name="amount"
          control={control}
          rules={{
            required: "أدخل المبلغ",
            validate: (v) =>
              Number(v) > 0 && Number(v) <= MAX_MONEY_VALUE
                ? true
                : Number(v) <= 0 ? "يجب أن يكون أكبر من صفر" : `أكبر من الحد المسموح (${MAX_MONEY_VALUE.toLocaleString()})`,
          }}
          render={({ field }) => (
            <NumberInput
              label="إجمالي المبلغ المستحق (ج.م) *"
              placeholder="0"
              error={errors.amount?.message}
              {...field}
            />
          )}
        />

        <Input label="التاريخ" type="date" {...register("date")} />

        <div className="sm:col-span-2">
          <Textarea label="ملاحظات" placeholder="أي تفاصيل إضافية..." {...register("notes")} />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>حفظ الفاتورة</Button>
      </div>
    </form>
  );
};

export default SupplierInvoiceForm;
