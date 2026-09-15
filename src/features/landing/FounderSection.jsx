// src/features/landing/FounderSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { fadeUp, fadeIn, viewportOnce } from "./motion";
import founderBg from "../../assets/landing/founder-bg.webp";

const FounderSection = () => (
  <section id="story" className="py-16 sm:py-20 border-t border-white/8 bg-surface/40">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid lg:grid-cols-5 gap-6 items-stretch">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="lg:col-span-3 order-2 lg:order-1"
        >
          <Card className="p-7 sm:p-10 h-full flex flex-col justify-center">
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

        {/* Supporting photo — shown fully, not as a peeking backdrop */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeIn}
          className="lg:col-span-2 order-1 lg:order-2"
        >
          <div className="relative h-64 lg:h-full min-h-[280px] rounded-2xl overflow-hidden ring-1 ring-white/10">
            <img
              src={founderBg}
              alt="متابعة شغل الميكنة الزراعية أول بأول"
              width={700}
              height={796}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/70 via-transparent to-transparent" />
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default FounderSection;
