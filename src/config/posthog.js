// src/config/posthog.js
import posthog from "posthog-js";

const POSTHOG_API_KEY = process.env.REACT_APP_POSTHOG_KEY;
const POSTHOG_HOST = process.env.REACT_APP_POSTHOG_HOST;

let ready = false;

const PRIVATE_QUERY_KEYS = new Set(["token", "owner", "code"]);
const DYNAMIC_ROUTE_SEGMENTS = new Set(["equipment", "clients", "suppliers", "drivers"]);

export const sanitizePostHogPath = (pathname = "/") => {
  const path = String(pathname).split(/[?#]/, 1)[0] || "/";
  const segments = path.split("/");

  return segments
    .map((segment, index) => (
      index > 0 && DYNAMIC_ROUTE_SEGMENTS.has(segments[index - 1]) && segment
        ? ":id"
        : segment
    ))
    .join("/");
};

export const sanitizePostHogUrl = (value) => {
  if (typeof value !== "string" || !value) return value;

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://app.local";
    const url = new URL(value, base);
    return `${url.origin}${sanitizePostHogPath(url.pathname)}`;
  } catch {
    return sanitizePostHogPath(value);
  }
};

const URL_PROPERTY_KEYS = new Set([
  "$current_url",
  "$referrer",
  "$pathname",
  "$prev_pageview_pathname",
  "$prev_pageview_url",
  "$previous_url",
  "$external_click_url",
]);

const sanitizeProperties = (properties = {}) => Object.fromEntries(
  Object.entries(properties).flatMap(([key, value]) => {
    if (PRIVATE_QUERY_KEYS.has(key.toLowerCase())) return [];
    if (URL_PROPERTY_KEYS.has(key)) return [[key, sanitizePostHogUrl(value)]];
    if (typeof value === "string" && /(?:[?&](?:token|owner|code)=)/i.test(value)) {
      return [[key, sanitizePostHogUrl(value)]];
    }
    return [[key, value]];
  })
);

export const sanitizePostHogEvent = (event) => {
  if (!event) return event;
  return {
    ...event,
    properties: sanitizeProperties(event.properties),
    ...(event.$set ? { $set: sanitizeProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: sanitizeProperties(event.$set_once) } : {}),
  };
};

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
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      before_send: sanitizePostHogEvent,
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

// بتتنادى مع كل تغيير route (شوف AppLayout.jsx). بتبعت بس المسار المنقّى
// — مستحيل تبعت اسم عميل/مورد/سائق/معدة حقيقي.
export const trackPageview = (pathname) => {
  if (!ready) return;
  try {
    posthog.capture("$pageview", {
      $current_url: sanitizePostHogUrl(pathname),
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
    posthog.capture(name, sanitizeProperties(properties));
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
