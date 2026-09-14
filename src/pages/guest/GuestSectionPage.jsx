// src/pages/guest/GuestSectionPage.jsx
import React, { useEffect, useState } from "react";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { GUEST_SECTIONS } from "./guestSectionsConfig";
import { EmptyState } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { LockIcon, SearchIcon } from "../../components/ui/Icons";

/**
 * صفحة قراءة-بس عامة لأي قسم من guestSectionsConfig.js. قسم jobs فيه
 * منطق فلترة عملاء خاص (allowedClients) فبيتحمّل عن طريق
 * guestAccessService.subscribeGuestJobs بدل service.subscribe العادي.
 */
const GuestSectionPage = ({ section }) => {
  const { ownerUid, isSectionOpen, access } = useGuest();
  const config = GUEST_SECTIONS[section];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const allowed = isSectionOpen(section);

  useEffect(() => {
    if (!allowed || !ownerUid) { setLoading(false); return; }
    setLoading(true);
    const onData = (list) => { setItems(list); setLoading(false); };
    const onError = (err) => { setError(err); setLoading(false); };

    const unsubscribe = section === "jobs"
      ? guestAccessService.subscribeGuestJobs(ownerUid, access?.allowedClients, onData, onError)
      : config.service.subscribe(ownerUid, onData, onError);

    return unsubscribe;
  }, [allowed, ownerUid, section, config, access]);

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

  if (items.length === 0) {
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
        <span className="text-xs text-gray-500 tabular-nums">({items.length})</span>
      </div>
      {config.note && <p className="text-xs text-gray-500 mb-4">{config.note}</p>}
      <div className="bg-surface border border-white/8 rounded-2xl overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-gray-500 text-[11px] uppercase tracking-wide">
              {config.columns.map((c) => (
                <th key={c.key} className="text-right font-semibold px-4 py-3 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                {config.columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 whitespace-nowrap ${
                      c.numeric ? "tabular-nums text-gray-100 font-semibold" : "text-gray-300"
                    }`}
                  >
                    {c.format ? c.format(item[c.key]) : (item[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GuestSectionPage;
