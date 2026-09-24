// src/pages/guest/GuestEquipmentDetailPage.jsx
//
// نسخة قراءة-بس من EquipmentDetailPage.jsx بتاع صاحب الحساب — نفس
// التصميم بالظبط (كروت KPI، تفصيل أرباح وخسائر، حالة مدفوعات، ليستة
// عمليات، سجل صيانة) من غير أي زرار تعديل/طباعة/تحميل/تحديد تذكير.
//
// صلاحيات القراءة المطلوبة (كل واحدة موجودة أصلاً في firestore.rules،
// صفر تعديل قواعد لعمل الصفحة دي):
//   - equipment  → guestCanRead(uid,'equipment')
//   - jobs       → guestCanReadJob (قسم 'jobs' + allowedClients)
//   - payments   → نفس صلاحية كل job مرتبطة بها، بما فيها allowedClients
//   - maintenance→ guestCanRead(uid,'maintenance')
//   - drivers    → guestCanRead(uid,'drivers') (لعرض اسم السائق بس)
// لو قسم من دول مقفول للضيف، بيتم تجاهل الجزء المرتبط بيه تمامًا (مفيش
// أي محاولة قراءة من غير صلاحية) بدل ما يظهر صفر مضلل — لأن الدقة
// المالية أهم أولوية في المشروع.
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { equipmentService } from "../../services/equipmentService";
import { driverService } from "../../services/driverService";
import { maintenanceService } from "../../services/maintenanceService";
import { paymentService } from "../../services/paymentService";
import { equipmentFuelEntryService } from "../../services/equipmentFuelEntryService";
import {
  calcRevenue, calcFuelCost, calcRemainingAmount, derivePaymentStatus, getJobPaidAmount,
} from "../../utils/calculations";
import PaymentBadge from "../../features/clients/PaymentBadge";
import { Card, CardHeader, CardBody, StatCard, SummaryRow, EmptyState, ProgressBar, Badge } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, formatDateShort, formatPercent } from "../../utils/formatters";
import {
  TractorIcon, FuelIcon, AcreIcon, RevenueIcon, ProfitIcon, CalendarIcon,
  EQUIP_TYPE_ICON_MAP, LockIcon,
} from "../../components/ui/Icons";
import { EQUIPMENT_CATEGORY, EQUIPMENT_STATUS_LABELS } from "../../config/constants";

const GuestEquipmentDetailPage = () => {
  const { equipmentId } = useParams();
  const navigate = useNavigate();
  const { ownerUid, isSectionOpen, access } = useGuest();

  const equipmentOpen   = isSectionOpen("equipment");
  const jobsOpen        = isSectionOpen("jobs");
  const maintenanceOpen = isSectionOpen("maintenance");
  const driversOpen     = isSectionOpen("drivers");

  const [equipmentList, setEquipmentList] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuelEntries, setFuelEntries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!equipmentOpen || !ownerUid) { setLoading(false); return; }
    let equipLoaded = false, fuelLoaded = false, jobsLoaded = !jobsOpen, paysLoaded = !jobsOpen;
    const maybeDone = () => { if (equipLoaded && fuelLoaded && jobsLoaded && paysLoaded) setLoading(false); };

    const unsubEquip = equipmentService.subscribe(ownerUid, (list) => { setEquipmentList(list); equipLoaded = true; maybeDone(); }, () => { equipLoaded = true; maybeDone(); });
    const unsubFuel = equipmentFuelEntryService.subscribe(ownerUid, (list) => { setFuelEntries(list); fuelLoaded = true; maybeDone(); }, () => { fuelLoaded = true; maybeDone(); });

    let unsubJobs = () => {}, unsubPay = () => {};
    if (jobsOpen) {
      unsubJobs = guestAccessService.subscribeGuestJobs(ownerUid, access?.allowedClients, (list) => {
        setJobs(list);
        jobsLoaded = true;
        paysLoaded = false;
        unsubPay();
        unsubPay = paymentService.subscribeByJobIds(
          ownerUid,
          list.map((job) => job.id),
          (paymentList) => { setPayments(paymentList); paysLoaded = true; maybeDone(); },
          () => { paysLoaded = true; maybeDone(); }
        );
        maybeDone();
      }, () => { jobsLoaded = true; paysLoaded = true; maybeDone(); });
    }

    let unsubMaint = () => {};
    if (maintenanceOpen) {
      unsubMaint = maintenanceService.subscribe(ownerUid, setMaintenance, () => {});
    }

    let unsubDrv = () => {};
    if (driversOpen) {
      unsubDrv = driverService.subscribe(ownerUid, setDrivers, () => {});
    }

    return () => { unsubEquip(); unsubFuel(); unsubJobs(); unsubPay(); unsubMaint(); unsubDrv(); };
  }, [equipmentOpen, jobsOpen, maintenanceOpen, driversOpen, ownerUid, access]);

  const equipment = equipmentList.find((e) => e.id === equipmentId);

  const eqJobs = useMemo(() => {
    if (!jobsOpen) return [];
    return jobs
      .filter((j) => j.equipmentId === equipmentId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((job) => {
        const revenue = calcRevenue(job.acres, job.pricePerAcre);
        const hasFuelPrice = job.fuelPriceAtJob != null;
        const fuelCost = hasFuelPrice ? calcFuelCost(job.fuelUsed, job.fuelPriceAtJob) : 0;
        const profit = revenue - fuelCost;
        const amountPaid = getJobPaidAmount(job, payments);
        const remainingAmount = calcRemainingAmount(revenue, amountPaid);
        const paymentStatus = derivePaymentStatus(revenue, amountPaid);
        return { ...job, revenue, fuelCost, profit, amountPaid, remainingAmount, paymentStatus, fuelPriceMissing: !hasFuelPrice && Number(job.fuelUsed) > 0 };
      });
  }, [jobsOpen, jobs, equipmentId, payments]);

  const eqMaint = useMemo(() => {
    if (!maintenanceOpen) return [];
    return maintenance
      .filter((m) => m.equipmentId === equipmentId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [maintenanceOpen, maintenance, equipmentId]);

  const eqFuelEntries = useMemo(() => {
    if (equipment?.category === EQUIPMENT_CATEGORY.ATTACHMENT) return [];
    return fuelEntries.filter((entry) => entry.equipmentId === equipmentId);
  }, [fuelEntries, equipmentId, equipment?.category]);

  const stats = useMemo(() => {
    const totalRevenue   = eqJobs.reduce((s, j) => s + j.revenue, 0);
    const totalAcres     = eqJobs.reduce((s, j) => s + (Number(j.acres) || 0), 0);
    const totalFuel      = eqJobs.reduce((s, j) => s + (Number(j.fuelUsed) || 0), 0)
      + eqFuelEntries.reduce((s, entry) => s + (Number(entry.liters) || 0), 0);
    const totalFuelCost  = eqJobs.reduce((s, j) => s + j.fuelCost, 0)
      + eqFuelEntries.reduce((s, entry) => s + (Number(entry.liters) || 0) * (Number(entry.pricePerLiter) || 0), 0);
    const totalPaid      = eqJobs.reduce((s, j) => s + j.amountPaid, 0);
    const totalRemaining = eqJobs.reduce((s, j) => s + j.remainingAmount, 0);
    const anyFuelMissing = eqJobs.some((j) => j.fuelPriceMissing);
    return { totalRevenue, totalAcres, totalFuel, totalFuelCost, totalPaid, totalRemaining, anyFuelMissing };
  }, [eqJobs, eqFuelEntries]);

  const maintCost = useMemo(() => eqMaint.reduce((s, m) => s + (Number(m.cost) || 0), 0), [eqMaint]);
  // لو قسم الصيانة مقفول للضيف، الربح المعروض هنا "قبل خصم الصيانة" —
  // بنوضح ده صراحةً بدل ما نعرض 0 مضلل لتكلفة الصيانة.
  const netProfit = stats.totalRevenue - stats.totalFuelCost - (maintenanceOpen ? maintCost : 0);
  const margin = stats.totalRevenue > 0 ? (netProfit / stats.totalRevenue) * 100 : 0;

  if (!equipmentOpen) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول لقسم المعدات في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen />;
  if (!equipment) return <div className="p-6 text-center text-gray-400">المعدة غير موجودة</div>;

  const driver = drivers.find((d) => d.id === equipment.driverId);
  const driverLabel = driver?.name || equipment.customDriverName || null;
  const isAttachment = equipment.category === EQUIPMENT_CATEGORY.ATTACHMENT;
  const EquipIcon = EQUIP_TYPE_ICON_MAP[equipment.type] ?? TractorIcon;
  const accent = isAttachment
    ? { iconBg: "from-orange-900/60 to-surface-3", iconBorder: "border-orange-800/30", iconColor: "text-orange-400" }
    : { iconBg: "from-green-900/60 to-surface-3",  iconBorder: "border-green-800/30",  iconColor: "text-green-400"  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-up" dir="rtl">
      <button onClick={() => navigate("/guest/app/equipment")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← المعدات
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${accent.iconBg} border ${accent.iconBorder} flex items-center justify-center`}>
          <EquipIcon size={28} className={accent.iconColor}/>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-gray-100">{equipment.name}</h1>
            <Badge variant={isAttachment ? "amber" : "green"}>{isAttachment ? "ملحق" : "أساسية"}</Badge>
            <Badge variant="gray">{EQUIPMENT_STATUS_LABELS[equipment.status] || equipment.status || "—"}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {equipment.type}
            {driverLabel && ` · السائق: ${driverLabel}`}
            {!isAttachment && equipment.fuelRate > 0 && ` · ${equipment.fuelRate} لتر/ساعة`}
          </p>
        </div>
      </div>

      {!jobsOpen ? (
        <EmptyState
          icon={<LockIcon size={32} className="text-gray-600 mx-auto mb-2" />}
          title="أرقام العمليات والأرباح مش متاحة ليك"
          description="صاحب الحساب ما فعّلش قسم سجل الشغل في الكود بتاعك، فمعلومات المعدة المالية مقفولة."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<AcreIcon size={24}/>}    label="إجمالي الأفدنة" value={formatNumber(stats.totalAcres)}    color="blue"/>
            <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي الإيراد" value={formatCurrency(stats.totalRevenue)} color="amber"/>
            <StatCard icon={<FuelIcon size={24}/>}    label="إجمالي الوقود"  value={`${formatNumber(stats.totalFuel)} ل`} color="orange"/>
            <StatCard icon={<ProfitIcon size={24}/>}  label="ربح المعدة (قبل المصاريف العامة)" value={formatCurrency(netProfit)} color={netProfit>=0?"green":"red"}/>
          </div>

          <Card className="mb-5">
            <CardHeader title="تفصيل الأرباح والخسائر"/>
            <CardBody>
              <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(stats.totalRevenue)}   valueColor="text-amber-400"/>
              <SummaryRow label="تكلفة الوقود"    value={formatCurrency(stats.totalFuelCost)}  valueColor="text-red-400"/>
              <SummaryRow
                label="تكاليف الصيانة"
                value={maintenanceOpen ? formatCurrency(maintCost) : "غير متاحة"}
                valueColor={maintenanceOpen ? "text-red-400" : "text-gray-500"}
              />
              <SummaryRow label="ربح المعدة (قبل المصاريف العامة)" value={formatCurrency(netProfit)}            valueColor={netProfit>=0?"text-green-400":"text-red-400"} bold/>
              {!maintenanceOpen && (
                <p className="text-[10px] text-gray-600 mt-2">* الربح هنا قبل خصم تكلفة الصيانة — قسم الصيانة مقفول ليك.</p>
              )}
              {stats.anyFuelMissing && (
                <p className="text-[10px] text-gray-600 mt-1">* في عمليات قديمة سعر الوقود مش محفوظ، فمتكلفتش في حساب الوقود.</p>
              )}
              {stats.totalRevenue > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>هامش الربح</span>
                    <span className="font-bold text-brand-400">{formatPercent(margin)}</span>
                  </div>
                  <ProgressBar value={Math.max(0,margin)} max={100}/>
                </div>
              )}
            </CardBody>
          </Card>

          {stats.totalRevenue > 0 && (
            <Card className="mb-5">
              <CardHeader title="حالة المدفوعات"/>
              <CardBody>
                <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(stats.totalRevenue)}   valueColor="text-amber-400"/>
                <SummaryRow label="تم تحصيله"       value={formatCurrency(stats.totalPaid||0)}   valueColor="text-green-400"/>
                <SummaryRow label="متبقي للتحصيل"  value={formatCurrency(stats.totalRemaining||0)} valueColor={(stats.totalRemaining||0)>0?"text-red-400":"text-gray-400"} bold/>
              </CardBody>
            </Card>
          )}

          <h2 className="text-sm font-bold text-gray-300 mb-3">العمليات ({eqJobs.length})</h2>
          {eqJobs.length === 0 ? (
            <EmptyState icon={<AcreIcon size={40} className="text-gray-600 mx-auto mb-2"/>} title="لا توجد عمليات بعد"/>
          ) : (
            <div className="space-y-3 mb-6">
              {eqJobs.map((job) => (
                <div key={job.id} className={`bg-surface border rounded-2xl p-4 ${
                  job.paymentStatus==="unpaid" && job.revenue>0 ? "border-amber-800/40" : "border-white/8"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-gray-100">{job.client}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <CalendarIcon size={11}/> {formatDateShort(job.date)}
                        <span>·</span><span>{job.workType}</span>
                      </div>
                    </div>
                    {job.revenue>0 && <PaymentBadge status={job.paymentStatus}/>}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label:"أفدنة", value:`${formatNumber(job.acres)} ف`,  color:"text-blue-400"  },
                      { label:"إيراد", value:formatCurrency(job.revenue),      color:"text-amber-400" },
                      { label:"ربح",   value:formatCurrency(job.profit),       color:job.profit>=0?"text-green-400":"text-red-400" },
                      { label:"متبقي", value:formatCurrency(job.remainingAmount||0), color:(job.remainingAmount||0)>0?"text-red-400":"text-gray-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface-2 rounded-xl p-2 text-center">
                        <p className={`text-xs font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {maintenanceOpen && eqMaint.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-300 mb-3">سجل الصيانة</h2>
          <Card>
            <div className="divide-y divide-white/8">
              {eqMaint.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{m.type}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <CalendarIcon size={11}/> {formatDateShort(m.date)}
                      {m.notes && <span>· {m.notes}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{formatCurrency(m.cost)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default GuestEquipmentDetailPage;
