// src/features/reports/EquipmentReportCard.jsx
import React from "react";
import { Card, Badge, ProgressBar } from "../../components/ui/Card";
import { formatCurrency, formatNumber, formatProfit } from "../../utils/formatters";
import { EQUIP_TYPE_ICON_MAP, TractorIcon } from "../../components/ui/Icons";

const EquipmentReportCard = ({ report }) => {
  const {
    name, type,
    totalRevenue, totalAcres, totalFuel,
    totalFuelCost,   // ← الاسم الصح من aggregateJobs
    maintCost, netProfit, margin, ops,
  } = report;

  const EquipIcon = EQUIP_TYPE_ICON_MAP[type] ?? TractorIcon;
  const isProfit  = netProfit >= 0;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/8">
        <div className="w-10 h-10 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center flex-shrink-0">
          <EquipIcon size={20} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-gray-100 truncate">{name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{type} · {ops} عملية</p>
        </div>
        <Badge variant={isProfit ? "green" : "red"}>
          {isProfit ? "رابح" : "خسارة"}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 border-b border-white/8">
        {[
          { label: "إجمالي الأفدنة",  value: `${formatNumber(totalAcres)} فدان`,   color: "text-blue-400"  },
          { label: "إجمالي الإيراد",  value: formatCurrency(totalRevenue),          color: "text-amber-400" },
          { label: "إجمالي الوقود",   value: `${formatNumber(totalFuel)} لتر`,     color: "text-gray-300"  },
          { label: "تكلفة الوقود",    value: formatCurrency(totalFuelCost),         color: "text-red-400"   },
          { label: "تكاليف الصيانة",  value: formatCurrency(maintCost),            color: "text-red-400"   },
          { label: "ربح المعدة (قبل المصاريف العامة)", value: formatProfit(netProfit),            color: isProfit ? "text-green-400" : "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-surface-2 rounded-xl p-3">
            <p className={`text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Margin bar */}
      {totalRevenue > 0 && (
        <div className="px-5 py-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-500">هامش ربح المعدة</span>
            <span className={`text-xs font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
              {margin.toFixed(1)}%
            </span>
          </div>
          <ProgressBar
            value={Math.max(0, margin)}
            max={100}
            color={isProfit ? "bg-green-500" : "bg-red-500"}
          />
        </div>
      )}
    </Card>
  );
};

export default EquipmentReportCard;
