export interface WorkerDevProcess {
  pid: number;
  ppid?: number;
  command: string;
  listeningPorts?: number[];
}

export interface ManagedWorkerDevProcess {
  pid?: number;
  waitForReady(): Promise<string | null>;
  waitForExit(): Promise<unknown>;
}

export function parseProcessTable(text: string): WorkerDevProcess[];

export function findOwnedWranglerDevPids(
  processes: WorkerDevProcess[],
  checkoutRoot: string,
): number[];

export function parseReadyPort(text: string): number | null;

export function assertPortAvailable(options: {
  port: number;
  checkoutRoot: string;
  processes: WorkerDevProcess[];
}): void;

export function stopPreviousWorkerDev(options: {
  checkoutRoot: string;
  listProcesses: () => Promise<WorkerDevProcess[]>;
  signalProcess: (pid: number, signal: NodeJS.Signals) => void | Promise<void>;
  delay: (milliseconds: number) => Promise<unknown>;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<number[]>;

export function startWorkerDev(options: {
  expectedPort: number;
  spawnWorker: (options: { port: number }) =>
    | ManagedWorkerDevProcess
    | Promise<ManagedWorkerDevProcess>;
  signalProcess: (pid: number, signal: NodeJS.Signals) => void | Promise<void>;
}): Promise<ManagedWorkerDevProcess>;
