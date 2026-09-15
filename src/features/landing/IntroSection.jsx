// src/features/landing/IntroSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "./motion";

const IntroSection = () => (
  <section className="py-16 sm:py-20 border-t border-white/8">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.1)}
        className="max-w-2xl"
      >
        <motion.span variants={fadeUp} className="text-xs font-bold tracking-wide text-brand-400 uppercase">
          إيه هو زراعي برو
        </motion.span>
        <motion.h2 variants={fadeUp} className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-50 leading-snug">
          نظام واحد لإدارة شركات المعدات الزراعية — مش برنامج مزارع عام، ومش
          بديل إكسل بس.
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-5 text-gray-400 leading-relaxed">
          إحنا شفنا المشكلة دي بشكل حقيقي جوه شغل ميكنة زراعية، ومن هنا بدأنا
          نبني نظام يجمع المعلومات ويربطها ببعض بدل ما تفضل متفرقة.
        </motion.p>
        <motion.p variants={fadeUp} className="mt-3 text-gray-400 leading-relaxed">
          زراعي برو بيساعد شركة الميكنة أو المعدات الزراعية تدير شغلها،
          معداتها، سواقينها، وحساباتها من مكان واحد — بدل ما كل واحدة من دول
          تكون في نظام أو دفتر لوحدها.
        </motion.p>
      </motion.div>
    </div>
  </section>
);

export default IntroSection;
