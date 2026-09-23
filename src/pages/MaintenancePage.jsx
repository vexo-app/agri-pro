// src/pages/MaintenancePage.jsx
import React, { useState } from "react";
import { useMaintenance }       from "../hooks/useMaintenance";
import { useData }              from "../contexts/DataContext";
import { useConfirm }           from "../hooks/useConfirm";
import MaintenanceGroupCard     from "../features/maintenance/MaintenanceGroupCard";
import MaintenanceForm          from "../features/maintenance/MaintenanceForm";
import Modal                    from "../components/ui/Modal";
import ConfirmDialog            from "../components/ui/ConfirmDialog";
import Button                   from "../components/ui/Button";
import { EmptyState, StatCard } from "../components/ui/Card";
import LoadingScreen            from "../components/ui/LoadingScreen";
import { PlusIcon, WrenchIcon, RevenueIcon } from "../components/ui/Icons";
import { formatCurrency }       from "../utils/formatters";
import { trackEvent }           from "../config/posthog";
import toast                    from "react-hot-toast";
import { removeOilEntryPatch }  from "../utils/serviceHistory";

const MaintenancePage = () => {
  const { maintenance, byEquipment, totalCost, loading, addMaintenance, updateMaintenance, deleteMaintenance } = useMaintenance();
  const { equipment, updateEquipment } = useData();

  // The oil-change entry (on the equipment doc) linked to a maintenance record.
  const findLinkedOilEntry = (record) => {
    if (!record?.oilChangeId) return null;
    const eq = equipment.find((e) => e.id === record.equipmentId);
    const entry = eq?.oilChangeHistory?.find((e) => e.id === record.oilChangeId);
    return entry ? { eq, entry } : null;
  };
  const { confirm, confirmState } = useConfirm();
  const [modal, setModal] = useState(null);

  const openAdd    = ()       => setModal({ mode: "add" });
  const openEdit   = (record) => setModal({ mode: "edit", data: record });
  const closeModal = ()       => setModal(null);

  const handleSave = async (formData) => {
    if (modal.mode === "add") {
      await addMaintenance(formData);
      trackEvent("maintenance_recorded");
    } else {
      const record = modal.data;
      // سجل مربوط بغيار زيت: مينفعش ينتقل لمعدة تانية، وإلا الغيار يفضل
      // على معدة والفلوس على معدة تانية.
      if (record.oilChangeId && formData.equipmentId && formData.equipmentId !== record.equipmentId) {
        toast.error("السجل ده مربوط بغيار زيت — امسحه وسجّله من صفحة المعدة الصحيحة");
        return;
      }
      await updateMaintenance(record.id, formData);
      // تغيير التاريخ يتنقل لسجل الغيار كمان.
      const link = formData.date ? findLinkedOilEntry(record) : null;
      if (link && link.entry.date !== formData.date) {
        await updateEquipment(link.eq.id, {
          oilChangeHistory: link.eq.oilChangeHistory.map((e) =>
            e.id === link.entry.id ? { ...e, date: formData.date } : e),
        });
      }
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm(id);
    if (!ok) return;
    const record = maintenance.find((m) => m.id === id);
    const link = findLinkedOilEntry(record);
    deleteMaintenance(id);
    // لو السجل ده غيار زيت، نشيله من سجل الغيار على المعدة كمان.
    if (link) await updateEquipment(link.eq.id, removeOilEntryPatch(link.eq, link.entry.id));
  };

  if (loading) return <LoadingScreen />;

  const totalRecords = byEquipment.reduce((s, g) => s + g.records.length, 0);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <WrenchIcon size={22} className="text-brand-400" />
            الصيانة
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalRecords} سجل صيانة</p>
        </div>
        <Button onClick={openAdd} icon={<PlusIcon size={16} />}>تسجيل صيانة</Button>
      </div>

      {totalCost > 0 && (
        <div className="mb-6">
          <StatCard icon={<RevenueIcon size={26} />} label="إجمالي تكاليف الصيانة"
            value={formatCurrency(totalCost)} color="amber" />
        </div>
      )}

      {byEquipment.length === 0 ? (
        <EmptyState
          icon={<WrenchIcon size={48} className="text-gray-600 mx-auto mb-2" />}
          title="لا توجد سجلات صيانة"
          description="سجّل أعمال الصيانة لمتابعة تكاليفها"
          action={<Button onClick={openAdd} icon={<PlusIcon size={16} />}>تسجيل أول صيانة</Button>}
        />
      ) : (
        <div className="space-y-4">
          {byEquipment.map((group) => (
            <MaintenanceGroupCard key={group.equipment.id} group={group}
              onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={closeModal}
        title={modal?.mode === "add" ? "تسجيل صيانة جديدة" : "تعديل سجل الصيانة"}>
        {modal && <MaintenanceForm initial={modal.data} equipment={equipment}
          onSave={handleSave} onClose={closeModal} />}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message="هل تريد حذف سجل الصيانة هذا؟" />
    </div>
  );
};

export default MaintenancePage;
