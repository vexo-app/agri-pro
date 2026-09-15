// src/utils/clipboard.js
//
// نسخ نص للـclipboard — لازم لإرسال رسالة الجروب، لأن روابط جروبات واتساب
// (chat.whatsapp.com) بعكس أرقام الأفراد (wa.me/<رقم>) مش بتدعم تعبئة نص
// تلقائي عن طريق ?text=. الحل الشغّال الوحيد: نسخ النص يدويًا + فتح رابط
// الجروب، والمالك يلزقه هو بنفسه جوه واتساب.
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // نكمل على البديل تحت
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};
