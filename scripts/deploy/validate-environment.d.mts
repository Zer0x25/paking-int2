export const REQUIRED_SECRET_NAMES: readonly string[];

export interface EnvironmentInspection {
  valid: boolean;
  errors: string[];
  workerName: string;
  databaseId: string;
  requiredSecrets: string[];
}

export function inspectEnvironment(source: string, target: string): EnvironmentInspection;
