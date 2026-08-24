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
  DownloadIcon, UploadFileIcon,
} from "../../components/ui/Icons";

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
