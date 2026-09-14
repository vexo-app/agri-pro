// src/config/posthog.js
// ─────────────────────────────────────────────
// PostHog analytics. Replace POSTHOG_API_KEY below with your own Project
// API Key (PostHog → Project Settings → Project API Key). Sign up free at
// https://posthog.com — pick US Cloud, EU Cloud, or point POSTHOG_HOST at
// your own self-hosted instance's URL.
//
// Deliberately additive/best-effort, same spirit as the rest of the app's
// "offline never breaks anything" rule: if the key isn't set yet, or a
// PostHog network call fails (offline, blocked, ad-blocker, whatever),
// nothing here throws or blocks any real feature — it just silently
// doesn't track anything that one time.
//
// Privacy: autocapture and session recording are OFF on purpose. Several
// routes carry a real client/supplier/driver/equipment name or id in the
// URL itself (e.g. /clients/كريم فتحي) — full autocapture would send that
// to PostHog's servers as part of every click/pageview. Pageviews are sent
// manually (see trackPageview, called from AppLayout.jsx) with the dynamic
// segment replaced by ":id" first, so no real name ever leaves the app via
// analytics.
// ─────────────────────────────────────────────
import posthog from "posthog-js";

const POSTHOG_API_KEY = "YOUR_POSTHOG_PROJECT_API_KEY"; // ← replace this
const POSTHOG_HOST     = "https://us.i.posthog.com";     // EU: https://eu.i.posthog.com — or your self-hosted URL

let ready = false;

export const initPostHog = () => {
  if (!POSTHOG_API_KEY || POSTHOG_API_KEY === "YOUR_POSTHOG_PROJECT_API_KEY") {
    // لسه محطوطش المفتاح الحقيقي — التتبع متعطّل بهدوء، مفيش أي تأثير
    // على باقي التطبيق.
    console.info("PostHog: no API key set yet — analytics disabled (see src/config/posthog.js)");
    return;
  }
  try {
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,           // لا تتبع تلقائي للكليكات/الروابط — راجع ملاحظة الخصوصية فوق
      capture_pageview: false,      // بنبعت pageview يدوي منقّى بدل ده — شوف trackPageview
      disable_session_recording: true,
      persistence: "localStorage+cookie",
    });
    ready = true;
  } catch (err) {
    console.warn("PostHog init failed (analytics disabled, app unaffected):", err);
  }
};

// الصفحات اللي فيها اسم/id حقيقي جوه الرابط نفسه — الجزء المتغيّر ده
// بيتستبدل بـ ":id" قبل ما أي حاجة تتبعت لـ PostHog.
const DYNAMIC_ROUTE_PREFIXES = ["/equipment/", "/clients/", "/suppliers/", "/drivers/"];

const sanitizePath = (pathname) => {
  const prefix = DYNAMIC_ROUTE_PREFIXES.find((p) => pathname.startsWith(p));
  return prefix ? `${prefix}:id` : pathname;
};

// بتتنادى مع كل تغيير route (شوف AppLayout.jsx). بتبعت بس المسار المنقّى
// — مستحيل تبعت اسم عميل/مورد/سائق/معدة حقيقي.
export const trackPageview = (pathname) => {
  if (!ready) return;
  try {
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${sanitizePath(pathname)}`,
    });
  } catch {
    // best-effort بس — التتبع محدش يوقف أي حاجة تانية في التطبيق
  }
};

// لتتبع أحداث مخصصة (لو احتجنا مستقبلًا) — بترجع بأمان لو PostHog مش
// شغال (مفيش مفتاح، أوف لاين، الشبكة متحجبة، إلخ). التتبع أبدًا مش لازم
// يبقى شرط لأي feature حقيقي في التطبيق.
export const trackEvent = (name, properties) => {
  if (!ready) return;
  try {
    posthog.capture(name, properties);
  } catch {
    // best-effort بس
  }
};

// تعريف المستخدم الحالي في PostHog بالـ uid + الإيميل — عشان تقدر تتبع
// سلوك كل صاحب حساب لوحده. بتتنادى من AuthContext.jsx مع أي تغيير في
// حالة تسجيل الدخول.
export const identifyUser = (uid, email) => {
  if (!ready || !uid) return;
  try {
    posthog.identify(uid, email ? { email } : undefined);
  } catch {
    // best-effort بس
  }
};

export const resetPostHogUser = () => {
  if (!ready) return;
  try {
    posthog.reset();
  } catch {
    // best-effort بس
  }
};

export default posthog;