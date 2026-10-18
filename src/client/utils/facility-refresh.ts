import type { FacilityChangeScope } from "../../shared/facility-events";
import type { ApplicationTab } from "./operational-view";

export type FacilityRefreshTarget = "catalogs" | "sessions" | "dashboard";

export function getFacilityRefreshTargets(
  activeTab: ApplicationTab,
  scopes?: readonly FacilityChangeScope[],
): FacilityRefreshTarget[] {
  if (scopes === undefined) {
    if (activeTab === "garita") return ["catalogs", "sessions"];
    if (activeTab === "dashboard") return ["dashboard"];
    return ["catalogs"];
  }

  const changes = new Set(scopes);
  if (activeTab === "dashboard") return changes.size > 0 ? ["dashboard"] : [];
  if (activeTab === "config") return changes.has("configuration") ? ["catalogs"] : [];

  const targets: FacilityRefreshTarget[] = [];
  if (changes.has("parking")) targets.push("sessions");
  if (changes.has("configuration")) targets.push("catalogs");
  return targets;
}
