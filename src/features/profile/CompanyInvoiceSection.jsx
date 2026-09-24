// src/features/profile/CompanyInvoiceSection.jsx
//
// قسم "بيانات الفاتورة الثابتة" — منقول هنا حرفيًا من ProfileModal.jsx
// من غير أي تغيير في السلوك أو الشكل.
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import { EditIcon, UploadFileIcon, TrashIcon, PrintIcon } from "../../components/ui/Icons";
import Section from "./Section";

// شعار الشركة بيتخزن كـ base64 جوه نفس مستند الإعدادات في Firestore (زي
// باقي بيانات الفاتورة) — من غير ما نحتاج Firebase Storage منفصل. عشان
// المستند يفضل صغير (وحد Firestore حوالي 1MB للمستند كله)، بنصغّر أي
// صورة مرفوعة لمقاس مصغّر (256px) ونحولها JPEG بجودة متوسطة قبل التخزين،
// فبيبقى حجمها كام كيلوبايت بس مهما كانت الصورة الأصلية كبيرة.
const MAX_LOGO_DIM = 256;
const resizeImageToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error("الملف ده مش صورة صالحة"));
    img.onload = () => {
      const scale = Math.min(1, MAX_LOGO_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// ── Company invoice info (fixed data reused on every printed invoice) ──
const INVOICE_FIELDS = [
  { key: "name",              label: "اسم الشركة / المزرعة",  placeholder: "مزرعة الأمل لتأجير المعدات الزراعية" },
  { key: "phone",             label: "رقم الهاتف",            placeholder: "أدخل رقم الهاتف", dir: "ltr" },
  { key: "address",           label: "العنوان",                placeholder: "كفر الشيخ، طريق دسوق الزراعي" },
  { key: "commercialRegister", label: "السجل التجاري",         placeholder: "١٢٣٤٥" },
  { key: "taxNumber",         label: "الرقم الضريبي",          placeholder: "٦٠٠-١٢٣-٤٥٦" },
];

const CompanyInvoiceSection = ({ user, settings, saveSettings }) => {
  const [form, setForm] = useState({
    name: "", phone: "", address: "", commercialRegister: "", taxNumber: "", logo: "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setForm({
      name: settings?.company?.name || "",
      phone: settings?.company?.phone || "",
      address: settings?.company?.address || "",
      commercialRegister: settings?.company?.commercialRegister || "",
      taxNumber: settings?.company?.taxNumber || "",
      logo: settings?.company?.logo || "",
    });
  }, [settings, user]);

  const save = async (overrides) => {
    setSaving(true);
    try {
      const next = { ...form, ...overrides };
      await saveSettings({ company: next });
      setForm(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("لازم تختار ملف صورة");
    setUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      // الشعار بيتحفظ فورًا (من غير ما نستنى زرار "حفظ") زي أي رفع صورة عادي
      await saveSettings({ company: { ...form, logo: dataUrl } });
      setForm((s) => ({ ...s, logo: dataUrl }));
      // رسالة النجاح (أو "تم الحفظ على الجهاز") بتيجي من saveSettings نفسه (Step 3)
    } catch (err) {
      toast.error(err.message || "تعذر رفع الشعار");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    setUploadingLogo(true);
    try {
      await saveSettings({ company: { ...form, logo: "" } });
      setForm((s) => ({ ...s, logo: "" }));
    } catch (err) {
      toast.error("تعذر حذف الشعار");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <Section icon={<PrintIcon size={16} />} title="بيانات الفاتورة الثابتة">
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        البيانات دي بتتحفظ مرة واحدة وتتحط تلقائيًا في كل فاتورة تطبعها أو تنزّلها — مفيش داعي تكتبها كل مرة.
      </p>

      {/* ── Company logo ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-xl bg-surface-3 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {form.logo ? (
            <img src={form.logo} alt="شعار الشركة" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-gray-500 text-center px-1">لا يوجد شعار</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 cursor-pointer">
            <UploadFileIcon size={14} />
            {uploadingLogo ? "جاري الرفع..." : form.logo ? "تغيير الشعار" : "رفع شعار الشركة"}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={onLogoChange} />
          </label>
          {form.logo && (
            <button type="button" onClick={removeLogo} disabled={uploadingLogo}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400">
              <TrashIcon size={12} /> حذف الشعار
            </button>
          )}
          <p className="text-[10px] text-gray-500 leading-relaxed">هيظهر تلقائيًا أعلى كل فاتورة بدل حروف اسم الشركة.</p>
        </div>
      </div>

      <div className="space-y-3">
        {INVOICE_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 tracking-wide">{f.label}</label>
            <input
              type="text"
              dir={f.dir}
              disabled={!editing}
              value={form[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full bg-surface-3 border border-white/10 rounded-xl px-4 py-2.5 text-gray-100 placeholder-gray-600 text-sm
                transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600
                disabled:opacity-60"
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        {editing ? (
          <Button type="button" size="sm" className="w-full" loading={saving} onClick={() => save()}>
            حفظ بيانات الفاتورة
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" className="w-full"
            icon={<EditIcon size={15} />} onClick={() => setEditing(true)}>
            تعديل بيانات الفاتورة
          </Button>
        )}
      </div>
    </Section>
  );
};

export default CompanyInvoiceSection;
