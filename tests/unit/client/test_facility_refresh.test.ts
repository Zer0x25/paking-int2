import { describe, expect, it } from "vitest";
import { getFacilityRefreshTargets } from "@client/utils/facility-refresh";

describe("facility event refresh targets", () => {
  it("refreshes only active parking sessions for a parking change in Garita", () => {
    expect(getFacilityRefreshTargets("garita", ["parking"])).toEqual(["sessions"]);
  });

  it("refreshes only catalogs for a configuration change in Garita", () => {
    expect(getFacilityRefreshTargets("garita", ["configuration"])).toEqual(["catalogs"]);
  });

  it("refreshes the dashboard once for either kind of change", () => {
    expect(getFacilityRefreshTargets("dashboard", ["parking"])).toEqual(["dashboard"]);
    expect(getFacilityRefreshTargets("dashboard", ["configuration"])).toEqual(["dashboard"]);
  });

  it("refreshes configuration only for configuration changes", () => {
    expect(getFacilityRefreshTargets("config", ["parking"])).toEqual([]);
    expect(getFacilityRefreshTargets("config", ["configuration"])).toEqual(["catalogs"]);
  });

  it("refreshes all data for the active view after reconnect", () => {
    expect(getFacilityRefreshTargets("garita")).toEqual(["catalogs", "sessions"]);
    expect(getFacilityRefreshTargets("dashboard")).toEqual(["dashboard"]);
    expect(getFacilityRefreshTargets("config")).toEqual(["catalogs"]);
  });

  it("deduplicates targets when multiple change types arrive together", () => {
    expect(getFacilityRefreshTargets("garita", ["parking", "configuration", "parking"]))
      .toEqual(["sessions", "catalogs"]);
  });
});
