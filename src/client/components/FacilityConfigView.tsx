import React, { useState, useEffect } from "react";
import type { Facility, BusinessUnit, EventBooking, ParkingArea } from "@core/types/schema";
import { calculateFacilityBuffer } from "@core/rules/areaAllocationRules";

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
  onRefresh,
}) => {
  // Facility parameters editing state
  const [facilityName, setFacilityName] = useState(facility?.name || "");
  const [facilityAddress, setFacilityAddress] = useState(facility?.address || "");
  const [totalCapacity, setTotalCapacity] = useState(facility?.totalCapacity || 100);
  const [savingFacility, setSavingFacility] = useState(false);

  // Areas state
  const [areas, setAreas] = useState<ParkingArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  // New Area Form state
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCode, setNewAreaCode] = useState("");
  const [newAreaCapacity, setNewAreaCapacity] = useState(20);
  const [newAreaBuId, setNewAreaBuId] = useState<string>("");
  const [newAreaDesc, setNewAreaDesc] = useState("");
  const [creatingArea, setCreatingArea] = useState(false);

  // Business Unit Form state
  const [newBuName, setNewBuName] = useState("");
  const [newBuCode, setNewBuCode] = useState("");
  const [newBuQuota, setNewBuQuota] = useState(10);
  const [newBuType, setNewBuType] = useState<"guaranteed" | "contractual" | "dynamic">("dynamic");

  // Global messages
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Synchronize facility fields on prop change
  useEffect(() => {
    if (facility) {
      setFacilityName(facility.name);
      setFacilityAddress(facility.address || "");
      setTotalCapacity(facility.totalCapacity);
    }
  }, [facility]);

  // Fetch areas from server or local
  const fetchAreas = async () => {
    if (!facility?.id) return;
    setLoadingAreas(true);
    try {
      const res = await fetch(`/api/facilities/${facility.id}/areas`);
      if (res.ok) {
        const data = await res.json();
        setAreas(data.areas || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingAreas(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, [facility?.id]);

  const allocatedSum = areas.filter((a) => a.isActive).reduce((sum, a) => sum + a.allocatedCapacity, 0);
  const currentTotal = Number(totalCapacity) || 0;
  const floatingBuffer = calculateFacilityBuffer(currentTotal, areas);

  // Handle saving facility base details
  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility?.id) return;
    setSavingFacility(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/facilities/${facility.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: facilityName,
          address: facilityAddress,
          totalCapacity: Number(totalCapacity),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || "Error al actualizar la instalación", type: "error" });
      } else {
        setFeedback({ text: "✓ Parámetros de la instalación actualizados con éxito", type: "success" });
        if (onRefresh) onRefresh();
      }
    } catch {
      setFeedback({ text: "Error de red al actualizar la instalación", type: "error" });
    } finally {
      setSavingFacility(false);
    }
  };

  // Handle creating a new parking area
  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility?.id) return;
    if (!newAreaName.trim() || !newAreaCode.trim()) return;

    setCreatingArea(true);
    setFeedback(null);

    const payload = {
      name: newAreaName.trim(),
      code: newAreaCode.trim().toUpperCase(),
      description: newAreaDesc.trim(),
      allocatedCapacity: Number(newAreaCapacity),
      businessUnitId: newAreaBuId || null,
    };

    try {
      const res = await fetch(`/api/facilities/${facility.id}/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || "Error al crear el área", type: "error" });
      } else {
        setFeedback({ text: `✓ Área "${data.area.name}" creada exitosamente`, type: "success" });
        setNewAreaName("");
        setNewAreaCode("");
        setNewAreaDesc("");
        setNewAreaCapacity(20);
        setNewAreaBuId("");
        fetchAreas();
        if (onRefresh) onRefresh();
      }
    } catch {
      setFeedback({ text: "Error de red al crear el área", type: "error" });
    } finally {
      setCreatingArea(false);
    }
  };

  // Handle dynamic reallocation of an area
  const handleQuickAdjustCapacity = async (area: ParkingArea, delta: number) => {
    const targetCapacity = Math.max(0, area.allocatedCapacity + delta);
    await handleUpdateAreaCapacity(area.id, targetCapacity, area.version);
  };

  const handleUpdateAreaCapacity = async (areaId: string, newCapacity: number, version: number) => {
    if (!facility?.id) return;
    setFeedback(null);

    try {
      const res = await fetch(`/api/facilities/${facility.id}/areas/${areaId}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocatedCapacity: newCapacity,
          version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || "No se pudo actualizar la capacidad", type: "error" });
      } else {
        setFeedback({ text: `✓ Capacidad de "${data.area.name}" reajustada a ${data.area.allocatedCapacity} plazas`, type: "success" });
        fetchAreas();
        if (onRefresh) onRefresh();
      }
    } catch {
      setFeedback({ text: "Error al actualizar la capacidad del área", type: "error" });
    }
  };

  // Handle creating a new business unit
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
    setFeedback({ text: `✓ Unidad de negocio "${newBuName}" agregada.`, type: "success" });
    setNewBuName("");
    setNewBuCode("");
    if (onRefresh) onRefresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: "1rem 1.5rem",
            borderRadius: "10px",
            backgroundColor: feedback.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${feedback.type === "success" ? "#10b981" : "#ef4444"}`,
            color: feedback.type === "success" ? "#34d399" : "#f87171",
            fontWeight: 600,
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Balance Summary Header Cards */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--accent-primary)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Capacidad Total Recinto
          </span>
          <div className="metric-val" style={{ color: "var(--accent-primary)" }}>
            {currentTotal}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Límite físico total
          </span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Plazas Sectorizadas (Áreas)
          </span>
          <div className="metric-val" style={{ color: "#a78bfa" }}>
            {allocatedSum}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Asignadas a {areas.length} áreas
          </span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: `4px solid ${floatingBuffer > 0 ? "#38bdf8" : "var(--color-warning)"}` }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Reserva Flotante Libre (Buffer)
          </span>
          <div className="metric-val" style={{ color: floatingBuffer > 0 ? "#38bdf8" : "var(--color-warning)" }}>
            {floatingBuffer}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Disponibles para nuevas áreas
          </span>
        </div>
      </div>

      {/* Section 1: Facility Construction & Base Parameters */}
      <div className="glass-panel" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              1. Construcción y Parámetros de la Instalación
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Define el nombre del complejo, dirección y la cantidad total de estacionamientos físicos
            </p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            ID: {facility?.id || "N/A"}
          </span>
        </div>

        <form onSubmit={handleSaveFacility} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre del Recinto / Complejo</label>
            <input
              type="text"
              className="form-input"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="ej. Centro de Convenciones & Hotel Pacífico"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ubicación / Dirección</label>
            <input
              type="text"
              className="form-input"
              value={facilityAddress}
              onChange={(e) => setFacilityAddress(e.target.value)}
              placeholder="ej. Av. Costanera 1000"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Capacidad Total de Plazas</label>
            <input
              type="number"
              className="form-input"
              min={Math.max(1, allocatedSum)}
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(Number(e.target.value))}
              required
            />
          </div>

          <button
            type="submit"
            disabled={savingFacility}
            className="btn btn-primary"
            style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
          >
            {savingFacility ? "Guardando..." : "Guardar Parámetros"}
          </button>
        </form>
      </div>

      {/* Section 2: Parking Areas & Dynamic Quota Management (Feature 002 core) */}
      <div className="glass-panel" style={{ padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            2. Gestión de Áreas y Asignación Dinámica de Capacidad
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Crea áreas físicas (pisos, sectores) y reajusta en caliente la cantidad de plazas asignadas a cada una
          </p>
        </div>

        {/* Create New Area Form */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>
            ➕ Crear Nueva Área de Estacionamiento
          </h4>

          <form onSubmit={handleCreateArea}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Nombre del Área</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej. Sector Norte Aire Libre"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código Único</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="NORTE-1"
                  maxLength={10}
                  value={newAreaCode}
                  onChange={(e) => setNewAreaCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Capacidad Asignada (Máx: {floatingBuffer})
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={floatingBuffer}
                  value={newAreaCapacity}
                  onChange={(e) => setNewAreaCapacity(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Régimen de Uso</label>
                <select
                  className="form-select"
                  value={newAreaBuId}
                  onChange={(e) => setNewAreaBuId(e.target.value)}
                >
                  <option value="">Compartida (Multi-Negocio)</option>
                  {businessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      Exclusiva: {bu.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginTop: "0.5rem" }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Descripción o Referencias Físicas</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej. Junto al pabellón de eventos, acceso por calle trasera"
                  value={newAreaDesc}
                  onChange={(e) => setNewAreaDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={creatingArea || floatingBuffer <= 0}
                className="btn btn-primary"
                style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
              >
                {creatingArea ? "Creando Área..." : "Crear Área"}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Areas List with Live Capacity Re-allocation */}
        <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1rem" }}>
          Áreas Operativas y Reajuste Dinámico en Caliente
        </h4>

        {loadingAreas ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Cargando áreas de estacionamiento...
          </div>
        ) : areas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            No hay áreas creadas. Crea tu primera área arriba utilizando el buffer disponible.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {areas.map((area: any) => {
              const activeVehicles = area.activeOccupancy || 0;
              const available = Math.max(0, area.allocatedCapacity - activeVehicles);
              const pct = area.allocatedCapacity > 0 ? Math.round((activeVehicles / area.allocatedCapacity) * 100) : 0;
              const isExclusive = Boolean(area.businessUnitId);
              const exclusiveUnit = isExclusive ? businessUnits.find((u) => u.id === area.businessUnitId)?.name : null;

              return (
                <div
                  key={area.id}
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "1.25rem 1.5rem",
                    display: "grid",
                    gridTemplateColumns: "1.8fr 1.5fr 2fr",
                    gap: "1.5rem",
                    alignItems: "center",
                  }}
                >
                  {/* Left: Info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-mono)",
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          fontWeight: 700,
                        }}
                      >
                        {area.code}
                      </span>
                      <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>{area.name}</strong>
                    </div>

                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                      {area.description || "Sin descripción física"}
                    </div>

                    <div style={{ marginTop: "0.4rem" }}>
                      {isExclusive ? (
                        <span style={{ fontSize: "0.7rem", background: "rgba(139, 92, 246, 0.2)", color: "#c4b5fd", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>
                          🔒 Exclusiva: {exclusiveUnit || "Convenio"}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>
                          🌐 Uso Compartido
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Live Occupancy */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Ocupación en vivo:</span>
                      <strong>
                        {activeVehicles} / {area.allocatedCapacity} plazas ({pct}%)
                      </strong>
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: pct >= 100 ? "var(--color-danger)" : pct >= 90 ? "var(--color-warning)" : "var(--color-success)",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem", display: "block" }}>
                      Plazas libres: {available}
                    </span>
                  </div>

                  {/* Right: Dynamic Capacity Controls */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ajustar cupo dinámico:</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                        onClick={() => handleQuickAdjustCapacity(area, -5)}
                        disabled={area.allocatedCapacity - 5 < activeVehicles}
                        title={area.allocatedCapacity - 5 < activeVehicles ? "No se puede reducir por debajo de autos estacionados" : "Reducir 5 plazas"}
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                        onClick={() => handleQuickAdjustCapacity(area, -1)}
                        disabled={area.allocatedCapacity - 1 < activeVehicles}
                        title="Reducir 1 plaza"
                      >
                        -1
                      </button>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          padding: "0 0.4rem",
                          minWidth: "3rem",
                          textAlign: "center",
                          color: "var(--text-primary)",
                        }}
                      >
                        {area.allocatedCapacity}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                        onClick={() => handleQuickAdjustCapacity(area, 1)}
                        disabled={floatingBuffer < 1}
                        title={floatingBuffer < 1 ? "Sin buffer flotante disponible" : "Aumentar 1 plaza"}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                        onClick={() => handleQuickAdjustCapacity(area, 5)}
                        disabled={floatingBuffer < 5}
                        title={floatingBuffer < 5 ? "Buffer insuficiente para +5" : "Aumentar 5 plazas"}
                      >
                        +5
                      </button>
                    </div>

                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Versión: v{area.version} | Mínimo actual: {activeVehicles} plazas
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Business Units and Active Events */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Business Units Config Form */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>
            3. Agregar Unidad de Negocio
          </h3>

          <form onSubmit={handleCreateBU}>
            <div className="form-group">
              <label className="form-label">Nombre de la Unidad</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej. Spa & Club"
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
              Guardar Unidad de Negocio
            </button>
          </form>
        </div>

        {/* Active Events and Contractual Reservations */}
        <div className="glass-panel" style={{ padding: "2rem" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>
            4. Eventos y Reservas Contractuales Activas
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {events.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No hay eventos programados actualmente</p>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "0.85rem 1rem",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "8px",
                    borderLeft: "3px solid #8b5cf6",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {ev.reservedSlots} cupos reservados | Horario: {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
