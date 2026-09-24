// src/pages/guest/GuestClientsListPage.jsx
//
// ليستة العملاء — مجمّعة من نفس جدول jobs بتاع قسم "سجل الشغل" (اسم
// العميل حقل عادي جوه مستند job، مش collection منفصلة)، فمفيش أي صلاحية
// قراءة جديدة هنا: نفس صلاحية قسم 'jobs' + نفس فلترة allowedClients
// (guestAccessService.subscribeGuestJobs) اللي قسم سجل الشغل نفسه
// بيستخدمها. الحساب هنا نفس منطق useClients.js بالحرف (calcRevenue/
// getJobPaidAmount/calcRemainingAmount من utils/calculations.js) — صفر
// حساب مالي جديد.
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { paymentService } from "../../services/paymentService";
import { buildClientList } from "../../utils/calculations";
import { Card, ProgressBar, EmptyState } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, getInitial } from "../../utils/formatters";
import { LockIcon, SearchIcon } from "../../components/ui/Icons";

const GuestClientsListPage = () => {
  const { ownerUid, isSectionOpen, access } = useGuest();
  const allowed = isSectionOpen("jobs");

  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
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
    return () => { unsubJobs(); unsubPay(); };
  }, [allowed, ownerUid, access]);

  // Step 2: نفس buildClientList بتاعة صفحة العملاء عند المالك بالحرف.
  const clients = useMemo(() => buildClientList(jobs, undefined, payments), [jobs, payments]);

  if (!allowed) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول لقسم سجل الشغل في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen message="جاري تحميل البيانات..." />;

  if (clients.length === 0) {
    return <EmptyState icon={<SearchIcon size={40} className="text-gray-600 mx-auto" />} title="لا يوجد عملاء مسجّلين." />;
  }

  return (
    <div dir="rtl" className="animate-fade-up">
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <h1 className="text-lg font-bold text-gray-100">العملاء</h1>
        <span className="text-xs text-gray-500 tabular-nums">({clients.length})</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">كل عميل: عدد العمليات، الإيراد، المدفوع والمتبقي عليه</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {clients.map((c, i) => {
          const paidPct = c.totalRevenue > 0 ? (c.totalPaid / c.totalRevenue) * 100 : 100;
          const hasDebt = c.totalRemaining > 0;
          return (
            <Link key={c.client} to={`/guest/app/clients/${encodeURIComponent(c.client)}`} className="block">
              <Card hover className="p-4 sm:p-5 animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold flex-shrink-0 ${
                    hasDebt ? "bg-red-900/30 border border-red-800/40 text-red-300"
                            : "bg-green-900/30 border border-green-800/40 text-green-300"
                  }`}>
                    {getInitial(c.client)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-extrabold text-gray-100 truncate">{c.client}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{c.ops} عملية · {formatNumber(c.totalAcres)} فدان</p>

                    <div className="flex gap-4 mt-3 flex-wrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-extrabold text-amber-400 tabular-nums">{formatCurrency(c.totalRevenue)}</span>
                        <span className="text-[10px] text-gray-500">إجمالي الإيراد</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-extrabold text-green-400 tabular-nums">{formatCurrency(c.totalPaid)}</span>
                        <span className="text-[10px] text-gray-500">مدفوع</span>
                      </div>
                    </div>

                    {c.totalRevenue > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">نسبة السداد</span>
                          <span className={`font-bold tabular-nums ${hasDebt ? "text-red-400" : "text-green-400"}`}>{paidPct.toFixed(0)}%</span>
                        </div>
                        <ProgressBar value={paidPct} max={100} color={hasDebt ? "bg-amber-500" : "bg-green-500"} />
                        {hasDebt && (
                          <p className="text-xs text-red-400 font-bold mt-1 tabular-nums">متبقي عليه: {formatCurrency(c.totalRemaining)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default GuestClientsListPage;
