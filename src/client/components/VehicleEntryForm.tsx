import React, { useState } from "react";
import type { BusinessUnit, SpaceCategory, ParkingArea } from "@core/types/schema";
import { normalizeLicensePlate, createParkingSession } from "@core/models/parking-session";
import { saveLocalSession, enqueueOutboxMutation } from "../db/indexed-db";

interface VehicleEntryFormProps {
  facilityId: string;
  businessUnits: BusinessUnit[];
  spaceCategories: SpaceCategory[];
  areas?: ParkingArea[];
  onEntrySuccess?: () => void;
}

interface EntryTicket {
  ticketNumber: string;
  plate: string;
  entryTime: string;
  unitName: string;
  areaName: string;
  offline?: boolean;
}

export const VehicleEntryForm: React.FC<VehicleEntryFormProps> = ({
  facilityId,
  businessUnits,
  spaceCategories,
  areas = [],
  onEntrySuccess,
}) => {
  const [plate, setPlate] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(businessUnits[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState(spaceCategories[0]?.id || "");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastTicket, setLastTicket] = useState<EntryTicket | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = normalizeLicensePlate(plate);
    if (!cleanPlate || cleanPlate.length < 3) {
      setMessage({ text: "Ingrese una patente válida (mínimo 3 caracteres)", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    const targetUnit = selectedUnit || businessUnits[0]?.id;
    const targetCategory = selectedCategory || spaceCategories[0]?.id;
    const targetArea = selectedArea || null;
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    const payload = {
      id: sessionId,
      facilityId,
      businessUnitId: targetUnit,
      spaceCategoryId: targetCategory,
      parkingAreaId: targetArea,
      licensePlate: cleanPlate,
      entryTime: now,
      deviceId: "gate-terminal-01",
    };

    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch("/api/parking-sessions/entry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          setMessage({ text: data.error || "No se pudo registrar el ingreso", type: "error" });
          setLoading(false);
          return;
        }

        // Cache locally as well
        await saveLocalSession(data.session);

        const areaName = areas.find((a) => a.id === targetArea)?.name;
        setLastTicket({
          ticketNumber: data.ticket?.ticketNumber || `TK-${Date.now().toString().slice(-6)}`,
          plate: cleanPlate,
          entryTime: now,
          unitName: businessUnits.find((u) => u.id === targetUnit)?.name || "General",
          areaName: areaName || "Sector Libre",
        });

        setMessage({ text: `✓ Ingreso registrado exitosamente (Online)`, type: "success" });
        setPlate("");
        if (onEntrySuccess) onEntrySuccess();
      } catch {
        // Fallback to offline registration on network error
        await handleOfflineEntry(sessionId, cleanPlate, targetUnit, targetCategory, targetArea, now);
      }
    } else {
      // Direct Offline mode
      await handleOfflineEntry(sessionId, cleanPlate, targetUnit, targetCategory, targetArea, now);
    }

    setLoading(false);
  };

  const handleOfflineEntry = async (
    sessionId: string,
    cleanPlate: string,
    targetUnit: string,
    targetCategory: string,
    targetArea: string | null,
    now: string
  ) => {
    const session = createParkingSession({
      id: sessionId,
      facilityId,
      businessUnitId: targetUnit,
      spaceCategoryId: targetCategory,
      parkingAreaId: targetArea,
      licensePlate: cleanPlate,
      entryTime: now,
      operatorUserId: "offline-operator",
      deviceId: "gate-terminal-01",
    });

    await saveLocalSession(session);
    await enqueueOutboxMutation({
      id: sessionId,
      type: "VEHICLE_ENTRY",
      payload: {
        facilityId,
        businessUnitId: targetUnit,
        spaceCategoryId: targetCategory,
        parkingAreaId: targetArea,
        licensePlate: cleanPlate,
        entryTime: now,
      },
      clientTimestamp: now,
      deviceId: "gate-terminal-01",
      status: "pending",
      retryCount: 0,
    });

    const areaName = areas.find((a) => a.id === targetArea)?.name;
    setLastTicket({
      ticketNumber: `OFF-${Date.now().toString().slice(-6)}`,
      plate: cleanPlate,
      entryTime: now,
      unitName: businessUnits.find((u) => u.id === targetUnit)?.name || "General",
      areaName: areaName || "Sector Libre",
      offline: true,
    });

    setMessage({
      text: `✓ Ingreso registrado en modo Offline (Pendiente de sincronización)`,
      type: "success",
    });
    setPlate("");
    if (onEntrySuccess) onEntrySuccess();
  };

  return (
    <div className="glass-panel" style={{ padding: "2rem" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Registrar Entrada de Vehículo
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Placa Patente del Vehículo</label>
          <input
            type="text"
            className="form-input plate-input"
            placeholder="AB123CD"
            maxLength={10}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            required
            autoFocus
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label">Unidad / Destino</label>
            <select
              className="form-select"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              {businessUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.quotaType === "guaranteed" ? "Garantizado" : "Dinámico"})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Espacio</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {spaceCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Parking Area Selector (Feature 002) */}
        <div className="form-group">
          <label className="form-label">Área / Sector Físico de Estacionamiento</label>
          <select
            className="form-select"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            <option value="">(Asignación Automática / Flotante)</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                [{area.code}] {area.name} — {area.allocatedCapacity} plazas
                {area.businessUnitId ? " (Exclusiva)" : " (Compartida)"}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
        >
          {loading ? "Registrando..." : "Confirmar Ingreso (Barrera Abierta)"}
        </button>
      </form>

      {message && (
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.85rem",
            borderRadius: "8px",
            backgroundColor: `var(${message.type === "success" ? "--color-success-surface" : "--color-danger-surface"})`,
            border: `1px solid var(${message.type === "success" ? "--color-success" : "--color-danger"})`,
            color: `var(${message.type === "success" ? "--color-success" : "--color-danger"})`,
            fontWeight: 500,
          }}
        >
          {message.text}
        </div>
      )}

      {lastTicket && (
        <div
          className="glass-panel"
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            borderStyle: "dashed",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>TICKET DE ACCESO</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-mono)", margin: "0.25rem 0" }}>
            {lastTicket.plate}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Ticket: {lastTicket.ticketNumber} | Destino: {lastTicket.unitName}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-info)", fontWeight: 600, marginTop: "0.2rem" }}>
            Sector Asignado: {lastTicket.areaName}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Hora: {new Date(lastTicket.entryTime).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};
