// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import toast from "react-hot-toast";
import "./index.css";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { initGlobalErrorLogger } from "./utils/globalErrorLogger";
import { initPostHog } from "./config/posthog";

initGlobalErrorLogger();
initPostHog();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// بيسجّل الـ service worker يخلي التطبيق (الشل بتاعه: JS/CSS/HTML) يتخزن
// على الجهاز من أول زيارة — حتى قبل ما المستخدم يسجل دخول — فيفتح ويشتغل
// حتى من غير نت خالص من بعد كده.
//
// onUpdate: من غير الكولباك ده، أي نسخة جديدة بتتنشر بتفضل "واقفة"
// (waiting) في الخلفية من غير ما تتفعّل أبدًا لحد ما المستخدم يقفل كل
// تابات الموقع فعليًا — فكان ممكن حد يعمل hard refresh مية مرة ولسه
// شغال بالكود القديم. دلوقتي: أول ما نسخة جديدة تكون جاهزة، بنوريه
// تنبيه فيه زرار "تحديث الآن"، ولو دوسه بنبعت SKIP_WAITING للنسخة
// الجديدة، وأول ما تاخد السيطرة (controllerchange) بنعمل reload تلقائي
// مرة واحدة بس عشان مايدخلش في لوب.
let hasReloaded = false;
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker) return;

    toast(
      (t) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>في نسخة جديدة من التطبيق متاحة</span>
          <button
            onClick={() => {
              waitingWorker.postMessage({ type: "SKIP_WAITING" });
              toast.dismiss(t.id);
            }}
            style={{
              background: "#0f4c2a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "4px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            تحديث الآن
          </button>
        </div>
      ),
      { duration: Infinity, id: "sw-update" }
    );
  },
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
}

// اطلب من المتصفح إن مساحة التخزين المحلي (اللي فيها كل بيانات
// Firestore الأوف لاين + التعديلات اللي لسه مترفعتش) تبقى "persistent"
// بدل "best-effort". الفرق: بدون الطلب ده، المتصفح (خصوصًا على أندرويد)
// ممكن يمسح جزء من التخزين المحلي تلقائيًا لو الجهاز بقى شغال بمساحة
// قليلة جدًا — حتى لو التطبيق ده مقفول. الطلب ده مش مضمون 100% (بيرجع
// true/false حسب المتصفح وتاريخ استخدام المستخدم للموقع)، لكنه بيقلل
// احتمال فقدان البيانات في الحالات دي بشكل كبير.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {
    // Silent — this is a best-effort request, not something to bother the
    // user about. If it's rejected, offline data is still safe under
    // normal conditions; only extreme low-disk-space scenarios are at risk.
  });
}