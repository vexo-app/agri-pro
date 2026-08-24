// src/components/ui/LoadingScreen.jsx
import React from "react";

const LoadingScreen = ({ message = "جاري التحميل..." }) => (
  <div className="min-h-screen bg-dark flex items-center justify-center font-arabic" dir="rtl">
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
