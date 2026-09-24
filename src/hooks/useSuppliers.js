// src/hooks/useSuppliers.js
// Mirror of useClients.js, flipped direction: this tracks money the
// business OWES to suppliers/contractors, not money owed to the business.
// Step 2: الحساب في buildSupplierList/buildSupplierSummary (calculations.js).
import { useMemo, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { buildSupplierList, buildSupplierSummary } from "../utils/calculations";

export const useSuppliers = () => {
  const { supplierInvoices = [], supplierPayments = [], loading } = useData();

  const suppliers = useMemo(
    () => buildSupplierList(supplierInvoices, supplierPayments),
    [supplierInvoices, supplierPayments]
  );

  const totalPayable = useMemo(
    () => suppliers.reduce((s, sup) => s + sup.totalPayable, 0),
    [suppliers]
  );

  const getSupplierSummary = useCallback(
    (supplierName) => buildSupplierSummary(supplierName, supplierInvoices, supplierPayments),
    [supplierInvoices, supplierPayments]
  );

  return { suppliers, totalPayable, loading, getSupplierSummary };
};
