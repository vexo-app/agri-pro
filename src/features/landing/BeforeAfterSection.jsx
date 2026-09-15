// src/features/landing/BeforeAfterSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { XCircleIcon, CheckCircleIcon } from "../../components/ui/Icons";
import { fadeUp, slideFrom, staggerContainer, viewportOnce } from "./motion";
import beforeImage from "../../assets/landing/before-convoy.webp";
import afterImage from "../../assets/landing/after-calm.webp";

const BEFORE = [
  "ورق ودفاتر",
  "بيانات على واتساب",
  "ملفات إكسل متفرقة",
  "المعلومة موجودة مع شخص معين",
  "وقت في البحث والمتابعة",
];

const AFTER = [
  "بيانات منظمة في نظام واحد",
  "معلومات مترابطة ببعض",
  "متابعة أسهل وأسرع",
  "رؤية أوضح لحالة الشركة",
  "تقارير جاهزة بدل ما تتلمّ يدوي",
];

const BeforeAfterSection = () => (
  <section className="py-16 sm:py-20 border-t border-white/8">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">الفرق قبل وبعد</h2>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.15)}
        className="grid sm:grid-cols-2 gap-4"
      >
        {/* Before — busy, dusty, scattered mood */}
        <motion.div variants={slideFrom("right", 32)}>
          <Card className="overflow-hidden h-full">
            <div className="relative h-48 sm:h-56">
              <img
                src={beforeImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover grayscale-[35%] opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
            </div>
            <div className="p-6 sm:p-7 pt-5">
              <span className="text-xs font-bold tracking-wide text-gray-500 uppercase">قبل</span>
              <ul className="mt-4 space-y-3">
                {BEFORE.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-gray-400">
                    <XCircleIcon size={18} className="text-gray-600 shrink-0" />
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>

        {/* After — calm, clear, organized mood */}
        <motion.div variants={slideFrom("left", 32)}>
          <Card className="overflow-hidden h-full border-brand-800/40">
            <div className="relative h-48 sm:h-56">
              <img
                src={afterImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
            </div>
            <div className="p-6 sm:p-7 pt-5">
              <span className="text-xs font-bold tracking-wide text-brand-400 uppercase">مع زراعي برو</span>
              <ul className="mt-4 space-y-3">
                {AFTER.map((a) => (
                  <li key={a} className="flex items-center gap-3 text-gray-200">
                    <CheckCircleIcon size={18} className="text-brand-500 shrink-0" />
                    <span className="text-sm font-semibold">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

export default BeforeAfterSection;
