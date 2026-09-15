// src/components/layout/ProtectedRoute.jsx
import React, { lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../ui/LoadingScreen";
import { DataProvider } from "../../contexts/DataContext";
import OnboardingGate from "./OnboardingGate";
import EmailVerificationGate from "./EmailVerificationGate";

// Lazy-loaded on purpose: LandingPage now pulls in framer-motion + gsap for
// its scroll/hover effects. Those libraries must NOT be in the bundle every
// logged-in user downloads — only an anonymous visitor hitting "/" needs
// them, so this import is code-split into its own chunk fetched on demand.
const LandingPage = lazy(() => import("../../pages/LandingPage"));

/**
 * Wraps routes that require authentication.
 * Also provides DataContext so all child pages have access to Firestore data.
 *
 * Special case: this block also covers the root path "/" (see App.jsx —
 * the index route renders DashboardPage). A logged-out visitor hitting "/"
 * sees the public marketing LandingPage instead of being redirected to
 * /auth, so the app has a real homepage. Every other path under this block
 * (equipment, jobs, ...) still redirects a logged-out visitor to /auth.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="جاري التحقق من تسجيل الدخول..." />;
  // مستخدم anonymous (Phase 2 — الوصول للضيوف) مش مالك حساب حقيقي — لازم
  // يتعامل معاه هنا زي غير مسجل دخول خالص، وإلا هيدخل هنا بـuid بتاعه
  // هو (مفيش users/{uid} ليه أصلاً) بدل uid صاحب الحساب اللي المفروض
  // يشوف بياناته، وكل قراءة/تحميل بيانات هتفشل permission-denied. مسار
  // الضيف الحقيقي منفصل تمامًا: /guest (GuestLoginPage) و/guest/app/*
  // (GuestRoute) في App.jsx.
  if (!user || user.isAnonymous) {
    if (location.pathname === "/") {
      return (
        <Suspense fallback={<LoadingScreen message="جاري التحميل..." />}>
          <LandingPage />
        </Suspense>
      );
    }
    return <Navigate to="/auth" replace />;
  }

  // EmailVerificationGate قبل DataProvider عن قصد: لو بريد المستخدم مش
  // متحقق منه، التطبيق ميحملش أي بيانات Firestore خاصة بيه أصلًا — مش بس
  // يمنعه بصريًا من الوصول للشاشة.
  return (
    <EmailVerificationGate>
      <DataProvider>
        <OnboardingGate>{children}</OnboardingGate>
      </DataProvider>
    </EmailVerificationGate>
  );
};

export default ProtectedRoute;
