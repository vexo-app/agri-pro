// src/features/messaging/WhatsAppAction.jsx
//
// المكوّن اللي بيتحط جوه أي كارت/صفحة شخص (عامل/عميل/مورد): زرار واتساب +
// قائمة القوالب + Modal المعاينة/التعديل، كلها مجمّعة مع بعضها عشان تتكرر
// في كل مكان من غير تكرار الكود. الـcaller بس بيجهّز `templates`
// (array من { key, label, icon, build() }) على حسب بيانات الشخص، والباقي
// بيتصرف لوحده هنا.
import React, { useState } from "react";
import WhatsAppButton from "./WhatsAppButton";
import MessagePreviewModal from "./MessagePreviewModal";
import { buildWhatsappLink } from "../../utils/whatsapp";

const WhatsAppAction = ({ phone, templates, disabledHint }) => {
  const [preview, setPreview] = useState(null); // string (النص الأولي) | null

  const handlePick = (template) => setPreview(template.build());

  const handleSend = (finalText) => {
    window.open(buildWhatsappLink(phone, finalText), "_blank", "noopener,noreferrer");
    setPreview(null);
  };

  return (
    <>
      <WhatsAppButton phone={phone} templates={templates} disabledHint={disabledHint} onPick={handlePick} />
      <MessagePreviewModal
        open={preview !== null}
        initialText={preview}
        onClose={() => setPreview(null)}
        onSend={handleSend}
      />
    </>
  );
};

export default WhatsAppAction;
