// src/features/landing/FounderSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { fadeUp, viewportOnce } from "./motion";
import founderBg from "../../assets/landing/founder-bg.webp";

const FounderSection = () => (
  <section id="story" className="relative py-16 sm:py-20 border-t border-white/8 bg-surface/40 overflow-hidden">
    {/* Purely atmospheric — a generic field/phone scene behind the quote,
        not a photo of an actual person. Kept low-key on purpose. */}
    <div
      className="absolute inset-0 opacity-[0.14] bg-cover bg-center pointer-events-none"
      style={{ backgroundImage: `url(${founderBg})` }}
      aria-hidden="true"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-dark/80 to-surface/40 pointer-events-none" aria-hidden="true" />

    <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
      >
        <Card className="p-7 sm:p-10 max-w-3xl backdrop-blur-sm bg-surface/90">
          <span className="text-xs font-bold tracking-wide text-brand-400 uppercase">قصتنا</span>
          <p className="mt-4 text-gray-300 leading-loose">
            إحنا عندنا نشاط في الميكنة الزراعية، وكان فيه شخص في العيلة مسؤول عن
            الحسابات ومتابعة تفاصيل كتير من الشغل. المعلومات كانت موزعة بين
            واتساب، الورق، والدفاتر — وكان صعب إنك تتابع كل حاجة في نفس الوقت.
          </p>
          <p className="mt-4 text-gray-300 leading-loose">
            من هنا جت فكرة إننا نبني نظام يجمع المعلومات دي ويربطها ببعض، ويساعد
            في فهم الشغل والحسابات والديون والمصروفات والمعدات بشكل أوضح.
          </p>
        </Card>
      </motion.div>
    </div>
  </section>
);

export default FounderSection;
