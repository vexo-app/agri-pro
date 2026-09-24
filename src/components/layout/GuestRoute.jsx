// src/components/layout/GuestRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { GuestProvider, useGuest } from "../../contexts/GuestContext";
import LoadingScreen from "../ui/LoadingScreen";

/**
 * حارس فوق مسارات واجهة الضيف (/guest/app/*). بيتأكد إن فيه جلسة ضيف
 * "active" فعلاً (مش بس anonymous auth) قبل ما يورّي أي بيانات — أي حالة
 * تانية (منتهي/ملغي/لسه ماستخدمش كود) بترجعه لصفحة الدخول /guest عشان
 * يشوف رسالة واضحة هناك.
 */
const GuestRouteInner = ({ children }) => {
  const { loading, status } = useGuest();
  if (loading) return <LoadingScreen fullScreen message="جاري التحقق من صلاحية الوصول..." />;
  if (status !== "active") return <Navigate to="/guest" replace />;
  return children;
};

const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen fullScreen message="جاري التحقق..." />;
  if (!user || !user.isAnonymous) return <Navigate to="/guest" replace />;

  return (
    <GuestProvider>
      <GuestRouteInner>{children}</GuestRouteInner>
    </GuestProvider>
  );
};

export default GuestRoute;
