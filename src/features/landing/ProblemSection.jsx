// src/features/landing/ProblemSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { PhoneIcon, ClipboardIcon, UsersGroupIcon, DownloadIcon } from "../../components/ui/Icons";
import { fadeUp, staggerContainer, viewportOnce } from "./motion";
import problemBg from "../../assets/landing/problem-bg.webp";

const SCATTERED = [
  { icon: <PhoneIcon />,      label: "واتساب" },
  { icon: <ClipboardIcon />,  label: "دفاتر وورق" },
  { icon: <DownloadIcon />,   label: "ملفات إكسل" },
  { icon: <UsersGroupIcon />, label: "أشخاص مختلفين" },
];

const ProblemSection = () => (
  <section id="problem" className="relative py-16 sm:py-20 border-t border-white/8 overflow-hidden">
    {/* Ambient photo backdrop — very low opacity, purely textural, never
        competes with the text. Same treatment idea as the AuthPage glows. */}
    <div
      className="absolute inset-0 opacity-[0.10] bg-cover bg-center pointer-events-none"
      style={{ backgroundImage: `url(${problemBg})` }}
      aria-hidden="true"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-dark via-dark/90 to-dark pointer-events-none" aria-hidden="true" />

    <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50 leading-snug">
          الشغلانة في مكان، الحسابات في مكان، والبيانات على واتساب...
        </h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          كل ما شركتك تكبر — معدات أكتر، سواقين أكتر، عملاء أكتر — متابعة كل ده
          بيبقى أصعب: مين لسه مديك فلوس؟ السواق مستحق كام؟ العهدة راحت فين؟
          المعدة محتاجة صيانة إمتى؟ الإجابات موجودة... بس متفرقة، وبتاخد وقت
          عشان تلمّها.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.08)}
        className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {SCATTERED.map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            <Card className="flex flex-col items-center gap-2.5 py-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-surface-2 flex items-center justify-center text-gray-400">
                {s.icon}
              </div>
              <span className="text-sm font-semibold text-gray-300">{s.label}</span>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="mt-9 rounded-3xl border border-brand-800/40 bg-gradient-to-l from-brand-900/25 to-transparent px-6 py-7 sm:px-9 sm:py-9"
      >
        <p className="text-lg sm:text-2xl font-extrabold text-gray-50 leading-snug">
          المشكلة مش إن البيانات مش موجودة.
          <br className="hidden sm:block" />
          {" "}المشكلة إنها موجودة... في أماكن كتير.
        </p>
      </motion.div>
    </div>
  </section>
);

export default ProblemSection;
