// src/pages/guest/GuestSectionPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { supplierInvoiceService } from "../../services/supplierInvoiceService";
import { supplierPaymentService } from "../../services/supplierPaymentService";
import { calcSupplierRemaining, getInvoicePaidAmount } from "../../utils/calculations";
import { formatCurrency, getInitial } from "../../utils/formatters";
import { GUEST_SECTIONS } from "./guestSectionsConfig";
import { Card, Badge, ProgressBar, EmptyState } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { LockIcon, SearchIcon } from "../../components/ui/Icons";

/** كارت عرض عام — بيبني عنوان + شارات (حالة/نوع) + شبكة حقول من إعداد
 * القسم في guestSectionsConfig.js. مفيش أي منطق مالي هنا، عرض بس. */
const GuestItemCard = ({ config, item, delay }) => {
  const badges = config.badges ? config.badges(item) : [];
  const title = config.title ? config.title(item) : (item.name ?? "—");
  const subtitle = config.subtitle ? config.subtitle(item) : null;
  const fields = config.fields || [];

  return (
    <Card hover className="p-4 sm:p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-gray-100 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {badges.length > 0 && (
          <div className="flex gap-1.5 flex-wrap flex-shrink-0">
            {badges.map((b, i) => <Badge key={i} variant={b.tone}>{b.label}</Badge>)}
          </div>
        )}
      </div>

      {fields.length > 0 && (
        <div className="flex gap-5 mt-3 flex-wrap">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-0.5">
              <span className={`text-sm font-extrabold tabular-nums ${f.numeric ? "text-gray-100" : "text-gray-200"}`}>
                {f.format ? f.format(item[f.key]) : (item[f.key] ?? "—")}
              </span>
              <span className="text-[10px] text-gray-500">{f.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

/** كارت مورد مجمّع — نفس شكل SupplierCard.jsx بتاعة صاحب الحساب (إجمالي
 * المستحق/مدفوع له/نسبة السداد)، من غير أي زرار تعديل أو دفعة (الضيف
 * قراءة بس). الأرقام هنا مبنية على نفس دوال الحساب بالظبط
 * (calcSupplierRemaining/getInvoicePaidAmount من utils/calculations.js) —
 * صفر حساب جديد أو موازي. */
const GuestSupplierCard = ({ supplier, delay }) => {
  const { supplierName, totalInvoiced, totalPaidOut, totalPayable, ops } = supplier;
  const paidPct = totalInvoiced > 0 ? (totalPaidOut / totalInvoiced) * 100 : 100;
  const hasPayable = totalPayable > 0;

  return (
    <Card hover className="p-4 sm:p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold flex-shrink-0 ${
          hasPayable ? "bg-red-900/30 border border-red-800/40 text-red-300"
                     : "bg-green-900/30 border border-green-800/40 text-green-300"
        }`}>
          {getInitial(supplierName)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-gray-100 truncate">{supplierName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{ops} فاتورة</p>

          <div className="flex gap-4 mt-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-extrabold text-amber-400 tabular-nums">{formatCurrency(totalInvoiced)}</span>
              <span className="text-[10px] text-gray-500">إجمالي المستحق</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-extrabold text-green-400 tabular-nums">{formatCurrency(totalPaidOut)}</span>
              <span className="text-[10px] text-gray-500">مدفوع له</span>
            </div>
          </div>

          {totalInvoiced > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">نسبة السداد له</span>
                <span className={`font-bold tabular-nums ${hasPayable ? "text-red-400" : "text-green-400"}`}>
                  {paidPct.toFixed(0)}%
                </span>
              </div>
              <ProgressBar value={paidPct} max={100} color={hasPayable ? "bg-red-500" : "bg-green-500"} />
              {hasPayable && (
                <p className="text-xs text-red-400 font-bold mt-1 tabular-nums">
                  متبقي له: {formatCurrency(totalPayable)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * صفحة قراءة-بس عامة لأي قسم من guestSectionsConfig.js — كروت بدل جدول.
 * قسم jobs فيه منطق فلترة عملاء خاص (allowedClients) فبيتحمّل عن طريق
 * guestAccessService.subscribeGuestJobs بدل service.subscribe العادي.
 * قسم suppliers مختلف تمامًا: بيتحمّل من فاتورتين/مدفوعات (نفس
 * services اللي واجهة صاحب الحساب بتستخدمها فعليًا) وبيتجمّع لكل مورد —
 * راجع GUEST_ACCESS_DESIGN.md في المشروع للتفاصيل.
 */
const GuestSectionPage = ({ section }) => {
  const { ownerUid, isSectionOpen, access } = useGuest();
  const config = GUEST_SECTIONS[section];
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const allowed = isSectionOpen(section);
  const isSuppliers = section === "suppliers";

  useEffect(() => {
    if (!allowed || !ownerUid) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    if (isSuppliers) {
      // مفيش subscribe واحد هنا — لازم الفاتورة + كل الدفعات بتاعتها مع
      // بعض عشان نحسب "متبقي" بنفس طريقة useSuppliers.js بالظبط. بنستنى
      // أول رد من الاتنين قبل ما نطفي شاشة التحميل.
      let invLoaded = false, payLoaded = false;
      const maybeDone = () => { if (invLoaded && payLoaded) setLoading(false); };
      const unsubInv = supplierInvoiceService.subscribe(
        ownerUid,
        (list) => { setInvoices(list); invLoaded = true; maybeDone(); },
        (err) => { setError(err); invLoaded = true; maybeDone(); }
      );
      const unsubPay = supplierPaymentService.subscribe(
        ownerUid,
        (list) => { setPayments(list); payLoaded = true; maybeDone(); },
        (err) => { setError(err); payLoaded = true; maybeDone(); }
      );
      return () => { unsubInv(); unsubPay(); };
    }

    const onData = (list) => { setItems(list); setLoading(false); };
    const onError = (err) => { setError(err); setLoading(false); };
    const unsubscribe = section === "jobs"
      ? guestAccessService.subscribeGuestJobs(ownerUid, access?.allowedClients, onData, onError)
      : config.service.subscribe(ownerUid, onData, onError);
    return unsubscribe;
  }, [allowed, ownerUid, section, config, access, isSuppliers]);

  // تجميع لكل مورد — نفس منطق useSuppliers.js بالحرف (map بالاسم، جمع
  // amount من كل فاتورة، وgetInvoicePaidAmount/calcSupplierRemaining من
  // utils/calculations.js لحساب المدفوع والمتبقي) — إعادة استخدام كاملة
  // لنفس دالة الحساب، صفر منطق مالي جديد.
  const supplierSummaries = useMemo(() => {
    if (!isSuppliers) return [];
    const map = {};
    invoices.forEach((inv) => {
      const name = inv.supplierName;
      if (!name) return;
      if (!map[name]) map[name] = { supplierName: name, ops: 0, totalInvoiced: 0, totalPaidOut: 0, totalPayable: 0 };
      const paid = getInvoicePaidAmount(inv, payments);
      const remaining = calcSupplierRemaining(inv.amount, paid);
      map[name].ops += 1;
      map[name].totalInvoiced += Number(inv.amount) || 0;
      map[name].totalPaidOut  += paid;
      map[name].totalPayable  += remaining;
    });
    return Object.values(map).sort((a, b) => b.totalPayable - a.totalPayable);
  }, [isSuppliers, invoices, payments]);

  if (!allowed) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول للقسم ده في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen message="جاري تحميل البيانات..." />;

  if (error) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="مش قادر أعرض البيانات دي دلوقتي"
        description="ممكن يكون الكود انتهى أو اتلغى — جرّب تدخل تاني بالرابط اللي وصلك."
      />
    );
  }

  const rows = isSuppliers ? supplierSummaries : items;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<SearchIcon size={40} className="text-gray-600 mx-auto" />}
        title={config.emptyText}
      />
    );
  }

  return (
    <div dir="rtl" className="animate-fade-up">
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <h1 className="text-lg font-bold text-gray-100">{config.label}</h1>
        <span className="text-xs text-gray-500 tabular-nums">
          ({rows.length}{isSuppliers ? " مورد" : ""})
        </span>
      </div>
      {config.note && <p className="text-xs text-gray-500 mb-4">{config.note}</p>}
      {config.description && <p className="text-xs text-gray-500 mb-4">{config.description}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {isSuppliers
          ? rows.map((s, i) => (
              <GuestSupplierCard key={s.supplierName} supplier={s} delay={Math.min(i, 12) * 25} />
            ))
          : rows.map((item, i) => (
              <GuestItemCard key={item.id} config={config} item={item} delay={Math.min(i, 12) * 25} />
            ))}
      </div>
    </div>
  );
};

export default GuestSectionPage;
