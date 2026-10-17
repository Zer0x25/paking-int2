import React, { useState } from "react";
import { normalizeLicensePlate, completeParkingSession } from "@core/models/parking-session";
import {
  getLocalSessionByPlate,
  saveLocalSession,
  enqueueOutboxMutation,
} from "../db/indexed-db";

interface VehicleExitFormProps {
  facilityId: string;
  onExitSuccess?: () => void;
}

interface ExitReceipt {
  plate: string;
  durationMinutes: number | null;
  exitTime: string;
  offline?: boolean;
}

export const VehicleExitForm: React.FC<VehicleExitFormProps> = ({
  facilityId,
  onExitSuccess,
}) => {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [receipt, setReceipt] = useState<ExitReceipt | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = normalizeLicensePlate(plate);
    if (!cleanPlate || cleanPlate.length < 3) {
      setMessage({ text: "Ingrese una patente válida", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);
    setReceipt(null);
    const now = new Date().toISOString();

    if (navigator.onLine) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch("/api/parking-sessions/exit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            facilityId,
            licensePlate: cleanPlate,
            exitTime: now,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setMessage({ text: data.error || "No se pudo registrar la salida", type: "error" });
          setLoading(false);
          return;
        }

        await saveLocalSession(data.session);

        setReceipt({
          plate: cleanPlate,
          durationMinutes: data.durationMinutes,
          exitTime: now,
        });

        setMessage({ text: `✓ Salida procesada exitosamente`, type: "success" });
        setPlate("");
        if (onExitSuccess) onExitSuccess();
      } catch {
        await handleOfflineExit(cleanPlate, now);
      }
    } else {
      await handleOfflineExit(cleanPlate, now);
    }

    setLoading(false);
  };

  const handleOfflineExit = async (cleanPlate: string, now: string) => {
    const localSession = await getLocalSessionByPlate(cleanPlate, facilityId);
    if (!localSession) {
      setMessage({
        text: `No se encontró registro local activo para la patente ${cleanPlate} en modo offline`,
        type: "error",
      });
      return;
    }

    const updated = completeParkingSession(localSession, now);
    await saveLocalSession(updated);

    await enqueueOutboxMutation({
      id: crypto.randomUUID(),
      type: "VEHICLE_EXIT",
      payload: {
        facilityId,
        licensePlate: cleanPlate,
        exitTime: now,
      },
      clientTimestamp: now,
      deviceId: "gate-terminal-01",
      status: "pending",
      retryCount: 0,
    });

    setReceipt({
      plate: cleanPlate,
      durationMinutes: updated.durationMinutes,
      exitTime: now,
      offline: true,
    });

    setMessage({
      text: `✓ Salida registrada en modo Offline (Pendiente de sincronización)`,
      type: "success",
    });
    setPlate("");
    if (onExitSuccess) onExitSuccess();
  };

  return (
    <div className="glass-panel" style={{ padding: "2rem" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        Registrar Salida de Vehículo
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Placa Patente a Egresar</label>
          <input
            type="text"
            className="form-input plate-input"
            placeholder="AB123CD"
            maxLength={10}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "0.5rem", borderColor: "var(--border-subtle)" }}
        >
          {loading ? "Procesando..." : "Confirmar Salida y Liberar Plaza"}
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

      {receipt && (
        <div
          className="glass-panel"
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>COMPROBANTE DE EGRESO</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-mono)", margin: "0.25rem 0" }}>
            {receipt.plate}
          </div>
          <div style={{ fontSize: "1rem", color: "var(--color-success)", fontWeight: 600 }}>
            Tiempo de Permanencia: {receipt.durationMinutes ?? 0} minutos
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Hora de Salida: {new Date(receipt.exitTime).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};
