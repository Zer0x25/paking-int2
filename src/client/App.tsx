import React, { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { VehicleGatePanel } from "./components/VehicleGatePanel";
import { OperationalDashboard } from "./components/OperationalDashboard";
import { FacilityConfigView } from "./components/FacilityConfigView";
import { LoginView } from "./components/LoginView";
import { ThemeSelector } from "./components/ThemeSelector";
import { getOperationalViewSections, type ApplicationTab } from "./utils/operational-view";
import {
  BusinessUnitSchema,
  DashboardMetricsSchema,
  EventBookingSchema,
  FacilitySchema,
  ParkingAreaSchema,
  SpaceCategorySchema,
  UserSchema,
  type Facility,
  type BusinessUnit,
  type SpaceCategory,
  type EventBooking,
  type DashboardMetrics,
  type User,
  type ParkingArea,
} from "@core/types/schema";
import { apiFetch, getTokenExpirationMs, SESSION_EXPIRED_EVENT } from "./api/client";
import { useFacilityEvents } from "./hooks/useFacilityEvents";
import { cacheCatalogData, getCachedCatalogData, getLocalAreas, saveLocalArea } from "./db/indexed-db";
import { getFacilityRefreshTargets } from "./utils/facility-refresh";
import type { FacilityChangeScope } from "../shared/facility-events";

const LOCAL_FACILITY_ID = "fac-default-01";

const FacilityCatalogResponseSchema = z.object({
  facility: FacilitySchema,
  businessUnits: z.array(BusinessUnitSchema),
  categories: z.array(SpaceCategorySchema),
  areas: z.array(ParkingAreaSchema),
  events: z.array(EventBookingSchema),
});
type FacilityCatalogResponse = z.infer<typeof FacilityCatalogResponseSchema>;

function clearStoredIdentity(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

function readStoredSession(): User | null {
  try {
    const token = localStorage.getItem("auth_token");
    const expiry = token ? getTokenExpirationMs(token) : null;
    const cachedUser = localStorage.getItem("auth_user");
    const parsedUser = cachedUser ? UserSchema.safeParse(JSON.parse(cachedUser)) : null;
    if (!token || !expiry || expiry <= Date.now() || !parsedUser?.success) {
      clearStoredIdentity();
      return null;
    }
    return parsedUser.data;
  } catch {
    clearStoredIdentity();
    return null;
  }
}

function setCatalogState(
  data: FacilityCatalogResponse,
  setFacility: React.Dispatch<React.SetStateAction<Facility>>,
  setBusinessUnits: React.Dispatch<React.SetStateAction<BusinessUnit[]>>,
  setSpaceCategories: React.Dispatch<React.SetStateAction<SpaceCategory[]>>,
  setAreas: React.Dispatch<React.SetStateAction<ParkingArea[]>>,
  setEvents: React.Dispatch<React.SetStateAction<EventBooking[]>>,
): void {
  setFacility(data.facility);
  setBusinessUnits(data.businessUnits);
  setSpaceCategories(data.categories);
  setAreas(data.areas);
  setEvents(data.events);
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(readStoredSession);
  const [activeTab, setActiveTab] = useState<ApplicationTab>("garita");
  const visibleSections = getOperationalViewSections(activeTab);
  const [facility, setFacility] = useState<Facility>(() => ({
    id: currentUser?.facilityId || LOCAL_FACILITY_ID,
    name: "Cargando instalación…",
    address: "",
    totalCapacity: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [spaceCategories, setSpaceCategories] = useState<SpaceCategory[]>([]);
  const [areas, setAreas] = useState<ParkingArea[]>([]);
  const [events, setEvents] = useState<EventBooking[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);
  const [gateRefreshKey, setGateRefreshKey] = useState(0);

  const clearPrivateViewState = useCallback(() => {
    clearStoredIdentity();
    setCurrentUser(null);
    setActiveTab("garita");
    setFacility({
      id: LOCAL_FACILITY_ID,
      name: "Cargando instalación…",
      address: "",
      totalCapacity: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
    setBusinessUnits([]);
    setSpaceCategories([]);
    setAreas([]);
    setEvents([]);
    setDashboardMetrics(null);
    setLoadingMetrics(false);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, clearPrivateViewState);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearPrivateViewState);
  }, [clearPrivateViewState]);

  useEffect(() => {
    if (!currentUser) return;
    const token = localStorage.getItem("auth_token");
    const expiry = token ? getTokenExpirationMs(token) : null;
    if (!expiry || expiry <= Date.now()) {
      clearPrivateViewState();
      return;
    }
    const timeout = window.setTimeout(clearPrivateViewState, Math.min(expiry - Date.now(), 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [currentUser, clearPrivateViewState]);

  const fetchCatalogs = useCallback(async () => {
    const facilityId = currentUser?.facilityId;
    if (!currentUser || !facilityId || (activeTab === "config" && currentUser.role !== "admin")) return;
    const token = localStorage.getItem("auth_token");
    const cacheKey = `catalogs:${facilityId}`;
    try {
      const response = await apiFetch(`/api/facilities/${encodeURIComponent(facilityId)}/catalogs`);
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok) throw new Error(`Error al cargar catálogos: HTTP ${response.status}`);
      const parsed = FacilityCatalogResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.facility.id !== facilityId) return;
      setCatalogState(parsed.data, setFacility, setBusinessUnits, setSpaceCategories, setAreas, setEvents);
      try {
        await cacheCatalogData(cacheKey, parsed.data);
        await Promise.all(parsed.data.areas.map(saveLocalArea));
      } catch {
        // IndexedDB can be unavailable in restricted browser contexts.
      }
    } catch {
      if (!token || localStorage.getItem("auth_token") !== token || currentUser.facilityId !== facilityId) return;
      try {
        const cached = await getCachedCatalogData<unknown>(cacheKey);
        const parsed = FacilityCatalogResponseSchema.safeParse(cached);
        if (parsed.success && parsed.data.facility.id === facilityId) {
          setCatalogState(parsed.data, setFacility, setBusinessUnits, setSpaceCategories, setAreas, setEvents);
          return;
        }
      } catch {
        // Try the facility-scoped area snapshot below.
      }
      try {
        setAreas(await getLocalAreas(facilityId));
      } catch {
        // Keep the current view usable if IndexedDB is not available.
      }
    }
  }, [activeTab, currentUser]);

  const fetchDashboard = useCallback(async () => {
    const facilityId = currentUser?.facilityId;
    if (!currentUser || !facilityId || activeTab !== "dashboard") return;
    setLoadingMetrics(true);
    try {
      const response = await apiFetch(`/api/facilities/${encodeURIComponent(facilityId)}/dashboard`);
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok) return;
      const parsed = DashboardMetricsSchema.safeParse(await response.json());
      if (parsed.success && parsed.data.facilityId === facilityId) setDashboardMetrics(parsed.data);
    } catch {
      // Keep the last dashboard snapshot while the API is unavailable.
    } finally {
      setLoadingMetrics(false);
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (currentUser && (activeTab === "garita" || activeTab === "config")) void fetchCatalogs();
  }, [activeTab, currentUser, fetchCatalogs]);

  useEffect(() => {
    if (currentUser && activeTab === "dashboard") void fetchDashboard();
  }, [activeTab, currentUser, fetchDashboard]);

  const refreshActiveView = useCallback((scopes?: readonly FacilityChangeScope[]) => {
    const targets = getFacilityRefreshTargets(activeTab, scopes);
    if (targets.includes("dashboard")) void fetchDashboard();
    if (targets.includes("catalogs")) void fetchCatalogs();
    if (targets.includes("sessions")) setGateRefreshKey((current) => current + 1);
  }, [activeTab, fetchCatalogs, fetchDashboard]);

  const refreshAfterSync = useCallback(() => {
    if (activeTab === "dashboard") void fetchDashboard();
    if (activeTab === "garita") setGateRefreshKey((current) => current + 1);
    if (activeTab === "config") void fetchCatalogs();
  }, [activeTab, fetchCatalogs, fetchDashboard]);

  useFacilityEvents({
    facilityId: currentUser?.facilityId || undefined,
    enabled: Boolean(currentUser?.facilityId),
    onRefresh: refreshActiveView,
  });

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab("garita");
    if (user.facilityId) setFacility((current) => ({ ...current, id: user.facilityId || LOCAL_FACILITY_ID }));
  };

  const handleFacilityCreated = (createdFacility: Facility, token: string) => {
    if (!currentUser) return;
    const assignedUser = { ...currentUser, facilityId: createdFacility.id };
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(assignedUser));
    setCurrentUser(assignedUser);
    setFacility(createdFacility);
    setActiveTab("garita");
  };

  if (!currentUser) {
    return (
      <main className="main-content">
        <LoginView onLoginSuccess={handleLogin} />
      </main>
    );
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-header">
        <div className="app-brand">
          <h1 className="brand-title">Smart Parking</h1>
          <span className="app-facility-label" title={currentUser.facilityId ? facility.name : "Configuración inicial"}>
            {currentUser.facilityId ? facility.name : "Configura tu recinto"}
          </span>
        </div>

        {currentUser.facilityId && <nav className="nav-tabs" aria-label="Navegación principal">
          <button
            onClick={() => setActiveTab("garita")}
            className={`nav-tab-btn ${activeTab === "garita" ? "active" : ""}`}
            aria-current={activeTab === "garita" ? "page" : undefined}
          >
            🚗 Garita Operativa
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
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
        </nav>}

        <div className="app-header-actions">
          <div className="app-account">
            <div className="app-user-info">
              <div className="app-user-name">{currentUser.fullName}</div>
              <div className="app-role-label">Rol: {currentUser.role}</div>
            </div>
          </div>
          <div className="app-header-quick-controls">
            <ThemeSelector />
            {currentUser.facilityId && <SyncStatusBar facilityId={currentUser.facilityId} onSyncCompleted={refreshAfterSync} />}
          </div>
          <button onClick={clearPrivateViewState} className="btn btn-secondary">Salir</button>
        </div>
      </header>

      <main className="main-content" style={{ flex: 1 }}>
        {!currentUser.facilityId && currentUser.role === "admin" && (
          <section>
            <FacilityConfigView
              facility={null}
              businessUnits={[]}
              events={[]}
              onFacilityCreated={handleFacilityCreated}
            />
          </section>
        )}

        {!currentUser.facilityId && currentUser.role !== "admin" && (
          <section className="glass-panel config-panel" role="alert">
            El administrador debe crear y asignar el recinto antes de habilitar la operación.
          </section>
        )}

        {currentUser.facilityId && visibleSections.includes("vehicle-entry") && visibleSections.includes("vehicle-exit") && (
          <section>
            <VehicleGatePanel
              facilityId={currentUser.facilityId || facility.id}
              businessUnits={businessUnits}
              spaceCategories={spaceCategories}
              areas={areas}
              operatorUserId={currentUser.id}
              refreshKey={gateRefreshKey}
            />
          </section>
        )}

        {currentUser.facilityId && visibleSections.includes("dashboard") && (
          <section><OperationalDashboard metrics={dashboardMetrics} loading={loadingMetrics} /></section>
        )}

        {currentUser.facilityId && visibleSections.includes("config") && currentUser.role === "admin" && (
          <section>
            <FacilityConfigView
              facility={facility}
              businessUnits={businessUnits}
              events={events}
              spaceCategories={spaceCategories}
              onRefresh={refreshActiveView}
              onFacilityDeactivated={clearPrivateViewState}
            />
          </section>
        )}
      </main>
    </div>
  );
};
