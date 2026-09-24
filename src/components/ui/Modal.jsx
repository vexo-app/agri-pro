// src/components/ui/Modal.jsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CloseIcon } from "./Icons";

const Modal = ({ open, onClose, title, size = "md", children }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Step 4: زرار Esc بيقفل النافذة (زي زرار الإغلاق بالظبط).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-3xl" };

  // بوابة (Portal) لـdocument.body بدل ما نرندر الـfixed div مكانه جوه
  // شجرة الكومبوننت العادية — مهم جدًا لأي مودال بيتحط جوه عنصر عليه أي
  // hover/transform (زي WhatsApp preview modal اللي بيترندر جوه Card
  // اللي عليه hover:-translate-y-0.5): من غير Portal، الـtransform ده وقت
  // الـhover بيعمل "containing block" جديد للـfixed، فيخلي المودال كله
  // (اللي المفروض يغطي الشاشة) يترسم بالنسبة للكارت الصغير بدل الشاشة
  // كلها، وده اللي كان بيبان زي المودال "بيتقفل ويتفتح" بمجرد ما الماوس
  // يعدي على أي كارت تاني. الـPortal بيخلي المودال دايمًا بالنسبة للشاشة
  // كلها بغض النظر عن أي hover/transform في أي عنصر أب.
  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={clsx(
          "w-full bg-surface border border-white/10 rounded-t-3xl sm:rounded-2xl",
          "max-h-[90vh] overflow-y-auto flex flex-col animate-slide-up",
          widths[size]
        )}>
        <div className="sticky top-0 bg-surface z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 rounded-t-3xl sm:rounded-t-2xl">
          <h2 id="modal-title" className="text-base font-bold text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 hover:bg-red-900/60 text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="p-4 sm:p-6 flex-1">{children}</div>
      </div>
    </div>
  ), document.body);
};

export default Modal;
