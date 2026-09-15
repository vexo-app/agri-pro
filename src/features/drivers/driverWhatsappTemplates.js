// src/features/drivers/driverWhatsappTemplates.js
//
// بناء قائمة قوالب واتساب عامل واحد — مصدر واحد يستخدمه DriverCard (إرسال
// فردي) و BulkSendDialog (إرسال جماعي) عشان منطق بناء رسالة العامل الشخصية
// (نفس الأرقام من نفس المصدر: useSalary().getMonthSummary) يفضل في مكان
// واحد بس، مش مكرر في الكارت وفي فيتشر الإرسال الجماعي.
import React from "react";
import { ClipboardIcon, ClockIcon, CheckCircleIcon, AlertIcon } from "../../components/ui/Icons";
import {
  buildDriverStatementText, buildDriverReminderText, buildDriverThanksText, buildDriverAbsenceText,
} from "../../utils/messageTemplates";

/**
 * @param {object} params
 * @param {object} params.driver - { id, name, unpaidThisMonth }
 * @param {(driverId: string, yearMonth: string) => object} params.getMonthSummary - useSalary().getMonthSummary
 * @param {string} params.currentMonth - useSalary().currentMonth
 * @param {(driverId: string) => Array} params.getDriverAttendance - useSalary().getDriverAttendance
 * @param {string} params.companyName
 * @returns {Array<{key:string,label:string,icon:JSX.Element,build:() => string}>}
 */
export const getDriverWhatsappTemplates = ({
  driver, getMonthSummary, currentMonth, getDriverAttendance, companyName,
}) => {
  const { id, name, unpaidThisMonth } = driver;
  const summary = getMonthSummary(id, currentMonth);
  const lastAbsence = getDriverAttendance(id).find((r) => r.status === "absent");

  return [
    {
      key: "statement", label: "كشف حساب", icon: <ClipboardIcon size={15} />,
      build: () => buildDriverStatementText({
        driverName: name, summary, yearMonth: currentMonth, isPaid: !unpaidThisMonth, companyName,
      }),
    },
    {
      key: "reminder", label: "تذكير بالمستحق", icon: <ClockIcon size={15} />,
      build: () => buildDriverReminderText({
        driverName: name, net: summary.net, yearMonth: currentMonth, companyName,
      }),
    },
    {
      key: "thanks", label: "شكر على التعامل", icon: <CheckCircleIcon size={15} />,
      build: () => buildDriverThanksText({ driverName: name, companyName }),
    },
    {
      key: "absence", label: "تنبيه غياب", icon: <AlertIcon size={15} />,
      build: () => buildDriverAbsenceText({ driverName: name, absenceDate: lastAbsence?.date, companyName }),
    },
  ];
};
