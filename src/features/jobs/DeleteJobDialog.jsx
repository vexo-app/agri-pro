// src/features/jobs/DeleteJobDialog.jsx
import React, { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/formatters";
import { TrashIcon, LockIcon, EyeIcon, EyeOffIcon, WalletIcon, AlertIcon } from "../../components/ui/Icons";

// نافذة تأكيد حذف عملية من "سجل الشغل" — بتوضح للمستخدم عدد ومبلغ
// الدفعات (المعلومات المالية) اللي هتتمسح معاها، وبتاخد باسورد حساب
// الأدمن وتتحقق منه فعليًا (Firebase reauthenticate) قبل ما تنفذ الحذف.
const DeleteJobDialog = ({ open, onClose, onConfirm, paymentsCount = 0, paymentsTotal = 0 }) => {
  const { reauthenticate } = useAuth();
  const [password, setPassword] = useState("");
  const [visible, setVisible]   = useState(false);
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) { setPassword(""); setError(""); setChecking(false); setVisible(false); }
  }, [open]);

  const hasPayments = paymentsCount > 0;

  const handleConfirm = async () => {
    if (!password) { setError("اكتب كلمة المرور"); return; }
    setChecking(true);
    setError("");
    try {
      await reauthenticate(password);
    } catch (err) {
      setChecking(false);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("كلمة المرور غير صحيحة");
      } else if (err.code === "auth/too-many-requests") {
        setError("محاولات كتير غلط، حاول تاني بعد شوية");
      } else {
        setError("تعذر التحقق من كلمة المرور، تأكد من اتصالك بالإنترنت");
      }
      return;
    }
    await onConfirm();
    setChecking(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={() => !checking && onClose()} title="تأكيد حذف العملية" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          هل تريد حذف هذه العملية؟ لا يمكن التراجع عن هذا الإجراء.
        </p>

        {hasPayments && (
          <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-red-400">
              <AlertIcon size={16} />
              <p className="text-sm font-bold">هيتمسح معاها معلومات مالية</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <WalletIcon size={14} className="text-red-400 flex-shrink-0" />
              <span>
                {paymentsCount} دفعة مسجّلة بإجمالي{" "}
                <span className="font-extrabold text-red-300">{formatCurrency(paymentsTotal)}</span>{" "}
                هتتمسح نهائيًا ومش هترجع.
              </span>
            </div>
          </div>
        )}

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
              className={`w-full bg-surface-2 border rounded-xl pr-10 pl-11 py-3 text-gray-100 placeholder-gray-500 text-sm
                transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600
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

        <div className="flex gap-3 justify-end pt-1">
          <Button variant="ghost" size="sm" disabled={checking} onClick={onClose}>إلغاء</Button>
          <Button variant="danger" size="sm" loading={checking} icon={<TrashIcon size={14} />} onClick={handleConfirm}>
            تأكيد الحذف
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteJobDialog;
