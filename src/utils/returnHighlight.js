// src/utils/returnHighlight.js
// UI بس (مفيش بيانات): لما تخرج من صفحة تفاصيل أو تقفل شباك تعديل، القائمة
// بتنزل على نفس العنصر وتعلّم عليه هايلايت ~2 ثانية. التخزين في
// sessionStorage (لكل تبويب) ومحمي بـ try/catch عشان ما يكسرش أي حاجة.
import { useEffect } from "react";

const KEY = "agripro:returnTarget";
const MAX_AGE_MS = 30 * 60 * 1000;

const attrValue = (scope, id) => `${scope}:${String(id)}`;
export const returnAttr = (scope, id) => ({ "data-return-id": attrValue(scope, id) });

export const setReturnTarget = (scope, id) => {
  try { sessionStorage.setItem(KEY, JSON.stringify({ scope, id: String(id), at: Date.now() })); } catch { /* ignore */ }
};

export const highlightItem = (scope, id) => {
  if (id == null || typeof document === "undefined") return;
  setTimeout(() => {
    const value = attrValue(scope, id);
    const el = Array.from(document.querySelectorAll("[data-return-id]"))
      .find((n) => n.getAttribute("data-return-id") === value);
    if (!el) return;
    try { el.scrollIntoView({ block: "center" }); } catch { /* ignore */ }
    el.classList.add("return-highlight");
    setTimeout(() => el.classList.remove("return-highlight"), 2000);
  }, 60);
};

/** صفحة القائمة: لو جاي راجع من تفاصيل عنصر من نفس النوع، علّم عليه. */
export const useReturnHighlight = (scope, ready = true) => {
  useEffect(() => {
    if (!ready) return;
    let target = null;
    try { target = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { target = null; }
    if (!target || target.scope !== scope || Date.now() - (target.at || 0) > MAX_AGE_MS) return;
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    highlightItem(scope, target.id);
  }, [scope, ready]);
};

/** صفحة التفاصيل: سجّل العنصر الحالي عشان القائمة ترجع عليه. */
export const useMarkReturnTarget = (scope, id) => {
  useEffect(() => { if (id) setReturnTarget(scope, id); }, [scope, id]);
};

/** ترتيب أبجدي عربي بالاسم (نسخة جديدة، من غير ما يغير الأصل). */
export const sortByName = (list, getName = (x) => x?.name) =>
  [...list].sort((a, b) => String(getName(a) || "").localeCompare(String(getName(b) || ""), "ar"));
