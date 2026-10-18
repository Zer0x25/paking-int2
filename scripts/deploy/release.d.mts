export interface ReleaseCommandResult {
  code?: number;
  stdout?: string;
  stderr?: string;
}

export interface ReleaseOptions {
  target?: string;
  configText?: string;
  cwd?: string;
  runCommand?: (command: string, args: string[], options?: { cwd?: string; capture?: boolean }) => Promise<ReleaseCommandResult>;
  build?: () => Promise<void | ReleaseCommandResult>;
  output?: (line: string) => void;
}

export function runRelease(options?: ReleaseOptions): Promise<void>;
