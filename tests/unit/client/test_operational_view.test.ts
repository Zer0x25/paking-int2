import { describe, expect, it } from "vitest";
import { getOperationalViewSections } from "@client/utils/operational-view";

describe("operational view sections", () => {
  it("keeps vehicle entry and exit in Garita without dashboard monitoring", () => {
    expect(getOperationalViewSections("garita")).toEqual(["vehicle-entry", "vehicle-exit"]);
  });

  it("keeps all monitoring in Dashboard without vehicle operation forms", () => {
    expect(getOperationalViewSections("dashboard")).toEqual(["dashboard"]);
  });

  it("keeps configuration isolated in its existing tab", () => {
    expect(getOperationalViewSections("config")).toEqual(["config"]);
  });
});
