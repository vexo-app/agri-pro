// src/components/ui/Modal.jsx
import React, { useEffect } from "react";
import clsx from "clsx";
import { CloseIcon } from "./Icons";

const Modal = ({ open, onClose, title, size = "md", children }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-3xl" };

  return (
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
        <div className="sticky top-0 bg-surface z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 rounded-t-3xl sm:rounded-t-2xl">
          <h2 id="modal-title" className="text-base font-bold text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-2 hover:bg-red-900/60 text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="p-6 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
