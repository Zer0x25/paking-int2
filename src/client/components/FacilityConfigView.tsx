import React, { useState, useEffect } from "react";
import { FacilitySchema, type Facility, type BusinessUnit, type EventBooking, type ParkingArea, type SpaceCategory } from "@core/types/schema";
import { calculateFacilityBuffer, calculateFacilityTypeBuffer } from "@core/rules/areaAllocationRules";
import { BusinessUnitManager } from "./BusinessUnitManager";
import { EventBookingsManager } from "./EventBookingsManager";
import { apiFetch } from "../api/client";

interface FacilityConfigViewProps {
  facility: Facility | null;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  spaceCategories?: SpaceCategory[];
  onRefresh?: () => void;
  onFacilityCreated?: (facility: Facility, token: string) => void;
  onFacilityDeactivated?: () => void;
}

interface ManagedParkingArea extends ParkingArea {
  activeOccupancy?: number;
  standardOccupied?: number;
  accessibleOccupied?: number;
  availableSlots?: number;
  occupancyPercentage?: number;
  isSaturated?: boolean;
}

interface AreaEditValues {
  name: string;
  code: string;
  description: string;
  standardCapacity: number;
  accessibleCapacity: number;
  businessUnitId: string | null;
}

interface ManagedAreaCardProps {
  area: ManagedParkingArea;
  businessUnits: BusinessUnit[];
  floatingBuffer: number;
  accessibleFloatingBuffer: number;
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
  accessibleFloatingBuffer,
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
  const [standardCapacity, setStandardCapacity] = useState(area.standardCapacity ?? area.allocatedCapacity);
  const [accessibleCapacity, setAccessibleCapacity] = useState(area.accessibleCapacity ?? 0);
  const [businessUnitId, setBusinessUnitId] = useState(area.businessUnitId || "");
  const activeVehicles = area.activeOccupancy || 0;
  const standardOccupied = area.standardOccupied ?? activeVehicles;
  const accessibleOccupied = area.accessibleOccupied ?? 0;
  const areaStandardCapacity = area.standardCapacity ?? area.allocatedCapacity;
  const areaAccessibleCapacity = area.accessibleCapacity ?? 0;
  const standardAvailable = Math.max(0, areaStandardCapacity - standardOccupied);
  const accessibleAvailable = Math.max(0, areaAccessibleCapacity - accessibleOccupied);
  const available = standardAvailable + accessibleAvailable;
  const pct = area.allocatedCapacity > 0 ? Math.round((activeVehicles / area.allocatedCapacity) * 100) : 0;
  const exclusiveUnit = businessUnits.find((unit) => unit.id === area.businessUnitId)?.name;

  const beginEditing = () => {
    setName(area.name);
    setCode(area.code);
    setDescription(area.description || "");
    setStandardCapacity(areaStandardCapacity);
    setAccessibleCapacity(areaAccessibleCapacity);
    setBusinessUnitId(area.businessUnitId || "");
    setEditing(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (Number(standardCapacity) + Number(accessibleCapacity) <= 0) return;
    const saved = await onSave(area, {
      name,
      code,
      description,
      standardCapacity: Number(standardCapacity),
      accessibleCapacity: Number(accessibleCapacity),
      businessUnitId: businessUnitId || null,
    });
    if (saved) setEditing(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border)",
    borderRadius: "10px",
    padding: "1.25rem 1.5rem",
  };

  if (editing) {
    return (
      <form onSubmit={submit} className="managed-area-editor" style={cardStyle}>
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
            <label className="form-label" htmlFor={`edit-area-standard-${area.id}`}>Plazas Estándar del área</label>
            <input id={`edit-area-standard-${area.id}`} className="form-input" type="number" min={standardOccupied} value={standardCapacity} onChange={(event) => setStandardCapacity(Number(event.target.value))} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`edit-area-accessible-${area.id}`}>Plazas Accesibles del área</label>
            <input id={`edit-area-accessible-${area.id}`} className="form-input" type="number" min={accessibleOccupied} max={accessibleFloatingBuffer + areaAccessibleCapacity} value={accessibleCapacity} onChange={(event) => setAccessibleCapacity(Number(event.target.value))} required />
            <small style={{ color: "var(--text-muted)" }}>Total del área: {Number(standardCapacity || 0) + Number(accessibleCapacity || 0)} plazas</small>
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
    <div className="managed-area-card" style={{ ...cardStyle, display: "grid", gap: "1.25rem", alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", background: "var(--color-info-surface)", color: "var(--color-info)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: 700 }}>{area.code}</span>
          <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>{area.name}</strong>
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>{area.description || "Sin descripción física"}</div>
        <div style={{ marginTop: "0.4rem" }}>
          {area.businessUnitId ? (
            <span style={{ fontSize: "0.7rem", background: "var(--color-surface-sunken)", color: "var(--color-accent)", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>🔒 Exclusiva: {exclusiveUnit || "Convenio"}</span>
          ) : (
            <span style={{ fontSize: "0.7rem", background: "var(--color-success-surface)", color: "var(--color-success)", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>🌐 Uso Compartido</span>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Ocupación en vivo:</span>
          <strong>{activeVehicles} / {area.allocatedCapacity} plazas ({pct}%)</strong>
        </div>
        <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? "var(--color-danger)" : pct >= 90 ? "var(--color-warning)" : "var(--color-success)" }} /></div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem", display: "block" }}>Estándar: {standardOccupied}/{areaStandardCapacity} · {standardAvailable} libres</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Accesibles: {accessibleOccupied}/{areaAccessibleCapacity} · {accessibleAvailable} libres</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total libre: {available}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ajustar estándar:</span>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, -5)} disabled={areaStandardCapacity - 5 < standardOccupied}>-5</button>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.6rem" }} onClick={() => onQuickAdjust(area, -1)} disabled={areaStandardCapacity - 1 < standardOccupied}>-1</button>
          <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-mono)", minWidth: "2.5rem", textAlign: "center" }}>{areaStandardCapacity}</strong>
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
  spaceCategories = [],
  onRefresh,
  onFacilityCreated,
  onFacilityDeactivated,
}) => {
  // Facility parameters editing state
  const [facilityName, setFacilityName] = useState(facility?.name || "");
  const [facilityAddress, setFacilityAddress] = useState(facility?.address || "");
  const [totalCapacity, setTotalCapacity] = useState(facility?.totalCapacity || 100);
  const [accessibleCapacity, setAccessibleCapacity] = useState(spaceCategories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0);
  const [savingFacility, setSavingFacility] = useState(false);
  const [creatingFacility, setCreatingFacility] = useState(false);
  const [pendingFacilityDeletion, setPendingFacilityDeletion] = useState(false);
  const [deactivatingFacility, setDeactivatingFacility] = useState(false);

  // Areas state
  const [areas, setAreas] = useState<ManagedParkingArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [deactivatingAreaId, setDeactivatingAreaId] = useState<string | null>(null);
  const [pendingAreaDeletion, setPendingAreaDeletion] = useState<ManagedParkingArea | null>(null);

  // New Area Form state
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCode, setNewAreaCode] = useState("");
  const [newAreaStandardCapacity, setNewAreaStandardCapacity] = useState(20);
  const [newAreaAccessibleCapacity, setNewAreaAccessibleCapacity] = useState(0);
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
      setAccessibleCapacity(spaceCategories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0);
    }
  }, [facility, spaceCategories]);

  // Fetch areas from server or local
  const fetchAreas = async () => {
    if (!facility?.id) return;
    setLoadingAreas(true);
    try {
      const res = await apiFetch(`/api/facilities/${facility.id}/areas`);
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

  const activeAreas = areas.filter((area) => area.isActive);
  const allocatedSum = activeAreas.reduce((sum, a) => sum + a.allocatedCapacity, 0);
  const currentTotal = Number(totalCapacity) || 0;
  const floatingBuffer = calculateFacilityBuffer(currentTotal, areas);
  const accessibleCurrent = Math.max(0, Number(accessibleCapacity) || 0);
  const standardCurrent = Math.max(0, currentTotal - accessibleCurrent);
  const typeBuffer = calculateFacilityTypeBuffer({ standardCapacity: standardCurrent, accessibleCapacity: accessibleCurrent }, activeAreas);
  const inactiveAreas = areas.filter((area) => !area.isActive);

  const handleCreateFacility = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingFacility(true);
    setFeedback(null);
    try {
      const response = await apiFetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: facilityName.trim(), address: facilityAddress.trim(), totalCapacity: Number(totalCapacity), accessibleCapacity: Number(accessibleCapacity) }),
      });
      const data = await response.json() as { facility?: unknown; token?: unknown; error?: string };
      const parsedFacility = FacilitySchema.safeParse(data.facility);
      if (!response.ok || !parsedFacility.success || typeof data.token !== "string") {
        setFeedback({ text: data.error || "No se pudo crear el recinto", type: "error" });
        return;
      }
      onFacilityCreated?.(parsedFacility.data, data.token);
    } catch {
      setFeedback({ text: "Error de red al crear el recinto", type: "error" });
    } finally {
      setCreatingFacility(false);
    }
  };

  const confirmFacilityDeletion = async () => {
    if (!facility) return;
    setDeactivatingFacility(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/facilities/${facility.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setFeedback({ text: data.error || "No se pudo eliminar el recinto", type: "error" });
        return;
      }
      onFacilityDeactivated?.();
    } catch {
      setFeedback({ text: "Error de red al eliminar el recinto", type: "error" });
    } finally {
      setDeactivatingFacility(false);
      setPendingFacilityDeletion(false);
    }
  };

  // Handle saving facility base details
  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility?.id) return;
    setSavingFacility(true);
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/facilities/${facility.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: facilityName,
          address: facilityAddress,
          totalCapacity: Number(totalCapacity),
          accessibleCapacity: Number(accessibleCapacity),
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
    const allocatedCapacity = Number(newAreaStandardCapacity) + Number(newAreaAccessibleCapacity);
    if (allocatedCapacity <= 0) {
      setFeedback({ text: "El área debe tener al menos una plaza asignada.", type: "error" });
      return;
    }

    setCreatingArea(true);
    setFeedback(null);

    const payload = {
      name: newAreaName.trim(),
      code: newAreaCode.trim().toUpperCase(),
      description: newAreaDesc.trim(),
      allocatedCapacity,
      standardCapacity: Number(newAreaStandardCapacity),
      accessibleCapacity: Number(newAreaAccessibleCapacity),
      businessUnitId: newAreaBuId || null,
    };

    try {
      const res = await apiFetch(`/api/facilities/${facility.id}/areas`, {
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
        setNewAreaStandardCapacity(20);
        setNewAreaAccessibleCapacity(0);
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
    const standardCapacity = Math.max(0, (area.standardCapacity ?? area.allocatedCapacity) + delta);
    await handleUpdateAreaCapacity(area.id, standardCapacity, area.accessibleCapacity ?? 0, area.version);
  };

  const handleUpdateAreaCapacity = async (areaId: string, standardCapacity: number, accessibleCapacity: number, version: number) => {
    if (!facility?.id) return;
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/facilities/${facility.id}/areas/${areaId}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocatedCapacity: standardCapacity + accessibleCapacity,
          standardCapacity,
          accessibleCapacity,
          version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || "No se pudo actualizar la capacidad", type: "error" });
      } else {
        setFeedback({ text: `✓ Capacidad de "${data.area.name}" reajustada: ${data.area.standardCapacity} Estándar + ${data.area.accessibleCapacity} Accesibles`, type: "success" });
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
      const response = await apiFetch(`/api/facilities/${facility.id}/areas/${area.id}`, {
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
      const response = await apiFetch(`/api/facilities/${facility.id}/areas/${area.id}/status`, {
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

  if (!facility) {
    return (
      <div className="facility-config-view">
        {feedback && (
          <div role="alert" style={{
            padding: "1rem 1.5rem",
            borderRadius: "10px",
            backgroundColor: `var(${feedback.type === "success" ? "--color-success-surface" : "--color-danger-surface"})`,
            border: `1px solid var(${feedback.type === "success" ? "--color-success" : "--color-danger"})`,
            color: `var(${feedback.type === "success" ? "--color-success" : "--color-danger"})`,
            fontWeight: 600,
          }}>{feedback.text}</div>
        )}
        <section className="glass-panel config-panel">
          <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>Configura tu recinto</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Registra el recinto principal para habilitar Garita, Dashboard y el resto de la configuración.
          </p>
          <form onSubmit={handleCreateFacility} className="config-facility-fields">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-facility-name">Nombre del recinto</label>
              <input id="new-facility-name" className="form-input" value={facilityName} onChange={(event) => setFacilityName(event.target.value)} minLength={2} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-facility-address">Dirección</label>
              <input id="new-facility-address" className="form-input" value={facilityAddress} onChange={(event) => setFacilityAddress(event.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-facility-capacity">Capacidad total</label>
              <input id="new-facility-capacity" className="form-input" type="number" min={1} step={1} value={totalCapacity} onChange={(event) => setTotalCapacity(Number(event.target.value))} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-facility-accessible">Plazas Accesibles</label>
              <input id="new-facility-accessible" className="form-input" type="number" min={0} max={totalCapacity} step={1} value={accessibleCapacity} onChange={(event) => setAccessibleCapacity(Number(event.target.value))} required />
              <small style={{ color: "var(--text-muted)" }}>{Math.max(0, Number(totalCapacity) - Number(accessibleCapacity))} plazas Estándar (calculadas)</small>
            </div>
            <button type="submit" disabled={creatingFacility} className="btn btn-primary" style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}>
              {creatingFacility ? "Creando recinto..." : "Crear recinto"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="facility-config-view">
      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: "1rem 1.5rem",
            borderRadius: "10px",
            backgroundColor: `var(${feedback.type === "success" ? "--color-success-surface" : "--color-danger-surface"})`,
            border: `1px solid var(${feedback.type === "success" ? "--color-success" : "--color-danger"})`,
            color: `var(${feedback.type === "success" ? "--color-success" : "--color-danger"})`,
            fontWeight: 600,
          }}
        >
          {feedback.text}
        </div>
      )}

      {pendingAreaDeletion && (
        <div className="dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "var(--color-overlay)" }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="area-delete-title" aria-describedby="area-delete-description" className="glass-panel confirmation-dialog" style={{ width: "min(100%, 30rem)", padding: "1.75rem", border: "1px solid var(--color-danger)", boxShadow: "var(--shadow-lg)" }}>
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

      {pendingFacilityDeletion && (
        <div className="dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "var(--color-overlay)" }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="facility-delete-title" aria-describedby="facility-delete-description" className="glass-panel confirmation-dialog" style={{ width: "min(100%, 30rem)", padding: "1.75rem", border: "1px solid var(--color-danger)", boxShadow: "var(--shadow-lg)" }}>
            <h3 id="facility-delete-title" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>Eliminar recinto</h3>
            <p id="facility-delete-description" style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              ¿Eliminar <strong>{facility.name}</strong>? El recinto se desactivará y conservará sus registros históricos. Primero debes registrar la salida de todos los vehículos activos.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingFacilityDeletion(false)} disabled={deactivatingFacility}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmFacilityDeletion()} disabled={deactivatingFacility}>
                {deactivatingFacility ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Balance Summary Header Cards */}
      <div className="dashboard-grid config-summary-grid">
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--accent-primary)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Capacidad Total Recinto
          </span>
          <div className="metric-val" style={{ color: "var(--accent-primary)" }}>
            {currentTotal}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {standardCurrent} Estándar + {accessibleCurrent} Accesibles
          </span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--color-accent)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Plazas Sectorizadas (Áreas)
          </span>
          <div className="metric-val" style={{ color: "var(--color-accent)" }}>
            {allocatedSum}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {activeAreas.reduce((sum, area) => sum + (area.standardCapacity ?? area.allocatedCapacity), 0)} Estándar · {activeAreas.reduce((sum, area) => sum + (area.accessibleCapacity ?? 0), 0)} Accesibles
          </span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: `4px solid ${floatingBuffer > 0 ? "var(--color-info)" : "var(--color-warning)"}` }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Reserva Flotante Libre (Buffer)
          </span>
          <div className="metric-val" style={{ color: floatingBuffer > 0 ? "var(--color-info)" : "var(--color-warning)" }}>
            {floatingBuffer}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {typeBuffer.standardCapacity} Estándar · {typeBuffer.accessibleCapacity} Accesibles disponibles para nuevas áreas
          </span>
        </div>
      </div>

      {/* Section 1: Facility Construction & Base Parameters */}
      <div className="glass-panel config-panel">
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

        <form onSubmit={handleSaveFacility} className="config-facility-fields">
          <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="facility-name">Nombre del Recinto / Complejo</label>
              <input
                id="facility-name"
              type="text"
              className="form-input"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="ej. Centro de Convenciones & Hotel Pacífico"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="facility-address">Ubicación / Dirección</label>
              <input
                id="facility-address"
              type="text"
              className="form-input"
              value={facilityAddress}
              onChange={(e) => setFacilityAddress(e.target.value)}
              placeholder="ej. Av. Costanera 1000"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="facility-capacity">Capacidad Total de Plazas</label>
              <input
                id="facility-capacity"
              type="number"
              className="form-input"
              min={Math.max(1, allocatedSum)}
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(Number(e.target.value))}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="facility-accessible-capacity">Plazas Accesibles</label>
            <input
              id="facility-accessible-capacity"
              type="number"
              className="form-input"
              min={Math.max(0, activeAreas.reduce((sum, area) => sum + (area.accessibleCapacity ?? 0), 0))}
              max={currentTotal}
              value={accessibleCapacity}
              onChange={(event) => setAccessibleCapacity(Number(event.target.value))}
              required
            />
            <small style={{ color: "var(--text-muted)" }}>{standardCurrent} plazas Estándar (calculadas)</small>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={savingFacility}
              className="btn btn-primary"
              style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
            >
              {savingFacility ? "Guardando..." : "Guardar Parámetros"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingFacilityDeletion(true)} disabled={deactivatingFacility} aria-label="Eliminar recinto">
              Eliminar recinto
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Parking Areas & Dynamic Quota Management (Feature 002 core) */}
      <div className="glass-panel config-panel">
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            2. Gestión de Áreas y Asignación Dinámica de Capacidad
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Crea áreas físicas (pisos, sectores) y reajusta en caliente la cantidad de plazas asignadas a cada una
          </p>
        </div>

        {/* Create New Area Form */}
        <div className="config-create-panel">
          <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>
            ➕ Crear Nueva Área de Estacionamiento
          </h4>

          <form onSubmit={handleCreateArea}>
            <div className="config-area-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="new-area-name">Nombre del Área</label>
                <input
                  id="new-area-name"
                  type="text"
                  className="form-input"
                  placeholder="ej. Sector Norte Aire Libre"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-area-code">Código Único</label>
                <input
                  id="new-area-code"
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
                <label className="form-label" htmlFor="new-area-standard">Plazas Estándar del área</label>
                <small style={{ color: "var(--text-muted)" }}>Disponibles para asignar: {typeBuffer.standardCapacity}</small>
                <input
                  id="new-area-standard"
                  type="number"
                  className="form-input"
                  min={0}
                  max={typeBuffer.standardCapacity}
                  value={newAreaStandardCapacity}
                  onChange={(e) => setNewAreaStandardCapacity(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-area-accessible">Plazas Accesibles del área</label>
                <small style={{ color: "var(--text-muted)" }}>Disponibles para asignar: {typeBuffer.accessibleCapacity}</small>
                <input
                  id="new-area-accessible"
                  type="number"
                  className="form-input"
                  min={0}
                  max={typeBuffer.accessibleCapacity}
                  value={newAreaAccessibleCapacity}
                  onChange={(e) => setNewAreaAccessibleCapacity(Number(e.target.value))}
                  required
                />
                <small style={{ color: "var(--text-muted)" }}>Total del área: {Number(newAreaStandardCapacity || 0) + Number(newAreaAccessibleCapacity || 0)} plazas</small>
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

            <div className="config-area-description-row">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-area-description">Descripción o Referencias Físicas</label>
                <input
                  id="new-area-description"
                  type="text"
                  className="form-input"
                  placeholder="ej. Junto al pabellón de eventos, acceso por calle trasera"
                  value={newAreaDesc}
                  onChange={(e) => setNewAreaDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={creatingArea || typeBuffer.standardCapacity + typeBuffer.accessibleCapacity <= 0 || Number(newAreaStandardCapacity) + Number(newAreaAccessibleCapacity) <= 0}
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
              <div className="config-area-list">
            {activeAreas.map((area) => (
              <ManagedAreaCard
                key={area.id}
                area={area}
                businessUnits={businessUnits}
                floatingBuffer={typeBuffer.standardCapacity}
                accessibleFloatingBuffer={typeBuffer.accessibleCapacity}
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
                <div key={area.id} className="config-inactive-row" style={{ opacity: 0.8 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginRight: "0.75rem" }}>{area.code}</span>
                    <strong>{area.name}</strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{area.description || "Sin descripción física"} · {area.allocatedCapacity} plazas</div>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "999px", background: "var(--color-surface-sunken)", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>Inactiva</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Business Units and Active Events */}
      <div className="config-business-sections">
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
