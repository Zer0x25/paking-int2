// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, getPageClientId, SESSION_EXPIRED_EVENT } from "@client/api/client";

describe("authenticated API client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("adds the current bearer token and a stable page instance identifier", async () => {
    localStorage.setItem("auth_token", "session-token");
    await apiFetch("/api/facilities/fac-1/catalogs");

    const [input, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(input).toBe("/api/facilities/fac-1/catalogs");
    expect(headers.get("Authorization")).toBe("Bearer session-token");
    expect(headers.get("X-Client-Id")).toBe(getPageClientId());
    expect(getPageClientId()).toMatch(/^[A-Za-z0-9._-]{1,80}$/);
  });

  it("signals the app when an authenticated request is rejected as expired", async () => {
    localStorage.setItem("auth_token", "expired-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    await apiFetch("/api/facilities/fac-1/catalogs");

    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });
});
