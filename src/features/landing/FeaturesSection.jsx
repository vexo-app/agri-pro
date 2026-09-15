// src/features/landing/FeaturesSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card, Badge } from "../../components/ui/Card";
import {
  ClipboardIcon, RevenueIcon, DriverIcon, WalletIcon, WrenchIcon,
  ChartIcon, AlertIcon, DownloadIcon, ReceiptIcon, UsersGroupIcon,
  WhatsAppIcon, ShieldIcon,
} from "../../components/ui/Icons";
import { fadeUp, staggerContainer, viewportOnce } from "./motion";

// شبكة Bento — مش كل الميزات بنفس الوزن: اللي بيحل أكتر من مشكلة يومية
// (المتابعة المالية للعملاء/الموردين، وإرسال كشف الحساب على واتساب) بياخد
// مساحة أكبر (`span: 2`) بدل ما يتساوى بصريًا مع ميزة أبسط زي "تاريخ
// الصيانة". كل عنصر لسه بيحل مشكلة يومية فعلية زي ما كانت الفلسفة الأصلية.
const FEATURES = [
  {
    icon: <ClipboardIcon />,
    title: "سجّل شغلانتك مرة واحدة",
    body: "المعدة، السواق، العميل، والإيراد — كله في تسجيلة واحدة، من غير ما تكررها في أكتر من مكان.",
    span: 1,
  },
  {
    icon: <UsersGroupIcon />,
    title: "العملاء والموردين في مكان واحد",
    body: "مين دفع، مين لسه عليه، وإنت مستحق كام عند كل مورد — بالتفصيل، مش تخمين.",
    span: 2,
    accent: "blue",
  },
  {
    icon: <DriverIcon />,
    title: "مرتب كل سواق، بالتفصيل",
    body: "سجل حضور، وسجل مرتب كامل — أساسي، إضافي، خصومات، وسلف — لكل سواق على حدة.",
    span: 1,
  },
  {
    icon: <WhatsAppIcon />,
    title: "ابعت كشف حساب على واتساب في ثانية",
    body: "كشف حساب، تذكير بالمستحق، أو شكر على التعامل — نص جاهز ومنسّق من بيانات الشخص فعليًا، تراجعه وتعدّله قبل ما تبعته.",
    span: 2,
    accent: "green",
    badge: "جديد",
    chips: ["كشف حساب", "تذكير بالمستحق", "شكر على التعامل", "تنبيه غياب"],
  },
  {
    icon: <RevenueIcon />,
    title: "اعرف مين دفع ومين لسه عليه",
    body: "المديونية بتتحسب لوحدها من المدفوعات المرتبطة بكل شغلانة، بدل ما تدور عليها في أكتر من ملف.",
    span: 1,
  },
  {
    icon: <WalletIcon />,
    title: "العهدة تحت السيطرة",
    body: "رصيد الكاش وفين اتصرف، مع تنبيه فوري لو الرصيد قرّب يخلص أو يعدّي السالب.",
    span: 1,
  },
  {
    icon: <ReceiptIcon />,
    title: "الضرائب والخصومات في مكانها",
    body: "سجل منفصل للضرائب والرسوم والغرامات، عشان ميلخبطش رصيد العهدة ولا مرتب السواق.",
    span: 1,
  },
  {
    icon: <WrenchIcon />,
    title: "تاريخ صيانة كل معدة",
    body: "متى اتصانت، وبكام — في مكان واحد بدل ما تعتمد على الذاكرة.",
    span: 1,
  },
  {
    icon: <ChartIcon />,
    title: "لوحة تحكم وتقارير جاهزة",
    body: "ربحية كل معدة وكل سواق، محسوبة من نفس البيانات اللي بتسجلها يوميًا — مش تقرير بتلمّه يدوي.",
    span: 1,
  },
  {
    icon: <ShieldIcon />,
    title: "يشتغل من غير نت خالص",
    body: "سجّل عملياتك في الحقل حتى من غير إنترنت، وهيتزامن لوحده أول ما الشبكة ترجع.",
    span: 1,
  },
  {
    icon: <AlertIcon />,
    title: "تنبيهات بدل ما تدوّر",
    body: "مديونية متأخرة، عهدة سالبة، أو تكرار محتمل في المرتبات — بتوصلك من غير ما تفتح كل صفحة.",
    span: 1,
  },
  {
    icon: <DownloadIcon />,
    title: "نسخة احتياطية يومية",
    body: "نسخ احتياطي تلقائي، واسترجاع وقت ما تحتاج، مع نسخة تقدر تنزّلها بنفسك على جهازك.",
    span: 1,
  },
];

const ACCENT_ICON_BG = {
  green: "bg-brand-900/30 text-brand-400",
  blue:  "bg-blue-900/30 text-blue-400",
  default: "bg-brand-900/30 text-brand-400",
};

const FeatureCard = ({ f }) => (
  <Card
    hover
    className={`p-6 h-full flex flex-col ${
      f.accent === "green" ? "sm:bg-gradient-to-br sm:from-brand-900/10 sm:to-transparent" : ""
    }`}
  >
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${ACCENT_ICON_BG[f.accent] || ACCENT_ICON_BG.default}`}>
        {f.icon}
      </div>
      {f.badge && <Badge variant="green">{f.badge}</Badge>}
    </div>

    <h3 className="text-sm font-bold text-gray-100 mb-1.5">{f.title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>

    {f.chips && (
      <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/8">
        {f.chips.map((c) => (
          <span
            key={c}
            className="text-[11px] font-semibold text-gray-400 bg-surface-2 border border-white/8 rounded-full px-2.5 py-1"
          >
            {c}
          </span>
        ))}
      </div>
    )}
  </Card>
);

const FeaturesSection = () => (
  <section id="features" className="py-16 sm:py-20 border-t border-white/8">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">كل حاجة محتاجها عشان تدير شغلك</h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          مش قائمة مميزات لوحدها — كل حاجة هنا موجودة عشان تحل مشكلة يومية فعلية.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.06)}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr"
      >
        {FEATURES.map((f) => (
          <motion.div key={f.title} variants={fadeUp} className={f.span === 2 ? "sm:col-span-2 lg:col-span-2" : ""}>
            <FeatureCard f={f} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default FeaturesSection;
