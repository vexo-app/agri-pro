// src/pages/ReportsPage.jsx
import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, LabelList,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { useEquipment }    from "../hooks/useEquipment";
import { useDrivers }      from "../hooks/useDrivers";
import EquipmentReportCard from "../features/reports/EquipmentReportCard";
import DriverReportCard    from "../features/reports/DriverReportCard";
import { EmptyState } from "../components/ui/Card";
import { ChartCard } from "../components/ui/ChartCard";
import LoadingScreen       from "../components/ui/LoadingScreen";
import DownloadReportButton from "../components/ui/DownloadReportButton";
import FeatureIntroBanner   from "../components/common/FeatureIntroBanner";
import { TractorIcon, DriverIcon, ChartIcon, RevenueIcon, AcreIcon, FuelIcon, ReceiptIcon } from "../components/ui/Icons";
import { formatCurrency, formatNumber, formatProfit, formatDeduction } from "../utils/formatters";
import { TEAM_ROLE } from "../config/constants";
import { useData }                from "../contexts/DataContext";
import { findJobsWithMissingEquipment } from "../utils/calculations";
import { buildPeriodFinancials } from "../utils/financialSummary";
import { downloadMonthlySummaryPdf } from "../utils/pdfGenerator";
import { shortNum, truncateLabel, createAngledNameTick } from "../components/charts/chartHelpers";
import { trackEvent } from "../config/posthog";

// ── Monthly report download: three choices — current month, previous
// month, or every month (all time). No calendar picker, since those are
// the only three ranges anyone actually asks for here.
const MONTH_DOWNLOAD_OPTIONS = [
  { value: "current",  label: "الشهر الحالي"  },
  { value: "previous", label: "الشهر السابق" },
  { value: "all",      label: "كل الشهور"     },
];

// Same {year, month} shape downloadMonthlySummaryPdf already expects —
// kept as one small helper so "current" and "previous" can never drift
// out of sync with each other. Not called for "all" (no single month).
const resolveMonth = (choice) => {
  const now = new Date();
  const base = choice === "previous"
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : now;
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
};

const TABS = [
  { id: "equipment", label: "المعدات",  Icon: TractorIcon },
  { id: "drivers",   label: "السائقون", Icon: DriverIcon  },
];

// ── Custom axis ticks: show a shortened name (to fit the chart), but wrap
// it in a native SVG <title> so hovering the label with the mouse shows the
// full, untruncated name as a browser tooltip.
const AngledNameTick = createAngledNameTick({ fontSize: 11, maxLength: 10 });

const HorizontalNameTick = (props) => {
  const { x, y, payload } = props;
  const full = payload.value ?? "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={4}
        textAnchor="end"
        fill="#9ca3af"
        fontSize={11}
        fontFamily="Cairo"
      >
        {truncateLabel(full, 10)}
        <title>{full}</title>
      </text>
    </g>
  );
};

// ── Tooltip ───────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, moneyKeys = [] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"rgba(13,21,38,0.97)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:14, padding:"12px 16px", boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
      direction:"rtl", minWidth:170,
    }}>
      <p style={{ fontSize:11, color:"#6b7280", marginBottom:8, fontWeight:600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:p.fill||p.color, flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"#9ca3af", flex:1 }}>{p.name}</span>
          <span style={{ fontSize:13, fontWeight:700, color:"#f0f4f8" }}>
            {moneyKeys.includes(p.dataKey) ? formatCurrency(p.value) : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Legend ────────────────────────────────────────────────────────────────
const Legend = ({ items }) => (
  <div className="flex items-center justify-center gap-5 mt-3 flex-wrap">
    {items.map((l) => (
      <div key={l.label} className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background:l.color }}/>
        <span className="text-xs text-gray-400">{l.label}</span>
      </div>
    ))}
  </div>
);

// ── ReportsPage ───────────────────────────────────────────────────────────
const ReportsPage = () => {
  const { report: equipReport, loading: eLoading } = useEquipment();
  const {
    salaryEntries = [], equipment = [], jobs = [], drivers = [], maintenance = [], equipmentFuelEntries = [],
    taxDeductions = [], supplierInvoices = [], supplierPayments = [], payments = [], settings,
  } = useData();
  // Step 2: كل أرقام الصفحة وPDF بتاعها من buildPeriodFinancials — نفس مصدر
  // الداشبورد بالحرف. قبل كده الإيراد/الوقود/الصيانة هنا كانوا متجمعين من
  // تقرير المعدات، فأي عملية أو صيانة مرتبطة بمعدة مش موجودة كانت بتسقط من
  // التقارير وتفضل ظاهرة في الداشبورد (رقمين مختلفين لنفس الفترة).
  const financialData = {
    jobs, payments, maintenance, equipmentFuelEntries, equipment,
    salaryEntries, drivers, taxDeductions, supplierInvoices, supplierPayments,
    fuelPrice: settings.fuelPrice,
  };
  const currentPeriod = resolveMonth("current");
  const currentMonthPrefix = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, "0")}`;
  const allTimeFinancials = buildPeriodFinancials(financialData, { assumeSalaryDueForMonth: currentMonthPrefix });
  const orphanJobs = findJobsWithMissingEquipment(jobs, equipment);
  const { report: driverReportAll, loading: dLoading } = useDrivers();
  // تقرير الأداء ده خاص بالعمليات الميدانية (أفدنة/عمليات/إيراد) — مالهاش
  // معنى للإداريين والمحاسبين، فبيفلتر بس السائقين الفعليين.
  const driverReport = driverReportAll.filter((d) => (d.role || TEAM_ROLE.DRIVER) === TEAM_ROLE.DRIVER);
  const [tab, setTab] = useState("equipment");
  const [downloadMonth, setDownloadMonth] = useState("current");

  // تحميل PDF: الشهر الحالي أو السابق أو كل الشهور — نفس الأرقام اللي في
  // الصفحة والداشبورد لنفس الفترة (buildPeriodFinancials).
  const handleDownloadMonthly = async () => {
    if (downloadMonth === "all") {
      await downloadMonthlySummaryPdf({ jobs, equipment, allTime: true, financials: allTimeFinancials });
      trackEvent("monthly_report_downloaded", { report_period: downloadMonth });
      return;
    }

    const { year, month } = resolveMonth(downloadMonth);
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const financials = buildPeriodFinancials(financialData, {
      monthPrefix,
      assumeSalaryDueForMonth: downloadMonth === "current" ? monthPrefix : null,
    });
    await downloadMonthlySummaryPdf({ jobs, equipment, month, year, allTime: false, financials });
    trackEvent("monthly_report_downloaded", { report_period: downloadMonth });
  };

  if (eLoading || dLoading) return <LoadingScreen />;

  const {
    totalRevenue, totalFuelCost, totalMaintCost, netProfit: totalProfit,
    totalSalariesPaid, totalSupplierPaidOut, totalTaxDeductions,
  } = allTimeFinancials;

  const revenueVsProfit = equipReport.map((eq) => ({
    name:    eq.name,
    revenue: eq.totalRevenue || 0,
    profit:  Math.max(0, eq.netProfit || 0),
    loss:    Math.abs(Math.min(0, eq.netProfit || 0)),
  }));

  const costBreakdown = equipReport.map((eq) => ({
    name:  eq.name,
    fuel:  eq.totalFuelCost || 0,
    maint: eq.maintCost     || 0,
  }));

  const acresData = equipReport.map((eq) => ({
    name:  eq.name,
    acres: eq.totalAcres || 0,
  }));

  const maxAcres = Math.max(...acresData.map((d) => d.acres), 1);

  const RADIAL_COLORS = ["#22c55e","#f59e0b","#3b82f6","#8b5cf6","#f97316"];
  const marginData = equipReport
    .filter((eq) => (eq.totalRevenue || 0) > 0)
    .map((eq, i) => ({
      name:  eq.name,
      value: Math.max(0, Math.round(eq.margin || 0)),
      fill:  RADIAL_COLORS[i % RADIAL_COLORS.length],
    }));

  const maxDriverAcres = Math.max(...driverReport.map((d) => d.totalAcres || 0), 1);

  // bar colors per entry (for profit/loss split)
  const profitColors  = ["#22c55e","#16a34a","#15803d","#166534","#14532d"];
  const lossColors    = ["#ef4444","#dc2626","#b91c1c","#991b1b","#7f1d1d"];
  const revenueColors = ["#f59e0b","#d97706","#b45309","#92400e","#78350f"];
  const fuelColors    = ["#3b82f6","#2563eb","#1d4ed8","#1e40af","#1e3a8a"];
  const maintColors   = ["#8b5cf6","#7c3aed","#6d28d9","#5b21b6","#4c1d95"];
  const acresColors   = ["#06b6d4","#0891b2","#0e7490","#155e75","#164e63"];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto" dir="rtl">

      <FeatureIntroBanner
        id="reports"
        title="التقارير"
        description="هنا تقدر تقارن أداء كل معدة وكل سائق على حدة (إيراد، وقود، صيانة)، وتنزّل ملخص شهري أو سنوي بصيغة PDF جاهز للطباعة أو الإرسال — من زرار «تحميل تقرير» تحت."
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <ChartIcon size={22} className="text-brand-400"/>
            التقارير
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">تحليل أداء المعدات والسائقين</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Monthly report download — pick the period, then download the
              exact same figures this page shows for it as a PDF file. */}
          <div className="flex items-center gap-2">
            <select
              value={downloadMonth}
              onChange={(e) => setDownloadMonth(e.target.value)}
              aria-label="اختر الفترة"
              className="bg-surface-2 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
            >
              {MONTH_DOWNLOAD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <DownloadReportButton
              onDownload={handleDownloadMonthly}
              title="تحميل التقرير PDF"
            />
          </div>
        </div>
      </div>

      {equipReport.length > 0 && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label:"إجمالي الإيراد",  value:formatCurrency(totalRevenue),  color:"text-amber-400",  icon:<RevenueIcon size={18}/> },
              { label:"تكلفة الوقود",    value:formatDeduction(totalFuelCost), color:"text-blue-400",   icon:<FuelIcon size={18}/> },
              { label:"تكاليف الصيانة",   value:formatDeduction(totalMaintCost),      color:"text-purple-400", icon:<AcreIcon size={18}/> },
              { label:"مرتبات الفريق", value:formatDeduction(totalSalariesPaid), color:"text-red-400",    icon:<DriverIcon size={18}/> },
              { label:"الواصل للمورد", value:formatDeduction(totalSupplierPaidOut), color:"text-red-400",    icon:<ReceiptIcon size={18}/> },
              { label:"ضرائب وخصومات",   value:formatDeduction(totalTaxDeductions), color:"text-red-400",    icon:<ReceiptIcon size={18}/> },
              { label:"صافي الربح",      value:formatProfit(totalProfit),   color:totalProfit>=0?"text-green-400":"text-red-400", icon:<ChartIcon size={18}/> },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-white/8 rounded-2xl p-4">
                <div className={`mb-2 ${s.color}`}>{s.icon}</div>
                <p className={`text-base font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {orphanJobs.length > 0 && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-6">
              ⚠ {orphanJobs.length} عملية مرتبطة بمعدة مش موجودة — داخلة في الإجماليات فوق، لكنها مش ظاهرة في تفصيل المعدات تحت.
            </p>
          )}

          {/* Chart 1 — Revenue vs Profit */}
          <ChartCard
            className="mb-5"
            title="الإيراد مقابل ربح كل معدة (قبل المصاريف العامة)"
            height={260}
            expandedHeight={460}
            footer={
              <Legend items={[
                { color:"#f59e0b", label:"الإيراد" },
                { color:"#22c55e", label:"ربح المعدة" },
                { color:"#ef4444", label:"الخسارة" },
              ]}/>
            }
          >
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={revenueVsProfit} margin={{ top:16, right:8, left:0, bottom:28 }}
                  barCategoryGap="30%" barGap={4}>
                  <defs>
                    {revenueVsProfit.map((_, i) => (
                      <React.Fragment key={i}>
                        <linearGradient id={`rv${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={revenueColors[i % revenueColors.length]} stopOpacity={0.95}/>
                          <stop offset="100%" stopColor={revenueColors[i % revenueColors.length]} stopOpacity={0.65}/>
                        </linearGradient>
                        <linearGradient id={`pv${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={profitColors[i % profitColors.length]} stopOpacity={0.95}/>
                          <stop offset="100%" stopColor={profitColors[i % profitColors.length]} stopOpacity={0.65}/>
                        </linearGradient>
                        <linearGradient id={`lv${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={lossColors[i % lossColors.length]} stopOpacity={0.95}/>
                          <stop offset="100%" stopColor={lossColors[i % lossColors.length]} stopOpacity={0.65}/>
                        </linearGradient>
                      </React.Fragment>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="name" tick={<AngledNameTick />}
                    axisLine={false} tickLine={false} interval={0}/>
                  <YAxis tick={{ fontSize:10, fill:"#4b5563" }} axisLine={false} tickLine={false} tickFormatter={shortNum}/>
                  <Tooltip content={<CustomTooltip moneyKeys={["revenue","profit","loss"]}/>}
                    cursor={{ fill:"rgba(255,255,255,0.04)", radius:8 }}/>
                  <Bar dataKey="revenue" name="الإيراد" radius={[6,6,0,0]} maxBarSize={48}>
                    {revenueVsProfit.map((_, i) => <Cell key={i} fill={`url(#rv${i})`}/>)}
                  </Bar>
                  <Bar dataKey="profit" name="ربح المعدة" radius={[6,6,0,0]} maxBarSize={48}>
                    {revenueVsProfit.map((_, i) => <Cell key={i} fill={`url(#pv${i})`}/>)}
                  </Bar>
                  <Bar dataKey="loss" name="الخسارة" radius={[6,6,0,0]} maxBarSize={48}>
                    {revenueVsProfit.map((_, i) => <Cell key={i} fill={`url(#lv${i})`}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 2 + 3 side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

            {/* Cost breakdown stacked */}
            <ChartCard
              title="تفصيل التكاليف لكل معدة"
              height={220}
              expandedHeight={420}
              footer={
                <Legend items={[
                  { color:"#3b82f6", label:"وقود" },
                  { color:"#8b5cf6", label:"صيانة" },
                ]}/>
              }
            >
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={costBreakdown} margin={{ top:8, right:8, left:0, bottom:24 }}>
                    <defs>
                      {costBreakdown.map((_, i) => (
                        <React.Fragment key={i}>
                          <linearGradient id={`fc${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={fuelColors[i % fuelColors.length]} stopOpacity={0.95}/>
                            <stop offset="100%" stopColor={fuelColors[i % fuelColors.length]} stopOpacity={0.65}/>
                          </linearGradient>
                          <linearGradient id={`mc${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={maintColors[i % maintColors.length]} stopOpacity={0.95}/>
                            <stop offset="100%" stopColor={maintColors[i % maintColors.length]} stopOpacity={0.65}/>
                          </linearGradient>
                        </React.Fragment>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="name" tick={<AngledNameTick />}
                      axisLine={false} tickLine={false} interval={0}/>
                    <YAxis tick={{ fontSize:10, fill:"#4b5563" }} axisLine={false} tickLine={false} tickFormatter={shortNum}/>
                    <Tooltip content={<CustomTooltip moneyKeys={["fuel","maint"]}/>}
                      cursor={{ fill:"rgba(255,255,255,0.04)" }}/>
                    <Bar dataKey="fuel"  name="وقود"  stackId="a" radius={[0,0,0,0]} maxBarSize={40}>
                      {costBreakdown.map((_, i) => <Cell key={i} fill={`url(#fc${i})`}/>)}
                    </Bar>
                    <Bar dataKey="maint" name="صيانة" stackId="a" radius={[6,6,0,0]} maxBarSize={40}>
                      {costBreakdown.map((_, i) => <Cell key={i} fill={`url(#mc${i})`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Horizontal acres bar */}
            <ChartCard title="الأفدنة لكل معدة" height={220} expandedHeight={420}>
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart layout="vertical" data={acresData}
                    margin={{ top:4, right:44, left:4, bottom:4 }}>
                    <defs>
                      {acresData.map((_, i) => (
                        <linearGradient key={i} id={`ac${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"   stopColor={acresColors[i % acresColors.length]} stopOpacity={0.65}/>
                          <stop offset="100%" stopColor={acresColors[i % acresColors.length]} stopOpacity={0.95}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)"/>
                    <XAxis type="number" tick={{ fontSize:10, fill:"#4b5563" }}
                      axisLine={false} tickLine={false} tickFormatter={shortNum}
                      domain={[0, maxAcres * 1.15]}/>
                    <YAxis type="category" dataKey="name" width={76}
                      tick={<HorizontalNameTick />}
                      axisLine={false} tickLine={false}/>
                    <Tooltip
                      cursor={{ fill:"rgba(255,255,255,0.04)" }}
                      formatter={(v) => [formatNumber(v) + " فدان", "الأفدنة"]}
                      contentStyle={{ background:"rgba(13,21,38,0.97)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, direction:"rtl" }}
                      labelStyle={{ color:"#9ca3af", fontSize:11 }}
                      itemStyle={{ color:"#f0f4f8", fontSize:12 }}
                    />
                    <Bar dataKey="acres" name="أفدنة" radius={[0,6,6,0]} maxBarSize={22}>
                      {acresData.map((_, i) => <Cell key={i} fill={`url(#ac${i})`}/>)}
                      <LabelList dataKey="acres" position="right"
                        style={{ fill:"#9ca3af", fontSize:10 }}
                        formatter={(v) => formatNumber(v)}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Chart 4 — Radial margin */}
          {marginData.length > 0 && (
            <ChartCard className="mb-5" title="هامش الربح لكل معدة (%)" height={200} expandedHeight={380}>
              {(h) => (
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <div style={{ width:"100%", height:h }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart innerRadius="25%" outerRadius="90%"
                        data={marginData} startAngle={180} endAngle={0}>
                        <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                        <RadialBar dataKey="value" cornerRadius={8}
                          background={{ fill:"rgba(255,255,255,0.04)" }}
                          label={{ position:"insideStart", fill:"#fff", fontSize:11, fontWeight:700,
                            formatter:(v) => `${v}%` }}/>
                        <Tooltip
                          formatter={(v) => [`${v}%`,"هامش الربح"]}
                          contentStyle={{ background:"rgba(13,21,38,0.97)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, direction:"rtl" }}
                          labelStyle={{ color:"#9ca3af", fontSize:11 }}
                          itemStyle={{ color:"#f0f4f8", fontSize:12 }}/>
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-3 min-w-[160px]">
                    {marginData.map((d) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:d.fill }}/>
                        <span className="text-xs text-gray-300 flex-1 truncate" title={d.name}>{d.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color:d.fill }}>{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>
          )}
        </>
      )}

      {/* Tabs */}
      <div className="flex bg-surface-2 rounded-2xl p-1 mb-5 gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab===id ? "bg-surface text-gray-100 shadow-md" : "text-gray-400 hover:text-gray-200"
            }`}>
            <Icon size={16} className={tab===id ? "text-brand-400" : "text-gray-500"}/>
            {label}
          </button>
        ))}
      </div>

      {tab === "equipment" && (
        equipReport.length === 0
          ? <EmptyState icon={<TractorIcon size={48} className="text-gray-600 mx-auto mb-2"/>} title="لا توجد بيانات للمعدات"/>
          : <div className="space-y-4">{equipReport.map((eq) => <EquipmentReportCard key={eq.id} report={eq}/>)}</div>
      )}

      {tab === "drivers" && (
        driverReport.length === 0
          ? <EmptyState icon={<DriverIcon size={48} className="text-gray-600 mx-auto mb-2"/>} title="لا توجد بيانات للسائقين"/>
          : <div className="space-y-4">{driverReport.map((drv) => <DriverReportCard key={drv.id} report={drv} maxAcres={maxDriverAcres}/>)}</div>
      )}
    </div>
  );
};

export default ReportsPage;
