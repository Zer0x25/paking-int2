import React, { useEffect, useMemo, useState } from "react";
import type { BusinessUnit, EventBooking } from "@core/types/schema";
import { isEventVisible } from "@core/rules/eventBookingRules";
import { formatEventRange, fromDateTimeLocal, toDateTimeLocal } from "../utils/event-booking";
import { apiFetch } from "../api/client";

interface EventBookingsManagerProps {
  facilityId: string;
  facilityCapacity: number;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  onRefresh?: () => void | Promise<void>;
}

interface EventBookingForm {
  title: string;
  businessUnitId: string;
  reservedSlots: number;
  startTime: string;
  endTime: string;
}

const emptyForm: EventBookingForm = {
  title: "",
  businessUnitId: "",
  reservedSlots: 1,
  startTime: "",
  endTime: "",
};

async function authorizedFetch(url: string, init: RequestInit): Promise<Response> {
  const token = localStorage.getItem("auth_token") || "";
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return apiFetch(url, { ...init, headers });
}

export const EventBookingsManager: React.FC<EventBookingsManagerProps> = ({
  facilityId,
  facilityCapacity,
  businessUnits,
  events,
  onRefresh,
}) => {
  const [form, setForm] = useState<EventBookingForm>(emptyForm);
  const [editingEvent, setEditingEvent] = useState<EventBooking | null>(null);
  const [confirmingCancellation, setConfirmingCancellation] = useState<EventBooking | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const contractualUnits = useMemo(
    () => businessUnits.filter((unit) => unit.isActive && unit.quotaType === "contractual"),
    [businessUnits],
  );
  const visibleEvents = useMemo(
    () => events
      .filter((event) => isEventVisible(event, now))
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [events, now],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEvent(null);
    setError(null);
  };

  const beginEditing = (event: EventBooking) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      businessUnitId: event.businessUnitId,
      reservedSlots: event.reservedSlots,
      startTime: toDateTimeLocal(event.startTime),
      endTime: toDateTimeLocal(event.endTime),
    });
    setError(null);
    setNotice(null);
  };

  const submit = async (submission: React.FormEvent<HTMLFormElement>) => {
    submission.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const startTime = fromDateTimeLocal(form.startTime);
    const endTime = fromDateTimeLocal(form.endTime);
    if (!startTime || !endTime || Date.parse(endTime) <= Date.parse(startTime)) {
      setError("La fecha y hora de término debe ser posterior al inicio.");
      setSaving(false);
      return;
    }

    const body = {
      title: form.title.trim(),
      businessUnitId: form.businessUnitId,
      reservedSlots: Number(form.reservedSlots),
      startTime,
      endTime,
      ...(editingEvent ? { version: editingEvent.version } : {}),
    };

    try {
      const endpoint = editingEvent
        ? `/api/facilities/${facilityId}/events/${editingEvent.id}`
        : `/api/facilities/${facilityId}/events`;
      const response = await authorizedFetch(endpoint, {
        method: editingEvent ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la reserva.");

      resetForm();
      setNotice(editingEvent ? "Reserva actualizada." : "Reserva creada.");
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async () => {
    if (!confirmingCancellation) return;
    setCancelling(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authorizedFetch(
        `/api/facilities/${facilityId}/events/${confirmingCancellation.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", version: confirmingCancellation.version }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cancelar la reserva.");

      setConfirmingCancellation(null);
      setNotice("Reserva cancelada; el registro se conserva en el historial.");
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar la reserva.");
      setConfirmingCancellation(null);
    } finally {
      setCancelling(false);
    }
  };

  const updateField = <K extends keyof EventBookingForm>(key: K, value: EventBookingForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 0 };
  const actionsStyle: React.CSSProperties = {
    display: "flex",
    gap: "0.6rem",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  };

  return (
    <div className="glass-panel event-bookings-manager config-panel" style={{ padding: "2rem" }}>
      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.45rem" }}>
        4. Eventos y Reservas Contractuales
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 1.25rem" }}>
        Programa reservas con anticipación y define sus cupos y horario, incluso si terminan al día siguiente.
      </p>

      {error && <p role="alert" style={{ color: "var(--color-danger)", margin: "0 0 1rem" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "var(--color-success)", margin: "0 0 1rem" }}>{notice}</p>}

      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          padding: "1.25rem",
          marginBottom: "1.25rem",
          borderRadius: "10px",
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="form-group" style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
          <label className="form-label" htmlFor="event-title">Nombre del evento</label>
          <input
            id="event-title"
            className="form-input"
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            minLength={2}
            maxLength={120}
            placeholder="Ej. Cumbre de Negocios 2026"
            required
          />
        </div>
        <div className="form-group" style={fieldStyle}>
          <label className="form-label" htmlFor="event-business-unit">Unidad contractual</label>
          <select
            id="event-business-unit"
            className="form-select"
            value={form.businessUnitId}
            onChange={(event) => updateField("businessUnitId", event.target.value)}
            required
          >
            <option value="" disabled>Seleccionar unidad</option>
            {contractualUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          {contractualUnits.length === 0 && (
            <small style={{ color: "var(--text-muted)" }}>Primero crea una unidad con tipo de cuota contractual.</small>
          )}
        </div>
        <div className="form-group" style={fieldStyle}>
          <label className="form-label" htmlFor="event-reserved-slots">Cupos reservados</label>
          <input
            id="event-reserved-slots"
            className="form-input"
            type="number"
            min={1}
            max={facilityCapacity}
            value={form.reservedSlots}
            onChange={(event) => updateField("reservedSlots", Number(event.target.value))}
            required
          />
        </div>
        <div className="form-group" style={fieldStyle}>
          <label className="form-label" htmlFor="event-start-time">Inicio</label>
          <input
            id="event-start-time"
            className="form-input"
            type="datetime-local"
            value={form.startTime}
            onChange={(event) => updateField("startTime", event.target.value)}
            required
          />
        </div>
        <div className="form-group" style={fieldStyle}>
          <label className="form-label" htmlFor="event-end-time">Término</label>
          <input
            id="event-end-time"
            className="form-input"
            type="datetime-local"
            value={form.endTime}
            onChange={(event) => updateField("endTime", event.target.value)}
            required
          />
        </div>
        <div style={{ ...actionsStyle, gridColumn: "1 / -1", alignItems: "center" }}>
          {editingEvent && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginRight: "auto" }}>Editando: {editingEvent.title}</span>}
          {editingEvent && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar edición</button>}
          <button type="submit" className="btn btn-primary" disabled={saving || contractualUnits.length === 0}>
            {saving ? "Guardando..." : editingEvent ? "Guardar cambios" : "Crear reserva"}
          </button>
        </div>
      </form>

      <h4 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Reservas activas y próximas ({visibleEvents.length})</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {visibleEvents.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>No hay reservas próximas o vigentes.</p>
        ) : visibleEvents.map((event) => (
          <article
            key={event.id}
            style={{
              padding: "0.9rem 1rem",
              background: "var(--color-surface-raised)",
              borderRadius: "8px",
              borderLeft: "3px solid var(--color-accent)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{event.title}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                {event.reservedSlots} cupos · {formatEventRange(event.startTime, event.endTime)}
              </div>
            </div>
            <div style={actionsStyle}>
              <button type="button" className="btn btn-secondary" onClick={() => beginEditing(event)} aria-label={`Editar reserva ${event.title}`}>
                Editar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmingCancellation(event)} aria-label={`Eliminar reserva ${event.title}`}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      {confirmingCancellation && (
        <div
          role="presentation"
          className="dialog-overlay"
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "var(--color-overlay)" }}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelling) setConfirmingCancellation(null); }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-event-title" aria-describedby="cancel-event-description" className="glass-panel confirmation-dialog" style={{ width: "min(100%, 28rem)", padding: "1.5rem", borderRadius: "12px" }}>
            <h4 id="cancel-event-title" style={{ marginTop: 0 }}>Eliminar reserva</h4>
            <p id="cancel-event-description">¿Cancelar “{confirmingCancellation.title}”? La reserva dejará de ocupar cupos y se conservará en el historial.</p>
            <div style={actionsStyle}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmingCancellation(null)} disabled={cancelling}>Volver</button>
              <button type="button" className="btn btn-primary" onClick={cancelBooking} disabled={cancelling}>{cancelling ? "Cancelando..." : "Confirmar eliminación"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
