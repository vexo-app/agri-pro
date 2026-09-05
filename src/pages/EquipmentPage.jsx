// src/pages/EquipmentPage.jsx
import React, { useMemo } from "react";
import { useState } from "react";
import { useEquipment } from "../hooks/useEquipment";
import { useDrivers }   from "../hooks/useDrivers";
import { useJobs }      from "../hooks/useJobs";
import { useConfirm }   from "../hooks/useConfirm";
import EquipmentCard    from "../features/equipment/EquipmentCard";
import EquipmentForm    from "../features/equipment/EquipmentForm";
import JobForm          from "../features/jobs/JobForm";
import Modal            from "../components/ui/Modal";
import ConfirmDialog    from "../components/ui/ConfirmDialog";
import Button           from "../components/ui/Button";
import { EmptyState }   from "../components/ui/Card";
import LoadingScreen    from "../components/ui/LoadingScreen";
import { PlusIcon, TractorIcon, LinkIcon } from "../components/ui/Icons";
import { EQUIPMENT_CATEGORY, TEAM_ROLE } from "../config/constants";

const EquipmentPage = () => {
  const { report, loading, addEquipment, updateEquipment, deleteEquipment } = useEquipment();
  const { report: driverReport } = useDrivers();
  // إسناد المعدات لسائقين بس — الإداريين والمحاسبين مش بيقودوا معدات.
  // getDriver() فاضلة بتدوّر في كل الفريق عشان لو فيه بيانات قديمة تفضل بتتعرض صح.
  const assignableDrivers = driverReport.filter((d) => (d.role || TEAM_ROLE.DRIVER) === TEAM_ROLE.DRIVER);
  const { addJob, fuelPrice }    = useJobs();
  const { confirm, confirmState } = useConfirm();
  const [modal, setModal] = useState(null);

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

  const handleSaveEquipment = async (formData) => {
    if (modal.mode === "add") await addEquipment(formData);
    else await updateEquipment(modal.data.id, formData);
    setModal(null);
  };

  const handleSaveJob = async (formData) => {
    await addJob(formData);
    setModal(null);
  };

  const handleDelete = async (id) => {
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
        <Button onClick={() => setModal({ mode:"add" })} icon={<PlusIcon size={16}/>}>إضافة معدة</Button>
      </div>

      {report.length === 0 ? (
        <EmptyState
          icon={<TractorIcon size={48} className="text-gray-600 mx-auto mb-4"/>}
          title="لا توجد معدات بعد"
          description="أضف معداتك الزراعية لبدء تتبع الأداء"
          action={<Button onClick={() => setModal({ mode:"add" })} icon={<PlusIcon size={16}/>}>إضافة أول معدة</Button>}
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
    </div>
  );
};

export default EquipmentPage;
