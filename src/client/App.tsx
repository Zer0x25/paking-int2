import React, { useState, useEffect } from "react";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { VehicleEntryForm } from "./components/VehicleEntryForm";
import { VehicleExitForm } from "./components/VehicleExitForm";
import { OperationalDashboard } from "./components/OperationalDashboard";
import { FacilityConfigView } from "./components/FacilityConfigView";
import { LoginView } from "./components/LoginView";
import { getOperationalViewSections, type ApplicationTab } from "./utils/operational-view";
import type { Facility, BusinessUnit, SpaceCategory, EventBooking, DashboardMetrics, User, ParkingArea } from "@core/types/schema";
import { defaultFacility, defaultBusinessUnits, defaultEvents } from "@server/services/allocation-service";

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem("auth_user");
    return cached ? JSON.parse(cached) : null;
  });

  const [activeTab, setActiveTab] = useState<ApplicationTab>("garita");
  const visibleSections = getOperationalViewSections(activeTab);
  const [facility, setFacility] = useState<Facility>(defaultFacility);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(defaultBusinessUnits);
  const [spaceCategories, setSpaceCategories] = useState<SpaceCategory[]>([
    { id: "cat-std", facilityId: defaultFacility.id, name: "General / Estándar", code: "STD", allocatedSlots: 80 },
    { id: "cat-acc", facilityId: defaultFacility.id, name: "Accesible (PMR)", code: "ACC", allocatedSlots: 10 },
    { id: "cat-vip", facilityId: defaultFacility.id, name: "VIP / Reservado", code: "VIP", allocatedSlots: 10 },
  ]);
  const [areas, setAreas] = useState<ParkingArea[]>([]);
  const [events, setEvents] = useState<EventBooking[]>(defaultEvents);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);

  const fetchCatalogs = async () => {
    try {
      const res = await fetch(`/api/facilities/${facility.id}/catalogs`);
      if (res.ok) {
        const data = await res.json();
        if (data.facility) setFacility(data.facility);
        if (data.businessUnits) setBusinessUnits(data.businessUnits);
        if (data.categories) setSpaceCategories(data.categories);
        if (data.areas) setAreas(data.areas);
        if (data.events) setEvents(data.events);
      }
    } catch {
      // Offline fallback: retains defaults
    }
  };

  const fetchDashboard = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch(`/api/facilities/${facility.id}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardMetrics(data);
      }
    } catch {
      // Offline fallback: compute locally if possible
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 6000);
    return () => clearInterval(interval);
  }, [facility.id]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <main className="main-content">
        <LoginView
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            fetchCatalogs();
            fetchDashboard();
          }}
        />
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* App Header */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <h1 className="brand-title">Smart Parking</h1>
          <span
            style={{
              fontSize: "0.8rem",
              background: "rgba(255, 255, 255, 0.08)",
              padding: "0.25rem 0.65rem",
              borderRadius: "999px",
              color: "var(--text-secondary)",
            }}
          >
            {facility.name}
          </span>
        </div>

        <nav className="nav-tabs">
          <button
            onClick={() => setActiveTab("garita")}
            className={`nav-tab-btn ${activeTab === "garita" ? "active" : ""}`}
          >
            🚗 Garita Operativa
          </button>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              fetchDashboard();
            }}
            className={`nav-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          >
            📊 Dashboard
          </button>
          {currentUser.role === "admin" && (
            <button
              onClick={() => setActiveTab("config")}
              className={`nav-tab-btn ${activeTab === "config" ? "active" : ""}`}
            >
              ⚙ Configuración
            </button>
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{currentUser.fullName}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
              Rol: {currentUser.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content" style={{ flex: 1 }}>
        {/* Sync Status Banner */}
        <SyncStatusBar facilityId={facility.id} onSyncCompleted={fetchDashboard} />

        {/* Tab Views */}
        {visibleSections.includes("vehicle-entry") && visibleSections.includes("vehicle-exit") && (
          <section>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              <VehicleEntryForm
                facilityId={facility.id}
                businessUnits={businessUnits}
                spaceCategories={spaceCategories}
                areas={areas}
                onEntrySuccess={fetchDashboard}
              />
              <VehicleExitForm facilityId={facility.id} onExitSuccess={fetchDashboard} />
            </div>

          </section>
        )}

        {visibleSections.includes("dashboard") && (
          <section>
            <OperationalDashboard metrics={dashboardMetrics} loading={loadingMetrics} />
          </section>
        )}

        {visibleSections.includes("config") && currentUser.role === "admin" && (
          <section>
            <FacilityConfigView
              facility={facility}
              businessUnits={businessUnits}
              events={events}
              onRefresh={fetchCatalogs}
            />
          </section>
        )}
      </main>
    </div>
  );
};
