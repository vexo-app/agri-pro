// src/hooks/useAdminBackups.js
import { useState, useEffect, useCallback } from "react";
import { backupService } from "../services/backupService";

/**
 * تاريخ آخر باك أب لكل الشركات — أدمن بس، الحماية الفعلية في
 * firestore.rules (isAdmin()). بترجع { [userId]: lastBackupAt } عشان
 * صفحة الأدمن تدمجها مع قائمة الشركات وتعرض عمود "آخر نسخة احتياطية".
 */
export const useAdminBackups = () => {
  const [backups, setBackups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const map = await backupService.getAllMeta();
      setBackups(map);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { backups, loading, error, reload: load };
};
