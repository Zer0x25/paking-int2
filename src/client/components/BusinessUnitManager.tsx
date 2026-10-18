import React, { useEffect, useState } from "react";
import type { BusinessUnit, QuotaType } from "@core/types/schema";
import { apiFetch } from "../api/client";

interface BusinessUnitManagerProps {
  facilityId: string;
  onRefresh?: () => void | Promise<void>;
}

interface BusinessUnitFields {
  name: string;
  code: string;
  quotaType: QuotaType;
  defaultQuota: number;
}

interface BusinessUnitFormProps {
  initialValues: BusinessUnitFields;
  idPrefix: string;
  submitLabel: string;
  disabled: boolean;
  onSubmit: (fields: BusinessUnitFields) => Promise<void>;
  onCancel?: () => void;
}

const quotaLabels: Record<QuotaType, string> = {
  guaranteed: "Garantizada (Hotel)",
  contractual: "Contractual (Eventos)",
  dynamic: "Dinámica (Rotativa)",
};

const BusinessUnitForm: React.FC<BusinessUnitFormProps> = ({
  initialValues,
  idPrefix,
  submitLabel,
  disabled,
  onSubmit,
  onCancel,
}) => {
  const [fields, setFields] = useState(initialValues);
  const update = <K extends keyof BusinessUnitFields>(key: K, value: BusinessUnitFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void onSubmit(fields);
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.85rem" }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor={`${idPrefix}-name`}>Nombre de la Unidad</label>
        <input
          id={`${idPrefix}-name`}
          className="form-input"
          value={fields.name}
          onChange={(event) => update("name", event.target.value)}
          maxLength={80}
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.85rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`${idPrefix}-code`}>Código</label>
          <input
            id={`${idPrefix}-code`}
            className="form-input"
            value={fields.code}
            onChange={(event) => update("code", event.target.value.toUpperCase())}
            maxLength={10}
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`${idPrefix}-quota-type`}>Tipo de Cuota</label>
          <select
            id={`${idPrefix}-quota-type`}
            className="form-select"
            value={fields.quotaType}
            onChange={(event) => update("quotaType", event.target.value as QuotaType)}
          >
            <option value="dynamic">{quotaLabels.dynamic}</option>
            <option value="guaranteed">{quotaLabels.guaranteed}</option>
            <option value="contractual">{quotaLabels.contractual}</option>
          </select>
          <small style={{ display: "block", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Define cómo se asignan los cupos a esta unidad. El tipo de espacio se selecciona por separado en Garita.
          </small>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor={`${idPrefix}-default-quota`}>Cupos Base Asignados</label>
        <input
          id={`${idPrefix}-default-quota`}
          className="form-input"
          type="number"
          min={0}
          step={1}
          value={fields.defaultQuota}
          onChange={(event) => update("defaultQuota", Number(event.target.value))}
          required
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.2rem" }}>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={disabled}>Cancelar</button>}
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {disabled ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

function authorizationHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
  };
}

export const BusinessUnitManager: React.FC<BusinessUnitManagerProps> = ({ facilityId, onRefresh }) => {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<BusinessUnit | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/facilities/${facilityId}/business-units`, {
        headers: authorizationHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las unidades");
      setUnits(data.businessUnits || []);
    } catch (error: unknown) {
      setFeedback({ text: error instanceof Error ? error.message : "No se pudieron cargar las unidades", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnits();
  }, [facilityId]);

  const refreshCatalogs = async () => {
    await onRefresh?.();
    await loadUnits();
  };

  const createUnit = async (fields: BusinessUnitFields) => {
    setSavingUnitId("new");
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/facilities/${facilityId}/business-units`, {
        method: "POST",
        headers: authorizationHeaders(),
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la unidad");
      setFeedback({ text: `Unidad "${data.businessUnit.name}" creada.`, type: "success" });
      await refreshCatalogs();
    } catch (error: unknown) {
      setFeedback({ text: error instanceof Error ? error.message : "No se pudo crear la unidad", type: "error" });
    } finally {
      setSavingUnitId(null);
    }
  };

  const saveUnit = async (unit: BusinessUnit, fields: BusinessUnitFields) => {
    setSavingUnitId(unit.id);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/facilities/${facilityId}/business-units/${unit.id}`, {
        method: "PUT",
        headers: authorizationHeaders(),
        body: JSON.stringify({ ...fields, version: unit.version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la unidad");
      setEditingUnitId(null);
      setFeedback({ text: `Unidad "${data.businessUnit.name}" actualizada.`, type: "success" });
      await refreshCatalogs();
    } catch (error: unknown) {
      setFeedback({ text: error instanceof Error ? error.message : "No se pudo actualizar la unidad", type: "error" });
    } finally {
      setSavingUnitId(null);
    }
  };

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    const unit = pendingDeletion;
    setSavingUnitId(unit.id);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/facilities/${facilityId}/business-units/${unit.id}/status`, {
        method: "PATCH",
        headers: authorizationHeaders(),
        body: JSON.stringify({ isActive: false, version: unit.version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo retirar la unidad");
      setPendingDeletion(null);
      setFeedback({ text: `Unidad "${unit.name}" retirada; el historial se conservó.`, type: "success" });
      await refreshCatalogs();
    } catch (error: unknown) {
      setPendingDeletion(null);
      setFeedback({ text: error instanceof Error ? error.message : "No se pudo retirar la unidad", type: "error" });
    } finally {
      setSavingUnitId(null);
    }
  };

  const activeUnits = units.filter((unit) => unit.isActive);
  const inactiveUnits = units.filter((unit) => !unit.isActive);
  const cardStyle: React.CSSProperties = {
    padding: "1rem 1.1rem",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border)",
    borderRadius: "10px",
  };

  return (
    <div className="glass-panel business-unit-manager config-panel" style={{ padding: "2rem" }}>
      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.4rem" }}>3. Unidades de Negocio</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 1.2rem" }}>
        Crea destinos y mantén sus cupos desde aquí.
      </p>

      {feedback && (
        <p role={feedback.type === "error" ? "alert" : "status"} style={{ color: feedback.type === "error" ? "var(--color-danger)" : "var(--color-success)", margin: "0 0 1rem" }}>
          {feedback.text}
        </p>
      )}

      <section aria-label="Crear unidad de negocio" style={{ ...cardStyle, marginBottom: "1.25rem" }}>
        <h4 style={{ fontSize: "1rem", margin: "0 0 1rem" }}>Agregar Unidad de Negocio</h4>
        <BusinessUnitForm
          initialValues={{ name: "", code: "", quotaType: "dynamic", defaultQuota: 10 }}
          idPrefix="create-business-unit"
          submitLabel="Guardar Unidad de Negocio"
          disabled={savingUnitId === "new"}
          onSubmit={createUnit}
        />
      </section>

      <section aria-label="Unidades de negocio activas">
        <h4 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Unidades activas</h4>
        {loading && <p role="status" style={{ color: "var(--text-muted)" }}>Cargando unidades...</p>}
        {!loading && activeUnits.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay unidades activas.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {activeUnits.map((unit) => (
            <article key={unit.id} style={cardStyle}>
              {editingUnitId === unit.id ? (
                <>
                  <h5 style={{ margin: "0 0 0.8rem", fontSize: "0.95rem" }}>Editar unidad: {unit.name}</h5>
                  <BusinessUnitForm
                    key={`${unit.id}-${unit.version}`}
                    initialValues={{ name: unit.name, code: unit.code, quotaType: unit.quotaType, defaultQuota: unit.defaultQuota }}
                    idPrefix={`edit-business-unit-${unit.id}`}
                    submitLabel="Guardar cambios"
                    disabled={savingUnitId === unit.id}
                    onSubmit={(fields) => saveUnit(unit, fields)}
                    onCancel={() => setEditingUnitId(null)}
                  />
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)", fontSize: "0.8rem" }}>{unit.code}</span>
                      <strong>{unit.name}</strong>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                      {quotaLabels[unit.quotaType]} · {unit.defaultQuota} cupos base · v{unit.version}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingUnitId(unit.id)} aria-label={`Editar unidad ${unit.name}`}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setPendingDeletion(unit)} disabled={savingUnitId === unit.id} aria-label={`Eliminar unidad ${unit.name}`}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {inactiveUnits.length > 0 && (
        <section aria-label="Historial de unidades inactivas" style={{ marginTop: "1.4rem" }}>
          <h4 style={{ fontSize: "0.95rem", margin: "0 0 0.75rem" }}>Unidades inactivas · historial conservado</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {inactiveUnits.map((unit) => (
              <div key={unit.id} style={{ ...cardStyle, opacity: 0.72, display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <span><span style={{ fontFamily: "var(--font-mono)", marginRight: "0.5rem" }}>{unit.code}</span><strong>{unit.name}</strong></span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{quotaLabels[unit.quotaType]} · Inactiva</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingDeletion && (
        <div className="dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "var(--color-overlay)" }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="business-unit-delete-title" aria-describedby="business-unit-delete-description" className="glass-panel confirmation-dialog" style={{ width: "min(100%, 30rem)", padding: "1.75rem", border: "1px solid var(--color-danger)", boxShadow: "var(--shadow-lg)" }}>
            <h3 id="business-unit-delete-title" style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" }}>Eliminar unidad de negocio</h3>
            <p id="business-unit-delete-description" style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              ¿Retirar <strong>{pendingDeletion.name}</strong>? Se ocultará de la operación diaria y conservará sus referencias históricas. No se podrá retirar mientras tenga sesiones, áreas exclusivas o reservas vigentes.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingDeletion(null)} disabled={savingUnitId === pendingDeletion.id}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmDeletion()} disabled={savingUnitId === pendingDeletion.id}>
                {savingUnitId === pendingDeletion.id ? "Retirando..." : "Confirmar eliminación"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
