import React, { useCallback, useEffect, useState } from "react";
import type { BusinessUnit, ParkingArea, ParkingSession, SpaceCategory, SyncMutation } from "@core/types/schema";
import {
  completeParkingSession,
  createParkingSession,
  formatLicensePlate,
  formatLicensePlateInput,
  isValidLicensePlate,
  normalizeLicensePlate,
  updateActiveParkingSessionPlate,
} from "@core/models/parking-session";
import {
  enqueueOutboxMutation,
  deleteLocalSession,
  getActiveSessions,
  getLocalSessionByPlate,
  getPendingOutboxMutations,
  saveLocalSession,
} from "../db/indexed-db";
import { findStaleActiveSessionIds, getLocalEntryValidationError, mergeActiveParkingSessions } from "../utils/gate-operations";

type OperationMode = "entry" | "exit";

interface VehicleGatePanelProps {
  facilityId: string;
  businessUnits: BusinessUnit[];
  spaceCategories: SpaceCategory[];
  areas?: ParkingArea[];
  operatorUserId: string;
  refreshKey?: number;
  onOperationSuccess?: () => void;
}

const deviceId = "gate-terminal-01";

export const VehicleGatePanel: React.FC<VehicleGatePanelProps> = ({
  facilityId,
  businessUnits,
  spaceCategories,
  areas = [],
  operatorUserId,
  refreshKey = 0,
  onOperationSuccess,
}) => {
  const [mode, setMode] = useState<OperationMode>("entry");
  const [plate, setPlate] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(businessUnits[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState(spaceCategories[0]?.id || "");
  const [selectedArea, setSelectedArea] = useState("");
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [workingSessionId, setWorkingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingPlate, setEditingPlate] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [lastTicket, setLastTicket] = useState<{ ticketNumber: string; plate: string; offline: boolean } | null>(null);

  useEffect(() => {
    if (!businessUnits.some((unit) => unit.id === selectedUnit)) {
      setSelectedUnit(businessUnits[0]?.id || "");
    }
  }, [businessUnits, selectedUnit]);

  useEffect(() => {
    if (!spaceCategories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(spaceCategories[0]?.id || "");
    }
  }, [spaceCategories, selectedCategory]);

  const refreshSessions = useCallback(async () => {
    if (!navigator.onLine) {
      setSessions(await getActiveSessions(facilityId));
      setListError(null);
      setLoadingSessions(false);
      return;
    }

    try {
      const token = localStorage.getItem("auth_token") || "";
      const response = await fetch(`/api/parking-sessions/active?facilityId=${encodeURIComponent(facilityId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la lista de vehículos activos");

      const remoteSessions = (data.sessions || []) as ParkingSession[];
      await Promise.all(remoteSessions.map((session) => saveLocalSession(session)));
      const [localSessions, pendingMutations] = await Promise.all([
        getActiveSessions(facilityId),
        getPendingOutboxMutations(),
      ]);
      const staleSessionIds = findStaleActiveSessionIds({ facilityId, remoteSessions, localSessions, pendingMutations });
      await Promise.all(staleSessionIds.map((sessionId) => deleteLocalSession(sessionId)));
      const reconciledLocalSessions = localSessions.filter((session) => !staleSessionIds.includes(session.id));
      setSessions(mergeActiveParkingSessions({ facilityId, remoteSessions, localSessions: reconciledLocalSessions, pendingMutations }));
      setListError(null);
    } catch (error) {
      const localSessions = await getActiveSessions(facilityId);
      setSessions(localSessions);
      setListError(error instanceof Error ? `${error.message}. Mostrando datos guardados localmente.` : "No se pudo actualizar la lista. Mostrando datos locales.");
    } finally {
      setLoadingSessions(false);
    }
  }, [facilityId]);

  useEffect(() => {
    void refreshSessions();
    const interval = window.setInterval(() => void refreshSessions(), 6000);
    const handleOnline = () => void refreshSessions();
    const handleOffline = () => void refreshSessions();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshSessions, refreshKey]);

  const completeOperation = async (successMessage: string) => {
    setMessage({ text: successMessage, type: "success" });
    await refreshSessions();
    onOperationSuccess?.();
  };

  const queueOfflineMutation = async (mutation: SyncMutation) => {
    await enqueueOutboxMutation(mutation);
  };

  const validateLocalEntry = async (licensePlate: string) => {
    const localSessions = await getActiveSessions(facilityId);
    const error = getLocalEntryValidationError(licensePlate, facilityId, localSessions);
    if (error) setMessage({ text: error, type: "error" });
    return !error;
  };

  const validatePlate = (value: string) => {
    if (!isValidLicensePlate(value)) {
      setMessage({ text: "La patente debe tener seis caracteres alfanuméricos, por ejemplo AA-1A-11.", type: "error" });
      return false;
    }
    return true;
  };

  const handleEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validatePlate(plate)) return;
    if (!selectedUnit || !selectedCategory) {
      setMessage({ text: "Seleccione una unidad y un tipo de espacio para registrar la entrada.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);
    setLastTicket(null);
    try {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanPlate = normalizeLicensePlate(plate);
    const payload = {
      id: sessionId,
      facilityId,
      businessUnitId: selectedUnit,
      spaceCategoryId: selectedCategory,
      parkingAreaId: selectedArea || null,
      licensePlate: cleanPlate,
      entryTime: now,
      deviceId,
    };

    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const response = await fetch("/api/parking-sessions/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage({ text: data.error || "No se pudo registrar la entrada", type: "error" });
          return;
        }
        await saveLocalSession(data.session);
        setLastTicket({ ticketNumber: data.ticket?.ticketNumber || `TK-${Date.now().toString().slice(-6)}`, plate: cleanPlate, offline: false });
      } catch {
        if (!(await validateLocalEntry(cleanPlate))) return;
        const session = createParkingSession({
          id: sessionId,
          facilityId,
          businessUnitId: selectedUnit,
          spaceCategoryId: selectedCategory,
          parkingAreaId: selectedArea || null,
          licensePlate: cleanPlate,
          entryTime: now,
          operatorUserId,
          deviceId,
        });
        await saveLocalSession(session);
        await queueOfflineMutation({
          id: sessionId,
          type: "VEHICLE_ENTRY",
          payload: {
            facilityId,
            businessUnitId: selectedUnit,
            spaceCategoryId: selectedCategory,
            parkingAreaId: selectedArea || null,
            licensePlate: cleanPlate,
            entryTime: now,
            operatorUserId,
          },
          clientTimestamp: now,
          deviceId,
          status: "pending",
          retryCount: 0,
        });
        setLastTicket({ ticketNumber: `OFF-${Date.now().toString().slice(-6)}`, plate: cleanPlate, offline: true });
      }
    } else {
      if (!(await validateLocalEntry(cleanPlate))) return;
      const session = createParkingSession({
        id: sessionId,
        facilityId,
        businessUnitId: selectedUnit,
        spaceCategoryId: selectedCategory,
        parkingAreaId: selectedArea || null,
        licensePlate: cleanPlate,
        entryTime: now,
        operatorUserId,
        deviceId,
      });
      await saveLocalSession(session);
      await queueOfflineMutation({
        id: sessionId,
        type: "VEHICLE_ENTRY",
        payload: {
          facilityId,
          businessUnitId: selectedUnit,
          spaceCategoryId: selectedCategory,
          parkingAreaId: selectedArea || null,
          licensePlate: cleanPlate,
          entryTime: now,
          operatorUserId,
        },
        clientTimestamp: now,
        deviceId,
        status: "pending",
        retryCount: 0,
      });
      setLastTicket({ ticketNumber: `OFF-${Date.now().toString().slice(-6)}`, plate: cleanPlate, offline: true });
    }

    setPlate("");
    await completeOperation("Entrada registrada correctamente.");
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la entrada", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleManualExit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validatePlate(plate)) return;

    setLoading(true);
    setMessage(null);
    try {
    const now = new Date().toISOString();
    const cleanPlate = normalizeLicensePlate(plate);

    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const response = await fetch("/api/parking-sessions/exit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ facilityId, licensePlate: cleanPlate, exitTime: now, deviceId }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage({ text: data.error || "No se pudo registrar la salida", type: "error" });
          return;
        }
        await saveLocalSession(data.session);
      } catch {
        await completeOfflineExit(cleanPlate, now);
      }
    } else {
      await completeOfflineExit(cleanPlate, now);
    }

    setPlate("");
    await completeOperation("Salida registrada correctamente.");
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la salida", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const completeOfflineExit = async (cleanPlate: string, now: string, selectedSession?: ParkingSession) => {
    const currentSession = selectedSession || await getLocalSessionByPlate(cleanPlate, facilityId);
    if (!currentSession) {
      throw new Error(`No se encontró una sesión local activa para ${formatLicensePlate(cleanPlate)}`);
    }
    const updated = completeParkingSession(currentSession, now);
    await saveLocalSession(updated);
    await queueOfflineMutation({
      id: crypto.randomUUID(),
      type: "VEHICLE_EXIT",
      payload: {
        facilityId,
        sessionId: currentSession.id,
        licensePlate: currentSession.licensePlate,
        expectedVersion: currentSession.version,
        exitTime: now,
        operatorUserId,
      },
      clientTimestamp: now,
      deviceId,
      status: "pending",
      retryCount: 0,
    });
  };

  const handleQuickExit = async (session: ParkingSession) => {
    setWorkingSessionId(session.id);
    setMessage(null);
    setLastTicket(null);
    try {
    const now = new Date().toISOString();
    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const response = await fetch(`/api/parking-sessions/${encodeURIComponent(session.id)}/exit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ facilityId, expectedVersion: session.version, exitTime: now }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage({ text: data.error || "No se pudo registrar la salida", type: "error" });
          await refreshSessions();
          return;
        }
        await saveLocalSession(data.session);
      } catch {
        try {
          await completeOfflineExit(session.licensePlate, now, session);
        } catch (error) {
          setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la salida local", type: "error" });
          return;
        }
      }
    } else {
      try {
        await completeOfflineExit(session.licensePlate, now, session);
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la salida local", type: "error" });
        return;
      }
    }

    await completeOperation(`Salida registrada para ${formatLicensePlate(session.licensePlate)}.`);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la salida", type: "error" });
    } finally {
      setWorkingSessionId(null);
    }
  };

  const handleSavePlate = async (session: ParkingSession) => {
    if (!validatePlate(editingPlate)) return;
    setWorkingSessionId(session.id);
    setMessage(null);
    try {
    const cleanPlate = normalizeLicensePlate(editingPlate);

    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const response = await fetch(`/api/parking-sessions/${encodeURIComponent(session.id)}/plate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ facilityId, licensePlate: cleanPlate, expectedVersion: session.version }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage({ text: data.error || "No se pudo corregir la patente", type: "error" });
          await refreshSessions();
          return;
        }
        await saveLocalSession(data.session);
      } catch {
        await saveOfflinePlateCorrection(session, cleanPlate);
      }
    } else {
      try {
        await saveOfflinePlateCorrection(session, cleanPlate);
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "No se pudo corregir la patente localmente", type: "error" });
        setWorkingSessionId(null);
        return;
      }
    }

    setEditingSessionId(null);
    await completeOperation(`Patente corregida a ${formatLicensePlate(cleanPlate)}.`);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo corregir la patente", type: "error" });
    } finally {
      setWorkingSessionId(null);
    }
  };

  const saveOfflinePlateCorrection = async (session: ParkingSession, cleanPlate: string) => {
    const localSessions = await getActiveSessions(facilityId);
    const updated = updateActiveParkingSessionPlate({
      currentSession: session,
      licensePlate: cleanPlate,
      existingSessions: localSessions,
      expectedVersion: session.version,
    });
    await saveLocalSession(updated);
    const now = new Date().toISOString();
    await queueOfflineMutation({
      id: crypto.randomUUID(),
      type: "VEHICLE_PLATE_UPDATE",
      payload: { facilityId, sessionId: session.id, licensePlate: cleanPlate, expectedVersion: session.version, operatorUserId },
      clientTimestamp: now,
      deviceId,
      status: "pending",
      retryCount: 0,
    });
  };

  const handleSubmit = (event: React.FormEvent) => mode === "entry" ? handleEntry(event) : handleManualExit(event);

  return (
    <div className="gate-workspace">
      <section className="glass-panel gate-operation-card" data-testid="vehicle-operation-card" aria-labelledby="gate-operation-title">
        <div className="gate-operation-header">
          <div>
            <span className="gate-eyebrow">OPERACIÓN DE GARITA</span>
            <h2 id="gate-operation-title">Registro de vehículos</h2>
            <p>Seleccione el movimiento que desea registrar.</p>
          </div>
          <div className="gate-mode-switch" role="group" aria-label="Tipo de operación">
            <button type="button" aria-pressed={mode === "entry"} className={mode === "entry" ? "active" : ""} onClick={() => { setMode("entry"); setMessage(null); setLastTicket(null); }}>
              <span aria-hidden="true">↙</span> Entrada
            </button>
            <button type="button" aria-pressed={mode === "exit"} className={mode === "exit" ? "active" : ""} onClick={() => { setMode("exit"); setMessage(null); setLastTicket(null); }}>
              <span aria-hidden="true">↗</span> Salida
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="gate-license-plate">Patente</label>
            <input
              id="gate-license-plate"
              type="text"
              className="form-input plate-input"
              placeholder="AA-1A-11"
              aria-describedby="gate-plate-hint"
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              maxLength={8}
              value={plate}
              onChange={(event) => setPlate(formatLicensePlateInput(event.target.value))}
              required
              autoFocus
            />
            <span id="gate-plate-hint" className="gate-input-hint">Seis letras o números · se agrupa automáticamente como XX-XX-XX</span>
          </div>

          {mode === "entry" && (
            <div className="gate-entry-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="gate-business-unit">Unidad / destino</label>
                <select id="gate-business-unit" className="form-select" value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)} required>
                  {businessUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gate-space-category">Tipo de espacio</label>
                <select id="gate-space-category" className="form-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} required>
                  {spaceCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="form-group gate-area-field">
                <label className="form-label" htmlFor="gate-parking-area">Área / sector</label>
                <select id="gate-parking-area" className="form-select" value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>
                  <option value="">Asignación automática / flotante</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>[{area.code}] {area.name} · {area.allocatedCapacity} plazas</option>)}
                </select>
              </div>
            </div>
          )}

          <button type="submit" className={`btn ${mode === "entry" ? "btn-primary" : "btn-danger"} gate-submit`} disabled={loading}>
            {loading ? "Procesando…" : mode === "entry" ? "Registrar entrada" : "Registrar salida"}
          </button>
        </form>

        {message && <div className={`gate-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>}
        {lastTicket && <div className="gate-ticket" role="status">
          <span>{lastTicket.offline ? "INGRESO GUARDADO OFFLINE" : "INGRESO REGISTRADO"}</span>
          <strong>{formatLicensePlate(lastTicket.plate)}</strong>
          <small>Comprobante {lastTicket.ticketNumber}</small>
        </div>}
      </section>

      <section className="glass-panel gate-active-panel" aria-labelledby="active-vehicles-title">
        <div className="gate-active-header">
          <div>
            <span className="gate-eyebrow">EN EL RECINTO</span>
            <h2 id="active-vehicles-title">Vehículos activos</h2>
          </div>
          <span className="gate-count" aria-label={`${sessions.length} vehículos activos`}>{sessions.length}</span>
        </div>

        {listError && <div className="gate-list-error" role="alert">
          <span>{listError}</span>
          <button type="button" className="btn btn-secondary" onClick={() => void refreshSessions()}>Reintentar</button>
        </div>}

        {loadingSessions && sessions.length === 0 ? (
          <p className="gate-list-empty" role="status">Cargando vehículos activos…</p>
        ) : sessions.length === 0 ? (
          <p className="gate-list-empty">No hay vehículos activos en este momento.</p>
        ) : (
          <div className="gate-session-list" role="list" aria-label="Lista de vehículos activos">
            {sessions.map((session) => {
              const unitName = businessUnits.find((unit) => unit.id === session.businessUnitId)?.name || "Unidad no disponible";
              const areaName = areas.find((area) => area.id === session.parkingAreaId)?.name;
              const isEditing = editingSessionId === session.id;
              const isWorking = workingSessionId === session.id;
              return <article className="gate-session-row" role="listitem" key={session.id}>
                <div className="gate-session-main">
                  {isEditing ? (
                    <div className="gate-edit-plate">
                      <label className="form-label" htmlFor={`edit-plate-${session.id}`}>Corregir patente</label>
                      <input
                        id={`edit-plate-${session.id}`}
                        type="text"
                        className="form-input plate-input"
                        aria-label={`Nueva patente de ${formatLicensePlate(session.licensePlate)}`}
                        maxLength={8}
                        value={editingPlate}
                        onChange={(event) => setEditingPlate(formatLicensePlateInput(event.target.value))}
                      />
                    </div>
                  ) : <strong className="gate-session-plate">{formatLicensePlate(session.licensePlate)}</strong>}
                  <span className="gate-session-context">{unitName}{areaName ? ` · ${areaName}` : " · Sector flotante"}</span>
                  <time className="gate-session-time" dateTime={session.entryTime}>Entrada {new Date(session.entryTime).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</time>
                </div>
                <div className="gate-session-actions">
                  {isEditing ? <>
                    <button type="button" className="btn btn-primary" onClick={() => void handleSavePlate(session)} disabled={isWorking}>Guardar</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditingSessionId(null); setEditingPlate(""); }}>Cancelar</button>
                  </> : <>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditingSessionId(session.id); setEditingPlate(formatLicensePlate(session.licensePlate)); setMessage(null); }}>Editar patente</button>
                    <button type="button" className="btn btn-danger gate-row-exit" onClick={() => void handleQuickExit(session)} disabled={isWorking} aria-label={`Registrar salida de ${formatLicensePlate(session.licensePlate)}`}>
                      {isWorking ? "Procesando…" : "Registrar salida"}
                    </button>
                  </>}
                </div>
              </article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
};
