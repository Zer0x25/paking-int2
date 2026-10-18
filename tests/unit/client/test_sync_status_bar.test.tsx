// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatusBar } from "@client/components/SyncStatusBar";
import { OUTBOX_CHANGED_EVENT } from "@client/db/indexed-db";
import { processDeltaSync } from "@client/db/outbox-sync";

vi.mock("@client/db/indexed-db", () => ({
  OUTBOX_CHANGED_EVENT: "smart-parking:outbox-changed",
  getPendingOutboxMutations: vi.fn(async () => []),
}));
vi.mock("@client/db/outbox-sync", () => ({
  processDeltaSync: vi.fn(async () => ({ processed: 0, succeeded: [], conflicts: [] })),
}));

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("event-triggered offline synchronization", () => {
  it("does not poll and checks for queued changes when the outbox changes", async () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    render(<SyncStatusBar facilityId="facility-1" />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(intervalSpy).not.toHaveBeenCalled();
    expect(processDeltaSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(processDeltaSync).toHaveBeenCalledTimes(2);
  });
});
