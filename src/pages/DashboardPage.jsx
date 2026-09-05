// src/pages/DashboardPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList,
} from "recharts";
import { useDashboard }  from "../hooks/useDashboard";
import { useClients }    from "../hooks/useClients";
import { usePrivacy }    from "../contexts/PrivacyContext";
import { StatCard, Card, CardHeader, CardBody, SummaryRow, EmptyState } from "../components/ui/Card";
import { ChartCard } from "../components/ui/ChartCard";
import LoadingScreen     from "../components/ui/LoadingScreen";
import PrivacyToggle     from "../components/ui/PrivacyToggle";
import Sensitive         from "../components/ui/Sensitive";
import JobCard           from "../features/jobs/JobCard";
import {
  RevenueIcon, AcreIcon, FuelIcon, ProfitIcon,
  TractorIcon, DriverIcon, ClipboardIcon, ChartIcon,
  AlertIcon, StarIcon, WORK_TYPE_ICON_MAP,
} from "../components/ui/Icons";
import { formatCurrency, formatNumber, formatDateShort } from "../utils/formatters";
import { calcRevenue, calcFuelCost, calcRemainingAmount, derivePaymentStatus, getJobPaidAmount } from "../utils/calculations";

// ── Color palettes ────────────────────────────────────────────────────────
const AREA_GREEN   = "#22c55e";
const PIE_COLORS   = ["#22c55e","#f59e0b","#3b82f6","#8b5cf6","#f97316","#06b6d4"];
const BAR_COLORS   = ["#f59e0b","#d97706","#b45309","#92400e","#78350f"];

// ── Shared tooltip style ──────────────────────────────────────────────────
const tooltipStyle = {
  background:"rgba(13,21,38,0.97)",
  border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:14, direction:"rtl",
  boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
};

// ── Custom X-axis tick: shows a shortened name (to fit the chart width),
// but wraps it in a native SVG <title> so hovering the label with the
// mouse shows the full, untruncated name as a browser tooltip.
const AngledNameTick = (props) => {
  const { x, y, payload } = props;
  const full = payload.value ?? "";
  const short = full.length > 11 ? `${full.slice(0, 11)}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={6}
        textAnchor="end"
        fill="#6b7280"
        fontSize={10}
        fontFamily="Cairo"
        transform="rotate(-15)"
      >
        {short}
        <title>{full}</title>
      </text>
    </g>
  );
};

// ── Custom Tooltip for area chart ─────────────────────────────────────────
const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...tooltipStyle, padding:"12px 16px", minWidth:150 }}>
      <p style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>{formatDateShort(label)}</p>
      <p style={{ fontSize:14, fontWeight:700, color:AREA_GREEN }}>
        {formatCurrency(payload[0]?.value)}
      </p>
    </div>
  );
};

// ── Custom Tooltip for bar chart ──────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...tooltipStyle, padding:"12px 16px", minWidth:160 }}>
      <p style={{ fontSize:11, color:"#6b7280", marginBottom:8 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:p.fill, flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"#9ca3af", flex:1 }}>{p.name}</span>
          <span style={{ fontSize:13, fontWeight:700, color:"#f0f4f8" }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const shortNum = (v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}م` : v >= 1_000 ? `${(v/1_000).toFixed(0)}k` : String(v);

// ── DashboardPage ─────────────────────────────────────────────────────────
const DashboardPage = () => {
  const navigate = useNavigate();
  const {
    totals, totalMaintCost, totalSalaries, totalTaxDeductions, netProfit, margin,
    dailyRevenue, workTypeBreakdown,
    equipReport, bestEquipment,
    recentJobs,
    equipment, drivers, payments,
    fuelPrice, loading,
  } = useDashboard();

  const { clients, totalDebt } = useClients();
  const totalCollected = clients.reduce((s, c) => s + c.totalPaid, 0);
  const { isPrivate } = usePrivacy();

  if (loading) return <LoadingScreen />;

  const { totalRevenue, totalAcres, totalFuel } = totals;
  const topDebtors = clients.filter((c) => c.totalRemaining > 0).slice(0, 3);

  // chart-ready data
  const barData = equipReport.slice(0, 5).map((eq) => ({
    name:    eq.name,
    revenue: eq.totalRevenue || 0,
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">

      {/* ── Privacy toggle ───────────────────────────────────── */}
      <PrivacyToggle />

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        <StatCard icon={<RevenueIcon size={26}/>} label="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} color="amber" sensitive/>
        <StatCard icon={<RevenueIcon size={26}/>} label="تم تحصيله" value={formatCurrency(totalCollected)} color="green" sensitive/>
        <StatCard icon={<AcreIcon size={26}/>} label="إجمالي الأفدنة" value={formatNumber(totalAcres)} color="blue" sensitive/>
        <StatCard icon={<FuelIcon size={26}/>} label="إجمالي الوقود" value={`${formatNumber(totalFuel)} ل`} color="orange" sensitive/>
        <StatCard icon={<ProfitIcon size={26}/>} label="صافي الربح" value={formatCurrency(netProfit)} color={netProfit>=0?"purple":"red"} sensitive/>
      </div>

      {/* ── Debt alert ─────────────────────────────────────── */}
      {totalDebt > 0 && (
        <div
          className="flex items-center justify-between gap-4 bg-amber-900/20 border border-amber-800/40 rounded-2xl px-5 py-3.5 cursor-pointer hover:bg-amber-900/30 transition-colors"
          onClick={() => navigate("/clients")}
        >
          <div className="flex items-center gap-3">
            <AlertIcon size={18} className="text-amber-400 flex-shrink-0"/>
            <div>
              <p className="text-sm font-bold text-amber-300">مستحقات غير محصّلة</p>
              <p className="text-xs text-amber-500/80 mt-0.5">
                {clients.filter(c=>c.totalRemaining>0).length} عميل لديهم ديون
              </p>
            </div>
          </div>
          <span
            className="text-base font-extrabold text-amber-400 tabular-nums flex-shrink-0 transition-[filter] duration-300"
            style={{ filter: isPrivate ? "blur(6px)" : "none", userSelect: isPrivate ? "none" : "auto" }}
          >
            {formatCurrency(totalDebt)}
          </span>
        </div>
      )}

      {/* ── Area chart + Financial summary ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area chart — last 7 days */}
        {totalRevenue === 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader title="الإيرادات — آخر 7 أيام"/>
            <CardBody>
              <EmptyState
                icon={<ChartIcon size={48} className="text-gray-600 mx-auto mb-2"/>}
                title="لا توجد بيانات بعد"
                description="سجّل أول عملية لتظهر الرسوم البيانية"
              />
            </CardBody>
          </Card>
        ) : (
          <ChartCard
            className="lg:col-span-2"
            title="الإيرادات — آخر 7 أيام"
            height={200}
            expandedHeight={440}
          >
            {(h) => (
              <Sensitive hint blur={12}>
                <ResponsiveContainer width="100%" height={h}>
                  <AreaChart data={dailyRevenue} margin={{ top:12, right:8, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={AREA_GREEN} stopOpacity={0.35}/>
                        <stop offset="100%" stopColor={AREA_GREEN} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)"/>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize:10, fill:"#6b7280" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={formatDateShort}
                    />
                    <YAxis
                      tick={{ fontSize:10, fill:"#4b5563" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={shortNum}
                    />
                    <Tooltip content={<AreaTooltip/>}/>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="الإيراد"
                      stroke={AREA_GREEN}
                      strokeWidth={2.5}
                      fill="url(#dashAreaGrad)"
                      dot={{ r:3, fill:AREA_GREEN, strokeWidth:0 }}
                      activeDot={{ r:5, fill:AREA_GREEN, strokeWidth:0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Sensitive>
            )}
          </ChartCard>
        )}

        {/* Financial summary */}
        <Card>
          <CardHeader title="الملخص المالي"/>
          <CardBody>
            <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(totalRevenue)}         valueColor="text-amber-400" sensitive/>
            <SummaryRow label="تكلفة الوقود"    value={formatCurrency(totals.totalFuelCost)} valueColor="text-red-400" sensitive/>
            <SummaryRow label="تكاليف الصيانة"  value={formatCurrency(totalMaintCost)}  valueColor="text-red-400" sensitive/>
            <SummaryRow label="مرتبات الفريق" value={formatCurrency(totalSalaries||0)} valueColor="text-red-400" sensitive/>
            <SummaryRow label="ضرائب وخصومات"   value={formatCurrency(totalTaxDeductions||0)} valueColor="text-red-400" sensitive/>
            <div className="border-t border-white/8 mt-2 pt-2">
              <SummaryRow label="صافي الربح" value={formatCurrency(netProfit)}
                valueColor={netProfit>=0?"text-green-400":"text-red-400"} bold sensitive/>
            </div>
            {totalRevenue > 0 && (
              <div className="mt-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">هامش الربح</span>
                  <span className="text-xs font-bold text-brand-400">{margin.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-400 transition-all duration-700"
                    style={{ width:`${Math.min(100,Math.max(0,margin))}%` }}/>
                </div>
              </div>
            )}
            {bestEquipment && (
              <div className="mt-4 p-3 bg-brand-900/20 border border-brand-800/40 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <StarIcon size={12} className="text-brand-400"/>
                  <p className="text-[10px] font-bold text-brand-400">أفضل معدة أداء</p>
                </div>
                <p className="text-sm font-bold text-gray-200">{bestEquipment.name}</p>
                <p
                  className="text-xs text-gray-400 mt-0.5 inline-block transition-[filter] duration-300"
                  style={{ filter: isPrivate ? "blur(5px)" : "none", userSelect: isPrivate ? "none" : "auto" }}
                >
                  {formatCurrency(bestEquipment.totalRevenue)} إيراد
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Top Debtors ───────────────────────────────────── */}
      {topDebtors.length > 0 && (
        <Card>
          <CardHeader title="أكبر المديونيات"
            actions={
              <button onClick={() => navigate("/clients")}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors">
                عرض الكل
              </button>
            }
          />
          <CardBody className="space-y-3">
            {topDebtors.map((c) => (
              <div key={c.client}
                className="flex items-center justify-between cursor-pointer hover:bg-surface-2 rounded-xl px-3 py-2 -mx-3 transition-colors"
                onClick={() => navigate(`/clients/${encodeURIComponent(c.client)}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-900/30 border border-amber-800/40 flex items-center justify-center text-xs font-bold text-amber-300">
                    {c.client.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{c.client}</p>
                    <p className="text-xs text-gray-500">{c.ops} عملية</p>
                  </div>
                </div>
                <span
                  className="text-sm font-extrabold text-amber-400 tabular-nums transition-[filter] duration-300"
                  style={{ filter: isPrivate ? "blur(6px)" : "none", userSelect: isPrivate ? "none" : "auto" }}
                >
                  {formatCurrency(c.totalRemaining)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* ── Pie chart + Bar chart ──────────────────────────── */}
      {workTypeBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Pie — work type breakdown */}
          <ChartCard title="توزيع أنواع العمل (أفدنة)" height={180} expandedHeight={320}>
            {(h) => (
              <div className="flex items-center gap-4">
                <div style={{ width:"45%", height:h, flexShrink:0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {workTypeBreakdown.map((_, i) => (
                          <radialGradient key={i} id={`pieG${i}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%"   stopColor={PIE_COLORS[i%PIE_COLORS.length]} stopOpacity={1}/>
                            <stop offset="100%" stopColor={PIE_COLORS[i%PIE_COLORS.length]} stopOpacity={0.7}/>
                          </radialGradient>
                        ))}
                      </defs>
                      <Pie
                        data={workTypeBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        innerRadius={48}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {workTypeBreakdown.map((_, i) => (
                          <Cell key={i} fill={`url(#pieG${i})`}/>
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [`${formatNumber(v)} فدان`, "أفدنة"]}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color:"#9ca3af", fontSize:11 }}
                        itemStyle={{ color:"#f0f4f8", fontSize:12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2.5">
                  {workTypeBreakdown.map((entry, i) => {
                    const WorkIcon = WORK_TYPE_ICON_MAP[entry.name];
                    const total    = workTypeBreakdown.reduce((s,x) => s+x.value, 0);
                    const pct      = total > 0 ? ((entry.value/total)*100).toFixed(0) : 0;
                    return (
                      <div key={entry.name}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background:PIE_COLORS[i%PIE_COLORS.length] }}/>
                          <div className="flex items-center gap-1 flex-1">
                            {WorkIcon && <WorkIcon size={11} className="text-gray-400"/>}
                            <span className="text-xs text-gray-400">{entry.name}</span>
                          </div>
                          <span className="text-xs font-bold text-gray-200">{formatNumber(entry.value)}</span>
                          <span className="text-[10px] text-gray-500">{pct}%</span>
                        </div>
                        {/* mini progress bar */}
                        <div className="h-1 bg-surface-2 rounded-full overflow-hidden mr-4">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${pct}%`, background:PIE_COLORS[i%PIE_COLORS.length] }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Bar — equipment revenue */}
          {barData.length > 0 && (
            <ChartCard title="إيراد المعدات" height={200} expandedHeight={420}>
              {(h) => (
                <Sensitive hint blur={12}>
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={barData} margin={{ top:12, right:8, left:0, bottom:24 }}
                      barCategoryGap="35%">
                      <defs>
                        {barData.map((_, i) => (
                          <linearGradient key={i} id={`dashBar${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={BAR_COLORS[i%BAR_COLORS.length]} stopOpacity={0.95}/>
                            <stop offset="100%" stopColor={BAR_COLORS[i%BAR_COLORS.length]} stopOpacity={0.6}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)"/>
                      <XAxis
                        dataKey="name"
                        tick={<AngledNameTick />}
                        axisLine={false} tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize:10, fill:"#4b5563" }}
                        axisLine={false} tickLine={false}
                        tickFormatter={shortNum}
                      />
                      <Tooltip content={<BarTooltip/>}
                        cursor={{ fill:"rgba(255,255,255,0.04)", radius:6 }}/>
                      <Bar dataKey="revenue" name="الإيراد" radius={[8,8,0,0]} maxBarSize={52}>
                        {barData.map((_, i) => (
                          <Cell key={i} fill={`url(#dashBar${i})`}/>
                        ))}
                        <LabelList
                          dataKey="revenue"
                          position="top"
                          style={{ fill:"#9ca3af", fontSize:9 }}
                          formatter={shortNum}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Sensitive>
              )}
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Quick stats ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { Icon:TractorIcon,   label:"المعدات",    value:equipment.length },
          { Icon:DriverIcon,    label:"فريق العمل", value:drivers.length },
          { Icon:ClipboardIcon, label:"العمليات",   value:recentJobs.length },
          { Icon:FuelIcon,      label:"سعر الوقود", value:`${fuelPrice} ج.م/ل` },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="bg-surface border border-white/8 rounded-2xl p-4 flex flex-col items-center text-center">
            <Icon size={24} className="text-brand-400 mb-2"/>
            <p className="text-base font-extrabold text-gray-100">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Recent jobs ───────────────────────────────────── */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader title="أحدث العمليات"/>
          <CardBody className="space-y-3">
            {recentJobs.map((job) => {
              const eq  = equipment.find((e) => e.id === job.equipmentId);
              const drv = drivers.find((d)  => d.id === job.driverId);
              const revenue         = calcRevenue(job.acres, job.pricePerAcre);
              const fuelCost        = calcFuelCost(job.fuelUsed, fuelPrice);
              const amountPaid      = getJobPaidAmount(job, payments);
              const remainingAmount = calcRemainingAmount(revenue, amountPaid);
              const paymentStatus   = derivePaymentStatus(revenue, amountPaid);
              const enriched = {
                ...job, revenue, fuelCost,
                profit: revenue - fuelCost,
                amountPaid, remainingAmount, paymentStatus,
              };
              return (
                <JobCard key={job.id} job={enriched}
                  equipmentName={eq?.name} driverName={drv?.name}
                  onEdit={() => {}} onDelete={() => {}}/>
              );
            })}
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
