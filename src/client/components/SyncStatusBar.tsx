import React, { useEffect, useState } from "react";
import { getPendingOutboxMutations } from "../db/indexed-db";
import { processDeltaSync } from "../db/outbox-sync";

interface SyncStatusBarProps {
  facilityId: string;
  onSyncCompleted?: () => void;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ facilityId, onSyncCompleted }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const checkPending = async () => {
    try {
      const pending = await getPendingOutboxMutations();
      setPendingCount(pending.length);
    } catch {
      // Ignored if indexedDB is not available
    }
  };

  const runSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await processDeltaSync(facilityId, "gate-pwa-01");
      if (result.processed > 0) {
        setLastSyncTime(new Date().toLocaleTimeString());
        if (onSyncCompleted) onSyncCompleted();
      }
    } catch (err) {
      console.warn("Error durante sincronización delta:", err);
    } finally {
      setIsSyncing(false);
      await checkPending();
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    checkPending();
    const interval = setInterval(() => {
      checkPending();
      if (navigator.onLine && pendingCount > 0) {
        runSync();
      }
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [facilityId, pendingCount]);

  return (
    <div className={`sync-banner ${isOnline ? "sync-online" : "sync-offline"}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>{isOnline ? "● Conectado (Online)" : "▲ Sin conexión de red (Modo Offline)"}</span>
        {pendingCount > 0 && (
          <span style={{ opacity: 0.9 }}>
            — {pendingCount} mutaciones pendientes de envío
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {lastSyncTime && (
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
            Última sync: {lastSyncTime}
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={runSync}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.65rem", fontSize: "0.8rem" }}
          >
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        )}
      </div>
    </div>
  );
};
