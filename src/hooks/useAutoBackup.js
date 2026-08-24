// src/hooks/useAutoBackup.js
import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { backupService } from "../services/backupService";
import { BACKUP_INTERVAL_MS } from "../config/constants";

const lastBackupKey = (uid) => `lastBackupAt:${uid}`;

/**
 * Runs a full data backup automatically:
 *  - at most once every 24h
 *  - only while the app is online
 *  - checked once when data finishes loading, again whenever the
 *    connection comes back, and re-checked hourly in case the app
 *    stays open across the 24h mark.
 */
export const useAutoBackup = () => {
  const { user }  = useAuth();
  const data      = useData();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!user || data.loading) return;

    const runIfDue = async () => {
      if (runningRef.current || !navigator.onLine) return;

      const localLast = Number(localStorage.getItem(lastBackupKey(user.uid)) || 0);
      if (Date.now() - localLast < BACKUP_INTERVAL_MS) return;

      runningRef.current = true;
      try {
        // Cross-check the server in case another device already backed up
        // recently, to avoid redundant writes.
        const meta = await backupService.getMeta(user.uid);
        const serverLast = meta?.lastBackupAt?.toMillis?.() || 0;
        if (Date.now() - serverLast < BACKUP_INTERVAL_MS) {
          localStorage.setItem(lastBackupKey(user.uid), String(serverLast));
          return;
        }

        await backupService.createBackup(user.uid, {
          equipment:     data.equipment,
          jobs:          data.jobs,
          drivers:       data.drivers,
          maintenance:   data.maintenance,
          payments:      data.payments,
          salaryEntries: data.salaryEntries,
          attendance:    data.attendance,
          custodyTransactions: data.custody,
          settings:      data.settings,
        });
        localStorage.setItem(lastBackupKey(user.uid), String(Date.now()));
      } catch (err) {
        console.warn("Auto backup failed:", err);
      } finally {
        runningRef.current = false;
      }
    };

    runIfDue();
    window.addEventListener("online", runIfDue);
    const interval = setInterval(runIfDue, 60 * 60 * 1000); // re-check hourly

    return () => {
      window.removeEventListener("online", runIfDue);
      clearInterval(interval);
    };
  }, [user, data.loading]);
};
