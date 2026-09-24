// src/features/reports/DriverReportCard.jsx
import React from "react";
import { Card } from "../../components/ui/Card";
import { formatCurrency, formatNumber, getInitial } from "../../utils/formatters";

const DriverReportCard = ({ report, maxAcres = 1 }) => {
  const { name, phone, salary, totalRevenue, totalAcres, netProfit, ops } = report;

  // Performance = acres relative to the top driver (not revenue)
  const acresPct   = maxAcres > 0 ? (totalAcres / maxAcres) * 100 : 0;
  const profitPct  = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const isProfit   = netProfit >= 0;

  const barColor = acresPct > 66 ? "#22c55e" : acresPct > 33 ? "#f59e0b" : "#ef4444";

  return (
    <Card>
      <div className="p-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-base font-extrabold text-white flex-shrink-0 shadow-lg">
            {getInitial(name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-100 truncate">{name}</p>
            {phone && (
              <p className="text-xs text-gray-500 mt-0.5" style={{ direction:"ltr", textAlign:"right" }}>{phone}</p>
            )}
          </div>
          <div className="text-left flex-shrink-0">
            <p className="text-base font-extrabold text-amber-400 tabular-nums">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] text-gray-500 text-left">إجمالي الإيراد</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label:"أفدنة",    value: formatNumber(totalAcres),  color:"text-blue-400"  },
            { label:"عمليات",   value: ops,                       color:"text-gray-300"  },
            { label:"ربح التشغيل", value: formatCurrency(netProfit), color: isProfit?"text-green-400":"text-red-400" },
            { label:"هامش",     value: `${profitPct.toFixed(0)}%`, color: isProfit?"text-brand-400":"text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-2 rounded-xl p-2.5 text-center">
              <p className={`text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Acres performance bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-500">
              نسبة الأفدنة مقارنةً بأعلى سائق
            </span>
            <span className="font-bold tabular-nums" style={{ color: barColor }}>
              {formatNumber(totalAcres)} فدان · {acresPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${acresPct}%`,
                background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
              }}
            />
          </div>
        </div>

        {/* Salary row */}
        {salary > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-white/8">
            <span className="text-xs text-gray-500">الراتب الشهري</span>
            <span className="text-xs font-bold text-gray-300">{formatCurrency(salary)}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DriverReportCard;
