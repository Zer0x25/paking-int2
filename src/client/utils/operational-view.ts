export type ApplicationTab = "garita" | "dashboard" | "config";
export type OperationalViewSection = "vehicle-entry" | "vehicle-exit" | "dashboard" | "config";

const SECTIONS_BY_TAB: Record<ApplicationTab, readonly OperationalViewSection[]> = {
  garita: ["vehicle-entry", "vehicle-exit"],
  dashboard: ["dashboard"],
  config: ["config"],
};

export function getOperationalViewSections(tab: ApplicationTab): readonly OperationalViewSection[] {
  return SECTIONS_BY_TAB[tab];
}
