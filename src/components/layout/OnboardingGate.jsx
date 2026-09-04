// src/components/layout/OnboardingGate.jsx
// Shows the P1.1 onboarding flow to first-time users (no
// settings.onboardingCompleted yet), then falls through to the normal
// app once it's done. Lives inside ProtectedRoute, after DataProvider,
// so it can read the already-loaded settings document.
import React from "react";
import { useData } from "../../contexts/DataContext";
import LoadingScreen from "../ui/LoadingScreen";
import OnboardingFlow from "../../features/onboarding/OnboardingFlow";

const OnboardingGate = ({ children }) => {
  const { settings, loading } = useData();

  if (loading) return <LoadingScreen message="جاري التحميل..." />;
  if (!settings?.onboardingCompleted) return <OnboardingFlow />;

  return children;
};

export default OnboardingGate;
