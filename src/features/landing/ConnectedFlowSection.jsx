// src/features/landing/ConnectedFlowSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import {
  ClipboardIcon, TractorIcon, DriverIcon, UsersGroupIcon,
  RevenueIcon, WalletIcon, ReceiptIcon, ChartIcon,
} from "../../components/ui/Icons";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "./motion";
import officeFlowImage from "../../assets/landing/office-flow.webp";

const HUB = [
  { icon: <TractorIcon />,   label: "المعدة" },
  { icon: <DriverIcon />,    label: "السواق" },
  { icon: <UsersGroupIcon />, label: "العميل" },
  { icon: <RevenueIcon />,   label: "الإيراد" },
];

const OUTCOMES = [
  { icon: <RevenueIcon />, title: "المدفوعات والمديونية", desc: "كل دفعة مرتبطة بالشغلانة، والباقي على العميل بيتحسب لوحده." },
  { icon: <DriverIcon />,  title: "الحضور والمرتب", desc: "حضور السواق مرتبط بسجل مرتبه — ليدجر واحد لكل حركة." },
  { icon: <WalletIcon />,  title: "العهدة", desc: "رصيد الكاش وفين اتصرف، منفصل عن حسابات العميل والسواق." },
  { icon: <ReceiptIcon />, title: "الضرائب والخصومات", desc: "سجل مستقل، بيقلل الأرباح من غير ما يلخبط رصيد العهدة." },
];

const STEPS = [
  "سجّل معداتك وسواقينك مرة واحدة.",
  "سجّل كل عملية شغل — المعدة، السواق، العميل، الإيراد.",
  "سجّل أي دفعة من العميل، والنظام بيحسبلك الباقي تلقائيًا.",
  "تابع مرتبات السواقين والعهدة من نفس المكان.",
  "افتح لوحة التحكم والتقارير عشان تشوف حالة شركتك الحقيقية.",
];

const ConnectedFlowSection = () => (
  <section id="how-it-works" className="py-16 sm:py-20 border-t border-white/8 bg-surface/40">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">
          البرنامج مش مجرد أماكن تسجل فيها بيانات
        </h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          كل عملية شغل بتتسجل مرة واحدة، وبترتبط تلقائيًا بكل حاجة تانية بتخصها.
        </p>
      </motion.div>

      {/* Hub card + supporting photo, side by side on larger screens */}
      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="lg:col-span-3"
        >
          <Card className="p-6 sm:p-8 h-full">
            <div className="flex items-center gap-2 text-brand-400 font-bold text-sm mb-6">
              <ClipboardIcon size={18} />
              <span>الشغلانة الواحدة بتوصل بين:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {HUB.map((h) => (
                <div key={h.label} className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-surface-2 border border-white/8">
                  <div className="text-brand-400">{h.icon}</div>
                  <span className="text-sm font-bold text-gray-200">{h.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeIn}
          className="hidden lg:block lg:col-span-2"
        >
          <div className="relative h-full min-h-[280px] rounded-2xl overflow-hidden ring-1 ring-white/10">
            <img
              src={officeFlowImage}
              alt="متابعة بيانات الشركة من مكان واحد"
              width={760}
              height={660}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/85 via-dark/20 to-transparent" />
          </div>
        </motion.div>
      </div>

      {/* Downstream: what that connection feeds */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.08)}
        className="grid sm:grid-cols-2 gap-3 mb-14"
      >
        {OUTCOMES.map((o) => (
          <motion.div key={o.title} variants={fadeUp}>
            <Card className="p-5 flex items-start gap-4 h-full">
              <div className="w-10 h-10 rounded-xl bg-brand-900/30 flex items-center justify-center text-brand-400 shrink-0">
                {o.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">{o.title}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{o.desc}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* How it works — numbered steps */}
      <div className="max-w-2xl mx-auto">
        <motion.h3
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="text-center text-lg font-extrabold text-gray-100 mb-8 flex items-center justify-center gap-2"
        >
          <ChartIcon size={18} className="text-brand-400" />
          إزاي بيشتغل، خطوة بخطوة
        </motion.h3>
        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.1)}
          className="space-y-4"
        >
          {STEPS.map((s, i) => (
            <motion.li key={s} variants={fadeUp} className="flex items-start gap-4">
              <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-extrabold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-gray-300 leading-relaxed pt-1">{s}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </div>
  </section>
);

export default ConnectedFlowSection;
