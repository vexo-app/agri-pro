// src/features/landing/FeaturesSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import {
  ClipboardIcon, RevenueIcon, DriverIcon, WalletIcon, WrenchIcon,
  ChartIcon, AlertIcon, DownloadIcon, ReceiptIcon,
} from "../../components/ui/Icons";
import { fadeUp, staggerContainer, viewportOnce } from "./motion";

const FEATURES = [
  {
    icon: <ClipboardIcon />,
    title: "سجّل شغلانتك مرة واحدة",
    body: "المعدة، السواق، العميل، والإيراد — كله في تسجيلة واحدة، من غير ما تكررها في أكتر من مكان.",
  },
  {
    icon: <RevenueIcon />,
    title: "اعرف مين دفع ومين لسه عليه",
    body: "المديونية بتتحسب لوحدها من المدفوعات المرتبطة بكل شغلانة، بدل ما تدور عليها في أكتر من ملف.",
  },
  {
    icon: <DriverIcon />,
    title: "مرتب كل سواق، بالتفصيل",
    body: "سجل حضور، وسجل مرتب كامل — أساسي، إضافي، خصومات، وسلف — لكل سواق على حدة.",
  },
  {
    icon: <WalletIcon />,
    title: "العهدة تحت السيطرة",
    body: "رصيد الكاش وفين اتصرف، مع تنبيه فوري لو الرصيد قرّب يخلص أو يعدّي السالب.",
  },
  {
    icon: <ReceiptIcon />,
    title: "الضرائب والخصومات في مكانها",
    body: "سجل منفصل للضرائب والرسوم والغرامات، عشان ميلخبطش رصيد العهدة ولا مرتب السواق.",
  },
  {
    icon: <WrenchIcon />,
    title: "تاريخ صيانة كل معدة",
    body: "متى اتصانت، وبكام — في مكان واحد بدل ما تعتمد على الذاكرة.",
  },
  {
    icon: <ChartIcon />,
    title: "لوحة تحكم وتقارير جاهزة",
    body: "ربحية كل معدة وكل سواق، محسوبة من نفس البيانات اللي بتسجلها يوميًا — مش تقرير بتلمّه يدوي.",
  },
  {
    icon: <AlertIcon />,
    title: "تنبيهات بدل ما تدوّر",
    body: "مديونية متأخرة، عهدة سالبة، أو تكرار محتمل في المرتبات — بتوصلك من غير ما تفتح كل صفحة.",
  },
  {
    icon: <DownloadIcon />,
    title: "نسخة احتياطية يومية",
    body: "نسخ احتياطي تلقائي، واسترجاع وقت ما تحتاج، مع نسخة تقدر تنزّلها بنفسك على جهازك.",
  },
];

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
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {FEATURES.map((f) => (
          <motion.div key={f.title} variants={fadeUp}>
            <Card hover className="p-6 h-full">
              <div className="w-11 h-11 rounded-2xl bg-brand-900/30 flex items-center justify-center text-brand-400 mb-4">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-100 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default FeaturesSection;
