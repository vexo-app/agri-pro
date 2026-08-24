// src/features/jobs/JobCard.jsx
import React, { useState } from "react";
import { Badge }       from "../../components/ui/Card";
import Button          from "../../components/ui/Button";
import PaymentBadge    from "../clients/PaymentBadge";
import {
  EditIcon, TrashIcon, CalendarIcon, TractorIcon,
  DriverIcon, AcreIcon, FuelIcon,
  WORK_TYPE_ICON_MAP, WrenchIcon,
} from "../../components/ui/Icons";
import { formatCurrency, formatNumber, formatDateShort } from "../../utils/formatters";
import { printClientInvoice, downloadClientInvoicePdf } from "../../utils/pdfGenerator";
import { useData } from "../../contexts/DataContext";
import DownloadReportButton from "../../components/ui/DownloadReportButton";

// Print icon inline (avoids import issues)
const PrintSVG = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7"/>
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8" rx="1"/>
  </svg>
);

const FinancialPill = ({ label, value, color }) => (
  <div className="flex-1 bg-surface-2 rounded-xl p-2 text-center min-w-0">
    <p className={`text-sm font-extrabold ${color} tabular-nums truncate`}>{value}</p>
    <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
  </div>
);

const JobCard = ({
  job, equipmentName, driverName,
  onEdit, onDelete,
  showPrint = true,
}) => {
  const { payments = [], maintenance = [], settings } = useData();
  const [showPayments, setShowPayments] = useState(false);

  const {
    client, workType, date,
    acres, fuelUsed,
    revenue, fuelCost, profit,
    amountPaid, remainingAmount, paymentStatus,
    notes,
  } = job;

  const WorkIcon  = WORK_TYPE_ICON_MAP[workType] ?? WrenchIcon;
  const isUnpaid  = paymentStatus === "unpaid" && revenue > 0;
  const jobPayments    = payments.filter((p) => p.jobId === job.id);
  // صيانة المعدة اللي استخدمت في العملية دي — بتتعرض في الفاتورة للشفافية
  const jobMaintenance = maintenance.filter((m) => m.equipmentId === job.equipmentId);

  const handlePrint = () => {
    printClientInvoice({
      job,
      equipmentName,
      driverName,
      fuelPrice:   settings.fuelPrice,
      payments:    jobPayments,
      maintenance: jobMaintenance,
      company:     settings.company,
    });
  };

  const handleDownload = () => downloadClientInvoicePdf({
    job,
    equipmentName,
    driverName,
    fuelPrice:   settings.fuelPrice,
    payments:    jobPayments,
    maintenance: jobMaintenance,
    company:     settings.company,
  });

  return (
    <div className={`bg-surface border rounded-2xl p-4 transition-colors ${
      isUnpaid ? "border-amber-800/40 hover:border-amber-700/60" : "border-white/8 hover:border-white/15"
    }`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 ml-2">
          <h3 className="text-sm font-bold text-gray-100 truncate">{client}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
            <CalendarIcon size={12}/>
            <span>{formatDateShort(date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <Badge variant="blue"><WorkIcon size={11}/> {workType}</Badge>
          {revenue > 0 && <PaymentBadge status={paymentStatus}/>}
          {showPrint && (
            <button
              onClick={handlePrint}
              title="طباعة فاتورة"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-surface-2 transition-colors"
            >
              <PrintSVG/>
            </button>
          )}
          {showPrint && (
            <DownloadReportButton onDownload={handleDownload} title="تحميل فاتورة PDF" size="xs" className="px-2" />
          )}
          {onEdit   && <Button variant="ghost" size="xs" onClick={onEdit}   icon={<EditIcon  size={13}/>} className="px-2"/>}
          {onDelete && <Button variant="ghost" size="xs" onClick={onDelete} icon={<TrashIcon size={13}/>} className="px-2"/>}
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {equipmentName && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <TractorIcon size={12}/> {equipmentName}
          </span>
        )}
        {driverName && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <DriverIcon size={12}/> {driverName}
          </span>
        )}
        <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
          <AcreIcon size={12}/> {formatNumber(acres)} فدان
        </span>
        {fuelUsed > 0 && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <FuelIcon size={12}/> {formatNumber(fuelUsed)} لتر
          </span>
        )}
      </div>

      {notes && (
        <p className="text-xs text-gray-500 mb-3 bg-surface-2 rounded-lg px-3 py-2">{notes}</p>
      )}

      {/* Financials */}
      <div className="flex gap-2 mb-2">
        <FinancialPill label="إيراد" value={formatCurrency(revenue)}  color="text-amber-400"/>
        <FinancialPill label="وقود"  value={formatCurrency(fuelCost)} color="text-red-400"/>
        <FinancialPill label="ربح"   value={formatCurrency(profit)}   color={profit>=0?"text-green-400":"text-red-400"}/>
      </div>

      {/* Payment */}
      {revenue > 0 && (
        <>
          <div className="flex gap-2 mb-1">
            <FinancialPill label="مدفوع" value={formatCurrency(amountPaid||0)}     color="text-green-400"/>
            <FinancialPill label="متبقي" value={formatCurrency(remainingAmount||0)} color={remainingAmount>0?"text-amber-400":"text-gray-500"}/>
          </div>

          {jobPayments.length > 0 && (
            <button
              className="w-full text-xs text-brand-400 hover:text-brand-300 mt-1 py-1 transition-colors text-right"
              onClick={() => setShowPayments(s => !s)}
            >
              {showPayments ? "إخفاء" : `عرض ${jobPayments.length} دفعة`} ←
            </button>
          )}

          {showPayments && (
            <div className="mt-2 px-2 border-t border-white/8 pt-2 space-y-2">
              {jobPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <CalendarIcon size={11}/>
                    <span>{formatDateShort(p.date)}</span>
                    {p.notes && <span>· {p.notes}</span>}
                  </div>
                  <span className="font-bold text-green-400">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobCard;
