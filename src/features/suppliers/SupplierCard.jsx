// src/features/suppliers/SupplierCard.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, ProgressBar } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { formatCurrency, getInitial } from "../../utils/formatters";
import { PlusIcon, ClipboardIcon, ClockIcon, CheckCircleIcon } from "../../components/ui/Icons";
import { CONTACT_TYPE } from "../../config/constants";
import { useData } from "../../contexts/DataContext";
import { useSuppliers } from "../../hooks/useSuppliers";
import { useContacts } from "../../hooks/useContacts";
import WhatsAppAction from "../messaging/WhatsAppAction";
import ContactPhoneField from "../messaging/ContactPhoneField";
import {
  buildSupplierStatementText, buildSupplierReminderText, buildSupplierThanksText,
} from "../../utils/messageTemplates";

const SupplierCard = ({ supplier, onQuickPayment }) => {
  const navigate = useNavigate();
  const {
    supplierName: name,
    totalInvoiced = 0, totalPaidOut = 0, totalPayable = 0,
    ops = 0,
  } = supplier;

  const { settings } = useData();
  const { getSupplierSummary } = useSuppliers();
  const { getPhone } = useContacts();
  const phone = getPhone(name, CONTACT_TYPE.SUPPLIER);

  const whatsappTemplates = useMemo(() => {
    const companyName = settings?.company?.name || "";
    const totals = { totalInvoiced, totalPaidOut, totalPayable };
    return [
      {
        key: "statement", label: "كشف حساب", icon: <ClipboardIcon size={15} />,
        build: () => buildSupplierStatementText({ supplierName: name, invoices: getSupplierSummary(name).invoices, totals, companyName }),
      },
      {
        key: "reminder", label: "تذكير بالمستحق", icon: <ClockIcon size={15} />,
        build: () => buildSupplierReminderText({ supplierName: name, totalPayable, companyName }),
      },
      {
        key: "thanks", label: "شكر على التعامل", icon: <CheckCircleIcon size={15} />,
        build: () => buildSupplierThanksText({ supplierName: name, companyName }),
      },
    ];
  }, [name, totalInvoiced, totalPaidOut, totalPayable, settings, getSupplierSummary]);

  const paidPct = totalInvoiced > 0 ? (totalPaidOut / totalInvoiced) * 100 : 100;
  const hasPayable = totalPayable > 0;

  return (
    <Card hover>
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold flex-shrink-0 ${
            hasPayable ? "bg-red-900/30 border border-red-800/40 text-red-300"
                       : "bg-green-900/30 border border-green-800/40 text-green-300"
          }`}>
            {getInitial(name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-gray-100 truncate">{name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{ops} فاتورة</p>

            <div className="flex gap-4 mt-3 flex-wrap">
              {[
                { label:"إجمالي المستحق", value:formatCurrency(totalInvoiced), color:"text-amber-400" },
                { label:"مدفوع له",       value:formatCurrency(totalPaidOut),  color:"text-green-400" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <span className={`text-sm font-extrabold ${s.color}`}>{s.value}</span>
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Payable progress */}
            {totalInvoiced > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">نسبة السداد له</span>
                  <span className={`font-bold ${hasPayable ? "text-red-400" : "text-green-400"}`}>
                    {paidPct.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={paidPct} max={100}
                  color={hasPayable ? "bg-red-500" : "bg-green-500"}/>
                {hasPayable && (
                  <p className="text-xs text-red-400 font-bold mt-1">
                    باقي عليك: {formatCurrency(totalPayable)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Details button */}
          <Button variant="ghost" size="xs" className="flex-shrink-0"
            onClick={() => navigate(`/suppliers/${encodeURIComponent(name)}`)}>
            تفاصيل
          </Button>
        </div>

        {/* رقم التواصل + واتساب */}
        <div className="mt-4 pt-3 border-t border-white/8 flex flex-col gap-2">
          <ContactPhoneField name={name} type={CONTACT_TYPE.SUPPLIER} phone={phone} />
          {phone && <WhatsAppAction phone={phone} templates={whatsappTemplates} />}
        </div>

        {/* Quick payment button — only if we still owe them */}
        {hasPayable && (
          <div className="mt-3 pt-3 border-t border-white/8">
            <button
              onClick={onQuickPayment}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-xs font-bold hover:bg-red-900/40 transition-colors"
            >
              <PlusIcon size={14}/>
              تسجيل دفعة — {formatCurrency(totalPayable)} متبقي
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SupplierCard;
