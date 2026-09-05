// src/components/system/ErrorBoundary.jsx
// ─────────────────────────────────────────────────────────
// أي خطأ يحصل أثناء الـ render بيوقع React كله ويورّي شاشة بيضا لو
// معملناش حاجة. الـ Boundary ده بيلقط الخطأ، يسجله في errorLogs، ويورّي
// شاشة ودّية بدل الشاشة البيضا، مع زرار "إعادة تحميل".
// ملحوظة: React Error Boundaries بتلقط أخطاء الـ render بس — مش أخطاء
// جوه event handlers ولا async code. دول متغطيين في globalErrorLogger.js.
// ─────────────────────────────────────────────────────────
import React from "react";
import { errorLogService } from "../../services/errorLogService";
import { AlertIcon } from "../ui/Icons";
import Button from "../ui/Button";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    errorLogService.log({
      message: error?.message || String(error),
      stack: error?.stack || info?.componentStack,
      source: "boundary",
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-dark font-arabic" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <img src="/brand-icon.png" alt="زراعي برو" className="w-12 h-12 rounded-2xl mx-auto mb-5 opacity-90" />
          <div className="w-16 h-16 rounded-3xl bg-red-900/30 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
            <AlertIcon size={28} className="text-red-400" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-100 mb-1">حصل خطأ غير متوقع</h2>
          <p className="text-sm text-gray-500 mb-6">
            المشكلة اتسجلت تلقائياً وهنراجعها. جرّب تعيد تحميل الصفحة.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            إعادة تحميل الصفحة
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
