// src/features/landing/FinalCtaSection.jsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../../components/ui/Button";
import { ChevronLeftIcon } from "../../components/ui/Icons";
import { fadeUp, viewportOnce } from "./motion";
import ctaTractor from "../../assets/landing/cta-tractor.webp";

const FinalCtaSection = () => (
  <section className="py-16 sm:py-20 border-t border-white/8">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="relative overflow-hidden rounded-3xl border border-brand-800/40 min-h-[320px] sm:min-h-[380px] flex items-center justify-center px-6 py-12 sm:px-14 sm:py-16 text-center"
      >
        {/* Same tractor, mirrored — a quiet visual "bookend" for the page.
            A dedicated wide crop (full vehicle + margin) is used here, and
            the section is tall enough that object-cover never has to slice
            through the tractor the way the plain Hero crop did. */}
        <img
          src={ctaTractor}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-65"
        />
        <div className="absolute inset-0 bg-dark/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark/75 via-transparent to-transparent" />

        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50 max-w-xl mx-auto leading-snug">
            خلي بيانات شغلك في مكان واحد، وشوف الصورة أوضح.
          </h2>
          <div className="mt-8 flex items-center justify-center gap-3">
            <motion.span
              className="inline-block"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link to="/auth?mode=register">
                <Button size="lg" className="group">
                  ابدأ الآن
                  <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-300 group-hover:-translate-x-0.5">
                    <ChevronLeftIcon size={14} />
                  </span>
                </Button>
              </Link>
            </motion.span>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

export default FinalCtaSection;
