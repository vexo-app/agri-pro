// src/pages/EquipmentDetailPage.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEquipmentDetail } from "../hooks/useEquipmentDetail";
import { useData }            from "../contexts/DataContext";
import PaymentBadge           from "../features/clients/PaymentBadge";
import ServiceHistoryCard     from "../features/equipment/ServiceHistoryCard";
import DownloadReportButton   from "../components/ui/DownloadReportButton";
import { Card, CardHeader, CardBody, StatCard, SummaryRow, EmptyState, ProgressBar, Badge } from "../components/ui/Card";
import Button                 from "../components/ui/Button";
import { Input }              from "../components/ui/Input";
import Modal                  from "../components/ui/Modal";
import ConfirmDialog          from "../components/ui/ConfirmDialog";
import FuelEntryForm          from "../features/equipment/FuelEntryForm";
import { useConfirm }         from "../hooks/useConfirm";
import LoadingScreen          from "../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, formatDateShort, formatPercent } from "../utils/formatters";
import { getLastOilChange, getLastGreaseDate } from "../utils/serviceHistory";
import {
  TractorIcon, FuelIcon, AcreIcon, RevenueIcon, ProfitIcon, CalendarIcon,
  EQUIP_TYPE_ICON_MAP, LinkIcon, OilCanIcon, TrashIcon,
} from "../components/ui/Icons";
import { printEquipmentReport, downloadEquipmentReportPdf } from "../utils/pdfGenerator";
import { EQUIPMENT_CATEGORY } from "../config/constants";

// Inline print SVG
const PrintSVG = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7"/>
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8" rx="1"/>
  </svg>
);

const EquipmentDetailPage = () => {
  const { equipmentId } = useParams();
  const navigate        = useNavigate();
  const { drivers, equipment: allEquipment, updateEquipment, addEquipmentFuelEntry, deleteEquipmentFuelEntry } = useData();
  const {
    equipment, jobs, maintenance, fuelEntries,
    stats, maintCost, netProfit, margin,
    loading, fuelPrice,
  } = useEquipmentDetail(equipmentId);
  const [editingReminder, setEditingReminder] = useState(false);
  const [reminderDraft, setReminderDraft]     = useState("");
  const [fuelModalOpen, setFuelModalOpen]     = useState(false);
  const { confirm, confirmState } = useConfirm();

  if (loading) return <LoadingScreen />;
  if (!equipment) return (
    <div className="p-6 text-center text-gray-400">المعدة غير موجودة</div>
  );

  const driver = drivers.find((d) => d.id === equipment.driverId);
  const driverLabel = driver?.name || equipment.customDriverName || null;
  const isAttachment = equipment.category === EQUIPMENT_CATEGORY.ATTACHMENT;
  const parent = isAttachment ? allEquipment.find((e) => e.id === equipment.parentEquipmentId) : null;
  const parentLabel = parent?.name || equipment.customParentName || null;
  const lastOilChange = !isAttachment ? getLastOilChange(equipment) : null;
  const lastGreaseDate = isAttachment ? getLastGreaseDate(equipment) : null;

  // Append/remove an entry to the equipment's oil-change or grease log.
  //
  // audit finding O1: كنا لازم قبل كده نبعت الـequipment doc كامل هنا،
  // لأن الـreducer المحلي كان بيستبدل السجل كامل بأي payload جزئي (بدل
  // merge)، فأي حقل ميتبعتش كان يختفي من الشاشة فورًا. الـreducer بقى
  // بيعمل merge دلوقتي (src/contexts/data/reducer.js)، فمبقى فيه داعي
  // نبعت غير الحقول اللي فعليًا اتغيّرت هنا — وده كمان بيقفل نفس مشكلة
  // O1 نفسها من الاتجاه التاني: لو جهاز/تاب تاني بيعدّل اسم/حالة المعدة
  // في نفس الوقت من صفحة المعدات، مانمسحش تعديله بإعادة كتابة نسخة قديمة
  // من باقي الحقول.
  const handleAddOilChange = async (entry) => {
    const oilChangeHistory = [...(equipment.oilChangeHistory || []), entry];
    const last = getLastOilChange({ oilChangeHistory });
    await updateEquipment(equipment.id, {
      oilChangeHistory, lastOilChangeMeter: last?.meter ?? "",
    });
  };
  const handleRemoveOilChange = async (entryId) => {
    const oilChangeHistory = (equipment.oilChangeHistory || []).filter((e) => e.id !== entryId);
    const last = getLastOilChange({ oilChangeHistory });
    await updateEquipment(equipment.id, {
      oilChangeHistory, lastOilChangeMeter: last?.meter ?? "",
    });
  };
  // Smart-alerts (Phase 1) — manual reminder date the owner sets themselves.
  // Works the same way for both base-equipment oil changes and attachment
  // grease reminders (see utils/maintenanceAlerts.js): a plain date, no
  // usage/interval math.
  const handleUpdateReminderDate = async (newValue) => {
    await updateEquipment(equipment.id, { reminderDate: newValue });
  };
  const handleAddGrease = async (entry) => {
    const greaseHistory = [...(equipment.greaseHistory || []), entry];
    const last = getLastGreaseDate({ greaseHistory });
    await updateEquipment(equipment.id, {
      greaseHistory, lastGreaseDate: last || "",
    });
  };
  const handleRemoveGrease = async (entryId) => {
    const greaseHistory = (equipment.greaseHistory || []).filter((e) => e.id !== entryId);
    const last = getLastGreaseDate({ greaseHistory });
    await updateEquipment(equipment.id, {
      greaseHistory, lastGreaseDate: last || "",
    });
  };
  const EquipIcon = EQUIP_TYPE_ICON_MAP[equipment.type] ?? TractorIcon;
  const accent = isAttachment
    ? { iconBg: "from-orange-900/60 to-surface-3", iconBorder: "border-orange-800/30", iconColor: "text-orange-400" }
    : { iconBg: "from-green-900/60 to-surface-3",  iconBorder: "border-green-800/30",  iconColor: "text-green-400"  };

  const handlePrint = () => {
    printEquipmentReport({
      equipment,
      jobs,
      maintenance,
      fuelEntries,
      fuelPrice,
      driverName: driverLabel,
    });
  };

  const handleDownload = () => downloadEquipmentReportPdf({
    equipment,
    jobs,
    maintenance,
    fuelEntries,
    fuelPrice,
    driverName: driverLabel,
  });

  const handleAddFuel = (entry) => addEquipmentFuelEntry({ ...entry, equipmentId });
  const handleDeleteFuel = async (id) => {
    if (await confirm(id, "هل أنت متأكد من حذف تسجيل الوقود؟")) deleteEquipmentFuelEntry(id);
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      {/* Back */}
      <button onClick={() => navigate("/equipment")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← المعدات
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${accent.iconBg} border ${accent.iconBorder} flex items-center justify-center`}>
          <EquipIcon size={28} className={accent.iconColor}/>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-gray-100">{equipment.name}</h1>
            <Badge variant={isAttachment ? "amber" : "green"}>{isAttachment ? "ملحق" : "أساسية"}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {equipment.type}
            {driverLabel && ` · السائق: ${driverLabel}`}
            {!isAttachment && equipment.fuelRate > 0 && ` · ${equipment.fuelRate} لتر/ساعة`}
          </p>
        </div>
        {/* Print / download buttons */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <PrintSVG/>
            <span className="mr-1.5">طباعة تقرير</span>
          </Button>
          <DownloadReportButton onDownload={handleDownload} title="تحميل تقرير المعدة PDF" />
        </div>
      </div>

      {/* Category-specific info strip */}
      <div className="flex flex-wrap gap-3 mb-6">
        {isAttachment ? (
          <>
            <div className="flex items-center gap-2 bg-orange-900/20 border border-orange-800/40 rounded-xl px-4 py-2.5 text-sm">
              <LinkIcon size={15} className="text-orange-400"/>
              <span className="text-gray-400">متعلقة على:</span>
              <span className="font-bold text-orange-300">{parentLabel || "غير محددة"}</span>
            </div>
            <div className="flex items-center gap-2 bg-surface border border-white/8 rounded-xl px-4 py-2.5 text-sm">
              <CalendarIcon size={15} className="text-gray-400"/>
              <span className="text-gray-400">آخر تشحيم:</span>
              <span className="font-bold text-gray-200">{lastGreaseDate ? formatDateShort(lastGreaseDate) : "—"}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 bg-surface border border-white/8 rounded-xl px-4 py-2.5 text-sm">
            <OilCanIcon size={15} className="text-gray-400"/>
            <span className="text-gray-400">عداد آخر غيار زيت:</span>
            <span className="font-bold text-gray-200">
              {lastOilChange ? formatNumber(lastOilChange.meter) : "—"}
            </span>
          </div>
        )}

        {/* Smart-alerts (Phase 1) — manual reminder date, the one input the
            app can't infer on its own. Same field/behavior for base
            equipment (oil change) and attachments (grease) — see
            utils/maintenanceAlerts.js. */}
        <div className="flex items-center gap-2 bg-surface border border-white/8 rounded-xl px-4 py-2.5 text-sm">
          <CalendarIcon size={15} className="text-gray-400"/>
          <span className="text-gray-400">يوم التنبيه:</span>
          {editingReminder ? (
            <div className="flex items-center gap-1.5">
              <div className="w-40">
                <Input
                  type="date"
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="text-xs font-bold text-brand-400 hover:text-brand-300 px-1"
                onClick={async () => {
                  await handleUpdateReminderDate(reminderDraft || "");
                  setEditingReminder(false);
                }}
              >
                حفظ
              </button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-300 px-1"
                onClick={() => setEditingReminder(false)}
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="font-bold text-gray-200 hover:text-brand-400 transition-colors underline decoration-dotted underline-offset-4"
              onClick={() => { setReminderDraft(equipment.reminderDate || ""); setEditingReminder(true); }}
            >
              {equipment.reminderDate ? formatDateShort(equipment.reminderDate) : "— (اضغط للتحديد)"}
            </button>
          )}
        </div>
      </div>

      {/* Oil-change / grease log — full sequence, not just the last value */}
      <ServiceHistoryCard
        kind={isAttachment ? "grease" : "oil"}
        entries={isAttachment ? (equipment.greaseHistory || []) : (equipment.oilChangeHistory || [])}
        onAdd={isAttachment ? handleAddGrease : handleAddOilChange}
        onRemove={isAttachment ? handleRemoveGrease : handleRemoveOilChange}
      />

      {!isAttachment && (
        <Card className="mb-5">
          <CardHeader title={`سجل الوقود (${fuelEntries.length})`} actions={
            <Button size="sm" onClick={() => setFuelModalOpen(true)} icon={<FuelIcon size={15}/>}>تسجيل وقود</Button>
          }/>
          {fuelEntries.length > 0 && (
            <div className="divide-y divide-white/8">
              {fuelEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-bold text-gray-200">{formatNumber(entry.liters)} لتر</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateShort(entry.date)} · {formatCurrency(entry.pricePerLiter)} للتر</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-400">{formatCurrency(Number(entry.liters) * Number(entry.pricePerLiter))}</span>
                    <Button variant="ghost" size="xs" icon={<TrashIcon size={12}/>} onClick={() => handleDeleteFuel(entry.id)} aria-label="حذف سجل الوقود"/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<AcreIcon size={24}/>}    label="إجمالي الأفدنة" value={formatNumber(stats.totalAcres)}    color="blue"/>
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي الإيراد" value={formatCurrency(stats.totalRevenue)} color="amber"/>
        <StatCard icon={<FuelIcon size={24}/>}    label="إجمالي الوقود"  value={`${formatNumber(stats.totalFuel)} ل`} color="orange"/>
        <StatCard icon={<ProfitIcon size={24}/>}  label="صافي الربح"     value={formatCurrency(netProfit)} color={netProfit>=0?"green":"red"}/>
      </div>

      {/* P&L */}
      <Card className="mb-5">
        <CardHeader title="تفصيل الأرباح والخسائر"/>
        <CardBody>
          <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(stats.totalRevenue)}   valueColor="text-amber-400"/>
          <SummaryRow label="تكلفة الوقود"    value={formatCurrency(stats.totalFuelCost)}  valueColor="text-red-400"/>
          <SummaryRow label="تكاليف الصيانة"  value={formatCurrency(maintCost)}            valueColor="text-red-400"/>
          <SummaryRow label="صافي الربح"      value={formatCurrency(netProfit)}            valueColor={netProfit>=0?"text-green-400":"text-red-400"} bold/>
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

      {/* Payment summary */}
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

      {/* Jobs */}
      <h2 className="text-sm font-bold text-gray-300 mb-3">العمليات ({jobs.length})</h2>
      {jobs.length === 0 ? (
        <EmptyState icon={<AcreIcon size={40} className="text-gray-600 mx-auto mb-2"/>} title="لا توجد عمليات بعد"/>
      ) : (
        <div className="space-y-3 mb-6">
          {jobs.map((job) => (
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

      {/* Maintenance */}
      {maintenance.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-300 mb-3">سجل الصيانة</h2>
          <Card>
            <div className="divide-y divide-white/8">
              {maintenance.map((m) => (
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

      {!isAttachment && (
        <Modal open={fuelModalOpen} onClose={() => setFuelModalOpen(false)} title="تسجيل وقود" size="sm">
          <FuelEntryForm fuelPrice={fuelPrice} onSave={handleAddFuel} onClose={() => setFuelModalOpen(false)}/>
        </Modal>
      )}
      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject} onConfirm={confirmState.accept} message={confirmState.message}/>
    </div>
  );
};

export default EquipmentDetailPage;
