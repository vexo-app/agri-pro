// src/pages/JobsPage.jsx
import React, { useState } from "react";
import { useJobs }      from "../hooks/useJobs";
import { useData }      from "../contexts/DataContext";
import { useConfirm }   from "../hooks/useConfirm";
import JobCard          from "../features/jobs/JobCard";
import JobForm          from "../features/jobs/JobForm";
import JobFilters       from "../features/jobs/JobFilters";
import Modal            from "../components/ui/Modal";
import ConfirmDialog    from "../components/ui/ConfirmDialog";
import Button           from "../components/ui/Button";
import { EmptyState }   from "../components/ui/Card";
import LoadingScreen    from "../components/ui/LoadingScreen";
import { PlusIcon, ClipboardIcon, RevenueIcon, FuelIcon, ProfitIcon, AcreIcon } from "../components/ui/Icons";
import { formatCurrency, formatNumber } from "../utils/formatters";

const SummaryBadge = ({ Icon, label, value, color }) => (
  <div className="bg-surface border border-white/8 rounded-2xl px-4 py-3 flex-1 min-w-[120px]">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={14} className={color} />}
      <p className={`text-sm font-extrabold tabular-nums ${color}`}>{value}</p>
    </div>
    <p className="text-[11px] text-gray-500">{label}</p>
  </div>
);

const JobsPage = () => {
  const { jobs, totals, filters, setFilters, clearFilters, hasActiveFilters, loading, addJob, updateJob, deleteJob, fuelPrice } = useJobs();
  const { equipment, drivers, addPayment } = useData();
  const { confirm, confirmState } = useConfirm();
  const [modal, setModal] = useState(null);

  const openAdd    = ()      => setModal({ mode: "add" });
  const openEdit   = (job)   => setModal({ mode: "edit", data: job });
  const closeModal = ()      => setModal(null);

  const handleSave = async (formData) => {
    if (modal.mode === "add") {
      const { amountPaid, ...jobData } = formData;
      const { id: newJobId, promise: jobWritePromise } = await addJob(jobData);
      // لو المستخدم دخل دفعة مقدّمة عند التسجيل، بنسجّلها كدفعة فعلية
      // في payments collection بدل ما تفضل بس رقم جوه الـ job — لكن بس
      // لما نتأكد إن الـ job اتسجّل فعلاً على السيرفر، عشان منسجلش دفعة
      // مرتبطة بعملية اتعمل لها rollback لو فشل حفظها.
      if (Number(amountPaid) > 0) {
        try {
          await jobWritePromise;
        } catch {
          return;
        }
        await addPayment({
          jobId: newJobId,
          amount: Number(amountPaid),
          date: jobData.date,
          notes: "دفعة مقدّمة عند تسجيل العملية",
        });
      }
    } else {
      await updateJob(modal.data.id, formData);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteJob(id);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <ClipboardIcon size={22} className="text-brand-400" />
            سجل الشغل
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} عملية{hasActiveFilters ? " (مفلترة)" : ""}</p>
        </div>
        <Button onClick={openAdd} icon={<PlusIcon size={16} />}>تسجيل عملية</Button>
      </div>

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <SummaryBadge Icon={RevenueIcon} label="إجمالي الإيراد"  value={formatCurrency(totals.totalRevenue)}   color="text-amber-400" />
          <SummaryBadge Icon={FuelIcon}    label="تكلفة الوقود"    value={formatCurrency(totals.totalFuelCost)}  color="text-red-400" />
          <SummaryBadge Icon={ProfitIcon}  label="صافي الربح"      value={formatCurrency(totals.netProfit)}      color={totals.netProfit >= 0 ? "text-green-400" : "text-red-400"} />
          <SummaryBadge Icon={AcreIcon}    label="إجمالي الأفدنة"  value={`${formatNumber(totals.totalAcres)} فدان`} color="text-blue-400" />
        </div>
      )}

      <div className="mb-5">
        <JobFilters filters={filters} setFilters={setFilters} clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters} equipment={equipment} drivers={drivers} />
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon size={48} className="text-gray-600 mx-auto mb-2" />}
          title={hasActiveFilters ? "لا توجد نتائج للفلتر الحالي" : "لا توجد عمليات بعد"}
          description={hasActiveFilters ? "جرّب تغيير الفلاتر" : "سجّل أول عملية عمل الآن"}
          action={
            hasActiveFilters
              ? <Button variant="ghost" onClick={clearFilters}>مسح الفلاتر</Button>
              : <Button onClick={openAdd} icon={<PlusIcon size={16} />}>تسجيل أول عملية</Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const eq  = equipment.find((e) => e.id === job.equipmentId);
            const drv = drivers.find((d)  => d.id === job.driverId);
            return <JobCard key={job.id} job={job} equipmentName={eq?.name} driverName={drv?.name}
              onEdit={() => openEdit(job)} onDelete={() => handleDelete(job.id)} />;
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={closeModal}
        title={modal?.mode === "add" ? "تسجيل عملية جديدة" : "تعديل العملية"} size="lg">
        {modal && <JobForm initial={modal.data} equipment={equipment} drivers={drivers}
          fuelPrice={fuelPrice} onSave={handleSave} onClose={closeModal} />}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message="هل تريد حذف هذه العملية؟" />
    </div>
  );
};

export default JobsPage;
