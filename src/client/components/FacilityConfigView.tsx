import React, { useState, useEffect } from "react";
import type { Facility, BusinessUnit, EventBooking, ParkingArea } from "@core/types/schema";
import { calculateFacilityBuffer } from "@core/rules/areaAllocationRules";
import { BusinessUnitManager } from "./BusinessUnitManager";
import { EventBookingsManager } from "./EventBookingsManager";

interface FacilityConfigViewProps {
  facility: Facility | null;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  onRefresh?: () => void;
}

interface ManagedParkingArea extends ParkingArea {
  activeOccupancy?: number;
  availableSlots?: number;
  occupancyPercentage?: number;
  isSaturated?: boolean;
}

interface AreaEditValues {
  name: string;
  code: string;
  description: string;
  allocatedCapacity: number;
  businessUnitId: string | null;
}

interface ManagedAreaCardProps {
  area: ManagedParkingArea;
  businessUnits: BusinessUnit[];
  floatingBuffer: number;
  saving: boolean;
  deactivating: boolean;
  onSave: (area: ManagedParkingArea, values: AreaEditValues) => Promise<boolean>;
  onDeactivate: (area: ManagedParkingArea) => void;
  onQuickAdjust: (area: ManagedParkingArea, delta: number) => void;
}

const ManagedAreaCard: React.FC<ManagedAreaCardProps> = ({
  area,
  businessUnits,
  floatingBuffer,
  saving,
  deactivating,
  onSave,
  onDeactivate,
  onQuickAdjust,
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(area.name);
  const [code, setCode] = useState(area.code);
  const [description, setDescription] = useState(area.description || "");
  const [capacity, setCapacity] = useState(area.allocatedCapacity);
  const [businessUnitId, setBusinessUnitId] = useState(area.businessUnitId || "");
  const activeVehicles = area.activeOccupancy || 0;
  const available = Math.max(0, area.allocatedCapacity - activeVehicles);
  const pct = area.allocatedCapacity > 0 ? Math.round((activeVehicles / area.allocatedCapacity) * 100) : 0;
  const exclusiveUnit = businessUnits.find((unit) => unit.id === area.businessUnitId)?.name;

  const beginEditing = () => {
    setName(area.name);
    setCode(area.code);
    setDescription(area.description || "");
    setCapacity(area.allocatedCapacity);
    setBusinessUnitId(area.businessUnitId || "");
    setEditing(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = await onSave(area, {
      name,
      code,
      description,
      allocatedCapacity: Number(capacity),
      businessUnitId: businessUnitId || null,
    });
    if (saved) setEditing(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
    padding: "1.25rem 1.5rem",
  };

  if (editing) {
    return (
      <form onSubmit={submit} style={cardStyle}>
        <h5 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Editar área: {area.name}</h5>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`edit-area-name-${area.id}`}>Nombre del área</label>
            <input id={`edit-area-name-${area.id}`} className="form-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`edit-area-code-${area.id}`}>Código único</label>
            <input id={`edit-area-code-${area.id}`} className="form-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={10} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`edit-area-capacity-${area.id}`}>Capacidad asignada</label>
            <input id={`edit-area-capacity-${area.id}`} className="form-input" type="number" min={activeVehicles} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`edit-area-unit-${area.id}`}>Régimen de uso</label>
            <select id={`edit-area-unit-${area.id}`} className="form-select" value={businessUnitId} onChange={(event) => setBusinessUnitId(event.target.value)}>
              <option value="">Compartida (Multi-Negocio)</option>
              {businessUnits.map((unit) => <option key={unit.id} value={unit.id}>Exclusiva: {unit.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
            <label className="form-label" htmlFor={`edit-area-description-${area.id}`}>Descripción o referencias físicas</label>
            <input id={`edit-area-description-${area.id}`} className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1.8fr 1.5fr 2fr", gap: "1.5rem", alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: 700 }}>{area.code}</span>
          <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>{area.name}</strong>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>{area.description || "Sin descripción física"}</div>
        <div style={{ marginTop: "0.4rem" }}>
          {area.businessUnitId ? (
            <span style={{ fontSize: "0.7rem", background: "rgba(139, 92, 246, 0.2)", color: "#c4b5fd", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>🔒 Exclusiva: {exclusiveUnit || "Convenio"}</span>
          ) : (
            <span style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>🌐 Uso Compartido</span>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Ocupación en vivo:</span>
          <strong>{activeVehicles} / {area.allocatedCapacity} plazas ({pct}%)</strong>
        </div>
        <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? "var(--color-danger)" : pct >= 90 ? "var(--color-warning)" : "var(--color-success)" }} /></div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem", display: "block" }}>Plazas libres: {available}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ajustar cupo:</span>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, -5)} disabled={area.allocatedCapacity - 5 < activeVehicles}>-5</button>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, -1)} disabled={area.allocatedCapacity - 1 < activeVehicles}>-1</button>
          <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-mono)", minWidth: "2.5rem", textAlign: "center" }}>{area.allocatedCapacity}</strong>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, 1)} disabled={floatingBuffer < 1}>+1</button>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, 5)} disabled={floatingBuffer < 5}>+5</button>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Versión: v{area.version} | Mínimo actual: {activeVehicles} plazas</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-secondary" onClick={beginEditing} aria-label={`Editar área ${area.name}`}>Editar</button>
          <button type="button" className="btn btn-secondary" onClick={() => onDeactivate(area)} disabled={activeVehicles > 0 || deactivating} title={activeVehicles > 0 ? "Retira los vehículos antes de eliminar el área" : "Eliminar y conservar el registro en historial"} aria-label={`Eliminar área ${area.name}`}>
            {deactivating ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [areas, setAreas] = useState<ManagedParkingArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [deactivatingAreaId, setDeactivatingAreaId] = useState<string | null>(null);
  const [pendingAreaDeletion, setPendingAreaDeletion] = useState<ManagedParkingArea | null>(null);

  // New Area Form state
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCode, setNewAreaCode] = useState("");
  const [newAreaCapacity, setNewAreaCapacity] = useState(20);
  const [newAreaBuId, setNewAreaBuId] = useState<string>("");
  const [newAreaDesc, setNewAreaDesc] = useState("");
  const [creatingArea, setCreatingArea] = useState(false);

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
  const activeAreas = areas.filter((area) => area.isActive);
  const inactiveAreas = areas.filter((area) => !area.isActive);

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

  const handleSaveArea = async (area: ManagedParkingArea, values: AreaEditValues): Promise<boolean> => {
    if (!facility?.id) return false;

    setSavingArea(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/facilities/${facility.id}/areas/${area.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          version: area.version,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback({ text: data.error || "No se pudo actualizar el área", type: "error" });
        return false;
      }

      setFeedback({ text: `✓ Área "${data.area.name}" actualizada`, type: "success" });
      await fetchAreas();
      onRefresh?.();
      return true;
    } catch {
      setFeedback({ text: "Error de red al actualizar el área", type: "error" });
      return false;
    } finally {
      setSavingArea(false);
    }
  };

  const handleDeactivateArea = (area: ManagedParkingArea) => {
    setPendingAreaDeletion(area);
  };

  const confirmAreaDeletion = async () => {
    const area = pendingAreaDeletion;
    if (!facility?.id || !area) return;

    setDeactivatingAreaId(area.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/facilities/${facility.id}/areas/${area.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, version: area.version }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback({ text: data.error || "No se pudo desactivar el área", type: "error" });
        return;
      }

      setFeedback({ text: `✓ Área "${data.area.name}" eliminada; se conservó en el historial`, type: "success" });
      setPendingAreaDeletion(null);
      await fetchAreas();
      onRefresh?.();
    } catch {
      setFeedback({ text: "Error de red al desactivar el área", type: "error" });
    } finally {
      setDeactivatingAreaId(null);
    }
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

      {pendingAreaDeletion && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(2, 6, 23, 0.76)" }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="area-delete-title" aria-describedby="area-delete-description" className="glass-panel" style={{ width: "min(100%, 30rem)", padding: "1.75rem", border: "1px solid rgba(248, 113, 113, 0.45)", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)" }}>
            <h3 id="area-delete-title" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>Eliminar área</h3>
            <p id="area-delete-description" style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              ¿Eliminar <strong>{pendingAreaDeletion.name}</strong>? Se marcará como inactiva, conservará su historial y liberará sus plazas. Esta acción requiere que el área esté vacía.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingAreaDeletion(null)} disabled={deactivatingAreaId !== null}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmAreaDeletion()} disabled={deactivatingAreaId !== null}>
                {deactivatingAreaId === pendingAreaDeletion.id ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </section>
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
            Asignadas a {activeAreas.length} áreas activas
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

        {/* Existing areas, editing, and logical deactivation */}
        <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1rem" }}>
          Áreas Operativas y Reajuste Dinámico en Caliente
        </h4>

        {loadingAreas ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            Cargando áreas de estacionamiento...
          </div>
        ) : activeAreas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            No hay áreas operativas. Crea una arriba utilizando el buffer disponible.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activeAreas.map((area) => (
              <ManagedAreaCard
                key={area.id}
                area={area}
                businessUnits={businessUnits}
                floatingBuffer={floatingBuffer}
                saving={savingArea}
                deactivating={deactivatingAreaId === area.id}
                onSave={handleSaveArea}
                onDeactivate={handleDeactivateArea}
                onQuickAdjust={handleQuickAdjustCapacity}
              />
            ))}
          </div>
        )}

        {inactiveAreas.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1rem" }}>
              Áreas inactivas · historial conservado
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {inactiveAreas.map((area) => (
                <div key={area.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", background: "rgba(0, 0, 0, 0.18)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", opacity: 0.8 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginRight: "0.75rem" }}>{area.code}</span>
                    <strong>{area.name}</strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{area.description || "Sin descripción física"} · {area.allocatedCapacity} plazas</div>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "999px", background: "rgba(148, 163, 184, 0.15)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Inactiva</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Business Units and Active Events */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {facility && <BusinessUnitManager facilityId={facility.id} onRefresh={onRefresh} />}

        {facility && (
          <EventBookingsManager
            facilityId={facility.id}
            facilityCapacity={facility.totalCapacity}
            businessUnits={businessUnits}
            events={events}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
};
