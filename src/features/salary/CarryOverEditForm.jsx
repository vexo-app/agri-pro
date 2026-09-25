// src/features/salary/CarryOverEditForm.jsx
// تعديل مبلغ "خصم مرحّل من الشهر اللي فات" يدويًا. الحفظ بيكتب قيد واحد
// نوعه carryover في الشهر ده؛ "رجوع للحساب التلقائي" بيمسح القيد ده بس.
import React, { useState } from "react";
import { NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { MAX_MONEY_VALUE } from "../../config/constants";
import { formatCurrency } from "../../utils/formatters";

const CarryOverEditForm = ({ currentAmount, autoAmount, isEdited, onSave, onReset, onClose }) => {
  const [value, setValue] = useState(String(currentAmount ?? 0));
  const [error, setError] = useState("");

  const handleSave = async () => {
    const amount = Number(value);
    if (value === "" || !Number.isFinite(amount) || amount < 0) return setError("أدخل مبلغ صحيح (صفر أو أكتر)");
    if (amount > MAX_MONEY_VALUE) return setError("أكبر من الحد المسموح");
    await onSave(amount);
    onClose();
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        المبلغ المحسوب تلقائي من سالب الشهر اللي فات: <span className="font-bold text-purple-400">{formatCurrency(autoAmount)}</span>
      </p>
      <NumberInput
        label="مبلغ الخصم المرحّل (ج.م)"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(""); }}
        error={error}
      />
      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8 flex-wrap">
        {isEdited && (
          <Button type="button" variant="ghost" onClick={async () => { await onReset(); onClose(); }}>
            رجوع للمبلغ التلقائي
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="button" onClick={handleSave}>حفظ</Button>
      </div>
    </div>
  );
};

export default CarryOverEditForm;
