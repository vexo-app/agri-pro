// src/pages/guest/GuestSupplierDetailPage.jsx
//
// نسخة قراءة-بس من SupplierDetailPage.jsx بتاع صاحب الحساب — نفس
// الملخص المالي وليستة الفواتير بالظبط، من غير أي تسجيل دفعة/حذف
// فاتورة/تصحيح اسم/طباعة.
//
// صلاحيات القراءة: supplierInvoices + supplierPayments، الاتنين مسموحين
// أصلاً تحت guestCanRead(uid,'suppliers') — نفس صلاحية ليستة الموردين،
// صفر تعديل قواعد.
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { supplierInvoiceService } from "../../services/supplierInvoiceService";
import { supplierPaymentService } from "../../services/supplierPaymentService";
import { getInvoicePaidAmount, calcSupplierRemaining } from "../../utils/calculations";
import { Card, CardHeader, CardBody, SummaryRow, EmptyState, ProgressBar, Badge } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { formatCurrency, formatDateShort } from "../../utils/formatters";
import { CalendarIcon, LockIcon } from "../../components/ui/Icons";

const GuestSupplierDetailPage = () => {
  const { supplierName } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(supplierName);
  const { ownerUid, isSectionOpen } = useGuest();
  const allowed = isSectionOpen("suppliers");

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed || !ownerUid) { setLoading(false); return; }
    let invLoaded = false, payLoaded = false;
    const maybeDone = () => { if (invLoaded && payLoaded) setLoading(false); };
    const unsubInv = supplierInvoiceService.subscribe(ownerUid, (list) => { setInvoices(list); invLoaded = true; maybeDone(); }, () => { invLoaded = true; maybeDone(); });
    const unsubPay = supplierPaymentService.subscribe(ownerUid, (list) => { setPayments(list); payLoaded = true; maybeDone(); }, () => { payLoaded = true; maybeDone(); });
    return () => { unsubInv(); unsubPay(); };
  }, [allowed, ownerUid]);

  const supplierInvoices = useMemo(
    () => invoices.filter((inv) => inv.supplierName === decodedName),
    [invoices, decodedName]
  );

  const { totalInvoiced, totalPaidOut, totalPayable } = useMemo(() => {
    let inv = 0, paid = 0, payable = 0;
    supplierInvoices.forEach((i) => {
      const p = getInvoicePaidAmount(i, payments);
      inv += Number(i.amount) || 0;
      paid += p;
      payable += calcSupplierRemaining(i.amount, p);
    });
    return { totalInvoiced: inv, totalPaidOut: paid, totalPayable: payable };
  }, [supplierInvoices, payments]);

  const paidPct = totalInvoiced > 0 ? (totalPaidOut / totalInvoiced) * 100 : 0;

  if (!allowed) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول لقسم الموردين في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="max-w-3xl mx-auto animate-fade-up" dir="rtl">
      <button onClick={() => navigate("/guest/app/suppliers")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← الموردين
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-red-900/40 border border-red-800/30 flex items-center justify-center text-2xl font-extrabold text-red-300">
          {decodedName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold text-gray-100 truncate">{decodedName}</h1>
          <p className="text-sm text-gray-500">{supplierInvoices.length} فاتورة</p>
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader title="الملخص المالي" />
        <CardBody>
          <SummaryRow label="إجمالي المستحق عليه" value={formatCurrency(totalInvoiced)} valueColor="text-amber-400" />
          <SummaryRow label="إجمالي اللي اتدفعله" value={formatCurrency(totalPaidOut)}  valueColor="text-green-400" />
          <SummaryRow label="المبلغ المتبقي له"    value={formatCurrency(totalPayable)}  valueColor={totalPayable > 0 ? "text-red-400" : "text-gray-400"} bold />

          {totalInvoiced > 0 && (
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
          )}
        </CardBody>
      </Card>

      <h2 className="text-sm font-bold text-gray-300 mb-3">الفواتير ({supplierInvoices.length})</h2>
      {supplierInvoices.length === 0 ? (
        <EmptyState title="لا توجد فواتير" />
      ) : (
        <div className="space-y-3">
          {supplierInvoices
            .slice()
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map((inv) => {
              const paid = getInvoicePaidAmount(inv, payments);
              const remaining = calcSupplierRemaining(inv.amount, paid);
              const isPaid = remaining <= 0;
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
                    <Badge variant={isPaid ? "green" : "red"}>{isPaid ? "مدفوع" : "لسه عليه"}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "إجمالي", value: formatCurrency(inv.amount), color: "text-amber-400" },
                      { label: "مدفوع",  value: formatCurrency(paid),       color: "text-green-400" },
                      { label: "متبقي",  value: formatCurrency(remaining),  color: remaining > 0 ? "text-red-400" : "text-gray-400" },
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

export default GuestSupplierDetailPage;
