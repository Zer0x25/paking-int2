import React, { useState } from "react";
import type { Facility, BusinessUnit, EventBooking } from "@core/types/schema";

interface FacilityConfigViewProps {
  facility: Facility | null;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  onRefresh?: () => void;
}

export const FacilityConfigView: React.FC<FacilityConfigViewProps> = ({
  facility,
  businessUnits,
  events,
}) => {
  const [newBuName, setNewBuName] = useState("");
  const [newBuCode, setNewBuCode] = useState("");
  const [newBuQuota, setNewBuQuota] = useState(10);
  const [newBuType, setNewBuType] = useState<"guaranteed" | "contractual" | "dynamic">("dynamic");
  const [msg, setMsg] = useState("");

  const handleCreateBU = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuName || !newBuCode) return;
    businessUnits.push({
      id: crypto.randomUUID(),
      facilityId: facility?.id || "fac-default-01",
      name: newBuName,
      code: newBuCode.toUpperCase(),
      priorityLevel: newBuType === "guaranteed" ? 1 : newBuType === "contractual" ? 2 : 3,
      quotaType: newBuType,
      defaultQuota: Number(newBuQuota),
      isActive: true,
    });
    setMsg(`✓ Unidad de negocio "${newBuName}" agregada.`);
    setNewBuName("");
    setNewBuCode("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
      {/* Current Facility Details */}
      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1rem" }}>
          Parámetros de la Instalación
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.95rem" }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Nombre del Recinto: </span>
            <strong style={{ color: "var(--text-primary)" }}>{facility?.name || "No configurado"}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Ubicación: </span>
            <span>{facility?.address || "Av. Costanera 1000"}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Capacidad Total de Plazas: </span>
            <strong style={{ color: "var(--accent-primary)", fontSize: "1.2rem", fontFamily: "var(--font-mono)" }}>
              {facility?.totalCapacity || 100}
            </strong>
          </div>
        </div>

        <h4 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "2rem", marginBottom: "0.75rem" }}>
          Eventos y Reservas Contractuales Activas
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {events.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No hay eventos programados</p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: "0.75rem",
                  background: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "8px",
                  borderLeft: "3px solid #8b5cf6",
                }}
              >
                <div style={{ fontWeight: 600 }}>{ev.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {ev.reservedSlots} cupos reservados | Horario: {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Business Units Config Form */}
      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1rem" }}>
          Agregar Unidad de Negocio
        </h3>

        <form onSubmit={handleCreateBU}>
          <div className="form-group">
            <label className="form-label">Nombre del Área / Unidad</label>
            <input
              type="text"
              className="form-input"
              placeholder="ej. Spa & Sauna"
              value={newBuName}
              onChange={(e) => setNewBuName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input
                type="text"
                className="form-input"
                placeholder="SPA"
                maxLength={6}
                value={newBuCode}
                onChange={(e) => setNewBuCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Cuota</label>
              <select
                className="form-select"
                value={newBuType}
                onChange={(e) => setNewBuType(e.target.value as any)}
              >
                <option value="dynamic">Dinámica (Rotativa)</option>
                <option value="guaranteed">Garantizada (Hotel)</option>
                <option value="contractual">Contractual (Eventos)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cupos Base Asignados</label>
            <input
              type="number"
              className="form-input"
              min={0}
              max={1000}
              value={newBuQuota}
              onChange={(e) => setNewBuQuota(Number(e.target.value))}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
            Guardar Unidad
          </button>
        </form>

        {msg && (
          <div style={{ marginTop: "1rem", color: "var(--color-success)", fontWeight: 500, fontSize: "0.9rem" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
};
