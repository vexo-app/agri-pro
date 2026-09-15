// src/features/landing/RealizationSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { LinkIcon } from "../../components/ui/Icons";
import { fadeUp, slideFrom, staggerContainer, viewportOnce } from "./motion";

const SHIFTS = [
  ["بيانات متفرقة",            "بيانات منظمة في مكان واحد"],
  ["متابعة يدوية",             "متابعة أسهل وتنبيهات تلقائية"],
  ["سجلات منفصلة لكل حاجة",     "صورة واحدة بيتصل بعضها ببعض"],
  ["الدوران على المعلومة",     "المعلومة جاهزة في ثانية"],
];

const RealizationSection = () => (
  <section className="py-16 sm:py-20 border-t border-white/8 bg-surface/40">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl mb-9"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">
          المشكلة مش إنك محتاج تسجّل بيانات أكتر
        </h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          المشكلة إنك محتاج البيانات دي تتربط ببعض. من بيانات متفرقة، لبيانات
          متصلة تديك صورة واحدة واضحة لشغلك.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.1)}
        className="space-y-3 max-w-2xl"
      >
        {SHIFTS.map(([from, to]) => (
          <motion.div key={from} variants={slideFrom("right", 24)} className="flex items-center gap-3 sm:gap-4">
            <span className="flex-1 text-sm sm:text-base text-gray-500 text-left sm:text-right py-3 px-4 rounded-2xl bg-surface-2 border border-white/8">
              {from}
            </span>
            <LinkIcon className="text-brand-500 shrink-0" size={18} />
            <span className="flex-1 text-sm sm:text-base font-bold text-gray-100 py-3 px-4 rounded-2xl bg-brand-900/20 border border-brand-800/40">
              {to}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default RealizationSection;
