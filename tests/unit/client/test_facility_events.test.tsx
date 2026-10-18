// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPageClientId } from "@client/api/client";
import { useFacilityEvents } from "@client/hooks/useFacilityEvents";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string, readonly protocols: string[]) {
    MockWebSocket.instances.push(this);
  }

  open(): void {
    this.onopen?.(new Event("open"));
  }

  message(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  close(): void {
    this.onclose?.({ code: 1000, reason: "closed" } as CloseEvent);
  }
}

function eventPayload(facilityId: string, sourceClientId = "other-tab"): string {
  return JSON.stringify({ schemaVersion: 1, type: "facility.changed", facilityId, changeId: crypto.randomUUID(), sourceClientId });
}

let visibility = "visible";
let previousVisibility: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorage.setItem("auth_token", "test-token");
  MockWebSocket.instances = [];
  visibility = "visible";
  previousVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (previousVisibility) Object.defineProperty(document, "visibilityState", previousVisibility);
  else Reflect.deleteProperty(document, "visibilityState");
});

describe("facility event client", () => {
  it("authenticates the socket and refreshes only valid changes from another page", async () => {
    const onRefresh = vi.fn();
    renderHook(() => useFacilityEvents({ facilityId: "facility-1", enabled: true, onRefresh }));
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain("/api/events/facility-1");
    expect(socket.protocols).toEqual(["parking-events-v1", "test-token", getPageClientId()]);

    act(() => {
      socket.message(JSON.stringify({ schemaVersion: 9, type: "facility.changed", facilityId: "facility-1", changeId: "x", sourceClientId: "other" }));
      socket.message(eventPayload("another-facility"));
      socket.message(eventPayload("facility-1", getPageClientId()));
    });
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => socket.message(eventPayload("facility-1")));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("defers hidden-page invalidations until visibility returns", async () => {
    const onRefresh = vi.fn();
    renderHook(() => useFacilityEvents({ facilityId: "facility-1", enabled: true, onRefresh }));
    const socket = MockWebSocket.instances[0];
    visibility = "hidden";
    act(() => socket.message(eventPayload("facility-1")));
    expect(onRefresh).not.toHaveBeenCalled();

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes the active view after a successful reconnect", async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const { unmount } = renderHook(() => useFacilityEvents({ facilityId: "facility-1", enabled: true, onRefresh }));
    const firstSocket = MockWebSocket.instances[0];
    act(() => firstSocket.open());
    expect(onRefresh).not.toHaveBeenCalled();
    act(() => firstSocket.close());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => MockWebSocket.instances[1].open());
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });
});
