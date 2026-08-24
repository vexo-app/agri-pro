# Design Tokens — زراعي برو (مرجع مستقبلي فقط)

⚠️ **هذه الـ Tokens للتوثيق والمرجع المستقبلي فقط. لم يتم تطبيقها على
التطبيق الحالي، ولا تُغيّر أي CSS/Tailwind config موجود بالفعل.**

## Colors

```json
{
  "color.primary":        "#8CFF00",
  "color.secondary":      "#22C55E",
  "color.dark-green":     "#15803D",
  "color.background.dark":"#0F172A",
  "color.neutral":        "#64748B",
  "color.surface.light":  "#F1F5F9",
  "color.white":          "#FFFFFF"
}
```

## Typography

```json
{
  "font.family.base": "Cairo, sans-serif",
  "font.weight.regular":  400,
  "font.weight.medium":   500,
  "font.weight.semibold": 600,
  "font.weight.bold":     700,
  "font.weight.extrabold":800,

  "font.size.xs":   "10px",
  "font.size.sm":   "12px",
  "font.size.base": "14px",
  "font.size.md":   "16px",
  "font.size.lg":   "20px",
  "font.size.xl":   "24px",
  "font.size.2xl":  "32px",

  "font.lineHeight.tight":  1.3,
  "font.lineHeight.base":   1.6,
  "font.lineHeight.loose":  1.8
}
```

## Spacing

```json
{
  "space.1": "4px",
  "space.2": "8px",
  "space.3": "12px",
  "space.4": "16px",
  "space.5": "20px",
  "space.6": "24px",
  "space.8": "32px",
  "space.10": "40px",
  "space.12": "48px"
}
```

## Border Radius

```json
{
  "radius.sm":   "6px",
  "radius.md":   "10px",
  "radius.lg":   "14px",
  "radius.xl":   "20px",
  "radius.full": "999px"
}
```

المرجع: زوايا الـ App Icon الفعلية دائرية بنسبة تقارب `radius.xl`
(تناسبًا مع مربع الأيقونة)، بينما البطاقات والأزرار الأصغر تستخدم
`radius.sm`–`radius.md`.

## Shadows

```json
{
  "shadow.sm": "0 1px 2px rgba(15, 23, 42, 0.08)",
  "shadow.md": "0 4px 12px rgba(15, 23, 42, 0.12)",
  "shadow.lg": "0 8px 24px rgba(15, 23, 42, 0.18)",
  "shadow.icon-glow": "0 0 16px rgba(140, 255, 0, 0.25)"
}
```

`shadow.icon-glow` موثّق كمرجع لأثر الإضاءة الخفيف حول إطار الـ App Icon
كما يظهر في الصورة المرجعية — استخدام اختياري ومحدود جدًا (لا يُستخدم كظل
عام للعناصر).

## Breakpoints

```json
{
  "breakpoint.sm":  "640px",
  "breakpoint.md":  "768px",
  "breakpoint.lg":  "1024px",
  "breakpoint.xl":  "1280px"
}
```

## Icon Sizes

```json
{
  "icon.xs": "16px",
  "icon.sm": "20px",
  "icon.md": "24px",
  "icon.lg": "32px",

  "app-icon.1024": "1024px",
  "app-icon.512":  "512px",
  "app-icon.256":  "256px",
  "app-icon.128":  "128px",
  "app-icon.64":   "64px",
  "favicon.48":    "48px",
  "favicon.32":    "32px",
  "favicon.16":    "16px"
}
```

---

هذه القيم مبنية على اللوحة اللونية والخط المعتمدَين فعليًا في الصورة
المرجعية، بالإضافة إلى قيم Spacing/Radius/Shadow/Breakpoints قياسية
متوافقة مع أسلوب الهوية (للاستخدام عند بناء نظام تصميم (Design System)
كامل مستقبلاً إن رغبت الشركة في ذلك).
