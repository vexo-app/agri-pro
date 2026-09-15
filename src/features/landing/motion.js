// src/features/landing/motion.js
//
// Shared Framer Motion primitives for the public landing page ONLY.
// Kept in one place so every section uses the same easing/timing instead of
// each component inventing its own — smaller diff, consistent feel.
//
// GPU-safe by construction: every variant animates opacity/transform only
// (never layout properties), and every usage below is driven by
// `whileInView` (IntersectionObserver-backed), never a raw scroll listener.

// Gentle fade-up used for headings, paragraphs, cards — the default reveal.
export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

// Same fade, no vertical travel — for things already mid-layout (e.g. a
// grid item inside a staggered parent) where re-adding y would double up.
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

// Wraps `fadeUp`/`fadeIn` children with a staggered delay — pass to a
// parent's `variants` + `initial`/`whileInView` and children just need
// `variants={fadeUp}` (no repeated transition config per item).
export const staggerContainer = (staggerAmount = 0.08) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerAmount },
  },
});

// Standard viewport options: animate once, slightly before the element is
// fully on-screen so the reveal doesn't feel late.
export const viewportOnce = { once: true, margin: "-10% 0px -10% 0px" };

// Directional slide-in (RTL-aware) — used for the Before/After pair so
// each card enters from its own side instead of a plain fade.
export const slideFrom = (dir = "right", distance = 36) => ({
  hidden: { opacity: 0, x: dir === "right" ? distance : -distance },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
});
