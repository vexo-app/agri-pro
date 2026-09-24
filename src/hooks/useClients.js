// src/hooks/useClients.js
// Step 2: التجميع والحساب في buildClientList/buildClientSummary
// (utils/calculations.js) — نفس الدوال اللي بتستخدمها صفحات الضيف. العميل
// بيتجمع بالاسم بعد trim + توحيد المسافات (normalizeClientName).
import { useMemo, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { buildClientList, buildClientSummary } from "../utils/calculations";

export const useClients = () => {
  const { jobs, payments, settings, loading } = useData();
  const fuelPrice = settings?.fuelPrice;

  const clients = useMemo(
    () => buildClientList(jobs, fuelPrice, payments),
    [jobs, fuelPrice, payments]
  );

  const totalDebt = useMemo(
    () => clients.reduce((s, c) => s + c.totalRemaining, 0),
    [clients]
  );

  const getClientSummary = useCallback(
    (clientName) => buildClientSummary(clientName, jobs, fuelPrice, payments),
    [jobs, fuelPrice, payments]
  );

  return { clients, totalDebt, loading, getClientSummary };
};
