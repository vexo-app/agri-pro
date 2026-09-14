// src/pages/SuppliersPage.jsx
import React, { useState } from "react";
import { useSuppliers }    from "../hooks/useSuppliers";
import { useData }         from "../contexts/DataContext";
import SupplierCard        from "../features/suppliers/SupplierCard";
import SupplierInvoiceForm from "../features/suppliers/SupplierInvoiceForm";
import SupplierPaymentForm from "../features/suppliers/SupplierPaymentForm";
import Modal                from "../components/ui/Modal";
import Button                from "../components/ui/Button";
import { StatCard, EmptyState } from "../components/ui/Card";
import LoadingScreen        from "../components/ui/LoadingScreen";
import FeatureIntroBanner   from "../components/common/FeatureIntroBanner";
import { TruckIcon, AlertIcon, PlusIcon, RevenueIcon } from "../components/ui/Icons";
import { formatCurrency } from "../utils/formatters";
import { trackEvent } from "../config/posthog";

const SuppliersPage = () => {
  const { suppliers, totalPayable, loading } = useSuppliers();
  const { addSupplierInvoice, addSupplierPayment } = useData();
  const [search,      setSearch]      = useState("");
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [payModal,    setPayModal]    = useState(null);

  if (loading) return <LoadingScreen />;

  const filtered      = suppliers.filter((s) =>
    s.supplierName.toLowerCase().includes(search.toLowerCase())
  );
  const totalInvoiced = suppliers.reduce((s, sup) => s + sup.totalInvoiced, 0);
  const totalPaidOut  = suppliers.reduce((s, sup) => s + sup.totalPaidOut,  0);

  const handleQuickPayment = (supplierName) => {
    setPayModal({ supplierName });
  };

  const handleSaveInvoice = async (data) => {
    await addSupplierInvoice(data);
    trackEvent("supplier_invoice_created");
    setInvoiceModal(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto" dir="rtl">

      <FeatureIntroBanner
        id="suppliers"
        title="الموردين"
        description="عكس صفحة العملاء بالظبط: هنا بتتابع فواتير الموردين اللي البرنامج مستحق عليك، ودفعاتك ليهم. سجّل فاتورة مورد جديدة وادفع منها على دفعات، والمتبقي بيتحدّث تلقائي."
      />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-100 flex items-center gap-2">
            <TruckIcon size={22} className="text-brand-400"/>
            الموردين والمستحقات عليك
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} مورد مسجل</p>
        </div>
        <Button onClick={() => setInvoiceModal(true)}>
          <PlusIcon size={16}/> فاتورة جديدة
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي المستحق عليك" value={formatCurrency(totalInvoiced)} color="amber"/>
        <StatCard icon={<RevenueIcon size={24}/>} label="إجمالي اللي دفعته"  value={formatCurrency(totalPaidOut)}  color="green"/>
        <StatCard icon={<AlertIcon size={24}/>}   label="باقي عليك"         value={formatCurrency(totalPayable)} color={totalPayable > 0 ? "red" : "green"}/>
      </div>

      {suppliers.length > 0 && (
        <div className="mb-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المورد..."
            className="w-full bg-surface-2 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-600"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<TruckIcon size={48} className="text-gray-600 mx-auto mb-2"/>}
          title="لا يوجد موردين"
          description="سجّل أول فاتورة مورد ليبدأ التتبع"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SupplierCard key={s.supplierName} supplier={s}
              onQuickPayment={() => handleQuickPayment(s.supplierName)}/>
          ))}
        </div>
      )}

      {/* New invoice modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="تسجيل فاتورة مورد جديدة">
        <SupplierInvoiceForm
          existingSupplierNames={suppliers.map((s) => s.supplierName)}
          onSave={handleSaveInvoice}
          onClose={() => setInvoiceModal(false)}
        />
      </Modal>

      {/* Quick payment modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)}
        title={`تسجيل دفعة — ${payModal?.supplierName || ""}`}>
        {payModal && (
          <SupplierPaymentQuickPay
            supplierName={payModal.supplierName}
            onSave={addSupplierPayment}
            onClose={() => setPayModal(null)}
          />
        )}
      </Modal>
    </div>
  );
};

// Resolves the oldest unpaid invoice for this supplier and lets the user pay
// against it — kept as a tiny local wrapper so SuppliersPage doesn't need
// full per-invoice detail just to accept a quick payment from the list view.
const SupplierPaymentQuickPay = ({ supplierName, onSave, onClose }) => {
  const { getSupplierSummary } = useSuppliers();
  const summary = getSupplierSummary(supplierName);
  const unpaid = summary.invoices
    .filter((inv) => inv.remainingAmount > 0)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];

  if (!unpaid) return null;

  return (
    <SupplierPaymentForm
      supplierInvoiceId={unpaid.id}
      invoiceAmount={unpaid.amount}
      alreadyPaid={unpaid.amountPaid || 0}
      onSave={onSave}
      onClose={onClose}
    />
  );
};

export default SuppliersPage;
