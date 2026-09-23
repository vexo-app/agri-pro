// src/features/equipment/ServiceHistoryCard.jsx
// Shows the full sequence of oil changes (by meter reading) or grease jobs
// (by date) for a piece of equipment, with a small inline form to add the
// next entry in the sequence. Used on the equipment detail page.
import React, { useState } from "react";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Input, NumberInput } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { OilCanIcon, CalendarIcon, PlusIcon, TrashIcon } from "../../components/ui/Icons";
import { formatNumber, formatCurrency, formatDateShort, todayISO } from "../../utils/formatters";
import { sortOilHistory, sortGreaseHistory, newHistoryEntryId, findLinkedOilMaintenance } from "../../utils/serviceHistory";

const ServiceHistoryCard = ({ kind, entries = [], onAdd, onRemove, maintenance = [] }) => {
  const isOil = kind === "oil";
  const [meter, setMeter] = useState("");
  const [date, setDate]   = useState(todayISO());
  const [oilKg, setOilKg]     = useState("");
  const [oilCost, setOilCost] = useState("");

  const sorted = isOil ? sortOilHistory(entries) : sortGreaseHistory(entries);

  const handleAdd = () => {
    if (isOil) {
      const meterVal = Number(meter);
      if (!meter || !Number.isFinite(meterVal) || meterVal <= 0) return;
      // Optional oil quantity (kg) + total price. Only set when entered, so
      // no `undefined` ever lands inside the Firestore array.
      const entry = { id: newHistoryEntryId(), meter: meterVal, date: date || todayISO() };
      const kgVal   = Number(oilKg);
      const costVal = Number(oilCost);
      if (oilKg !== ""   && (!Number.isFinite(kgVal)   || kgVal < 0))   return;
      if (oilCost !== "" && (!Number.isFinite(costVal) || costVal < 0)) return;
      if (oilKg !== ""   && kgVal > 0)   entry.oilKg   = kgVal;
      if (oilCost !== "" && costVal > 0) entry.oilCost = costVal;
      onAdd(entry);
      setMeter("");
      setOilKg("");
      setOilCost("");
    } else {
      if (!date) return;
      onAdd({ id: newHistoryEntryId(), date });
    }
    setDate(todayISO());
  };

  return (
    <Card className="mb-5">
      <CardHeader
        title={isOil ? "سجل غيار الزيت" : "سجل التشحيم"}
        subtitle={`${entries.length} ${isOil ? "غيار مسجل" : "تشحيمة مسجلة"}`}
      />
      <CardBody>
        {/* Add-entry row */}
        <div className="flex flex-wrap items-end gap-2 mb-4 pb-4 border-b border-white/8">
          {isOil && (
            <div className="flex-1 min-w-[140px]">
              <NumberInput
                label="عداد الغيار الجديد"
                placeholder="مثال: 123000"
                value={meter}
                onChange={(e) => setMeter(e.target.value)}
              />
            </div>
          )}
          {isOil && (
            <div className="flex-1 min-w-[110px]">
              <NumberInput
                label="كمية الزيت (كيلو)"
                placeholder="مثال: 15"
                value={oilKg}
                onChange={(e) => setOilKg(e.target.value)}
              />
            </div>
          )}
          {isOil && (
            <div className="flex-1 min-w-[110px]">
              <NumberInput
                label="ثمن الزيت (جنيه)"
                placeholder="الإجمالي"
                value={oilCost}
                onChange={(e) => setOilCost(e.target.value)}
              />
            </div>
          )}
          <div className="flex-1 min-w-[140px]">
            <Input
              label="التاريخ"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" icon={<PlusIcon size={14} />} onClick={handleAdd}>
            {isOil ? "إضافة غيار" : "إضافة تشحيم"}
          </Button>
        </div>

        {/* History list — oldest first, so the sequence reads naturally */}
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-3">لا يوجد سجل بعد</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((entry, idx) => {
              // الكمية والثمن بيتقروا من سجل الصيانة المرتبط (مصدر الفلوس
              // الوحيد)، فأي تعديل في صفحة الصيانة يبان هنا على طول.
              const linked = isOil ? findLinkedOilMaintenance(maintenance, entry) : null;
              return (
              <div
                key={entry.id || idx}
                className="flex items-center justify-between bg-surface-2 rounded-xl px-4 py-2.5"
              >
                <div className="flex items-center gap-2.5 text-xs text-gray-400">
                  <span className="w-5 h-5 rounded-full bg-brand-900/40 text-brand-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  {isOil ? <OilCanIcon size={13} /> : <CalendarIcon size={13} />}
                  {isOil ? (
                    <span className="font-bold text-gray-200">{formatNumber(entry.meter)}</span>
                  ) : (
                    <span className="font-bold text-gray-200">{formatDateShort(entry.date)}</span>
                  )}
                  {isOil && entry.date && (
                    <span className="text-gray-500">· {formatDateShort(entry.date)}</span>
                  )}
                  {linked?.oilKg > 0 && (
                    <span className="text-gray-500">· {formatNumber(linked.oilKg)} كيلو</span>
                  )}
                  {linked && (
                    <span className="text-gray-300">· {formatCurrency(linked.cost)}</span>
                  )}
                </div>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  >
                    <TrashIcon size={13} />
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ServiceHistoryCard;
