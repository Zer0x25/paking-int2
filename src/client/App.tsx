import React, { useState, useEffect } from "react";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { VehicleGatePanel } from "./components/VehicleGatePanel";
import { OperationalDashboard } from "./components/OperationalDashboard";
import { FacilityConfigView } from "./components/FacilityConfigView";
import { LoginView } from "./components/LoginView";
import { ThemeSelector } from "./components/ThemeSelector";
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
  const [gateRefreshKey, setGateRefreshKey] = useState(0);

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
    <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* App Header */}
      <header className="app-header">
        <div className="app-brand">
          <h1 className="brand-title">Smart Parking</h1>
          <span className="app-facility-label" title={facility.name}>{facility.name}</span>
        </div>

        <nav className="nav-tabs" aria-label="Navegación principal">
          <button
            onClick={() => setActiveTab("garita")}
            className={`nav-tab-btn ${activeTab === "garita" ? "active" : ""}`}
            aria-current={activeTab === "garita" ? "page" : undefined}
          >
            🚗 Garita Operativa
          </button>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              fetchDashboard();
            }}
            className={`nav-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            aria-current={activeTab === "dashboard" ? "page" : undefined}
          >
            📊 Dashboard
          </button>
          {currentUser.role === "admin" && (
            <button
              onClick={() => setActiveTab("config")}
              className={`nav-tab-btn ${activeTab === "config" ? "active" : ""}`}
              aria-current={activeTab === "config" ? "page" : undefined}
            >
              ⚙ Configuración
            </button>
          )}
        </nav>

        <div className="app-header-actions">
          <div className="app-account">
            <div className="app-user-info">
              <div className="app-user-name">{currentUser.fullName}</div>
              <div className="app-role-label">
              Rol: {currentUser.role}
              </div>
            </div>
          </div>
          <ThemeSelector />
          <button onClick={handleLogout} className="btn btn-secondary">Salir</button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content" style={{ flex: 1 }}>
        {/* Sync Status Banner */}
        <SyncStatusBar
          facilityId={facility.id}
          onSyncCompleted={() => {
            fetchDashboard();
            setGateRefreshKey((current) => current + 1);
          }}
        />

        {/* Tab Views */}
        {visibleSections.includes("vehicle-entry") && visibleSections.includes("vehicle-exit") && (
          <section>
            <VehicleGatePanel
              facilityId={facility.id}
              businessUnits={businessUnits}
              spaceCategories={spaceCategories}
              areas={areas}
              operatorUserId={currentUser.id}
              refreshKey={gateRefreshKey}
              onOperationSuccess={fetchDashboard}
            />
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
