import { describe, expect, it, vi } from "vitest";
import {
  assertPortAvailable,
  findOwnedWranglerDevPids,
  parseProcessTable,
  parseReadyPort,
  startWorkerDev,
  stopPreviousWorkerDev,
} from "../../../scripts/worker-dev-lifecycle.mjs";

describe("local Wrangler dev lifecycle", () => {
  const checkoutRoot = "/workspace/paking-int2";

  it("parses ps PID and command columns while preserving command arguments", () => {
    const processes = parseProcessTable(
      [
        "  PID COMMAND",
        "  401 node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts --port 8787",
        "  402 /usr/bin/node /workspace/other/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
        "",
      ].join("\n"),
    );

    expect(processes).toEqual([
      {
        pid: 401,
        command:
          "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts --port 8787",
      },
      {
        pid: 402,
        command:
          "/usr/bin/node /workspace/other/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
      },
    ]);
  });

  it("selects only this checkout's Wrangler dev entry point", () => {
    const processes = [
      {
        pid: 501,
        command:
          "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts --port 8787",
      },
      {
        pid: 502,
        command:
          "node /workspace/paking-int2-copy/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
      },
      {
        pid: 503,
        command:
          "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js deploy src/server/index.ts",
      },
      {
        pid: 504,
        command:
          "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev --test-scheduled src/server/index.ts",
      },
      {
        pid: 505,
        command: "vitest run src/server/index.ts",
      },
      {
        pid: 506,
        command:
          "bash -c 'echo /workspace/paking-int2/node_modules/.bin/wrangler dev src/server/index.ts'",
      },
      {
        pid: 507,
        command:
          "echo /workspace/paking-int2/node_modules/.bin/wrangler dev src/server/index.ts",
      },
    ];

    expect(findOwnedWranglerDevPids(processes, checkoutRoot)).toEqual([501]);
  });

  it("extracts the port announced on Wrangler's Ready line", () => {
    expect(parseReadyPort("⎔ Starting local server...\nReady on http://localhost:8787")).toBe(
      8787,
    );
    expect(parseReadyPort("Ready on http://127.0.0.1:8788/")).toBe(8788);
    expect(parseReadyPort("Starting on http://localhost:8790")).toBeNull();
  });

  it("rejects 8787 when a listener exists but is not identified as this checkout's Worker", () => {
    expect(() =>
      assertPortAvailable({
        port: 8787,
        checkoutRoot,
        processes: [
          {
            pid: 801,
            command: "python3 -m http.server 8787",
            listeningPorts: [8787],
          },
        ],
      }),
    ).toThrow(/8787/);
  });

  it("sends SIGINT only to an owned dev Worker and waits for it to disappear", async () => {
    let processIsVisible = true;
    let delayCount = 0;
    const ownedProcess = {
      pid: 601,
      command:
        "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
    };
    const unrelatedProcess = {
      pid: 602,
      command: "node /workspace/unrelated/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
    };
    const listProcesses = vi.fn(async () =>
      processIsVisible ? [ownedProcess, unrelatedProcess] : [unrelatedProcess],
    );
    const signalProcess = vi.fn(async () => undefined);
    const delay = vi.fn(async () => {
      delayCount += 1;
      if (delayCount === 1) processIsVisible = false;
    });

    await stopPreviousWorkerDev({
      checkoutRoot,
      listProcesses,
      signalProcess,
      delay,
      timeoutMs: 100,
    });

    expect(signalProcess).toHaveBeenCalledTimes(1);
    expect(signalProcess).toHaveBeenCalledWith(601, "SIGINT");
    expect(delay).toHaveBeenCalled();
    expect(listProcesses.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("times out when the owned Wrangler dev Worker does not exit", async () => {
    const stillRunning = {
      pid: 701,
      command:
        "node /workspace/paking-int2/node_modules/wrangler/bin/wrangler.js dev src/server/index.ts",
    };
    const delay = vi.fn(
      (milliseconds: number) =>
        new Promise<void>((resolve) =>
          setTimeout(resolve, Math.min(Math.max(milliseconds, 1), 5)),
        ),
    );

    await expect(
      stopPreviousWorkerDev({
        checkoutRoot,
        listProcesses: vi.fn(async () => [stillRunning]),
        signalProcess: vi.fn(async () => undefined),
        delay,
        timeoutMs: 25,
      }),
    ).rejects.toThrow(/timed? ?out/i);
  });

  it("gracefully stops a newly launched Worker when Wrangler announces 8788", async () => {
    const worker = {
      pid: 901,
      waitForReady: vi.fn(async () => "Ready on http://localhost:8788"),
      waitForExit: vi.fn(async () => undefined),
    };
    const spawnWorker = vi.fn(async () => worker);
    const signalProcess = vi.fn(async () => undefined);

    await expect(
      startWorkerDev({
        expectedPort: 8787,
        spawnWorker,
        signalProcess,
      }),
    ).rejects.toThrow(/8788/);

    expect(spawnWorker).toHaveBeenCalledWith({ port: 8787 });
    expect(signalProcess).toHaveBeenCalledTimes(1);
    expect(signalProcess).toHaveBeenCalledWith(901, "SIGINT");
    expect(worker.waitForExit).toHaveBeenCalledTimes(1);
  });
});
