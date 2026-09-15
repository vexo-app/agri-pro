// src/features/messaging/BulkSendDialog.jsx
//
// "إرسال جماعي" — بيظهر في صفحة فريق العمل بس (حسب السبيك). خطوتين:
//
// أ. فردي لكل واحد: تحديد الأعضاء + قالب واحد يتطبق على الكل، وبعدين
//    "طابور" — كل عضو بزرار "معاينة وإرسال" لوحده، بيفتح نفس Popup
//    المعاينة/التعديل العادي (MessagePreviewModal) قبل ما يتفتح واتساب بتاعه
//    هو تحديدًا. لازم يبقوا فتحات منفصلة بنقرة مستخدم فعلية لكل واحد
//    (المتصفح بيمنع فتح أكتر من تاب تلقائي من غير تفاعل مباشر).
//
// ب. جروب واحد: رسالة عامة موحدة. ⚠️ ملحوظة فنية مهمة: روابط جروبات واتساب
//    (chat.whatsapp.com/xxx) — بعكس wa.me/<رقم> — مش بتدعم تعبئة نص تلقائي
//    عن طريق ?text=. الحل الوحيد الشغّال فعليًا: نسخ النص للـclipboard +
//    فتح رابط الجروب، والمالك يلزقه هو بنفسه جوه واتساب.
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  UsersGroupIcon, LinkIcon, CheckCircleIcon, WhatsAppIcon, ClipboardIcon, InfoIcon,
} from "../../components/ui/Icons";
import { hasValidWhatsappPhone, buildWhatsappLink } from "../../utils/whatsapp";
import { copyToClipboard } from "../../utils/clipboard";
import { getDriverWhatsappTemplates } from "../drivers/driverWhatsappTemplates";
import { buildGroupReminderText, buildGroupThanksText } from "../../utils/messageTemplates";
import MessagePreviewModal from "./MessagePreviewModal";

const TEMPLATE_LABELS = [
  { key: "statement", label: "كشف حساب" },
  { key: "reminder",  label: "تذكير بالمستحق" },
  { key: "thanks",    label: "شكر على التعامل" },
  { key: "absence",   label: "تنبيه غياب" },
];

const GROUP_TEMPLATES = [
  { key: "reminder", label: "تذكير عام", build: buildGroupReminderText },
  { key: "thanks",   label: "شكر عام",   build: buildGroupThanksText },
];

const normalizeLink = (link) => {
  const trimmed = (link || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const BulkSendDialog = ({
  open, onClose, members, companyName, getMonthSummary, currentMonth, getDriverAttendance,
}) => {
  const [step, setStep] = useState("method"); // method | individual-select | individual-queue | group-compose
  const [method, setMethod] = useState(null); // "individual" | "group"
  const [groupLink, setGroupLink] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [templateKey, setTemplateKey] = useState("statement");
  const [sentIds, setSentIds] = useState(() => new Set());
  const [previewDriver, setPreviewDriver] = useState(null); // العضو الحالي في popup المعاينة
  const [groupText, setGroupText] = useState("");
  const [groupSent, setGroupSent] = useState(false);

  const membersWithPhone = useMemo(
    () => (members || []).filter((m) => hasValidWhatsappPhone(m.phone)),
    [members]
  );

  useEffect(() => {
    if (!open) return;
    setStep("method");
    setMethod(null);
    setGroupLink("");
    setSelectedIds(new Set(membersWithPhone.map((m) => m.id)));
    setTemplateKey("statement");
    setSentIds(new Set());
    setPreviewDriver(null);
    setGroupText("");
    setGroupSent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedMembers = membersWithPhone.filter((m) => selectedIds.has(m.id));

  const toggleMember = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === membersWithPhone.length ? new Set() : new Set(membersWithPhone.map((m) => m.id))
    );
  };

  const handleContinueFromMethod = () => {
    if (method === "individual") setStep("individual-select");
    else if (method === "group") {
      const template = GROUP_TEMPLATES.find((t) => t.key === "reminder");
      setGroupText(template.build({ companyName }));
      setStep("group-compose");
    }
  };

  const openPreviewFor = (driver) => {
    setPreviewDriver(driver);
  };

  const previewText = useMemo(() => {
    if (!previewDriver) return "";
    const templates = getDriverWhatsappTemplates({
      driver: previewDriver, getMonthSummary, currentMonth, getDriverAttendance, companyName,
    });
    return templates.find((t) => t.key === templateKey)?.build() || "";
  }, [previewDriver, templateKey, getMonthSummary, currentMonth, getDriverAttendance, companyName]);

  const handleSendToDriver = (finalText) => {
    window.open(buildWhatsappLink(previewDriver.phone, finalText), "_blank", "noopener,noreferrer");
    setSentIds((prev) => new Set(prev).add(previewDriver.id));
    setPreviewDriver(null);
  };

  const handleCopyAndOpenGroup = async () => {
    const ok = await copyToClipboard(groupText);
    if (ok) toast.success("اتنسخت الرسالة — الصقها جوه الجروب بعد ما يفتح");
    else toast.error("مقدرناش ننسخ الرسالة تلقائي، انسخها من الصندوق يدويًا");
    window.open(normalizeLink(groupLink), "_blank", "noopener,noreferrer");
    setGroupSent(true);
  };

  const title = {
    method:             "إرسال جماعي",
    "individual-select": "اختار الأعضاء والقالب",
    "individual-queue":  "إرسال الرسائل",
    "group-compose":     "الرسالة الجماعية",
  }[step];

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} size={step === "method" ? "sm" : "md"}>
        {step === "method" && (
          <div className="flex flex-col gap-3">
            {membersWithPhone.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                محدش من الأعضاء عنده رقم تليفون متسجل — سجّل رقم الأول من كارت العضو.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-500 leading-relaxed">
                  اختار طريقة الإرسال ({membersWithPhone.length} عضو عندهم رقم مسجل)
                </p>

                <button
                  type="button"
                  onClick={() => setMethod("individual")}
                  className={`flex items-start gap-3 text-right rounded-2xl p-3.5 border-[1.5px] transition-colors ${
                    method === "individual" ? "bg-brand-900/20 border-brand-600" : "bg-surface-2 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <UsersGroupIcon size={17} className="text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-gray-100">فردي لكل واحد</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      هيفتح واتساب لكل عضو لوحده، برسالته الشخصية على حسب بياناته هو
                    </div>
                  </div>
                </button>

                <div
                  className={`flex flex-col gap-2.5 rounded-2xl p-3.5 border-[1.5px] transition-colors ${
                    method === "group" ? "bg-green-900/15 border-green-600" : "bg-surface-2 border-white/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMethod("group")}
                    className="flex items-start gap-3 text-right"
                  >
                    <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center flex-shrink-0">
                      <LinkIcon size={17} className={method === "group" ? "text-green-400" : "text-gray-400"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-gray-100">جروب واحد</span>
                        {method === "group" && (
                          <div className="w-[18px] h-[18px] rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                            <CheckCircleIcon size={11} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        رسالة عامة موحدة تتبعت لجروب واتساب — مش كشف حساب شخصي
                      </div>
                    </div>
                  </button>

                  {method === "group" && (
                    <div className="flex flex-col gap-1.5 pr-[50px]">
                      <label className="text-[10.5px] font-bold text-gray-400">رابط جروب الواتساب</label>
                      <input
                        value={groupLink}
                        onChange={(e) => setGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        dir="ltr"
                        className="bg-surface-3 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100 text-left focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-1.5 text-gray-500 text-[10.5px] leading-relaxed mt-1">
                  <InfoIcon size={12} className="flex-shrink-0 mt-0.5" />
                  واتساب مابيسمحش بتعبئة النص تلقائي في روابط الجروبات — هنسخّلك الرسالة وتلزقها بنفسك بعد ما الجروب يفتح.
                </div>

                <Button
                  size="lg"
                  className="w-full !bg-green-600 hover:!bg-green-500 !shadow-green-900/40 mt-1"
                  icon={<WhatsAppIcon size={16} />}
                  disabled={!method || (method === "group" && !groupLink.trim())}
                  onClick={handleContinueFromMethod}
                >
                  متابعة
                </Button>
              </>
            )}
          </div>
        )}

        {step === "individual-select" && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400">القالب المطلوب إرساله للكل</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_LABELS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                      templateKey === t.key
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "bg-surface-2 border-white/10 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400">الأعضاء ({selectedIds.size} من {membersWithPhone.length})</span>
                <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-brand-400 hover:text-brand-300">
                  {selectedIds.size === membersWithPhone.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {membersWithPhone.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2.5 bg-surface-2 border border-white/8 rounded-xl px-3 py-2.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="w-4 h-4 accent-brand-600 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{m.name}</span>
                    <span className="text-[11px] text-gray-500 flex-shrink-0" style={{ direction: "ltr" }}>{m.phone}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("method")}>رجوع</Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={selectedIds.size === 0}
                onClick={() => setStep("individual-queue")}
              >
                متابعة ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        {step === "individual-queue" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500">
              تم إرسال {sentIds.size} من {selectedMembers.length} — دوس "معاينة وإرسال" لكل عضو لوحده
            </p>
            <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
              {selectedMembers.map((m) => {
                const sent = sentIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${
                      sent ? "bg-green-900/10 border-green-800/30" : "bg-surface-2 border-white/8"
                    }`}
                  >
                    <span className={`text-sm flex-1 min-w-0 truncate ${sent ? "text-gray-500 line-through" : "text-gray-200"}`}>
                      {m.name}
                    </span>
                    {sent ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-400 flex-shrink-0">
                        <CheckCircleIcon size={13} /> اتبعتت
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPreviewFor(m)}
                        className="text-[11px] font-bold text-brand-400 hover:text-brand-300 flex-shrink-0"
                      >
                        معاينة وإرسال
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("individual-select")}>رجوع</Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>إغلاق</Button>
            </div>
          </div>
        )}

        {step === "group-compose" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {GROUP_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setGroupText(t.build({ companyName }))}
                  className="text-xs font-bold px-3 py-2 rounded-xl border bg-surface-2 border-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={groupText}
              onChange={(e) => setGroupText(e.target.value)}
              dir="rtl"
              rows={10}
              className="w-full bg-surface-3 border border-white/10 rounded-xl px-4 py-3 text-gray-100 text-sm leading-7
                transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600 resize-none"
            />

            <div className="flex items-start gap-1.5 text-gray-500 text-[11px] leading-relaxed">
              <InfoIcon size={13} className="flex-shrink-0 mt-0.5" />
              هننسخ النص ده وهنفتحلك رابط الجروب في تاب جديد — الصقه بنفسك جوه واتساب (مفيش تعبئة تلقائية في روابط الجروبات).
            </div>

            {groupSent ? (
              <div className="flex items-center gap-2 text-green-400 text-sm font-bold justify-center py-2">
                <CheckCircleIcon size={16} /> اتفتح الجروب واتنسخت الرسالة
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full !bg-green-600 hover:!bg-green-500 !shadow-green-900/40"
                icon={<ClipboardIcon size={16} />}
                disabled={!groupText.trim()}
                onClick={handleCopyAndOpenGroup}
              >
                نسخ الرسالة وفتح الجروب
              </Button>
            )}

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("method")}>رجوع</Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

      <MessagePreviewModal
        open={previewDriver !== null}
        initialText={previewText}
        onClose={() => setPreviewDriver(null)}
        onSend={handleSendToDriver}
      />
    </>
  );
};

export default BulkSendDialog;
