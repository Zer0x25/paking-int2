import path from "node:path";

const ANSI_ESCAPE = new RegExp(
  `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
  "g",
);
const WRANGLER_ENTRY_POINTS = new Set([
  path.join("node_modules", ".bin", "wrangler"),
  path.join("node_modules", "wrangler", "bin", "wrangler.js"),
]);

export function parseProcessTable(text) {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(?:(\d+)\s+)?(\S.*)?$/);
      if (!match || !match[3]) return [];

      const process = { pid: Number(match[1]), command: match[3] };
      if (match[2] !== undefined) process.ppid = Number(match[2]);
      return [process];
    });
}

function tokenizeCommand(command) {
  const tokens = [];
  let token = "";
  let quote = null;
  let escaped = false;

  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += character;
    }
  }

  if (escaped) token += "\\";
  if (token) tokens.push(token);
  return tokens;
}

function isCheckoutWranglerEntryPoint(candidate, checkoutRoot) {
  const absoluteRoot = path.resolve(checkoutRoot);
  const absoluteCandidate = path.resolve(candidate);
  const relative = path.relative(absoluteRoot, absoluteCandidate);

  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative) &&
    WRANGLER_ENTRY_POINTS.has(relative)
  );
}

export function findOwnedWranglerDevPids(processes, checkoutRoot) {
  return processes
    .filter(({ command }) => {
      const tokens = tokenizeCommand(command);
      const entryPointIndex = tokens.findIndex((token) =>
        isCheckoutWranglerEntryPoint(token, checkoutRoot),
      );
      const executable = path.basename(tokens[0] ?? "").toLowerCase();
      const isNodeCommand = executable === "node" || executable === "node.exe";
      const nodeFlagsOnly = tokens
        .slice(1, entryPointIndex)
        .every((token) => token.startsWith("-"));

      return (
        isNodeCommand &&
        entryPointIndex >= 0 &&
        nodeFlagsOnly &&
        tokens[entryPointIndex + 1] === "dev" &&
        tokens[entryPointIndex + 2] === "src/server/index.ts"
      );
    })
    .map(({ pid }) => pid);
}

export function parseReadyPort(text) {
  const plainText = String(text).replace(ANSI_ESCAPE, "");
  const match = plainText.match(
    /Ready\s+on\s+https?:\/\/(?:\[[^\]]+\]|[^:\s/]+):(\d+)/i,
  );
  return match ? Number(match[1]) : null;
}

function hasOwnedWranglerAncestor(process, processByPid, ownedPids) {
  const visited = new Set();
  let current = process;

  while (current && !visited.has(current.pid)) {
    if (ownedPids.has(current.pid)) return true;
    visited.add(current.pid);
    current = current.ppid ? processByPid.get(current.ppid) : undefined;
  }

  return false;
}

export function assertPortAvailable({ port, checkoutRoot, processes }) {
  const owners = processes.filter((process) =>
    process.listeningPorts?.includes(port),
  );
  if (owners.length === 0) return;

  const processByPid = new Map(processes.map((process) => [process.pid, process]));
  const ownedPids = new Set(
    findOwnedWranglerDevPids(processes, checkoutRoot),
  );
  const unrelated = owners.filter(
    (owner) => !hasOwnedWranglerAncestor(owner, processByPid, ownedPids),
  );

  if (unrelated.length > 0) {
    const owner = unrelated[0];
    throw new Error(
      `El puerto ${port} está ocupado por otro proceso (PID ${owner.pid}); no se cerrará automáticamente.`,
    );
  }

  throw new Error(
    `El puerto ${port} sigue ocupado por una instancia Worker de este checkout después de solicitar su cierre.`,
  );
}

export async function stopPreviousWorkerDev({
  checkoutRoot,
  listProcesses,
  signalProcess,
  delay,
  timeoutMs = 10_000,
  pollIntervalMs = 100,
}) {
  const previousPids = new Set(
    findOwnedWranglerDevPids(await listProcesses(), checkoutRoot),
  );
  if (previousPids.size === 0) return [];

  for (const pid of previousPids) {
    try {
      await signalProcess(pid, "SIGINT");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }

  const deadline = Date.now() + timeoutMs;
  while (true) {
    const stillRunning = new Set(
      findOwnedWranglerDevPids(await listProcesses(), checkoutRoot),
    );
    const remaining = [...previousPids].filter((pid) => stillRunning.has(pid));
    if (remaining.length === 0) return [...previousPids];
    if (Date.now() >= deadline) {
      throw new Error(
        `Timeout: tiempo agotado esperando el cierre ordenado del Worker anterior (PID ${remaining.join(", ")}).`,
      );
    }

    await delay(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
  }
}

export async function startWorkerDev({
  expectedPort,
  spawnWorker,
  signalProcess,
}) {
  const worker = await spawnWorker({ port: expectedPort });

  try {
    const readyText = await worker.waitForReady();
    const actualPort = parseReadyPort(readyText ?? "");
    if (actualPort === expectedPort) return worker;

    const announced = actualPort === null ? "ninguno" : actualPort;
    throw new Error(
      `Wrangler anunció el puerto ${announced}; se requiere ${expectedPort}. Se cerrará esta instancia.`,
    );
  } catch (error) {
    if (Number.isInteger(worker.pid)) {
      try {
        await signalProcess(worker.pid, "SIGINT");
      } catch (signalError) {
        if (signalError?.code !== "ESRCH") throw signalError;
      }
    }
    await worker.waitForExit();
    throw error;
  }
}
