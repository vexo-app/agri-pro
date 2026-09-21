// src/pages/guest/GuestSectionPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { supplierInvoiceService } from "../../services/supplierInvoiceService";
import { supplierPaymentService } from "../../services/supplierPaymentService";
import { paymentService } from "../../services/paymentService";
import { equipmentService } from "../../services/equipmentService";
import { driverService } from "../../services/driverService";
import {
  calcSupplierRemaining, getInvoicePaidAmount,
  calcRevenue, calcFuelCost, calcRemainingAmount, derivePaymentStatus, getJobPaidAmount,
} from "../../utils/calculations";
import { formatCurrency, formatNumber, formatDateShort, getInitial } from "../../utils/formatters";
import { GUEST_SECTIONS } from "./guestSectionsConfig";
import { Card, Badge, ProgressBar, EmptyState } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { LockIcon, SearchIcon, CalendarIcon, TractorIcon, DriverIcon, AcreIcon, FuelIcon, WORK_TYPE_ICON_MAP, WrenchIcon } from "../../components/ui/Icons";
import PaymentBadge from "../../features/clients/PaymentBadge";

/** كارت عرض عام — بيبني عنوان + شارات (حالة/نوع) + شبكة حقول من إعداد
 * القسم في guestSectionsConfig.js. مفيش أي منطق مالي هنا، عرض بس.
 * لو القسم عنده detailPath (equipment/drivers) الكارت كله بيبقى رابط
 * لصفحة تفاصيل قراءة-بس (بدون أي زرار تعديل/حذف/طباعة). */
const GuestItemCard = ({ config, item, delay }) => {
  const badges = config.badges ? config.badges(item) : [];
  const title = config.title ? config.title(item) : (item.name ?? "—");
  const subtitle = config.subtitle ? config.subtitle(item) : null;
  const fields = config.fields || [];
  const linkTo = config.detailPath ? config.detailPath(item) : null;

  const body = (
    <Card hover={!!linkTo} className="p-4 sm:p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
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

  return linkTo ? <Link to={linkTo} className="block">{body}</Link> : body;
};

/** كارت مورد مجمّع — نفس شكل SupplierCard.jsx بتاعة صاحب الحساب (إجمالي
 * المستحق/مدفوع له/نسبة السداد)، من غير أي زرار تعديل أو دفعة (الضيف
 * قراءة بس). قابل للضغط عليه لعرض تفاصيل فواتير المورد الكاملة —
 * راجع GuestSupplierDetailPage.jsx. الأرقام هنا مبنية على نفس دوال
 * الحساب بالظبط (calcSupplierRemaining/getInvoicePaidAmount من
 * utils/calculations.js) — صفر حساب جديد أو موازي. */
const GuestSupplierCard = ({ supplier, delay }) => {
  const { supplierName, totalInvoiced, totalPaidOut, totalPayable, ops } = supplier;
  const paidPct = totalInvoiced > 0 ? (totalPaidOut / totalInvoiced) * 100 : 100;
  const hasPayable = totalPayable > 0;

  return (
    <Link to={`/guest/app/suppliers/${encodeURIComponent(supplierName)}`} className="block">
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
    </Link>
  );
};

const FinancialPill = ({ label, value, color }) => (
  <div className="flex-1 bg-surface-2 rounded-xl p-2 text-center min-w-0">
    <p className={`text-sm font-extrabold ${color} tabular-nums truncate`}>{value}</p>
    <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
  </div>
);

/**
 * كارت عملية شغل غني — نفس شكل JobCard.jsx بتاعة صاحب الحساب بالظبط
 * (بيانات المعدة/السائق، الوقود المستخدم، إيراد/وقود/ربح، مدفوع/متبقي)
 * من غير أي زرار تعديل/حذف/طباعة. اسم المعدة/السائق بيتعرض بس لو
 * القسم بتاعهم مفعّل للضيف (equipment/drivers) — لو مقفول، بيتم تجاهله
 * تمامًا (مفيش أي قراءة لمجموعة equipment/drivers من غير صلاحية).
 * إيراد/وقود/ربح ومدفوع/متبقي بيتحسبوا بنفس دوال useJobs.js بالظبط
 * (calcRevenue/calcFuelCost/calcRemainingAmount/derivePaymentStatus/
 * getJobPaidAmount من utils/calculations.js) — صفر حساب جديد.
 */
const GuestJobCard = ({ job, equipmentName, driverName, delay }) => {
  const [showPayments, setShowPayments] = useState(false);
  const {
    client, workType, date, acres, fuelUsed,
    revenue, fuelCost, profit,
    amountPaid, remainingAmount, paymentStatus,
    notes, fuelPriceMissing, jobPayments = [],
  } = job;

  const WorkIcon = WORK_TYPE_ICON_MAP[workType] ?? WrenchIcon;
  const isUnpaid = paymentStatus === "unpaid" && revenue > 0;

  return (
    <Card className={`p-4 sm:p-5 animate-fade-up border ${
      isUnpaid ? "border-amber-800/40" : "border-white/8"
    }`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-gray-100 truncate">{client || "—"}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
            <CalendarIcon size={12}/>
            <span>{formatDateShort(date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <Badge variant="blue"><WorkIcon size={11}/> {workType}</Badge>
          {revenue > 0 && <PaymentBadge status={paymentStatus}/>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {equipmentName && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <TractorIcon size={12}/> {equipmentName}
          </span>
        )}
        {driverName && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <DriverIcon size={12}/> {driverName}
          </span>
        )}
        <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
          <AcreIcon size={12}/> {formatNumber(acres)} فدان
        </span>
        {fuelUsed > 0 && (
          <span className="flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-lg text-xs text-gray-400">
            <FuelIcon size={12}/> {formatNumber(fuelUsed)} لتر
          </span>
        )}
      </div>

      {notes && (
        <p className="text-xs text-gray-500 mb-3 bg-surface-2 rounded-lg px-3 py-2">{notes}</p>
      )}

      <div className="flex gap-2 mb-2">
        <FinancialPill label="إيراد" value={formatCurrency(revenue)}  color="text-amber-400"/>
        <FinancialPill label="وقود"  value={formatCurrency(fuelCost)} color="text-red-400"/>
        <FinancialPill label="ربح"   value={formatCurrency(profit)}   color={profit>=0?"text-green-400":"text-red-400"}/>
      </div>

      {revenue > 0 && (
        <>
          <div className="flex gap-2 mb-1">
            <FinancialPill label="مدفوع" value={formatCurrency(amountPaid||0)}     color="text-green-400"/>
            <FinancialPill label="متبقي" value={formatCurrency(remainingAmount||0)} color={remainingAmount>0?"text-amber-400":"text-gray-500"}/>
          </div>

          {jobPayments.length > 0 && (
            <button
              className="w-full text-xs text-brand-400 hover:text-brand-300 mt-1 py-1 transition-colors text-right"
              onClick={() => setShowPayments((s) => !s)}
            >
              {showPayments ? "إخفاء" : `عرض ${jobPayments.length} دفعة`} ←
            </button>
          )}

          {showPayments && (
            <div className="mt-2 px-2 border-t border-white/8 pt-2 space-y-2">
              {jobPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <CalendarIcon size={11}/>
                    <span>{formatDateShort(p.date)}</span>
                    {p.notes && <span>· {p.notes}</span>}
                  </div>
                  <span className="font-bold text-green-400">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {fuelPriceMissing && (
        <p className="text-[10px] text-gray-600 mt-2">
          * سعر الوقود وقت العملية دي مش محفوظ، فمتكلفتش هنا.
        </p>
      )}
    </Card>
  );
};

/**
 * صفحة قراءة-بس عامة لأي قسم من guestSectionsConfig.js — كروت بدل جدول.
 * قسم jobs فيه منطق فلترة عملاء خاص (allowedClients) وبيتحمّل بجانبه
 * المدفوعات (مسموحة أصلاً تحت نفس صلاحية 'jobs' في firestore.rules) +
 * أسماء المعدة/السائق (بس لو قسميهم مفعّلين للضيف — قراءة مشروطة، صفر
 * صلاحية جديدة). قسم suppliers مختلف تمامًا: بيتحمّل من فاتورتين/مدفوعات
 * وبيتجمّع لكل مورد — راجع GUEST_ACCESS_DESIGN.md في المشروع للتفاصيل.
 */
const GuestSectionPage = ({ section }) => {
  const { ownerUid, isSectionOpen, access } = useGuest();
  const config = GUEST_SECTIONS[section];
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [driverList, setDriverList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const allowed = isSectionOpen(section);
  const isSuppliers = section === "suppliers";
  const isJobs = section === "jobs";
  const equipmentOpen = isSectionOpen("equipment");
  const driversOpen = isSectionOpen("drivers");

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

    if (isJobs) {
      // Payments are queried only for the already-authorized job ids.
      // equipment/drivers بيتحملوا بس لو قسمهم مفعّل للضيف فعليًا،
      // عشان لو مقفول ميحصلش أي محاولة قراءة (permission-denied).
      let jobsLoaded = false, paysLoaded = false;
      const maybeDone = () => { if (jobsLoaded && paysLoaded) setLoading(false); };
      let unsubPay = () => {};
      const unsubJobs = guestAccessService.subscribeGuestJobs(
        ownerUid, access?.allowedClients,
        (list) => {
          setItems(list);
          jobsLoaded = true;
          paysLoaded = false;
          unsubPay();
          unsubPay = paymentService.subscribeByJobIds(
            ownerUid,
            list.map((job) => job.id),
            (paymentList) => { setPayments(paymentList); paysLoaded = true; maybeDone(); },
            (err) => { setError(err); paysLoaded = true; maybeDone(); }
          );
          maybeDone();
        },
        (err) => { setError(err); jobsLoaded = true; paysLoaded = true; maybeDone(); }
      );
      let unsubEquip = () => {};
      if (equipmentOpen) {
        unsubEquip = equipmentService.subscribe(ownerUid, setEquipmentList, () => {});
      } else {
        setEquipmentList([]);
      }
      let unsubDrv = () => {};
      if (driversOpen) {
        unsubDrv = driverService.subscribe(ownerUid, setDriverList, () => {});
      } else {
        setDriverList([]);
      }
      return () => { unsubJobs(); unsubPay(); unsubEquip(); unsubDrv(); };
    }

    const onData = (list) => { setItems(list); setLoading(false); };
    const onError = (err) => { setError(err); setLoading(false); };
    const unsubscribe = config.service.subscribe(ownerUid, onData, onError);
    return unsubscribe;
  }, [allowed, ownerUid, section, config, access, isSuppliers, isJobs, equipmentOpen, driversOpen]);

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

  // إثراء كل عملية شغل بنفس حقول useJobs.js بالظبط (revenue/fuelCost/
  // profit/amountPaid/remainingAmount/paymentStatus) — بدون أي fallback
  // لسعر وقود الإعدادات (settings.fuelPrice) لأن الضيف مفيش عنده صلاحية
  // قراءة meta/settings أصلاً؛ لو عملية قديمة ناقصة fuelPriceAtJob
  // بيتعتبر سعر وقودها "غير معروف" (تكلفة وقود = 0 لهذه العملية بس) بدل
  // ما نطلب صلاحية جديدة على meta/settings.
  const enrichedJobs = useMemo(() => {
    if (!isJobs) return [];
    return items.map((job) => {
      const revenue = calcRevenue(job.acres, job.pricePerAcre);
      const hasFuelPrice = job.fuelPriceAtJob != null;
      const fuelCost = hasFuelPrice ? calcFuelCost(job.fuelUsed, job.fuelPriceAtJob) : 0;
      const profit = revenue - fuelCost;
      const amountPaid = getJobPaidAmount(job, payments);
      const remainingAmount = calcRemainingAmount(revenue, amountPaid);
      const paymentStatus = derivePaymentStatus(revenue, amountPaid);
      const jobPayments = payments.filter((p) => p.jobId === job.id);
      return {
        ...job, revenue, fuelCost, profit, amountPaid, remainingAmount, paymentStatus,
        jobPayments, fuelPriceMissing: !hasFuelPrice && Number(job.fuelUsed) > 0,
      };
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [isJobs, items, payments]);

  const equipmentNameById = useMemo(
    () => new Map(equipmentList.map((e) => [e.id, e.name])),
    [equipmentList]
  );
  const driverNameById = useMemo(
    () => new Map(driverList.map((d) => [d.id, d.name])),
    [driverList]
  );

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

  const rows = isSuppliers ? supplierSummaries : (isJobs ? enrichedJobs : items);

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
          : isJobs
          ? rows.map((job, i) => (
              <GuestJobCard
                key={job.id}
                job={job}
                equipmentName={equipmentNameById.get(job.equipmentId)}
                driverName={driverNameById.get(job.driverId)}
                delay={Math.min(i, 12) * 25}
              />
            ))
          : rows.map((item, i) => (
              <GuestItemCard key={item.id} config={config} item={item} delay={Math.min(i, 12) * 25} />
            ))}
      </div>
    </div>
  );
};

export default GuestSectionPage;
