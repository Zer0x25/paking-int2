import { describe, expect, it } from "vitest";
import { getDashboardRenderState } from "@client/utils/dashboard-render-state";

describe("Dashboard background refresh", () => {
  it("keeps the current dashboard content visible while refreshing metrics", () => {
    expect(getDashboardRenderState(true, true)).toBe("content");
  });

  it("shows an initial loading state before the first metrics arrive", () => {
    expect(getDashboardRenderState(false, true)).toBe("loading");
  });

  it("reports unavailable metrics after the initial request fails", () => {
    expect(getDashboardRenderState(false, false)).toBe("unavailable");
  });
});
