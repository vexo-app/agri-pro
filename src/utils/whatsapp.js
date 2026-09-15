// src/utils/whatsapp.js
//
// بناء رابط wa.me بس — مفيش أي تكامل مباشر مع WhatsApp API ولا إرسال فعلي
// من السيرفر (شوف whatsapp-messaging-feature.md). فتح الرابط بيشغّل واتساب
// بتاع المالك نفسه بنص جاهز، والإرسال الفعلي بيتم منه هو يدويًا.

/**
 * فورمات رقم تليفون لصيغة wa.me: بيشيل أي رمز غير رقمي (مسافات/+/-)، ولو
 * الرقم بصيغة محلية مصرية (بيبدأ بصفر) بيستبدل الصفر بكود الدولة 20 — نفس
 * المطلوب في السبيك بالظبط. رقم بكود دولة تاني (متسجل من غير صفر البداية)
 * بيتسيب زي ما هو من غير أي افتراض.
 */
export const formatWhatsappPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
};

/** هل الرقم ده كافي يتبنى منه رابط واتساب صالح؟ */
export const hasValidWhatsappPhone = (phone) => formatWhatsappPhone(phone).length >= 10;

/** رابط فتح واتساب لشخص بعينه (رقمه) بنص جاهز معبّي مسبقًا. */
export const buildWhatsappLink = (phone, text) =>
  `https://wa.me/${formatWhatsappPhone(phone)}?text=${encodeURIComponent(text || "")}`;
