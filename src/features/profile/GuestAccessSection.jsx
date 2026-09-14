// src/features/profile/GuestAccessSection.jsx
//
// تاب "الوصول للضيوف" في صفحة الملف الشخصي (Phase 3) — إنشاء/إلغاء/تمديد/
// حذف أكواد guestAccess. كل الحماية الفعلية في firestore.rules (شوف
// isValidNewGuestAccess/isValidOwnerGuestAccessUpdate هناك) — الواجهة دي
// بس بتبني الحقول الصح وتعرض حالة كل كود. راجع GUEST_ACCESS_DESIGN.md في
// المشروع لتفاصيل القرارات (شكل التوكن، حد الـ30 عميل، سويتش البيانات
// المالية = مستوى القسم كامل).
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { useAuth } from "../../contexts/AuthContext";
import { useClients } from "../../hooks/useClients";
import { guestAccessService } from "../../services/guestAccessService";
import { computeStatus } from "../../contexts/GuestContext";
import { NAV_ITEMS } from "../../components/layout/GuestSidebar";
import { formatDateTime } from "../../utils/formatters";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Section from "./Section";
import {
  UsersGroupIcon, PlusIcon, LinkIcon, TrashIcon, ClockIcon, XCircleIcon,
  SendIcon, AlertIcon,
} from "../../components/ui/Icons";

// حد Firestore الأقصى لقيم where(field,'in',array) — لو المالك اختار أكتر
// من كده، الفلترة هترفض الطلب بالكامل مش هتقصّه لأول 30 (شوف
// guestAccessService.subscribeGuestJobs). القاعدة نفسها (firestore.rules)
// بتسمح بحد 500 structurally، بس القيمة المفيدة عمليًا 30 بسبب حد الـ
// query — فبنمنع اختيار أكتر من كده من الأساس هنا.
const MAX_ALLOWED_CLIENTS = 30;

// قوالب جاهزة (Phase 4) — بس بتملى اختيار الأقسام في الفورم، مفيش أي
// حفظ إضافي أو حقل جديد؛ المالك لسه يقدر يعدّل بعد ما يختار القالب.
const TEMPLATES = [
  { id: "accountant", label: "قالب: محاسب",     sections: ["jobs", "custody", "taxDeductions", "suppliers"] },
  { id: "supplier",   label: "قالب: مورد",       sections: ["suppliers"] },
  { id: "partner",    label: "قالب: شريك/مستثمر", sections: ["equipment", "jobs", "drivers", "maintenance", "custody", "taxDeductions", "suppliers"] },
  { id: "team",       label: "قالب: متابعة الفريق", sections: ["drivers", "equipment", "maintenance"] },
];

// عتبة "هينتهي قريب" (Phase 4) — للعرض بس في ليستة الأكواد، مش قاعدة
// حماية. نص يوم كافي إنه يبقى تنبيه مفيد من غير ما يبقى مزعج على أكواد
// مدتها أسابيع.
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;
const isExpiringSoon = (access, status) => {
  if (status !== "active") return false;
  const until = access.validUntil?.toMillis?.() ?? new Date(access.validUntil).getTime();
  return until - Date.now() <= EXPIRING_SOON_MS;
};

const pad = (n) => String(n).padStart(2, "0");
const toDatetimeLocal = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const defaultValidUntil = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
};

// تحويل وقت محلي (HH:MM من input[type=time]) لدقايق UTC من نص الليل —
// مطابق تمامًا لما firestore.rules متوقعة (dailyStartMinute/dailyEndMinute
// — راجع withinDailyWindow هناك). معتمد على فرق توقيت المتصفح وقت
// الإنشاء؛ لو الشركة غيّرت توقيت صيفي/شتوي بعد كده، النافذة المخزّنة
// (UTC) بتفضل ثابتة زي ما كانت — قرار موثّق في GUEST_ACCESS_DESIGN.md.
const localTimeToUtcMinute = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const offset = new Date().getTimezoneOffset();
  return (((h * 60 + m) + offset) % 1440 + 1440) % 1440;
};

const emptySections = () => {
  const s = {};
  NAV_ITEMS.forEach(({ section }) => { s[section] = false; });
  return s;
};

const emptyForm = () => ({
  name: "",
  validFrom: toDatetimeLocal(new Date()),
  validUntil: toDatetimeLocal(defaultValidUntil()),
  sections: emptySections(),
  dailyEnabled: false,
  dailyStart: "08:00",
  dailyEnd: "17:00",
  clientMode: "all", // "all" | "specific"
  selectedClients: [],
});

const STATUS_LABELS = {
  active:                { label: "شغّال دلوقتي",               cls: "bg-green-900/40 text-green-400 border-green-800/50" },
  not_started:           { label: "لسه ماوصلش وقته",             cls: "bg-blue-900/40 text-blue-400 border-blue-800/50" },
  expired:               { label: "انتهى",                       cls: "bg-gray-800 text-gray-400 border-white/10" },
  cancelled:             { label: "ملغي",                        cls: "bg-red-900/40 text-red-400 border-red-800/50" },
  outside_daily_window:  { label: "بره ساعات اليوم المسموحة",    cls: "bg-amber-900/40 text-amber-400 border-amber-800/50" },
};

const GuestAccessSection = () => {
  const { user } = useAuth();
  const { clients } = useClients();
  const ownerUid = user.uid;

  const [codes, setCodes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null); // { id, validUntil }
  const [form, setForm]           = useState(emptyForm);
  const [qrLink, setQrLink]       = useState(null); // الرابط المعروض في مودال الـQR، أو null لو مقفول
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = guestAccessService.subscribeOwnerCodes(
      ownerUid,
      (rows) => { setCodes(rows); setLoading(false); },
      () => { toast.error("تعذر تحميل أكواد الوصول"); setLoading(false); }
    );
    return unsub;
  }, [ownerUid]);

  // توليد QR للرابط المفتوح حاليًا في المودال — best-effort، لو فشل
  // (نادر جدًا لمكتبة بتشتغل local بالكامل) بنسيب المودال يعرض الرابط
  // نفسه كـfallback (شوف الـJSX تحت) بدل ما يبقى فاضي.
  useEffect(() => {
    if (!qrLink) { setQrDataUrl(null); return; }
    let cancelled = false;
    QRCode.toDataURL(qrLink, { margin: 1, width: 240 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) toast.error("تعذر توليد QR — استخدم الرابط بدل كده"); });
    return () => { cancelled = true; };
  }, [qrLink]);

  const jobsSelected = form.sections.jobs;
  const buildLink = (code) => `${window.location.origin}/guest?token=${ownerUid}:${code}`;
  const buildWhatsAppLink = (link) => {
    const company = user.displayName || "الحساب";
    const message = `مرحبًا، ده رابط دخولك كضيف على ${company} في زراعي برو (قراءة فقط):\n${link}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const applyTemplate = (template) =>
    setForm((f) => {
      const sections = emptySections();
      template.sections.forEach((s) => { sections[s] = true; });
      return { ...f, sections, clientMode: "all", selectedClients: [] };
    });

  const toggleSection = (section) =>
    setForm((f) => ({ ...f, sections: { ...f.sections, [section]: !f.sections[section] } }));

  const toggleClient = (name) =>
    setForm((f) => {
      const has = f.selectedClients.includes(name);
      if (!has && f.selectedClients.length >= MAX_ALLOWED_CLIENTS) {
        toast.error(`أقصى عدد عملاء لكود واحد ${MAX_ALLOWED_CLIENTS}`);
        return f;
      }
      return { ...f, selectedClients: has ? f.selectedClients.filter((c) => c !== name) : [...f.selectedClients, name] };
    });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("اكتب اسم للكود (زي: المحاسب أحمد)");
    if (!Object.values(form.sections).some(Boolean)) return toast.error("اختار قسم واحد على الأقل");

    const validFrom  = new Date(form.validFrom);
    const validUntil = new Date(form.validUntil);
    if (!(validUntil > validFrom)) return toast.error("وقت الانتهاء لازم يكون بعد وقت البداية");

    let dailyStartMinute, dailyEndMinute;
    if (form.dailyEnabled) {
      dailyStartMinute = localTimeToUtcMinute(form.dailyStart);
      dailyEndMinute   = localTimeToUtcMinute(form.dailyEnd);
      if (dailyStartMinute >= dailyEndMinute) {
        return toast.error("ساعة البداية لازم تكون قبل ساعة النهاية، ومينفعش النافذة تعدي نص الليل");
      }
    }

    if (jobsSelected && form.clientMode === "specific" && form.selectedClients.length === 0) {
      return toast.error("اختار عميل واحد على الأقل أو رجّع لـ'كل العملاء'");
    }

    const sections = {};
    NAV_ITEMS.forEach(({ section }) => {
      // القرار المتفق عليه: سويتش "إظهار القسم" و"إظهار بياناته المالية"
      // بيتحطوا مع بعض دايمًا — Firestore Rules مقدرش يخفي أرقام بعينها
      // جوه قسم ظاهر، فمفيش فايدة حقيقية من فصلهم هنا (راجع
      // GUEST_ACCESS_DESIGN.md، وsectionOpen في firestore.rules).
      sections[section] = { enabled: !!form.sections[section], financial: !!form.sections[section] };
    });

    setCreating(true);
    try {
      const payload = { name: form.name.trim(), validFrom, validUntil, sections };
      if (form.dailyEnabled) { payload.dailyStartMinute = dailyStartMinute; payload.dailyEndMinute = dailyEndMinute; }
      if (jobsSelected && form.clientMode === "specific") payload.allowedClients = form.selectedClients;

      const code = await guestAccessService.createCode(ownerUid, payload);
      setCreatedLink(buildLink(code));
      toast.success("تم إنشاء الكود");
      setForm(emptyForm());
    } catch {
      toast.error("تعذر إنشاء الكود");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("تعذر النسخ — انسخ الرابط يدويًا");
    }
  };

  const handleCancel = async (code) => {
    try {
      await guestAccessService.updateCode(ownerUid, code, { cancelled: true });
      toast.success("تم إلغاء الكود");
    } catch {
      toast.error("تعذر إلغاء الكود");
    }
  };

  const handleDelete = async (code) => {
    try {
      await guestAccessService.deleteCode(ownerUid, code);
      toast.success("تم حذف الكود");
    } catch {
      toast.error("تعذر حذف الكود");
    }
  };

  const handleExtend = async () => {
    if (!extendTarget) return;
    const validUntil = new Date(extendTarget.validUntil);
    if (isNaN(validUntil.getTime())) return toast.error("تاريخ غير صالح");
    try {
      await guestAccessService.updateCode(ownerUid, extendTarget.id, { validUntil });
      toast.success("تم تمديد الصلاحية");
      setExtendTarget(null);
    } catch {
      toast.error("تعذر التمديد");
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <Section icon={<UsersGroupIcon size={16} />} title="إنشاء كود وصول جديد">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5 block">
              قوالب جاهزة (اختياري — بس بتملى الأقسام، تقدر تعدّل بعدها)
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button type="button" key={t.id} onClick={() => applyTemplate(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-3 text-gray-300 hover:bg-brand-900/40 hover:text-brand-300 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="اسم الكود (يساعدك تتعرف عليه بعدين)"
            placeholder="مثال: المحاسب أحمد"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input type="datetime-local" label="صالح من" value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
            <Input type="datetime-local" label="صالح لغاية" value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5 block">
              الأقسام المتاحة (إظهار قسم = إظهاره ببياناته المالية كاملة)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NAV_ITEMS.map(({ section, label, Icon }) => (
                <button
                  type="button" key={section} onClick={() => toggleSection(section)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    form.sections[section]
                      ? "bg-brand-900/40 border-brand-700/50 text-brand-300"
                      : "bg-surface-2 border-white/10 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {jobsSelected && (
            <div className="bg-surface-2 border border-white/8 rounded-xl p-3 space-y-2">
              <label className="text-xs font-semibold text-gray-400 tracking-wide">عملاء قسم "سجل الشغل"</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, clientMode: "all" }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${form.clientMode === "all" ? "bg-brand-700 text-white" : "bg-surface-3 text-gray-400"}`}
                >كل العملاء</button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, clientMode: "specific" }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${form.clientMode === "specific" ? "bg-brand-700 text-white" : "bg-surface-3 text-gray-400"}`}
                >عملاء محددين</button>
              </div>
              {form.clientMode === "specific" && (
                <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                  {clients.length === 0 && <p className="text-xs text-gray-500">مفيش عملاء مسجلين لسه.</p>}
                  {clients.map((c) => (
                    <label key={c.client} className="flex items-center gap-2 text-xs text-gray-300 py-0.5">
                      <input type="checkbox" className="accent-brand-600"
                        checked={form.selectedClients.includes(c.client)}
                        onChange={() => toggleClient(c.client)} />
                      {c.client}
                    </label>
                  ))}
                  <p className="text-[11px] text-gray-500 pt-1">
                    {form.selectedClients.length}/{MAX_ALLOWED_CLIENTS} — حد Firestore الأقصى لفلترة العملاء دفعة واحدة.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-surface-2 border border-white/8 rounded-xl p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <input type="checkbox" className="accent-brand-600" checked={form.dailyEnabled}
                onChange={(e) => setForm((f) => ({ ...f, dailyEnabled: e.target.checked }))} />
              حد ساعات معينة كل يوم (اختياري)
            </label>
            {form.dailyEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Input type="time" label="من" value={form.dailyStart}
                  onChange={(e) => setForm((f) => ({ ...f, dailyStart: e.target.value }))} />
                <Input type="time" label="لحد" value={form.dailyEnd}
                  onChange={(e) => setForm((f) => ({ ...f, dailyEnd: e.target.value }))} />
              </div>
            )}
          </div>

          <Button type="submit" size="sm" loading={creating} icon={<PlusIcon size={16} />} className="w-full">
            إنشاء الكود
          </Button>
        </form>

        {createdLink && (
          <div className="mt-4 bg-green-900/20 border border-green-800/40 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <LinkIcon size={16} className="text-green-400 shrink-0" />
            <span className="text-xs text-green-300 truncate flex-1 min-w-[140px]" dir="ltr">{createdLink}</span>
            <Button type="button" size="xs" variant="secondary" onClick={() => copyLink(createdLink)}>نسخ</Button>
            <a href={buildWhatsAppLink(createdLink)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-green-700/80 hover:bg-green-600 text-white transition-colors">
              <SendIcon size={12} /> واتساب
            </a>
            <Button type="button" size="xs" variant="secondary" onClick={() => setQrLink(createdLink)}>QR</Button>
          </div>
        )}
      </Section>

      <Section icon={<ClockIcon size={16} />} title="الأكواد الحالية">
        {loading && <p className="text-xs text-gray-500">جاري التحميل...</p>}
        {!loading && codes.length === 0 && <p className="text-xs text-gray-500">لسه ماعملتش أي كود.</p>}
        <div className="space-y-2">
          {codes.map((c) => {
            const status = computeStatus(c);
            const badge = STATUS_LABELS[status] || STATUS_LABELS.expired;
            const expiringSoon = isExpiringSoon(c, status);
            const link = buildLink(c.id);
            return (
              <div key={c.id} className="bg-surface-2 border border-white/8 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-200 truncate">{c.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    {expiringSoon && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-900/40 text-amber-400 border-amber-800/50">
                        <AlertIcon size={10} /> هينتهي خلال يوم
                      </span>
                    )}
                    {c.redeemedByUid && (
                      <span className="text-[10px] text-gray-500">• أول دخول: {formatDateTime(c.redeemedAt)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    من {formatDateTime(c.validFrom)} لحد {formatDateTime(c.validUntil)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <Button type="button" size="xs" variant="secondary" icon={<LinkIcon size={12} />}
                    onClick={() => copyLink(link)}>نسخ الرابط</Button>
                  <a href={buildWhatsAppLink(link)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-700/80 hover:bg-green-600 text-white transition-colors">
                    <SendIcon size={12} />
                  </a>
                  <Button type="button" size="xs" variant="secondary" onClick={() => setQrLink(link)}>QR</Button>
                  {!c.cancelled && (
                    <Button type="button" size="xs" variant="secondary" onClick={() => setExtendTarget({
                      id: c.id,
                      validUntil: toDatetimeLocal(c.validUntil?.toDate?.() ?? new Date(c.validUntil)),
                    })}>تمديد</Button>
                  )}
                  {!c.cancelled && (
                    <Button type="button" size="xs" variant="danger" icon={<XCircleIcon size={12} />}
                      onClick={() => handleCancel(c.id)}>إلغاء</Button>
                  )}
                  <Button type="button" size="xs" variant="ghost" icon={<TrashIcon size={12} />}
                    onClick={() => handleDelete(c.id)} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Modal open={!!extendTarget} onClose={() => setExtendTarget(null)} title="تمديد صلاحية الكود" size="sm">
        {extendTarget && (
          <div className="space-y-4">
            <Input type="datetime-local" label="صالح لغاية" value={extendTarget.validUntil}
              onChange={(e) => setExtendTarget((t) => ({ ...t, validUntil: e.target.value }))} />
            <Button type="button" size="sm" className="w-full" onClick={handleExtend}>حفظ</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!qrLink} onClose={() => setQrLink(null)} title="QR كود الدخول" size="sm">
        {qrLink && (
          <div className="flex flex-col items-center gap-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR كود لرابط دخول الضيف" width={240} height={240}
                className="rounded-xl bg-white p-2" />
            ) : (
              <p className="text-xs text-gray-500 py-10">جاري توليد الـQR...</p>
            )}
            <p className="text-[11px] text-gray-500 text-center break-all" dir="ltr">{qrLink}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GuestAccessSection;
