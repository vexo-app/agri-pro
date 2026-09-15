// src/features/messaging/MessagePreviewModal.jsx
//
// Popup معاينة/تعديل نص الرسالة قبل ما يتفتح واتساب — النص جاهز ومعبّي
// تلقائيًا بس قابل للتعديل بالكامل قبل الإرسال (زي المطلوب في السبيك).
import React, { useState, useEffect } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { WhatsAppIcon, InfoIcon } from "../../components/ui/Icons";

const MessagePreviewModal = ({ open, initialText, onClose, onSend }) => {
  const [text, setText] = useState(initialText || "");

  useEffect(() => {
    if (open) setText(initialText || "");
  }, [open, initialText]);

  return (
    <Modal open={open} onClose={onClose} title="معاينة الرسالة" size="md">
      <div className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="rtl"
          rows={12}
          className="w-full bg-surface-3 border border-white/10 rounded-xl px-4 py-3 text-gray-100 text-sm leading-7
            transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600 resize-none"
        />

        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <InfoIcon size={13} />
          تقدر تعدّل النص قبل الإرسال
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full !bg-green-600 hover:!bg-green-500 !shadow-green-900/40"
          icon={<WhatsAppIcon size={17} />}
          disabled={!text.trim()}
          onClick={() => onSend(text)}
        >
          افتح واتساب
        </Button>
      </div>
    </Modal>
  );
};

export default MessagePreviewModal;
