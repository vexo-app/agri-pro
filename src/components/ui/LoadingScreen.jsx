// src/components/ui/LoadingScreen.jsx
import React from "react";

// Step 4: جوه الصفحات (fullScreen=false) بياخد جزء من الشاشة بدل ما يغطي
// الـlayout كله؛ fullScreen للتحميل على مستوى التطبيق/التوجيه بس.
const LoadingScreen = ({ message = "جاري التحميل...", fullScreen = false }) => (
  <div className={`${fullScreen ? "min-h-screen bg-dark" : "min-h-[60vh]"} flex items-center justify-center font-arabic`} dir="rtl" role="status" aria-live="polite">
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <img src="/brand-icon.png" alt="زراعي برو" className="w-14 h-14 rounded-2xl opacity-90" />
      </div>
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  </div>
);

export default LoadingScreen;
