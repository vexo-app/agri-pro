// src/hooks/useTaxDeductions.js
import { useMemo } from "react";
import { useData } from "../contexts/DataContext";

export const useTaxDeductions = () => {
  const {
    taxDeductions, loading,
    addTaxDeduction, updateTaxDeduction, deleteTaxDeduction,
  } = useData();

  /** الحركات مرتّبة الأحدث أولاً (الـ service بيرتّبها أصلاً، ده احتياط) */
  const entries = useMemo(
    () => [...taxDeductions].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [taxDeductions]
  );

  /** إجمالي كل الضرائب والخصومات — البند اللي بيتخصم من صافي الربح */
  const total = useMemo(
    () => taxDeductions.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [taxDeductions]
  );

  /** الإجمالي مجمّع حسب النوع (ضريبة / رسوم حكومية / غرامة / أخرى) */
  const totalByType = useMemo(() => {
    const map = {};
    taxDeductions.forEach((t) => {
      const key = t.type || "other";
      map[key] = (map[key] || 0) + (Number(t.amount) || 0);
    });
    return map;
  }, [taxDeductions]);

  return {
    entries,
    total,
    totalByType,
    loading,
    addTaxDeduction,
    updateTaxDeduction,
    deleteTaxDeduction,
  };
};
