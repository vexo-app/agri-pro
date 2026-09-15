// src/features/landing/Hero.jsx
import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Button from "../../components/ui/Button";
import { Badge, StatCard } from "../../components/ui/Card";
import { RevenueIcon, WalletIcon, TractorIcon, ProfitIcon, ChevronLeftIcon } from "../../components/ui/Icons";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "./motion";
import heroImage from "../../assets/landing/hero-tractor.webp";

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  // The ONE signature GSAP moment on the whole page: the hero photo drifts
  // slower than the page as you scroll past it (classic parallax), pinned
  // to this section only via ScrollTrigger's `scrub`. Everything else on
  // the landing page uses plain Framer Motion `whileInView` — this is kept
  // deliberately rare per the agreed "1-2 signature moments, not everywhere".
  const imgWrapRef = useRef(null);

  useEffect(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    });
    return () => ctx.revert(); // cleanup on unmount — no leaked ScrollTriggers
  }, []);

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient glow — same treatment as AuthPage, kept subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-900/25 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-80 h-80 bg-blue-900/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.12)}
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="green" className="mb-5">نظام إدارة شركات المعدات الزراعية</Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-3xl sm:text-5xl font-extrabold text-gray-50 leading-[1.25] sm:leading-[1.2]"
            >
              بيانات أوضح. قرارات أذكى. أرباح أكبر.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl"
            >
              زراعي برو بيجمع شغل شركتك، معداتك، سواقينك، وفلوسك في نظام واحد متصل —
              بدل ما تفضل تدور عليهم في الواتساب والدفاتر وملفات الإكسل المتفرقة.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
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
              <a href="#how-it-works">
                <Button variant="secondary" size="lg">شوف إزاي بيشتغل</Button>
              </a>
            </motion.div>

            {/* Product-truth mini preview — real UI language, not a stock photo */}
            <motion.div
              variants={staggerContainer(0.08)}
              className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl"
            >
              <motion.div variants={fadeIn}><StatCard icon={<RevenueIcon />} label="إيرادات الشغل" value="متصلة بالعميل" color="green" /></motion.div>
              <motion.div variants={fadeIn}><StatCard icon={<WalletIcon />}  label="رصيد العهدة" value="محدّث أول بأول" color="amber" /></motion.div>
              <motion.div variants={fadeIn}><StatCard icon={<TractorIcon />} label="حالة المعدات" value="واضحة قدامك" color="blue" /></motion.div>
              <motion.div variants={fadeIn}><StatCard icon={<ProfitIcon />} label="مستحقات العملاء" value="بتتحسب لوحدها" color="purple" /></motion.div>
            </motion.div>
          </motion.div>

          {/* Photo panel — hidden on small screens to keep first paint light on mobile */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeIn}
            className="hidden lg:block relative"
          >
            <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10">
              <div ref={imgWrapRef} className="will-change-transform">
                <img
                  src={heroImage}
                  alt="جرار زراعي حديث يعمل في الحقل عند الفجر"
                  width={1152}
                  height={648}
                  fetchpriority="high"
                  className="w-full h-full object-cover scale-110"
                />
              </div>
              {/* Brand-navy gradient so the photo reads as part of the same
                  dark UI instead of a pasted-in stock photo. */}
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/10 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-l from-dark/40 via-transparent to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
