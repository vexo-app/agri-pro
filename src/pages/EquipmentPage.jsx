// src/pages/EquipmentPage.jsx
import React, { useMemo } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useEquipment } from "../hooks/useEquipment";
import { useDrivers }   from "../hooks/useDrivers";
import { useJobs }      from "../hooks/useJobs";
import { useConfirm }   from "../hooks/useConfirm";
import { useEntitlement } from "../hooks/useEntitlement";
import EquipmentCard    from "../features/equipment/EquipmentCard";
import EquipmentForm    from "../features/equipment/EquipmentForm";
import JobForm          from "../features/jobs/JobForm";
import Modal            from "../components/ui/Modal";
import ConfirmDialog    from "../components/ui/ConfirmDialog";
import Button           from "../components/ui/Button";
import { EmptyState }   from "../components/ui/Card";
import LoadingScreen    from "../components/ui/LoadingScreen";
import { PlusIcon, TractorIcon, LinkIcon, AlertIcon, EditIcon } from "../components/ui/Icons";
import { EQUIPMENT_CATEGORY, TEAM_ROLE } from "../config/constants";
import { trackEvent } from "../config/posthog";

const EquipmentPage = () => {
  const {
    report, loading, addEquipment, updateEquipment, deleteEquipment,
    getEquipmentDependencyCounts,
  } = useEquipment();
  const { report: driverReport } = useDrivers();
  // إسناد المعدات لسائقين بس — الإداريين والمحاسبين مش بيقودوا معدات.
  // getDriver() فاضلة بتدوّر في كل الفريق عشان لو فيه بيانات قديمة تفضل بتتعرض صح.
  const assignableDrivers = driverReport.filter((d) => (d.role || TEAM_ROLE.DRIVER) === TEAM_ROLE.DRIVER);
  const { addJob, fuelPrice }    = useJobs();
  const { confirm, confirmState } = useConfirm();
  const { canAddEquipment, plan: currentPlan } = useEntitlement();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  // (audit finding B1) equipment with dependent history the user just tried
  // to delete — { eq, counts } | null. Blocks the delete outright instead
  // of the previous bare unconditional confirm.
  const [blockedDeleteTarget, setBlockedDeleteTarget] = useState(null);

  const baseList = useMemo(
    () => report.filter((eq) => (eq.category || EQUIPMENT_CATEGORY.BASE) === EQUIPMENT_CATEGORY.BASE),
    [report]
  );
  const attachmentList = useMemo(
    () => report.filter((eq) => eq.category === EQUIPMENT_CATEGORY.ATTACHMENT),
    [report]
  );

  const getDriver = (driverId) => driverReport.find((d) => d.id === driverId);
  const getParent = (parentId) => report.find((eq) => eq.id === parentId);

  // حد عدد المعدات مرتبط بالباقة (راجع src/config/constants/billing.js) —
  // بيمنع إضافة معدة جديدة بس، مش بيلمس أي معدة موجودة أصلاً ولا بياناتها.
  const handleAddClick = () => {
    if (!canAddEquipment(baseList.length)) {
      toast.error(`وصلت للحد الأقصى لباقتك الحالية (${currentPlan?.limits?.equipmentMax} معدة) — رقّي باقتك عشان تضيف أكتر`);
      navigate("/billing");
      return;
    }
    setModal({ mode: "add" });
  };

  const handleSaveEquipment = async (formData) => {
    if (modal.mode === "add") {
      await addEquipment(formData);
      trackEvent("equipment_created", { equipment_category: formData.category || EQUIPMENT_CATEGORY.BASE });
    } else {
      await updateEquipment(modal.data.id, formData);
      trackEvent("equipment_updated", { equipment_category: formData.category || EQUIPMENT_CATEGORY.BASE });
    }
    setModal(null);
  };

  const handleSaveJob = async (formData) => {
    await addJob(formData);
    setModal(null);
  };

  // (audit finding B1, hardened per explicit decision) Previously this was
  // a bare unconditional confirm — no dependency check at all. Deleting
  // equipment while jobs/maintenance/custody records (or attachments
  // mounted on it) still referenced its id left those permanently pointing
  // at a dead id (orphaned), silently breaking per-equipment reporting.
  // Now: ANY dependent record blocks the delete outright. Deactivating
  // (status: "inactive") is the only path for equipment with history.
  const handleDelete = async (id) => {
    const eq = report.find((e) => e.id === id);
    const counts = getEquipmentDependencyCounts(id);
    const hasHistory = counts.jobs > 0 || counts.maintenance > 0 || counts.custody > 0 || counts.attachments > 0;

    if (hasHistory) {
      setBlockedDeleteTarget({ eq, counts });
      return;
    }

    const ok = await confirm(id);
    if (ok) deleteEquipment(id);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <TractorIcon size={22} className="text-brand-400"/>
            إدارة المعدات
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {baseList.length} معدة أساسية · {attachmentList.length} ملحق
          </p>
        </div>
        <Button onClick={handleAddClick} icon={<PlusIcon size={16}/>}>إضافة معدة</Button>
      </div>

      {report.length === 0 ? (
        <EmptyState
          icon={<TractorIcon size={48} className="text-gray-600 mx-auto mb-4"/>}
          title="لا توجد معدات بعد"
          description="أضف معداتك الزراعية لبدء تتبع الأداء"
          action={<Button onClick={handleAddClick} icon={<PlusIcon size={16}/>}>إضافة أول معدة</Button>}
        />
      ) : (
        <>
          {/* ── Base equipment ─────────────────────────────── */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500"/>
            <h2 className="text-sm font-bold text-gray-300">المعدات الأساسية</h2>
            <span className="text-xs text-gray-500">({baseList.length})</span>
          </div>
          {baseList.length === 0 ? (
            <div className="mb-8">
              <EmptyState
                icon={<TractorIcon size={36} className="text-gray-600 mx-auto mb-2"/>}
                title="لا توجد معدات أساسية بعد"
                description="أضف جرارًا أو عربية لتبدأ"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              {baseList.map((eq) => (
                <EquipmentCard key={eq.id} equipment={eq}
                  driver={getDriver(eq.driverId)}
                  onEdit={()       => setModal({ mode:"edit", data:eq })}
                  onDelete={()     => handleDelete(eq.id)}
                  onQuickJob={()   => setModal({ mode:"quickJob", equipmentId:eq.id, driverId:eq.driverId })}
                />
              ))}
            </div>
          )}

          {/* ── Attachments ─────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-orange-500"/>
            <h2 className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
              <LinkIcon size={14} className="text-orange-400"/> الملحقات
            </h2>
            <span className="text-xs text-gray-500">({attachmentList.length})</span>
          </div>
          {attachmentList.length === 0 ? (
            <EmptyState
              icon={<LinkIcon size={36} className="text-gray-600 mx-auto mb-2"/>}
              title="لا توجد ملحقات بعد"
              description="أضف معدات الحرث والزراعة وحدد الجرار المتعلقة عليه"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {attachmentList.map((eq) => (
                <EquipmentCard key={eq.id} equipment={eq}
                  driver={getDriver(eq.driverId)}
                  parent={getParent(eq.parentEquipmentId)}
                  onEdit={()       => setModal({ mode:"edit", data:eq })}
                  onDelete={()     => handleDelete(eq.id)}
                  onQuickJob={()   => setModal({ mode:"quickJob", equipmentId:eq.id, driverId:eq.driverId })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add / Edit equipment */}
      <Modal open={modal?.mode==="add" || modal?.mode==="edit"}
        onClose={() => setModal(null)}
        title={modal?.mode==="add" ? "إضافة معدة جديدة" : "تعديل المعدة"}>
        {(modal?.mode==="add" || modal?.mode==="edit") && (
          <EquipmentForm initial={modal.data} drivers={assignableDrivers} baseEquipment={baseList}
            onSave={handleSaveEquipment} onClose={() => setModal(null)}/>
        )}
      </Modal>

      {/* Quick Job modal */}
      <Modal open={modal?.mode==="quickJob"} onClose={() => setModal(null)} title="تسجيل شغل جديد">
        {modal?.mode==="quickJob" && (
          <JobForm
            equipment={report}
            drivers={assignableDrivers}
            fuelPrice={fuelPrice}
            initial={{ equipmentId: modal.equipmentId, driverId: modal.driverId || "" }}
            onSave={handleSaveJob}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message="هل تريد حذف هذه المعدة؟"/>

      {/* (audit finding B1) Delete blocked — dependent history exists */}
      <Modal open={!!blockedDeleteTarget} onClose={() => setBlockedDeleteTarget(null)}
        title="مينفعش تتمسح" size="sm">
        {blockedDeleteTarget && (
          <>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 flex gap-3 mb-4">
              <AlertIcon size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <span className="font-bold text-amber-200">{blockedDeleteTarget.eq?.name || "المعدة"}</span> عليها
                سجلات مرتبطة، فمينفعش تتمسح نهائيًا — الحذف كان هيسيب السجلات دي من غير معدة مرتبطة بيها.
              </p>
            </div>
            <ul className="list-disc list-inside text-gray-300 text-sm mb-4 space-y-0.5">
              {blockedDeleteTarget.counts.jobs > 0 && <li>{blockedDeleteTarget.counts.jobs} عملية شغل</li>}
              {blockedDeleteTarget.counts.maintenance > 0 && <li>{blockedDeleteTarget.counts.maintenance} سجل صيانة</li>}
              {blockedDeleteTarget.counts.custody > 0 && <li>{blockedDeleteTarget.counts.custody} سجل عهدة</li>}
              {blockedDeleteTarget.counts.attachments > 0 && <li>{blockedDeleteTarget.counts.attachments} ملحق متعلّق عليها</li>}
            </ul>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              لو مسحتهاش من الاستخدام بس عايز تحتفظ بتاريخها، غيّر حالتها لـ "متوقفة" بدل الحذف — بتختفي من
              القوائم النشطة وكل سجلاتها وتقاريرها تفضل زي ما هي بالظبط.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setBlockedDeleteTarget(null)}>إغلاق</Button>
              <Button variant="primary" size="sm" icon={<EditIcon size={14} />}
                onClick={() => {
                  const eq = blockedDeleteTarget.eq;
                  setBlockedDeleteTarget(null);
                  setModal({ mode: "edit", data: eq });
                }}>
                تغيير الحالة لـ "متوقفة"
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default EquipmentPage;
