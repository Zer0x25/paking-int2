import { useEffect, useRef } from "react";
import { getPageClientId } from "../api/client";
import { FacilityChangedEventSchema, type FacilityChangeScope } from "../../shared/facility-events";

interface UseFacilityEventsOptions {
  facilityId: string | undefined;
  enabled: boolean;
  onRefresh: (scopes?: readonly FacilityChangeScope[]) => void;
}

export function useFacilityEvents({ facilityId, enabled, onRefresh }: UseFacilityEventsOptions): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !facilityId || typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const clientId = getPageClientId();
    const url = new URL(`/api/events/${encodeURIComponent(facilityId)}`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const protocols = ["parking-events-v1", token, clientId];
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let refreshTimer: number | undefined;
    let reconnectAttempt = 0;
    let connectedBefore = false;
    let deferredRefresh = false;
    let pendingFullRefresh = false;
    const pendingScopes = new Set<FacilityChangeScope>();

    const flushRefresh = () => {
      const scopes = pendingFullRefresh ? undefined : [...pendingScopes];
      pendingFullRefresh = false;
      pendingScopes.clear();
      onRefreshRef.current(scopes);
    };

    const schedulePendingRefresh = () => {
      if (document.visibilityState !== "visible") {
        deferredRefresh = true;
        return;
      }
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        flushRefresh();
      }, 60);
    };

    const scheduleRefresh = (scopes?: readonly FacilityChangeScope[]) => {
      if (scopes === undefined) pendingFullRefresh = true;
      else scopes.forEach((scope) => pendingScopes.add(scope));
      schedulePendingRefresh();
    };

    const scheduleReconnect = () => {
      if (disposed || !navigator.onLine || reconnectTimer !== undefined) return;
      const delay = Math.min(500 * (2 ** reconnectAttempt), 30_000);
      reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed || !navigator.onLine) return;
      socket = new WebSocket(url.toString(), protocols);
      const currentSocket = socket;
      currentSocket.onopen = () => {
        reconnectAttempt = 0;
        if (connectedBefore) scheduleRefresh();
        connectedBefore = true;
      };
      currentSocket.onmessage = (message) => {
        if (typeof message.data !== "string") return;
        let decoded: unknown;
        try {
          decoded = JSON.parse(message.data) as unknown;
        } catch {
          return;
        }
        const parsed = FacilityChangedEventSchema.safeParse(decoded);
        if (!parsed.success || parsed.data.facilityId !== facilityId || parsed.data.sourceClientId === clientId) return;
        scheduleRefresh([parsed.data.scope]);
      };
      currentSocket.onerror = () => currentSocket.close();
      currentSocket.onclose = () => scheduleReconnect();
    };

    const handleOnline = () => {
      if (!socket || socket.readyState === WebSocket.CLOSED) connect();
    };
    const handleOffline = () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && deferredRefresh) {
        deferredRefresh = false;
        schedulePendingRefresh();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    connect();

    return () => {
      disposed = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "session ended");
    };
  }, [enabled, facilityId]);
}
