// src/config/posthog.js
import posthog from "posthog-js";

const POSTHOG_API_KEY = process.env.REACT_APP_POSTHOG_KEY;
const POSTHOG_HOST = process.env.REACT_APP_POSTHOG_HOST;

let ready = false;

const requirePostHogVariable = (name, value) => {
  if (value) return true;

  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      `${name} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${name} is configured`
    );
  }

  return false;
};

export const initPostHog = () => {
  if (!requirePostHogVariable("REACT_APP_POSTHOG_KEY", POSTHOG_API_KEY)) return;
  if (!requirePostHogVariable("REACT_APP_POSTHOG_HOST", POSTHOG_HOST)) return;

  try {
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      persistence: "localStorage+cookie",
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
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