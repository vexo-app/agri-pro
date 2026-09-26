// src/features/maintenance/MaintenanceGroupCard.jsx
import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { EditIcon, TrashIcon, CalendarIcon, WrenchIcon, EQUIP_TYPE_ICON_MAP } from "../../components/ui/Icons";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

const MaintenanceGroupCard = ({ group, onEdit, onDelete }) => {
  const { equipment, records, totalCost } = group;
  const EquipIcon = EQUIP_TYPE_ICON_MAP[equipment.type] ?? WrenchIcon;
  // مقفولة افتراضيًا — الضغط على المعدة بيفتح/يقفل سجلات صيانتها
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-full text-right flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors ${open ? "border-b border-white/8" : ""}`}>
        <div className="w-9 h-9 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center flex-shrink-0">
          <EquipIcon size={18} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-100 truncate">{equipment.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{records.length} سجل صيانة</p>
        </div>
        <span className="text-sm font-extrabold text-amber-400 flex-shrink-0">
          {formatCurrency(totalCost)}
        </span>
        <span className={`text-gray-400 text-xs flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▼</span>
      </button>

      {open && <div className="divide-y divide-white/8">
        {records.map((record) => (
          <div key={record.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
              <WrenchIcon size={13} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200">{record.type}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                <CalendarIcon size={11} />
                <span>{formatDateShort(record.date)}</span>
                {record.notes && <span>· {record.notes}</span>}
              </div>
            </div>
            <span className="text-sm font-bold text-amber-400 flex-shrink-0 mx-2">
              {formatCurrency(record.cost)}
            </span>
            <Button variant="ghost" size="xs" onClick={() => onEdit(record)}      icon={<EditIcon size={13} />}  className="px-2 flex-shrink-0" />
            <Button variant="ghost" size="xs" onClick={() => onDelete(record.id)} icon={<TrashIcon size={13} />} className="px-2 flex-shrink-0" />
          </div>
        ))}
      </div>}
    </Card>
  );
};

export default MaintenanceGroupCard;
