// src/contexts/GuestContext.jsx
//
// حالة جلسة الضيف (Phase 2) — منفصل تمامًا عن DataContext.jsx بتاع
// المالك عن قصد: DataContext معقّد ومبني حوالين الكتابة + الأوفلاين +
// المزامنة لصاحب الحساب، ولمس منطقه عشان حالة "قراءة بس محدودة الأقسام"
// كان هيزود خطر حقيقي على أهم جزء أوفلاين في البرنامج من غير داعي —
// راجع GUEST_ACCESS_DESIGN.md في المشروع لتفاصيل القرار ده.
//
// الضيف بيوصل هنا وهو أصلاً معاه guestSessions/{uid} (اتعمل وقت
// الاستخدام في GuestLoginPage.jsx) — الكونتكست ده مسؤوليته الوحيدة:
// يقرا الـsession وبعدين الـguestAccess doc بتاعتها، ويحسب "الحالة
// الحالية" (صالح/منتهي/ملغي/بره ساعات اليوم) على مستوى الواجهة بس —
// الحماية الحقيقية لسه في firestore.rules، الحساب هنا للعرض بس (بانر/
// إخفاء أقسام)، مش بديل عن القواعد.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { guestAccessService } from "../services/guestAccessService";

const GuestContext = createContext(null);

// نفس منطق withinGeneralPeriod + withinDailyWindow في firestore.rules
// بالظبط — لو عدّلت واحد فيهم لازم تعدّل التاني. هنا للعرض بس (تحديد
// الحالة اللي تتعرض للضيف)، مش طبقة حماية.
// Exported (Phase 3) عشان تاب إعدادات المالك (GuestAccessSection.jsx)
// يعرض نفس الحالة بالظبط في ليستة الأكواد، بدل ما يكرر نفس المنطق.
export function computeStatus(access) {
  if (!access) return "not_found";
  if (access.cancelled) return "cancelled";
  const now = Date.now();
  const validFrom  = access.validFrom?.toMillis?.() ?? new Date(access.validFrom).getTime();
  const validUntil = access.validUntil?.toMillis?.() ?? new Date(access.validUntil).getTime();
  if (now < validFrom) return "not_started";
  if (now > validUntil) return "expired";
  if (access.dailyStartMinute != null && access.dailyEndMinute != null) {
    const d = new Date();
    const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (!(nowMin >= access.dailyStartMinute && nowMin < access.dailyEndMinute)) {
      return "outside_daily_window";
    }
  }
  return "active";
}

export const GuestProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, status: null, ownerUid: null, code: null, access: null, ownerProfile: null });

  const load = useCallback(async () => {
    if (!user || !user.isAnonymous) {
      setState({ loading: false, status: "no_guest_session", ownerUid: null, code: null, access: null, ownerProfile: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const session = await guestAccessService.getSession(user.uid);
      if (!session) {
        setState({ loading: false, status: "no_guest_session", ownerUid: null, code: null, access: null, ownerProfile: null });
        return;
      }
      const access = await guestAccessService.getAccess(session.ownerUid, session.code);
      const status = computeStatus(access);
      // بروفايل المالك (لاسم البانر) — best-effort، لو اتمنع (زي بعد
      // الإلغاء/الانتهاء) بنسيبه null ونعرض اسم الكود بدل الشركة.
      let ownerProfile = null;
      try {
        ownerProfile = await guestAccessService.getOwnerProfile(session.ownerUid);
      } catch { /* ignore — banner falls back to the code's own name */ }

      setState({
        loading: false, status,
        ownerUid: session.ownerUid, code: session.code,
        access, ownerProfile,
      });
    } catch (err) {
      setState({ loading: false, status: "error", ownerUid: null, code: null, access: null, ownerProfile: null, error: err });
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const isSectionOpen = useCallback((section) => {
    const s = state.access?.sections?.[section];
    return state.status === "active" && !!s?.enabled && !!s?.financial;
  }, [state.access, state.status]);

  const value = { ...state, guestUid: user?.uid || null, isSectionOpen, reload: load };

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
};

export const useGuest = () => {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be inside GuestProvider");
  return ctx;
};
