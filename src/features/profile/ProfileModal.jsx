// src/features/profile/ProfileModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { useForm } from "react-hook-form";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { backupService } from "../../services/backupService";
import { exportService } from "../../services/exportService";
import { formatDateTime } from "../../utils/formatters";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import RestoreModal from "./RestoreModal";
import ImportModal from "./ImportModal";
import {
  LockIcon, CloudUploadIcon, EditIcon, SaveIcon,
  EyeIcon, EyeOffIcon, ClockIcon, RestoreIcon,
  DownloadIcon, UploadFileIcon, PrintIcon, TrashIcon,
} from "../../components/ui/Icons";

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
      toast.success("تم حفظ شعار الشركة");
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
      toast.success("تم حذف الشعار");
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

// ── Small section wrapper ───────────────────────────────────
const Section = ({ icon, title, children }) => (
  <div className="bg-surface-2 border border-white/8 rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-brand-400">{icon}</span>
      <h3 className="text-sm font-bold text-gray-200">{title}</h3>
    </div>
    {children}
  </div>
);

// ── Password input with show/hide toggle ────────────────────
const PasswordField = ({ label, error, register }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          className={`w-full bg-surface-3 border rounded-xl px-4 py-3 pl-11 text-gray-100 placeholder-gray-500 text-sm
            transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600
            ${error ? "border-red-500 focus:ring-red-500/50" : "border-white/10"}`}
          {...register}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

const ProfileModal = ({ open, onClose }) => {
  const { user }  = useAuth();
  const data      = useData();
  const { settings, saveSettings } = data;

  // ── Display name ───────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.displayName || "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { setName(user?.displayName || ""); }, [user, open]);

  const saveName = async () => {
    if (!name.trim()) return toast.error("الاسم لا يمكن أن يكون فارغًا");
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      toast.success("تم تحديث الاسم");
      setEditingName(false);
    } catch (err) {
      toast.error("تعذر تحديث الاسم");
    } finally {
      setSavingName(false);
    }
  };

  // ── Change password ─────────────────────────────────────
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm();

  const onChangePassword = async (form) => {
    try {
      const cred = EmailAuthProvider.credential(user.email, form.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, form.newPassword);
      toast.success("تم تغيير كلمة المرور بنجاح");
      reset();
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        toast.error("كلمة المرور الحالية غير صحيحة");
      } else if (err.code === "auth/weak-password") {
        toast.error("كلمة المرور الجديدة ضعيفة جدًا");
      } else {
        toast.error("تعذر تغيير كلمة المرور");
      }
    }
  };

  // ── Backup ───────────────────────────────────────────────
  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const lastExportKey = user ? `lastLocalExportAt:${user.uid}` : null;
  const [lastExportAt, setLastExportAt] = useState(
    () => (lastExportKey ? localStorage.getItem(lastExportKey) : null)
  );

  const loadMeta = useCallback(async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const m = await backupService.getMeta(user.uid);
      setMeta(m);
    } catch (err) {
      // silent — non-critical
    } finally {
      setLoadingMeta(false);
    }
  }, [user]);

  useEffect(() => { if (open) loadMeta(); }, [open, loadMeta]);

  const runBackupNow = async () => {
    if (!navigator.onLine) return toast.error("لازم تكون متصل بالإنترنت لعمل نسخة احتياطية");
    setBackingUp(true);
    try {
      await backupService.createBackup(user.uid, {
        equipment:     data.equipment,
        jobs:          data.jobs,
        drivers:       data.drivers,
        maintenance:   data.maintenance,
        payments:      data.payments,
        salaryEntries: data.salaryEntries,
        attendance:    data.attendance,
        custodyTransactions: data.custody,
        settings:      data.settings,
      });
      localStorage.setItem(`lastBackupAt:${user.uid}`, String(Date.now()));
      toast.success("تم عمل نسخة احتياطية بنجاح");
      loadMeta();
    } catch (err) {
      toast.error("تعذر عمل النسخة الاحتياطية");
    } finally {
      setBackingUp(false);
    }
  };

  // ── تنزيل نسخة على جهاز المستخدم (بره Firebase تمامًا) ──────
  const downloadLocalBackup = () => {
    setExporting(true);
    try {
      exportService.downloadBackupFile({
        equipment:     data.equipment,
        jobs:          data.jobs,
        drivers:       data.drivers,
        maintenance:   data.maintenance,
        payments:      data.payments,
        salaryEntries: data.salaryEntries,
        attendance:    data.attendance,
        custodyTransactions: data.custody,
        settings:      data.settings,
      });
      const now = String(Date.now());
      if (lastExportKey) localStorage.setItem(lastExportKey, now);
      setLastExportAt(now);
      toast.success("اتنزّل ملف النسخة الاحتياطية على جهازك");
    } catch (err) {
      toast.error("تعذر تنزيل النسخة الاحتياطية");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="الملف الشخصي" size="md">
      <div className="space-y-5">

        {/* ── Identity ── */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {(user?.displayName || user?.email || "م").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
                />
                <button onClick={saveName} disabled={savingName}
                  className="text-brand-400 hover:text-brand-300 p-1.5 rounded-lg hover:bg-brand-900/30 flex-shrink-0">
                  <SaveIcon size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-gray-100 truncate">{user?.displayName || "المستخدم"}</p>
                <button onClick={() => setEditingName(true)}
                  className="text-gray-500 hover:text-brand-400 p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
                  <EditIcon size={13} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* ── Fixed invoice data (used on every printed invoice) ── */}
        <CompanyInvoiceSection user={user} settings={settings} saveSettings={saveSettings} />

        {/* ── Change password ── */}
        <Section icon={<LockIcon size={16} />} title="تغيير كلمة المرور">
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-3" noValidate>
            <PasswordField
              label="كلمة المرور الحالية"
              error={errors.currentPassword?.message}
              register={register("currentPassword", { required: "مطلوب" })}
            />
            <PasswordField
              label="كلمة المرور الجديدة"
              error={errors.newPassword?.message}
              register={register("newPassword", {
                required: "مطلوب",
                minLength: { value: 6, message: "6 أحرف على الأقل" },
              })}
            />
            <PasswordField
              label="تأكيد كلمة المرور الجديدة"
              error={errors.confirmPassword?.message}
              register={register("confirmPassword", {
                required: "مطلوب",
                validate: (val) => val === watch("newPassword") || "كلمتا المرور غير متطابقتين",
              })}
            />
            <Button type="submit" size="sm" loading={isSubmitting} className="w-full">
              حفظ كلمة المرور الجديدة
            </Button>
          </form>
        </Section>

        {/* ── Backup ── */}
        <Section icon={<CloudUploadIcon size={16} />} title="النسخ الاحتياطي">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <ClockIcon size={13} className="flex-shrink-0" />
            {loadingMeta ? (
              <span>جاري التحقق...</span>
            ) : meta?.lastBackupAt ? (
              <span>آخر نسخة احتياطية: {formatDateTime(meta.lastBackupAt)}</span>
            ) : (
              <span>لا توجد نسخة احتياطية بعد</span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            يتم عمل نسخة احتياطية تلقائيًا من كل بيانات البرنامج كل 24 ساعة، أول ما يكون فيه اتصال بالإنترنت. تقدر كمان تعمل نسخة يدويًا دلوقتي.
          </p>
          <Button
            type="button" size="sm" variant="secondary" className="w-full"
            icon={<CloudUploadIcon size={15} />}
            loading={backingUp}
            onClick={runBackupNow}
          >
            نسخ احتياطي الآن
          </Button>

          <button
            type="button"
            onClick={() => setRestoreOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 mt-3 transition-colors"
          >
            <RestoreIcon size={13} />
            استرجاع نسخة سابقة
          </button>
        </Section>

        {/* ── نسخة احتياطية على جهازك (خارج Firebase تمامًا) ── */}
        <Section icon={<DownloadIcon size={16} />} title="نسخة احتياطية على جهازك">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <ClockIcon size={13} className="flex-shrink-0" />
            {lastExportAt ? (
              <span>آخر تنزيل على الجهاز: {formatDateTime(new Date(Number(lastExportAt)))}</span>
            ) : (
              <span className="text-amber-400 font-semibold">لسه منزّلتش نسخة على جهازك — دي مهمة جدًا</span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            النسخة اللي فوق بتتخزن جوه نفس حساب Firebase. النسخة دي بتنزل ملف فعلي على تليفونك/جهازك، فلو حصلت أي مشكلة في الحساب نفسه، البيانات بتفضل عندك محفوظة برة. يستحسن تنزّل نسخة كل فترة (خصوصًا بعد أي شغل مهم).
          </p>
          <Button
            type="button" size="sm" variant="secondary" className="w-full"
            icon={<DownloadIcon size={15} />}
            loading={exporting}
            onClick={downloadLocalBackup}
          >
            تنزيل نسخة على جهازك
          </Button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 mt-3 transition-colors"
          >
            <UploadFileIcon size={13} />
            استرجاع من ملف محلي
          </button>
        </Section>

      </div>

      <RestoreModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Modal>
  );
};

export default ProfileModal;
