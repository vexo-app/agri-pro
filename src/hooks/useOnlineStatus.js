// src/hooks/useOnlineStatus.js — حالة الاتصال الحالية (navigator.onLine) مع التحديث.
import { useEffect, useState } from "react";

export const useOnlineStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
};
