// src/features/landing/DashboardSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { StatCard, Card } from "../../components/ui/Card";
import { RevenueIcon, FuelIcon, ProfitIcon, WrenchIcon, DriverIcon, ReceiptIcon } from "../../components/ui/Icons";
import { fadeUp, fadeIn, staggerContainer, viewportOnce } from "./motion";

const DashboardSection = () => (
  <section id="dashboard" className="py-16 sm:py-20 border-t border-white/8 bg-surface/40">
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="max-w-2xl mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-50">
          بدل ما تجمع الأرقام، خلي الصورة قدامك
        </h2>
        <p className="mt-4 text-gray-400 leading-relaxed">
          لوحة التحكم محسوبة لحظيًا من نفس البيانات اللي بتدخلها كل يوم — مش
          تقرير منفصل لازم حد يبنيه بعدين.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
      >
        <Card className="p-5 sm:p-7">
          <motion.div
            variants={staggerContainer(0.06)}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <motion.div variants={fadeIn}><StatCard icon={<RevenueIcon />} label="الإيرادات"      value="من كل الشغلانات"   color="green" /></motion.div>
            <motion.div variants={fadeIn}><StatCard icon={<FuelIcon />}    label="تكلفة الوقود"   value="لكل شغلانة"        color="amber" /></motion.div>
            <motion.div variants={fadeIn}><StatCard icon={<ProfitIcon />}  label="صافي الربح"     value="إيراد ناقص تكلفة"  color="blue" /></motion.div>
            <motion.div variants={fadeIn}><StatCard icon={<WrenchIcon />}  label="تكلفة الصيانة"  value="لكل معدة"          color="orange" /></motion.div>
            <motion.div variants={fadeIn}><StatCard icon={<DriverIcon />}  label="المرتبات"       value="من ليدجر السواقين" color="purple" /></motion.div>
            <motion.div variants={fadeIn}><StatCard icon={<ReceiptIcon />} label="الضرائب والخصومات" value="سجل مستقل"      color="red" /></motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  </section>
);

export default DashboardSection;
