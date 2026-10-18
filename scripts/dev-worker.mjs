import { execFileSync, spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPortAvailable,
  parseProcessTable,
  parseReadyPort,
  startWorkerDev,
  stopPreviousWorkerDev,
} from "./worker-dev-lifecycle.mjs";

const checkoutRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedPort = 8787;
const wranglerExecutable = path.join(checkoutRoot, "node_modules", ".bin", "wrangler");
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function listListeningPidsByPort() {
  try {
    const output = execFileSync("ss", ["-ltnp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const listeners = new Map();

    for (const line of output.split(/\r?\n/)) {
      const columns = line.trim().split(/\s+/);
      const portMatch = columns[3]?.match(/:(\d+)$/);
      if (!portMatch) continue;

      const port = Number(portMatch[1]);
      const pids = [...line.matchAll(/\bpid=(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      if (pids.length > 0) {
        const existing = listeners.get(port) ?? [];
        listeners.set(port, [...new Set([...existing, ...pids])]);
      }
    }

    return listeners;
  } catch {
    // The bind probe below still detects conflicts when ss is unavailable.
    return new Map();
  }
}

async function listProcesses() {
  const output = execFileSync("ps", ["-ww", "-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const listeners = listListeningPidsByPort();
  const portsByPid = new Map();

  for (const [port, pids] of listeners) {
    for (const pid of pids) {
      const ports = portsByPid.get(pid) ?? [];
      ports.push(port);
      portsByPid.set(pid, ports);
    }
  }

  return parseProcessTable(output).map((process) => ({
    ...process,
    listeningPorts: portsByPid.get(process.pid) ?? [],
  }));
}

async function signalProcess(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function assertBindable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }).catch((error) => {
    if (error?.code === "EADDRINUSE") {
      throw new Error(
        `El puerto ${port} sigue ocupado por un proceso que no se puede identificar; no se cerrará automáticamente.`,
      );
    }
    throw error;
  });
}

function spawnWorker({ port }) {
  const child = spawn(
    process.execPath,
    [wranglerExecutable, "dev", "src/server/index.ts", "--port", String(port)],
    {
      cwd: checkoutRoot,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );

  let readinessSettled = false;
  let pendingOutput = "";
  let readinessTimer;
  let resolveReady;
  let rejectReady;
  let resolveExit;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });

  const settleReady = (value, error) => {
    if (readinessSettled) return;
    readinessSettled = true;
    clearTimeout(readinessTimer);
    if (error) rejectReady(error);
    else resolveReady(value);
  };

  const consumeOutput = (destination, chunk) => {
    const text = chunk.toString();
    destination.write(text);
    pendingOutput += text;

    const lines = pendingOutput.split(/\r?\n/);
    pendingOutput = lines.pop() ?? "";
    for (const line of lines) {
      if (parseReadyPort(line) !== null) settleReady(line);
    }
    if (parseReadyPort(pendingOutput) !== null) {
      settleReady(pendingOutput);
    }
    if (pendingOutput.length > 8192) pendingOutput = pendingOutput.slice(-8192);
  };

  child.stdout.on("data", (chunk) =>
    consumeOutput(process.stdout, chunk),
  );
  child.stderr.on("data", (chunk) =>
    consumeOutput(process.stderr, chunk),
  );
  child.once("error", (error) => {
    settleReady(null, error);
    resolveExit({ code: 1, signal: null, error });
  });
  child.once("exit", (code, signal) => {
    settleReady(null);
    resolveExit({ code, signal });
  });

  readinessTimer = setTimeout(() => {
    settleReady(
      null,
      new Error(`Wrangler no confirmó que quedó listo en ${port} dentro de 30 segundos.`),
    );
  }, 30_000);

  return {
    pid: child.pid,
    waitForReady: () => ready,
    waitForExit: () => exited,
  };
}

function exitCodeFor(result, requestedSignal) {
  if (requestedSignal === "SIGINT") return 130;
  if (requestedSignal === "SIGTERM") return 143;
  if (Number.isInteger(result?.code)) return result.code;
  return result?.signal ? 1 : 0;
}

async function main() {
  let activeWorker;
  let requestedSignal;
  const handleShutdown = (signal) => {
    requestedSignal ??= signal;
    if (activeWorker?.pid) void signalProcess(activeWorker.pid, "SIGINT");
  };
  const onInterrupt = () => handleShutdown("SIGINT");
  const onTerminate = () => handleShutdown("SIGTERM");

  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  try {
    await stopPreviousWorkerDev({
      checkoutRoot,
      listProcesses,
      signalProcess,
      delay,
    });

    if (requestedSignal) {
      process.exitCode = exitCodeFor(null, requestedSignal);
      return;
    }

    const processes = await listProcesses();
    assertPortAvailable({
      port: expectedPort,
      checkoutRoot,
      processes,
    });
    await assertBindable(expectedPort);

    const worker = await startWorkerDev({
      expectedPort,
      spawnWorker: (options) => {
        activeWorker = spawnWorker(options);
        return activeWorker;
      },
      signalProcess,
    });
    const result = await worker.waitForExit();
    process.exitCode = exitCodeFor(result, requestedSignal);
  } catch (error) {
    console.error(`[worker:dev] ${error.message}`);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

await main();
