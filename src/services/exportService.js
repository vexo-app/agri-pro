// src/services/exportService.js
// ─────────────────────────────────────────────────────────
// نسخة احتياطية "خارجية" حقيقية: بتنزل ملف JSON على جهاز
// المستخدم نفسه (تليفون/كمبيوتر)، بره مشروع Firebase تمامًا.
// لو حصل أي حاجة في حساب Firebase نفسه (تعليق، فوترة، حذف
// بالغلط)، النسخة دي بتفضل موجودة عند المستخدم لوحدها.
//
// ده ملف pure JS بسيط، مفيهوش أي اعتماد على Firestore —
// بياخد أي object جاهز ويحوّله لملف، أو ياخد ملف ويرجّعه object.
// ─────────────────────────────────────────────────────────

const EXPORT_VERSION = 1;

const BACKUP_KEYS = [
  "equipment", "jobs", "drivers", "maintenance",
  "payments", "salaryEntries", "attendance", "custodyTransactions", "settings",
];

/** بناء اسم ملف واضح فيه تاريخ اليوم، عشان لو حمّل أكتر من نسخة يعرف يميزهم. */
const buildFileName = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `زراعي-برو-نسخة-احتياطية_${stamp}.json`;
};

export const exportService = {
  /**
   * بيحوّل بيانات التطبيق لملف JSON وينزّله على جهاز المستخدم فورًا
   * (عن طريق رابط تنزيل مؤقت في المتصفح — من غير أي طلب شبكة).
   */
  downloadBackupFile(data) {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: EXPORT_VERSION,
      app: "زراعي برو",
      data: BACKUP_KEYS.reduce((acc, key) => {
        acc[key] = data[key] ?? (key === "settings" ? {} : []);
        return acc;
      }, {}),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = buildFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return payload;
  },

  /**
   * بيقرأ ملف JSON (اللي المستخدم رفعه) ويتأكد إنه ملف نسخة احتياطية
   * صحيح شكله، وبيرجّع البيانات (data) بس جاهزة للاسترجاع.
   * بيرمي Error برسالة عربية واضحة لو الملف مش سليم.
   */
  async readBackupFile(file) {
    if (!file) throw new Error("لم يتم اختيار ملف");
    if (!file.name.endsWith(".json")) {
      throw new Error("الملف لازم يكون بصيغة JSON (الملف اللي نزلته من نفس البرنامج)");
    }

    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error("الملف تالف أو مش بصيغة صحيحة");
    }

    if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
      throw new Error("الملف ده مش نسخة احتياطية من زراعي برو");
    }

    // بناء counts للعرض في شاشة التأكيد قبل الاسترجاع
    const counts = BACKUP_KEYS.reduce((acc, key) => {
      if (key === "settings") return acc;
      acc[key] = Array.isArray(parsed.data[key]) ? parsed.data[key].length : 0;
      return acc;
    }, {});

    return {
      exportedAt: parsed.exportedAt || null,
      data: parsed.data,
      counts,
    };
  },
};
