// src/pages/guest/GuestClientDetailPage.jsx
//
// نسخة قراءة-بس من ClientDetailPage.jsx بتاع صاحب الحساب — نفس الملخص
// المالي وليستة العمليات بالظبط، من غير أي تسجيل دفعة/تذكير. نفس منطق
// useClients.js → getClientSummary بالحرف (calcRevenue/getJobPaidAmount/
// calcRemainingAmount/derivePaymentStatus من utils/calculations.js).
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { paymentService } from "../../services/paymentService";
import { equipmentService } from "../../services/equipmentService";
import { buildClientSummary } from "../../utils/calculations";
import PaymentBadge from "../../features/clients/PaymentBadge";
import { Card, CardHeader, CardBody, SummaryRow, EmptyState, ProgressBar } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, formatDateShort } from "../../utils/formatters";
import { AcreIcon, CalendarIcon, TractorIcon, LockIcon } from "../../components/ui/Icons";

const GuestClientDetailPage = () => {
  const { clientName } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(clientName);
  const { ownerUid, isSectionOpen, access } = useGuest();
  const allowed = isSectionOpen("jobs");
  const equipmentOpen = isSectionOpen("equipment");

  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed || !ownerUid) { setLoading(false); return; }
    let jobsLoaded = false, paysLoaded = false;
    const maybeDone = () => { if (jobsLoaded && paysLoaded) setLoading(false); };
    let unsubPay = () => {};
    const unsubJobs = guestAccessService.subscribeGuestJobs(ownerUid, access?.allowedClients, (list) => {
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
    let unsubEquip = () => {};
    if (equipmentOpen) unsubEquip = equipmentService.subscribe(ownerUid, setEquipmentList, () => {});
    return () => { unsubJobs(); unsubPay(); unsubEquip(); };
  }, [allowed, ownerUid, access, equipmentOpen]);

  // Step 2: نفس buildClientSummary بتاعة المالك (مطابقة الاسم بعد trim).
  const summary = useMemo(
    () => buildClientSummary(decodedName, jobs, undefined, payments),
    [jobs, decodedName, payments]
  );
  const clientJobs = summary.jobs;
  const totals = summary;

  const paidPct = totals.totalRevenue > 0 ? (totals.totalPaid / totals.totalRevenue) * 100 : 0;
  const equipmentNameById = useMemo(() => new Map(equipmentList.map((e) => [e.id, e.name])), [equipmentList]);

  if (!allowed) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول لقسم سجل الشغل في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="max-w-3xl mx-auto animate-fade-up" dir="rtl">
      <button onClick={() => navigate("/guest/app/clients")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← العملاء
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-800/30 flex items-center justify-center text-2xl font-extrabold text-brand-300">
          {decodedName.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-100">{decodedName}</h1>
          <p className="text-sm text-gray-500">{clientJobs.length} عملية · {formatNumber(totals.totalAcres)} فدان</p>
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader title="الملخص المالي" />
        <CardBody>
          <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(totals.totalRevenue)}   valueColor="text-amber-400" />
          <SummaryRow label="إجمالي المدفوع"  value={formatCurrency(totals.totalPaid)}      valueColor="text-green-400" />
          <SummaryRow label="المبلغ المتبقي"  value={formatCurrency(totals.totalRemaining)} valueColor={totals.totalRemaining > 0 ? "text-red-400" : "text-gray-400"} bold />

          {totals.totalRevenue > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>نسبة السداد</span>
                <span className="font-bold text-brand-400">{paidPct.toFixed(0)}%</span>
              </div>
              <ProgressBar
                value={paidPct}
                max={100}
                color={paidPct >= 100 ? "bg-green-500" : paidPct > 50 ? "bg-brand-500" : "bg-amber-500"}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <h2 className="text-sm font-bold text-gray-300 mb-3">العمليات ({clientJobs.length})</h2>
      {clientJobs.length === 0 ? (
        <EmptyState icon={<AcreIcon size={40} className="text-gray-600 mx-auto mb-2" />} title="لا توجد عمليات" />
      ) : (
        <div className="space-y-3">
          {clientJobs.map((job) => {
            const eq = equipmentNameById.get(job.equipmentId);
            return (
              <div key={job.id} className={`bg-surface border rounded-2xl p-4 ${
                job.paymentStatus === "unpaid" && job.revenue > 0 ? "border-amber-800/40" : "border-white/8"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-100">{job.workType}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <CalendarIcon size={11} /> {formatDateShort(job.date)}
                      {eq && <><TractorIcon size={11} /> {eq}</>}
                    </div>
                  </div>
                  <PaymentBadge status={job.paymentStatus} />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "أفدنة",  value: formatNumber(job.acres),           color: "text-blue-400"  },
                    { label: "إيراد",  value: formatCurrency(job.revenue),       color: "text-amber-400" },
                    { label: "مدفوع",  value: formatCurrency(job.amountPaid),    color: "text-green-400" },
                    { label: "متبقي",  value: formatCurrency(job.remainingAmount), color: job.remainingAmount > 0 ? "text-red-400" : "text-gray-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface-2 rounded-xl p-2 text-center">
                      <p className={`text-xs font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GuestClientDetailPage;
