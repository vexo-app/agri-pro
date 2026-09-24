// src/pages/SupplierDetailPage.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSuppliers }  from "../hooks/useSuppliers";
import { useData }       from "../contexts/DataContext";
import SupplierPaymentForm from "../features/suppliers/SupplierPaymentForm";
import DeleteSupplierInvoiceDialog from "../features/suppliers/DeleteSupplierInvoiceDialog";
import Modal              from "../components/ui/Modal";
import Button              from "../components/ui/Button";
import DownloadReportButton from "../components/ui/DownloadReportButton";
import { Input }           from "../components/ui/Input";
import { Card, CardHeader, CardBody, SummaryRow, EmptyState, ProgressBar, Badge } from "../components/ui/Card";
import LoadingScreen      from "../components/ui/LoadingScreen";
import { formatCurrency, formatDateShort } from "../utils/formatters";
import { calcOverpaidAmount } from "../utils/calculations";
import { CalendarIcon, PlusIcon, EditIcon, PrintIcon, TrashIcon } from "../components/ui/Icons";
import {
  printSupplierInvoice, downloadSupplierInvoicePdf,
  printSupplierStatement, downloadSupplierStatementPdf,
} from "../utils/pdfGenerator";

const SupplierDetailPage = () => {
  const { supplierName }  = useParams();
  const navigate           = useNavigate();
  const decodedName        = decodeURIComponent(supplierName);
  const { getSupplierSummary, loading } = useSuppliers();
  const { addSupplierPayment, deleteSupplierInvoice, renameSupplier, supplierPayments = [], settings } = useData();
  const [payModal, setPayModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // { invoice }
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState(decodedName);
  const [renaming, setRenaming] = useState(false);

  if (loading) return <LoadingScreen />;

  const summary = getSupplierSummary(decodedName);
  const { totalInvoiced, totalPaidOut, totalPayable, ops, invoices } = summary;
  const paidPct = totalInvoiced > 0 ? (totalPaidOut / totalInvoiced) * 100 : 0;

  const handleSavePayment = async (data) => {
    await addSupplierPayment(data);
    setPayModal(null);
  };

  // حذف فاتورة مورد بالكامل — deleteSupplierInvoice بتمسح الفاتورة وكل
  // الدفعات المرتبطة بيها في batch واحد ذرّي (راجع supplierMutations.js)،
  // فمفيش أي حاجة يتيمة بتفضل بعد الحذف.
  const handleConfirmDeleteInvoice = async () => {
    const inv = deleteModal?.invoice;
    if (!inv) return;
    await deleteSupplierInvoice(inv.id);
  };

  // فاتورة عامة تجمع كل فواتير المورد في مستند واحد — نفس الإجماليات
  // المعروضة فوق بالظبط (totalInvoiced/totalPaidOut/totalPayable)، من غير
  // أي حساب موازي جديد.
  const handlePrintStatement = () => printSupplierStatement({
    supplierName: decodedName, invoices, totalInvoiced, totalPaidOut, totalPayable, company: settings.company,
  });
  const handleDownloadStatement = () => downloadSupplierStatementPdf({
    supplierName: decodedName, invoices, totalInvoiced, totalPaidOut, totalPayable, company: settings.company,
  });

  // بعد التصحيح بيتنقل تلقائيًا لصفحة المورد بالاسم الجديد، لأن الرابط
  // (وده المورد نفسه فعليًا) مبني على الاسم — مفيش id تاني نرجعله.
  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === decodedName) { setRenameModal(false); return; }
    setRenaming(true);
    try {
      await renameSupplier(decodedName, trimmed);
      navigate(`/suppliers/${encodeURIComponent(trimmed)}`, { replace: true });
    } finally {
      setRenaming(false);
      setRenameModal(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Back */}
      <button
        onClick={() => navigate("/suppliers")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors"
      >
        ← الموردين
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-900/60 to-surface-3 border border-red-800/30 flex items-center justify-center text-2xl font-extrabold text-red-300">
          {decodedName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-100 truncate">{decodedName}</h1>
            <button
              onClick={() => { setRenameValue(decodedName); setRenameModal(true); }}
              className="text-gray-500 hover:text-gray-300 flex-shrink-0"
              title="تصحيح اسم المورد"
            >
              <EditIcon size={15} />
            </button>
          </div>
          <p className="text-sm text-gray-500">{ops} فاتورة</p>
        </div>
      </div>

      {/* Financial summary card */}
      <Card className="mb-5">
        <CardHeader
          title="الملخص المالي"
          actions={
            <div className="flex items-center gap-1.5">
              {ops > 0 && (
                <>
                  <button
                    onClick={handlePrintStatement}
                    title="طباعة فاتورة عامة للمورد"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-surface-2 transition-colors"
                  >
                    <PrintIcon size={13} />
                  </button>
                  <DownloadReportButton onDownload={handleDownloadStatement} title="تحميل فاتورة عامة PDF" size="xs" className="px-2" />
                </>
              )}
              {totalPayable > 0 && (
                <Button size="xs" variant="danger" onClick={() => setPayModal({})}>
                  <PlusIcon size={14}/> تسجيل دفعة
                </Button>
              )}
            </div>
          }
        />
        <CardBody>
          <SummaryRow label="إجمالي المستحق عليك" value={formatCurrency(totalInvoiced)} valueColor="text-amber-400" />
          <SummaryRow label="إجمالي اللي دفعته"    value={formatCurrency(totalPaidOut)}  valueColor="text-green-400" />
          <SummaryRow label="المبلغ الباقي عليك"    value={formatCurrency(totalPayable)}  valueColor={totalPayable > 0 ? "text-red-400" : "text-gray-400"} bold />

          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>نسبة السداد له</span>
              <span className="font-bold text-brand-400">{paidPct.toFixed(0)}%</span>
            </div>
            <ProgressBar
              value={paidPct}
              max={100}
              color={paidPct >= 100 ? "bg-green-500" : paidPct > 50 ? "bg-brand-500" : "bg-red-500"}
            />
          </div>
        </CardBody>
      </Card>

      {/* Invoices list */}
      <h2 className="text-sm font-bold text-gray-300 mb-3">الفواتير ({ops})</h2>
      {invoices.length === 0 ? (
        <EmptyState title="لا توجد فواتير" />
      ) : (
        <div className="space-y-3">
          {invoices
            .slice()
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map((inv) => {
              const remaining = inv.remainingAmount;
              const isPaid    = remaining <= 0;
              // audit FIN-4: مدفوع للمورد أكتر من قيمة الفاتورة
              const overpaid  = calcOverpaidAmount(inv.amount, inv.amountPaid);
              // نفس فكرة الفاتورة اللي بتتطبع/تتحمل لكل عملية في JobCard.jsx
              // بالظبط — فاتورة المورد هنا عملية واحدة بمبلغ وتاريخ محددين،
              // فطبيعي يكون ليها فاتورة زي أي عملية تانية في التطبيق، مش
              // مجرد سجل بيانات من غير مستند.
              const handlePrint    = () => printSupplierInvoice({ invoice: inv, supplierPayments, company: settings.company });
              const handleDownload = () => downloadSupplierInvoicePdf({ invoice: inv, supplierPayments, company: settings.company });
              return (
                <div key={inv.id} className={`bg-surface border rounded-2xl p-4 ${
                  !isPaid ? "border-red-800/40" : "border-white/8"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-gray-100">{inv.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <CalendarIcon size={11} /> {formatDateShort(inv.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant={isPaid ? "green" : "red"}>{isPaid ? "مدفوع" : "لسه عليك"}</Badge>
                      <button
                        onClick={handlePrint}
                        title="طباعة فاتورة"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-surface-2 transition-colors"
                      >
                        <PrintIcon size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ invoice: inv })}
                        title="حذف الفاتورة"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border border-white/10 text-gray-400 hover:text-red-400 hover:bg-surface-2 transition-colors"
                      >
                        <TrashIcon size={13} />
                      </button>
                      <DownloadReportButton onDownload={handleDownload} title="تحميل فاتورة PDF" size="xs" className="px-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "إجمالي", value: formatCurrency(inv.amount),          color: "text-amber-400" },
                      { label: "مدفوع",  value: formatCurrency(inv.amountPaid),      color: "text-green-400" },
                      { label: "متبقي",  value: formatCurrency(remaining),           color: remaining > 0 ? "text-red-400" : "text-gray-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface-2 rounded-xl p-2 text-center">
                        <p className={`text-xs font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {overpaid > 0 && (
                    <p className="text-xs font-bold text-sky-400 mt-2">
                      ⚠ مدفوع زيادة عن قيمة الفاتورة: {formatCurrency(overpaid)} (رصيد لك عند المورد)
                    </p>
                  )}

                  {remaining > 0 && (
                    <button
                      onClick={() => setPayModal({ invoice: inv })}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-xs font-bold hover:bg-red-900/40 transition-colors"
                    >
                      <PlusIcon size={14}/> تسجيل دفعة على الفاتورة دي
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Payment modal — targets a specific invoice if one was clicked,
          otherwise the oldest unpaid invoice for this supplier. */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`تسجيل دفعة — ${decodedName}`}>
        {payModal && (() => {
          const target = payModal.invoice
            || invoices.filter((i) => i.remainingAmount > 0)
                 .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
          if (!target) return null;
          return (
            <SupplierPaymentForm
              supplierInvoiceId={target.id}
              invoiceAmount={target.amount}
              alreadyPaid={target.amountPaid || 0}
              onSave={handleSavePayment}
              onClose={() => setPayModal(null)}
            />
          );
        })()}
      </Modal>

      {/* Delete invoice modal — password-gated, deletes the invoice + its
          payments atomically (no orphaned records) */}
      <DeleteSupplierInvoiceDialog
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        invoiceDescription={deleteModal?.invoice?.description}
        paymentsCount={deleteModal ? supplierPayments.filter((p) => p.supplierInvoiceId === deleteModal.invoice.id).length : 0}
        paymentsTotal={deleteModal?.invoice?.amountPaid || 0}
        onConfirm={handleConfirmDeleteInvoice}
      />

      {/* Rename modal — bulk-updates every invoice under this name, since
          there's no separate supplier id to edit in one place. */}
      <Modal open={renameModal} onClose={() => !renaming && setRenameModal(false)} title="تصحيح اسم المورد" size="sm">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          هيتغير الاسم في كل فواتير "{decodedName}" ({ops}) دفعة واحدة — استخدمها لو الاسم اتكتب بغلطة إملائية، مش لعمل مورد جديد.
        </p>
        <Input
          label="الاسم الصحيح"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
          <Button variant="ghost" size="sm" disabled={renaming} onClick={() => setRenameModal(false)}>إلغاء</Button>
          <Button variant="primary" size="sm" loading={renaming}
            disabled={!renameValue.trim() || renameValue.trim() === decodedName}
            onClick={handleRename}>
            حفظ
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default SupplierDetailPage;
