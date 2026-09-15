// src/features/clients/ClientCard.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, ProgressBar } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { formatCurrency, formatNumber, getInitial } from "../../utils/formatters";
import { PlusIcon, ClipboardIcon, ClockIcon, CheckCircleIcon } from "../../components/ui/Icons";
import { CONTACT_TYPE } from "../../config/constants";
import { useData } from "../../contexts/DataContext";
import { useClients } from "../../hooks/useClients";
import { useContacts } from "../../hooks/useContacts";
import WhatsAppAction from "../messaging/WhatsAppAction";
import ContactPhoneField from "../messaging/ContactPhoneField";
import {
  buildClientStatementText, buildClientReminderText, buildClientThanksText,
} from "../../utils/messageTemplates";

const ClientCard = ({ client, onQuickPayment }) => {
  const navigate = useNavigate();
  const {
    client: name,
    totalRevenue = 0, totalAcres = 0,
    totalPaid = 0, totalRemaining = 0,
    ops = 0,
  } = client;

  const { settings } = useData();
  const { getClientSummary } = useClients();
  const { getPhone } = useContacts();
  const phone = getPhone(name, CONTACT_TYPE.CLIENT);

  // القوالب بترجع دالة (build) بتتنادى بس لما يتختار القالب فعليًا — عشان
  // getClientSummary (اللي بتلف على كل jobs العميل) ما تتحسبش إلا وقت
  // الحاجة الفعلية، مش على كل render.
  const whatsappTemplates = useMemo(() => {
    const companyName = settings?.company?.name || "";
    const totals = { totalRevenue, totalPaid, totalRemaining };
    return [
      {
        key: "statement", label: "كشف حساب", icon: <ClipboardIcon size={15} />,
        build: () => buildClientStatementText({ clientName: name, jobs: getClientSummary(name).jobs, totals, companyName }),
      },
      {
        key: "reminder", label: "تذكير بالمستحق", icon: <ClockIcon size={15} />,
        build: () => buildClientReminderText({ clientName: name, totalRemaining, companyName }),
      },
      {
        key: "thanks", label: "شكر على التعامل", icon: <CheckCircleIcon size={15} />,
        build: () => buildClientThanksText({ clientName: name, companyName }),
      },
    ];
  }, [name, totalRevenue, totalPaid, totalRemaining, settings, getClientSummary]);

  const paidPct = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 100;
  const hasDebt = totalRemaining > 0;

  return (
    <Card hover>
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold flex-shrink-0 ${
            hasDebt ? "bg-amber-900/30 border border-amber-800/40 text-amber-300"
                    : "bg-green-900/30 border border-green-800/40 text-green-300"
          }`}>
            {getInitial(name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-gray-100 truncate">{name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{ops} عملية</p>

            <div className="flex gap-4 mt-3 flex-wrap">
              {[
                { label:"إيراد",  value:formatCurrency(totalRevenue),  color:"text-amber-400" },
                { label:"أفدنة",  value:`${formatNumber(totalAcres)} ف`, color:"text-blue-400" },
                { label:"مدفوع", value:formatCurrency(totalPaid),       color:"text-green-400" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <span className={`text-sm font-extrabold ${s.color}`}>{s.value}</span>
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Debt progress */}
            {totalRevenue > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">نسبة السداد</span>
                  <span className={`font-bold ${hasDebt ? "text-amber-400" : "text-green-400"}`}>
                    {paidPct.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={paidPct} max={100}
                  color={hasDebt ? "bg-amber-500" : "bg-green-500"}/>
                {hasDebt && (
                  <p className="text-xs text-amber-400 font-bold mt-1">
                    متبقي: {formatCurrency(totalRemaining)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Details button */}
          <Button variant="ghost" size="xs" className="flex-shrink-0"
            onClick={() => navigate(`/clients/${encodeURIComponent(name)}`)}>
            تفاصيل
          </Button>
        </div>

        {/* رقم التواصل + واتساب */}
        <div className="mt-4 pt-3 border-t border-white/8 flex flex-col gap-2">
          <ContactPhoneField name={name} type={CONTACT_TYPE.CLIENT} phone={phone} />
          {phone && <WhatsAppAction phone={phone} templates={whatsappTemplates} />}
        </div>

        {/* Quick payment button — only if has debt */}
        {hasDebt && (
          <div className="mt-3 pt-3 border-t border-white/8">
            <button
              onClick={onQuickPayment}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-900/20 border border-amber-800/40 text-amber-400 text-xs font-bold hover:bg-amber-900/40 transition-colors"
            >
              <PlusIcon size={14}/>
              استلام دفعة — {formatCurrency(totalRemaining)} متبقي
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ClientCard;
