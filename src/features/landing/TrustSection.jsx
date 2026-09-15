// src/features/landing/TrustSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { ShieldIcon, RestoreIcon, DownloadIcon, CloudUploadIcon } from "../../components/ui/Icons";
import { fadeUp, staggerContainer, viewportOnce } from "./motion";
import trustBanner from "../../assets/landing/trust-fleet.webp";

const POINTS = [
  { icon: <CloudUploadIcon />, title: "نسخة احتياطية يومية", body: "نسخة كاملة من بياناتك بتتاخد أوتوماتيك كل 24 ساعة." },
  { icon: <RestoreIcon />,     title: "استرجاع وقت ما تحتاج", body: "لو حصل أي حاجة، تقدر ترجع لنسخة سابقة بسهولة." },
  { icon: <DownloadIcon />,    title: "نسخة تاخدها معاك",     body: "تصدير محلي لبياناتك على جهازك، مش على السحابة بس." },
  { icon: <ShieldIcon />,      title: "بياناتك ليك وحدك",     body: "بيانات كل شركة معزولة تمامًا عن أي شركة تانية." },
];

const TrustSection = () => (
  <section className="py-16 sm:py-20 border-t border-white/8">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Full-width banner — cool dusk tones sit close to the dark-mode
          palette already, so only a light overlay is needed here. */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="relative h-64 sm:h-80 rounded-3xl overflow-hidden mb-10 ring-1 ring-white/10"
      >
        <img
          src={trustBanner}
          alt="أسطول معدات زراعية جاهز للعمل"
          width={1200}
          height={516}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover brightness-110 contrast-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">اتعمل من مشكلة حقيقية</h2>
          <p className="mt-2 max-w-2xl text-gray-300 leading-relaxed text-sm sm:text-base">
            زراعي برو منتج حقيقي شغال، مبني من مشكلة اتعاشت فعلًا في شغل ميكنة
            زراعية — مش فكرة على الورق.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={staggerContainer(0.08)}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {POINTS.map((p) => (
          <motion.div key={p.title} variants={fadeUp}>
            <Card className="p-5 h-full">
              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-brand-400 mb-3">
                {p.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-100">{p.title}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.body}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default TrustSection;
