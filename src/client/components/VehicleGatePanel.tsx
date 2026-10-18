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
import { createUuid } from "@core/utils/uuid";
import { apiFetch } from "../api/client";

type GateStep = "plate" | "entry-details";

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
  const [step, setStep] = useState<GateStep>("plate");
  const [plate, setPlate] = useState("");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(businessUnits[0]?.id || "");
  const entrySpaceCategories = spaceCategories.filter((category) => category.code === "STD" || category.code === "ACC");
  const standardCategory = entrySpaceCategories.find((category) => category.code === "STD");
  const [selectedCategory, setSelectedCategory] = useState(standardCategory?.id || entrySpaceCategories[0]?.id || "");
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
  const [suggestedAreaId, setSuggestedAreaId] = useState<string | null>(null);
  const [standardFallbackAvailable, setStandardFallbackAvailable] = useState(false);
  const [standardFallbackConfirmed, setStandardFallbackConfirmed] = useState(false);

  const normalizedPlate = normalizeLicensePlate(plate);
  const plateIsComplete = isValidLicensePlate(plate);
  const activePlateSession = !loadingSessions && plateIsComplete
    ? sessions.find((session) =>
      session.facilityId === facilityId &&
      session.status === "active" &&
      normalizeLicensePlate(session.licensePlate) === normalizedPlate
    )
    : undefined;
  const plateSuggestions = !loadingSessions && step === "plate" && normalizedPlate.length > 0 && !activePlateSession
    ? sessions
      .filter((session) =>
        session.facilityId === facilityId &&
        session.status === "active" &&
        normalizeLicensePlate(session.licensePlate).startsWith(normalizedPlate)
      )
      .slice(0, 5)
    : [];
  const suggestionsVisible = !suggestionsDismissed && plateSuggestions.length > 0;

  useEffect(() => {
    if (!businessUnits.some((unit) => unit.id === selectedUnit)) {
      setSelectedUnit(businessUnits[0]?.id || "");
    }
  }, [businessUnits, selectedUnit]);

  useEffect(() => {
    if (!entrySpaceCategories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory(standardCategory?.id || entrySpaceCategories[0]?.id || "");
    }
  }, [spaceCategories, selectedCategory, standardCategory?.id]);

  const getCategoryCode = (spaceCategoryId: string): "STD" | "ACC" =>
    spaceCategories.find((category) => category.id === spaceCategoryId)?.code === "ACC" ? "ACC" : "STD";

  const getAreaAvailability = (area: ParkingArea, code: "STD" | "ACC") => {
    const categoryIds = new Set(entrySpaceCategories.filter((category) => category.code === code).map((category) => category.id));
    const occupied = sessions.filter((session) => session.status === "active" && session.parkingAreaId === area.id && (code === "ACC"
      ? categoryIds.has(session.spaceCategoryId)
      : !spaceCategories.some((category) => category.code === "ACC" && category.id === session.spaceCategoryId))).length;
    const capacity = code === "ACC" ? area.accessibleCapacity ?? 0 : area.standardCapacity ?? area.allocatedCapacity;
    return Math.max(0, capacity - occupied);
  };

  const getFloatingAvailability = (code: "STD" | "ACC") => {
    const category = entrySpaceCategories.find((item) => item.code === code);
    const assignedCapacity = areas.filter((area) => area.isActive).reduce((sum, area) => sum + (code === "ACC"
      ? area.accessibleCapacity ?? 0
      : area.standardCapacity ?? area.allocatedCapacity), 0);
    const capacity = Math.max(0, (category?.allocatedSlots ?? 0) - assignedCapacity);
    const occupied = sessions.filter((session) => session.status === "active" && !session.parkingAreaId && (code === "ACC"
      ? getCategoryCode(session.spaceCategoryId) === "ACC"
      : getCategoryCode(session.spaceCategoryId) !== "ACC")).length;
    return Math.max(0, capacity - occupied);
  };

  const confirmStandardFallback = () => {
    if (!standardCategory) return;
    setSelectedCategory(standardCategory.id);
    setStandardFallbackAvailable(false);
    setStandardFallbackConfirmed(true);
    setSuggestedAreaId(null);
    setMessage({ text: "Vas a registrar este vehículo en una plaza Estándar. Confirma para continuar.", type: "error" });
  };
  const currentArea = areas.find((area) => area.id === selectedArea);
  const selectedCategoryCode = getCategoryCode(selectedCategory);

  const getSessionDisplayContext = (session: ParkingSession) => {
    const unitName = businessUnits.find((unit) => unit.id === session.businessUnitId)?.name || "Unidad no disponible";
    const categoryName = spaceCategories.find((category) => category.id === session.spaceCategoryId)?.name || "Tipo de espacio no disponible";
    const areaName = areas.find((area) => area.id === session.parkingAreaId)?.name || "Sector flotante";
    return `${unitName} · ${categoryName} · ${areaName}`;
  };

  const selectPlateSuggestion = (session: ParkingSession) => {
    setPlate(formatLicensePlateInput(session.licensePlate));
    setSuggestionsDismissed(true);
    setActiveSuggestionIndex(-1);
    setMessage(null);
    setLastTicket(null);
  };

  const handlePlateKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && suggestionsVisible) {
      event.preventDefault();
      setSuggestionsDismissed(true);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (!suggestionsVisible || plateSuggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => current < 0 || current >= plateSuggestions.length - 1 ? 0 : current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => current <= 0 ? plateSuggestions.length - 1 : current - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeSuggestionIndex >= 0) selectPlateSuggestion(plateSuggestions[activeSuggestionIndex]);
    }
  };

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    if (!navigator.onLine) {
      setSessions(await getActiveSessions(facilityId));
      setListError(null);
      setLoadingSessions(false);
      return;
    }

    try {
      const response = await apiFetch(`/api/parking-sessions/active?facilityId=${encodeURIComponent(facilityId)}`);
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
    const handleOnline = () => void refreshSessions();
    const handleOffline = () => void refreshSessions();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshSessions();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
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
    const sessionId = createUuid();
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
        const response = await apiFetch("/api/parking-sessions/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage({ text: data.error || "No se pudo registrar la entrada", type: "error" });
          setSuggestedAreaId(typeof data.suggestedParkingAreaId === "string" ? data.suggestedParkingAreaId : null);
          setStandardFallbackAvailable(data.allowStandardFallback === true && getCategoryCode(selectedCategory) === "ACC");
          return;
        }
        await saveLocalSession(data.session);
        setSuggestedAreaId(null);
        setStandardFallbackAvailable(false);
        setStandardFallbackConfirmed(false);
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
    setStep("plate");
    await completeOperation("Entrada registrada correctamente.");
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo registrar la entrada", type: "error" });
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
      id: createUuid(),
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

  const handleQuickExit = async (session: ParkingSession, clearPlateAfterSuccess = false) => {
    setWorkingSessionId(session.id);
    setMessage(null);
    setLastTicket(null);
    try {
    const now = new Date().toISOString();
    if (navigator.onLine) {
      try {
        const response = await apiFetch(`/api/parking-sessions/${encodeURIComponent(session.id)}/exit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

    if (clearPlateAfterSuccess) {
      setPlate("");
      setSuggestionsDismissed(false);
      setActiveSuggestionIndex(-1);
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
        const response = await apiFetch(`/api/parking-sessions/${encodeURIComponent(session.id)}/plate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
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
      id: createUuid(),
      type: "VEHICLE_PLATE_UPDATE",
      payload: { facilityId, sessionId: session.id, licensePlate: cleanPlate, expectedVersion: session.version, operatorUserId },
      clientTimestamp: now,
      deviceId,
      status: "pending",
      retryCount: 0,
    });
  };

  const handlePlateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (loadingSessions || activePlateSession) return;
    if (!validatePlate(plate)) return;
    setMessage(null);
    setLastTicket(null);
    setSuggestionsDismissed(true);
    setActiveSuggestionIndex(-1);
    setPlate(formatLicensePlateInput(plate));
    setStep("entry-details");
  };

  const returnToPlate = () => {
    setMessage(null);
    setStep("plate");
    setSuggestionsDismissed(false);
    setActiveSuggestionIndex(-1);
  };

  return (
    <div className="gate-workspace">
      <section className="glass-panel gate-operation-card" data-testid="vehicle-operation-card" aria-labelledby="gate-operation-title">
        <div className="gate-operation-header">
          <div>
            <span className="gate-eyebrow">OPERACIÓN DE GARITA</span>
            <h2 id="gate-operation-title">Registro de vehículos</h2>
            <p>{step === "plate" ? "Ingresa la patente; el sistema indicará el movimiento disponible." : "Revisa los datos antes de confirmar la entrada."}</p>
          </div>
          <span className="gate-step-indicator" role="status" aria-live="polite">
            {step === "plate" ? "Paso 1 de 2 · Patente y movimiento" : "Paso 2 de 2 · Confirmación de entrada"}
          </span>
        </div>

        {step === "plate" && <form onSubmit={handlePlateSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="gate-license-plate">Patente</label>
            <div className="gate-plate-search">
              <input
                id="gate-license-plate"
                type="text"
                role="combobox"
                className="form-input plate-input"
                placeholder="AA-1A-11"
                aria-describedby="gate-plate-hint"
                aria-autocomplete="list"
                aria-expanded={suggestionsVisible}
                aria-controls={suggestionsVisible ? "gate-active-plate-options" : undefined}
                aria-activedescendant={suggestionsVisible && activeSuggestionIndex >= 0 ? `gate-active-plate-option-${activeSuggestionIndex}` : undefined}
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                maxLength={8}
                value={plate}
                onChange={(event) => {
                  setPlate(formatLicensePlateInput(event.target.value));
                  setActiveSuggestionIndex(-1);
                  setSuggestionsDismissed(false);
                  setMessage(null);
                  setLastTicket(null);
                }}
                onKeyDown={handlePlateKeyDown}
                required
                autoFocus
              />
              {suggestionsVisible && <div id="gate-active-plate-options" className="gate-plate-suggestions" role="listbox" aria-label="Vehículos activos">
                {plateSuggestions.map((session, index) => <div
                  id={`gate-active-plate-option-${index}`}
                  className={`gate-plate-suggestion${activeSuggestionIndex === index ? " is-active" : ""}`}
                  key={session.id}
                  role="option"
                  aria-selected={activeSuggestionIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPlateSuggestion(session)}
                >
                  <strong className="gate-session-plate">{formatLicensePlate(session.licensePlate)}</strong>
                  <span className="gate-session-context">{getSessionDisplayContext(session)}</span>
                  <time className="gate-session-time" dateTime={session.entryTime}>Entrada {new Date(session.entryTime).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</time>
                </div>)}
              </div>}
            </div>
            <span id="gate-plate-hint" className="gate-input-hint">Seis letras o números · se agrupa automáticamente como XX-XX-XX</span>
          </div>

          {loadingSessions && normalizedPlate.length > 0 && <p className="gate-search-status" role="status">Consultando vehículos activos…</p>}

          {activePlateSession && <div className="gate-active-match" aria-live="polite">
            <div role="status">
              <span className="gate-eyebrow">VEHÍCULO DENTRO DEL RECINTO</span>
              <strong className="gate-session-plate">{formatLicensePlate(activePlateSession.licensePlate)}</strong>
              <span className="gate-session-context">{getSessionDisplayContext(activePlateSession)}</span>
              <time className="gate-session-time" dateTime={activePlateSession.entryTime}>Entrada {new Date(activePlateSession.entryTime).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</time>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleQuickExit(activePlateSession, true)}
              disabled={workingSessionId === activePlateSession.id}
            >
              {workingSessionId === activePlateSession.id ? "Procesando…" : "Registrar salida"}
            </button>
          </div>}

          {plateIsComplete && !activePlateSession && !loadingSessions && message?.type !== "error" && <button type="submit" className="btn btn-primary gate-submit" disabled={loading}>
            Registrar entrada
          </button>}
        </form>}

        {step === "entry-details" && <form onSubmit={handleEntry} noValidate>
          <div className="gate-plate-summary">
            <span>Patente a ingresar</span>
            <strong>{formatLicensePlate(plate)}</strong>
          </div>

          <div className="gate-entry-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="gate-business-unit">Unidad / destino</label>
              <select id="gate-business-unit" className="form-select" value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)} required>
                {businessUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gate-space-category">Tipo de espacio</label>
              <select id="gate-space-category" className="form-select" value={selectedCategory} onChange={(event) => {
                setSelectedCategory(event.target.value);
                setSuggestedAreaId(null);
                setStandardFallbackAvailable(false);
                setStandardFallbackConfirmed(false);
                setMessage(null);
              }} required>
                {entrySpaceCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="form-group gate-area-field">
              <label className="form-label" htmlFor="gate-parking-area">Área / sector</label>
              <select id="gate-parking-area" className="form-select" value={selectedArea} onChange={(event) => {
                setSelectedArea(event.target.value);
                setSuggestedAreaId(null);
                setStandardFallbackAvailable(false);
                setStandardFallbackConfirmed(false);
                setMessage(null);
              }}>
                <option value="">Asignación automática / flotante</option>
                {areas.filter((area) => area.isActive).map((area) => <option key={area.id} value={area.id}>
                  [{area.code}] {area.name} · {getAreaAvailability(area, "STD")} Estándar / {getAreaAvailability(area, "ACC")} Accesibles libres
                </option>)}
              </select>
            </div>
          </div>

          <div className="gate-capacity-hint" role="status">
            {currentArea
              ? `Disponibles en el área: ${getAreaAvailability(currentArea, selectedCategoryCode)} ${selectedCategoryCode === "ACC" ? "Accesibles" : "Estándar"}.`
              : `Reserva flotante: ${getFloatingAvailability(selectedCategoryCode)} ${selectedCategoryCode === "ACC" ? "Accesibles" : "Estándar"} disponibles.`}
          </div>

          {suggestedAreaId && <div className="gate-capacity-prompt" role="status">
            <span>{message?.text}</span>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setSelectedArea(suggestedAreaId);
              setSuggestedAreaId(null);
              setMessage(null);
            }}>Usar área {areas.find((area) => area.id === suggestedAreaId)?.name || "sugerida"}</button>
          </div>}

          {standardFallbackAvailable && <div className="gate-capacity-prompt" role="alert">
            <span>{message?.text} Las plazas Accesibles seguirán protegidas.</span>
            <button type="button" className="btn btn-secondary" onClick={confirmStandardFallback}>Usar una plaza Estándar</button>
          </div>}

          <div className="gate-step-actions">
            <button type="button" className="btn btn-secondary" onClick={returnToPlate} disabled={loading}>Volver</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Procesando…" : standardFallbackConfirmed ? "Confirmar entrada Estándar" : "Confirmar entrada"}
            </button>
          </div>
        </form>}

        {message && !suggestedAreaId && !standardFallbackAvailable && <div className={`gate-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>}
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
