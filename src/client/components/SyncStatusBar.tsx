import React, { useEffect, useRef, useState } from "react";
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
  const syncLock = useRef(false);

  const checkPending = async () => {
    try {
      const pending = await getPendingOutboxMutations();
      setPendingCount(pending.length);
    } catch {
      // Ignored if indexedDB is not available
    }
  };

  const runSync = async () => {
    if (!navigator.onLine || syncLock.current) return;
    syncLock.current = true;
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
      syncLock.current = false;
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

  const canSync = isOnline && pendingCount > 0 && !isSyncing;
  const pendingDescription = pendingCount === 1 ? "1 cambio pendiente" : `${pendingCount} cambios pendientes`;
  const statusDescription = isSyncing
    ? `Conectado. Sincronizando ${pendingDescription}.`
    : isOnline
      ? pendingCount > 0
        ? `Conectado. ${pendingDescription}. Pulsa el indicador para sincronizar ahora.`
        : "Conectado. Sin cambios pendientes de sincronización."
      : pendingCount > 0
        ? `Sin conexión. ${pendingDescription}. Se sincronizarán al recuperar la conexión.`
        : "Sin conexión. Los cambios nuevos se guardarán para sincronizarse después.";
  const statusTitle = lastSyncTime
    ? `${statusDescription} Última sincronización: ${lastSyncTime}.`
    : statusDescription;

  return (
    <div className="sync-indicator">
      <button
        type="button"
        className={`sync-indicator-button ${isOnline ? "sync-online" : "sync-offline"} ${isSyncing ? "is-syncing" : ""}`}
        aria-label={statusTitle}
        aria-describedby="sync-status-description"
        aria-busy={isSyncing}
        title={statusTitle}
        disabled={!canSync}
        onClick={() => { void runSync(); }}
      >
        {isOnline ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.8a15.7 15.7 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 3.2a6 6 0 0 1 8 0" />
            <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 2 20 20M8.5 8.5a6 6 0 0 1 7 1.3M5 12a11 11 0 0 1 2.4-1.7m4.6 8.2.01 0M2 8.8a15.7 15.7 0 0 1 3.5-2.2M22 8.8a15.7 15.7 0 0 0-4.2-2.5" />
          </svg>
        )}
        {pendingCount > 0 && (
          <span className="sync-pending-badge" aria-hidden="true">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>
      <span id="sync-status-description" className="sr-only" role="status" aria-live="polite">
        {statusDescription}
      </span>
    </div>
  );
};
