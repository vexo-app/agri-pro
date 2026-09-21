// src/features/profile/DeleteAccountDialog.jsx
//
// audit finding F-006: قبل الملف ده، مكانش فيه أي واجهة في التطبيق تقدر
// بيها تحذف حسابك نهائيًا. نفس نمط التأكيد بالباسورد المستخدم بالظبط في
// DeleteJobDialog.jsx (كلمة مرور إجبارية قبل أي إجراء لا يمكن التراجع
// عنه)، لكن هنا العملية أكبر (مسح كل بيانات الحساب مش عملية واحدة بس)
// فمضاف شريط تقدم حي بدل سبينر واحد غامض.
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { TrashIcon, LockIcon, EyeIcon, EyeOffIcon, AlertIcon } from "../../components/ui/Icons";

// أسماء الخطوات كما بتوصل من onProgress (مطابقة لمفاتيح BACKUP_COLLECTIONS
// في backupService.js + "settings" + "backups") — بس لعرض تقدم مفهوم
// للمستخدم أثناء الحذف، مش جزء من منطق الحذف نفسه.
const STEP_LABELS = {
  equipment: "المعدات", jobs: "الوظائف", drivers: "السائقين",
  maintenance: "الصيانة", payments: "المدفوعات",
  supplierInvoices: "فواتير الموردين", supplierPayments: "مدفوعات الموردين",
  salaryEntries: "الرواتب", attendance: "الحضور",
  custodyTransactions: "العهدة", taxDeductions: "الضرائب",
  contacts: "جهات الاتصال",
  settings: "الإعدادات", backups: "النسخ الاحتياطية",
  account: "بيانات الحساب",
};

const DeleteAccountDialog = ({ open, onClose }) => {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState("");
  const [visible, setVisible]   = useState(false);
  const [error, setError]       = useState("");
  const [working, setWorking]   = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, step }

  useEffect(() => {
    if (open) { setPassword(""); setError(""); setWorking(false); setProgress(null); }
  }, [open]);

  const handleConfirm = async () => {
    if (!password) { setError("اكتب كلمة المرور"); return; }
    setWorking(true);
    setError("");
    try {
      await deleteAccount(password, { onProgress: setProgress });
      toast.success("تم حذف حسابك وكل بياناتك نهائيًا");
      // مفيش داعي لـ navigate يدوي — deleteUser بيلغي الجلسة تلقائيًا،
      // وonAuthStateChanged هيحول التطبيق لصفحة تسجيل الدخول/الهبوط لوحده.
    } catch (err) {
      setWorking(false);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("كلمة المرور غير صحيحة");
      } else if (err.code === "auth/too-many-requests") {
        setError("محاولات كتير غلط، حاول تاني بعد شوية");
      } else if (err.code === "auth/requires-recent-login") {
        setError("محتاج تسجّل دخول تاني قبل ما تقدر تحذف الحساب، لأسباب أمان");
      } else {
        setError("تعذر حذف الحساب — تأكد من اتصالك بالإنترنت وحاول تاني");
      }
    }
  };

  return (
    <Modal open={open} onClose={() => !working && onClose()} title="حذف الحساب نهائيًا" size="sm">
      <div className="space-y-4">
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertIcon size={16} />
            <p className="text-sm font-bold">إجراء نهائي لا يمكن التراجع عنه</p>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            هيتمسح نهائيًا: كل الوظائف والمدفوعات والمعدات والسائقين والصيانة
            والرواتب والحضور والعهدة والضرائب وفواتير الموردين ومدفوعاتهم
            وكل النسخ الاحتياطية — وحساب الدخول نفسه.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            لو محتاج نسخة من بياناتك، نزّلها الأول من "تصدير نسخة محلية"
            في الملف الشخصي قبل ما تكمل هنا.
          </p>
        </div>

        {working && progress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>جارٍ حذف بياناتك...</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
              <div
                className="bg-red-600 h-full transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {STEP_LABELS[progress.step] || progress.step}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 tracking-wide">
              أدخل كلمة مرور حسابك للتأكيد
            </label>
            <div className="relative">
              <LockIcon size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                placeholder="كلمة المرور"
                autoFocus
                disabled={working}
                className={`w-full bg-surface-2 border rounded-xl pr-10 pl-11 py-3 text-gray-100 placeholder-gray-500 text-sm
                  transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600
                  disabled:opacity-50
                  ${error ? "border-red-500 focus:ring-red-500/50" : "border-white/10"}`}
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
        )}

        <div className="flex gap-3 justify-end pt-1">
          <Button variant="ghost" size="sm" disabled={working} onClick={onClose}>إلغاء</Button>
          <Button variant="danger" size="sm" loading={working} icon={<TrashIcon size={14} />} onClick={handleConfirm}>
            حذف حسابي نهائيًا
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteAccountDialog;
