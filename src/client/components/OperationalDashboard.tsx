import React from "react";
import type { DashboardMetrics } from "@core/types/schema";

interface OperationalDashboardProps {
  metrics: DashboardMetrics | null;
  loading?: boolean;
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({ metrics, loading }) => {
  if (loading || !metrics) {
    return (
      <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
        Cargando indicadores de ocupación en tiempo real...
      </div>
    );
  }

  const getAlertBadge = (level: "normal" | "warning" | "critical") => {
    switch (level) {
      case "critical":
        return <span className="badge-alert badge-critical">● Saturación Crítica (100%)</span>;
      case "warning":
        return <span className="badge-alert badge-warning">▲ Capacidad Próxima al Límite (&gt;90%)</span>;
      default:
        return <span className="badge-alert badge-normal">✓ Capacidad Normal</span>;
    }
  };

  const getBarColor = (pct: number) => {
    if (pct >= 100) return "var(--color-danger)";
    if (pct >= 90) return "var(--color-warning)";
    return "var(--color-success)";
  };

  return (
    <div>
      {/* Header with Title and Alert Level */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 700 }}>Monitoreo de Ocupación en Vivo</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Actualización automática de plazas compartidas y control de cuotas
          </p>
        </div>
        <div>{getAlertBadge(metrics.alertLevel)}</div>
      </div>

      {/* Primary KPI Grid */}
      <div className="dashboard-grid">
        <div className="glass-panel metric-card">
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Ocupación Global
          </span>
          <div className="metric-val" style={{ color: getBarColor(metrics.occupancyPercentage) }}>
            {metrics.occupancyPercentage}%
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{
                width: `${metrics.occupancyPercentage}%`,
                backgroundColor: getBarColor(metrics.occupancyPercentage),
              }}
            />
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            {metrics.totalOccupied} de {metrics.totalCapacity} plazas totales
          </span>
        </div>

        <div className="glass-panel metric-card">
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Vehículos Adentro
          </span>
          <div className="metric-val" style={{ color: "var(--text-primary)" }}>
            {metrics.totalOccupied}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "auto" }}>
            Sesiones de garita activas
          </span>
        </div>

        <div className="glass-panel metric-card">
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>
            Disponibilidad Física
          </span>
          <div className="metric-val" style={{ color: "var(--color-success)" }}>
            {metrics.totalAvailable}
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "auto" }}>
            Plazas desocupadas en el recinto
          </span>
        </div>
      </div>

      {/* Business Units Breakdown */}
      <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>
        Asignación Dinámica por Unidad de Negocio
      </h3>
      <div className="dashboard-grid">
        {metrics.units.map((unit) => {
          const quota = unit.allocatedQuota;
          const pct = quota > 0 ? Math.min(100, Math.round((unit.occupied / quota) * 100)) : 0;
          const quotaBadge =
            unit.quotaType === "guaranteed"
              ? "Prioridad Hotel (Garantizada)"
              : unit.quotaType === "contractual"
              ? "Eventos (Contractual)"
              : "Rotativa Comercial (Dinámica)";

          return (
            <div key={unit.businessUnitId} className={`glass-panel unit-card ${unit.quotaType}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{unit.name}</h4>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{quotaBadge}</span>
                </div>
                {unit.isSaturated && (
                  <span style={{ color: "var(--color-danger)", fontSize: "0.75rem", fontWeight: 700 }}>
                    CUPO LLENO
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "1rem" }}>
                <span style={{ fontSize: "1.8rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  {unit.occupied}
                </span>
                {quota > 0 ? (
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>/ {quota} cupos</span>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>vehículos</span>
                )}
              </div>

              {quota > 0 && (
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getBarColor(pct),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
