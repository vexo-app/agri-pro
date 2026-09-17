// src/pages/ClientDetailPage.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClients }    from "../hooks/useClients";
import { useData }       from "../contexts/DataContext";
import PaymentBadge      from "../features/clients/PaymentBadge";
import PaymentForm       from "../features/payments/PaymentForm";
import Modal              from "../components/ui/Modal";
import { Input }          from "../components/ui/Input";
import Button              from "../components/ui/Button";
import { Card, CardHeader, CardBody, SummaryRow, EmptyState, ProgressBar } from "../components/ui/Card";
import LoadingScreen     from "../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, formatDateShort, todayISO } from "../utils/formatters";
import { AcreIcon, CalendarIcon, TractorIcon, PlusIcon } from "../components/ui/Icons";

const ClientDetailPage = () => {
  const { clientName }  = useParams();
  const navigate        = useNavigate();
  const decodedName     = decodeURIComponent(clientName);
  const { getClientSummary, loading } = useClients();
  const { equipment, addPayment, updateJob, jobs: rawJobs } = useData();
  const [payModal, setPayModal] = useState(null);
  // Smart-alerts (Phase 1) — optional reminder date per job (e.g. a debt
  // follow-up). Purely an additive field on the job doc; the actual "is it
  // due soon" logic lives in utils/maintenanceAlerts.js and feeds the
  // existing notification bell + dashboard "تنبيهات هامة" card.
  const [reminderModal, setReminderModal] = useState(null); // job | null
  const [reminderDraft, setReminderDraft] = useState("");

  if (loading) return <LoadingScreen />;

  const summary = getClientSummary(decodedName);
  const { totalRevenue, totalPaid, totalRemaining, totalAcres, ops, jobs } = summary;
  const paidPct = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

  // نفس addPayment المستخدمة بالفعل في JobsPage — بدون أي منطق حساب جديد.
  const handleSavePayment = async (data) => {
    await addPayment(data);
    setPayModal(null);
  };

  // `jobs` in this page comes from useClients()'s getClientSummary, which
  // ENRICHES each job with computed-only fields (amountPaid, remainingAmount,
  // paymentStatus) that must never be written back to Firestore as if they
  // were real job fields — that's why we look up the RAW job doc from
  // useData() by id first rather than using the enriched one directly.
  //
  // audit finding O1: كنا لازم قبل كده نبعت الـjob doc الخام كامل هنا،
  // لأن الـreducer المحلي كان بيستبدل السجل كامل بأي payload جزئي (بدل
  // merge)، فأي حقل ميتبعتش كان يختفي من الشاشة فورًا. الـreducer بقى
  // بيعمل merge دلوقتي (src/contexts/data/reducer.js)، فمبقى فيه داعي
  // نبعت غير reminderDate بس — وده كمان بيقفل نفس مشكلة O1 نفسها من
  // الاتجاه التاني: لو جهاز/تاب تاني بيعدّل نفس العملية في نفس الوقت من
  // صفحة سجل الشغل، مانمسحش تعديله بإعادة كتابة نسخة قديمة من باقي الحقول.
  const handleSaveReminder = async () => {
    const raw = rawJobs.find((j) => j.id === reminderModal.id);
    if (!raw) return;
    await updateJob(raw.id, { reminderDate: reminderDraft || "" });
    setReminderModal(null);
  };
  const handleClearReminder = async (job) => {
    const raw = rawJobs.find((j) => j.id === job.id);
    if (!raw) return;
    await updateJob(raw.id, { reminderDate: "" });
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Back */}
      <button
        onClick={() => navigate("/clients")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors"
      >
        ← العملاء
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-900/60 to-surface-3 border border-brand-800/30 flex items-center justify-center text-2xl font-extrabold text-brand-300">
          {decodedName.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-100">{decodedName}</h1>
          <p className="text-sm text-gray-500">{ops} عملية · {formatNumber(totalAcres)} فدان</p>
        </div>
      </div>

      {/* Financial summary card */}
      <Card className="mb-5">
        <CardHeader
          title="الملخص المالي"
          actions={
            totalRemaining > 0 && (
              <button
                onClick={() => setPayModal({})}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
              >
                <PlusIcon size={14}/> تسجيل دفعة
              </button>
            )
          }
        />
        <CardBody>
          <SummaryRow label="إجمالي الإيراد"  value={formatCurrency(totalRevenue)}   valueColor="text-amber-400" />
          <SummaryRow label="إجمالي المدفوع"  value={formatCurrency(totalPaid)}      valueColor="text-green-400" />
          <SummaryRow label="المبلغ المتبقي"  value={formatCurrency(totalRemaining)} valueColor={totalRemaining > 0 ? "text-red-400" : "text-gray-400"} bold />

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
        </CardBody>
      </Card>

      {/* Jobs list */}
      <h2 className="text-sm font-bold text-gray-300 mb-3">العمليات ({ops})</h2>
      {jobs.length === 0 ? (
        <EmptyState icon={<AcreIcon size={40} className="text-gray-600 mx-auto mb-2" />} title="لا توجد عمليات" />
      ) : (
        <div className="space-y-3">
          {jobs
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((job) => {
              // job is already enriched by useClients (getClientSummary) with
              // amountPaid / remainingAmount / paymentStatus derived from
              // the payments collection — no need to recompute here.
              const revenue    = job.revenue;
              const paid       = job.amountPaid;
              const remaining  = job.remainingAmount;
              const status     = job.paymentStatus;
              const eq         = equipment.find((e) => e.id === job.equipmentId);

              return (
                <div key={job.id} className={`bg-surface border rounded-2xl p-4 ${
                  status === "unpaid" && revenue > 0 ? "border-amber-800/40" : "border-white/8"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-gray-100">{job.workType}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <CalendarIcon size={11} /> {formatDateShort(job.date)}
                        {eq && <><TractorIcon size={11} /> {eq.name}</>}
                      </div>
                    </div>
                    <PaymentBadge status={status} />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "أفدنة",  value: formatNumber(job.acres),    color: "text-blue-400"  },
                      { label: "إيراد",  value: formatCurrency(revenue),    color: "text-amber-400" },
                      { label: "مدفوع",  value: formatCurrency(paid),       color: "text-green-400" },
                      { label: "متبقي",  value: formatCurrency(remaining),  color: remaining > 0 ? "text-red-400" : "text-gray-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface-2 rounded-xl p-2 text-center">
                        <p className={`text-xs font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {remaining > 0 && (
                    <button
                      onClick={() => setPayModal({ job })}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-900/20 border border-amber-800/40 text-amber-400 text-xs font-bold hover:bg-amber-900/40 transition-colors"
                    >
                      <PlusIcon size={14}/> تسجيل دفعة على العملية دي
                    </button>
                  )}

                  {/* Smart-alerts (Phase 1) — optional reminder date on this
                      job (e.g. "تابع مع العميل يوم كذا"). Shows up in the
                      notification bell + dashboard "تنبيهات هامة" card once
                      within 7 days of the date (utils/maintenanceAlerts.js). */}
                  {job.reminderDate ? (
                    <div className="w-full mt-2 flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-surface-2 border border-white/8 text-xs">
                      <span className="text-gray-400">
                        🔔 تذكير: <span className="font-bold text-gray-200">{formatDateShort(job.reminderDate)}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-brand-400 hover:text-brand-300 font-semibold"
                          onClick={() => { setReminderModal(job); setReminderDraft(job.reminderDate); }}
                        >
                          تعديل
                        </button>
                        <button
                          className="text-gray-500 hover:text-red-400"
                          onClick={() => handleClearReminder(job)}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReminderModal(job); setReminderDraft(todayISO()); }}
                      className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl bg-surface-2 border border-white/8 text-gray-400 text-xs font-bold hover:bg-surface-3 hover:text-gray-200 transition-colors"
                    >
                      🔔 تحديد تذكير على العملية دي
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Payment modal — targets a specific job if one was clicked,
          otherwise the oldest unpaid job for this client. */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`تسجيل دفعة — ${decodedName}`}>
        {payModal && (() => {
          const target = payModal.job
            || jobs.filter((j) => j.remainingAmount > 0)
                 .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
          if (!target) return null;
          return (
            <PaymentForm
              jobId={target.id}
              jobRevenue={target.revenue}
              alreadyPaid={target.amountPaid || 0}
              onSave={handleSavePayment}
              onClose={() => setPayModal(null)}
            />
          );
        })()}
      </Modal>

      {/* Reminder-date modal — smart-alerts Phase 1 */}
      <Modal open={!!reminderModal} onClose={() => setReminderModal(null)} title="تحديد تذكير">
        {reminderModal && (
          <div className="space-y-4">
            <Input
              label="التاريخ"
              type="date"
              value={reminderDraft}
              onChange={(e) => setReminderDraft(e.target.value)}
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setReminderModal(null)}>إلغاء</Button>
              <Button type="button" onClick={handleSaveReminder} disabled={!reminderDraft}>حفظ</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClientDetailPage;
