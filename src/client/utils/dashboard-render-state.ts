export type DashboardRenderState = "loading" | "content" | "unavailable";

export function getDashboardRenderState(
  hasMetrics: boolean,
  isLoading: boolean
): DashboardRenderState {
  if (hasMetrics) return "content";
  return isLoading ? "loading" : "unavailable";
}
