import type { UserRole } from "@core/types/schema";
import type { AppEnvironment } from "../types/app-environment";
import { z } from "zod";

const CredentialConfigurationSchema = z.object({
  adminUsername: z.string().min(1),
  adminPassword: z.string().min(1),
  operatorUsername: z.string().min(1),
  operatorPassword: z.string().min(1),
  jwtSecret: z.string().min(1),
});

export interface LocalCredentialConfiguration {
  adminUsername: string;
  adminPassword: string;
  operatorUsername: string;
  operatorPassword: string;
  jwtSecret: string;
}

export interface ConfiguredLocalIdentity {
  username: string;
  fullName: string;
  role: UserRole;
}

export class LocalCredentialConfigurationError extends Error {
  constructor(key: string) {
    super(`Falta configurar ${key} en .dev.vars`);
    this.name = "LocalCredentialConfigurationError";
  }
}

function required(bindings: AppEnvironment["Bindings"], key: keyof AppEnvironment["Bindings"]): string {
  const value = bindings[key];
  if (typeof value !== "string" || value.length === 0) throw new LocalCredentialConfigurationError(key);
  return value;
}

export function readLocalCredentialConfiguration(bindings: AppEnvironment["Bindings"]): LocalCredentialConfiguration {
  const candidate = {
    adminUsername: required(bindings, "ADMIN_USERNAME"),
    adminPassword: required(bindings, "ADMIN_PASSWORD"),
    operatorUsername: required(bindings, "OPERATOR_USERNAME"),
    operatorPassword: required(bindings, "OPERATOR_PASSWORD"),
    jwtSecret: required(bindings, "JWT_SECRET"),
  };
  const configuration = CredentialConfigurationSchema.parse(candidate);
  if (configuration.adminUsername.toLocaleLowerCase() === configuration.operatorUsername.toLocaleLowerCase()) {
    throw new Error("ADMIN_USERNAME y OPERATOR_USERNAME deben ser distintos");
  }
  return configuration;
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function authenticateLocalCredential(
  configuration: LocalCredentialConfiguration,
  username: string,
  password: string,
): ConfiguredLocalIdentity | null {
  const adminUsernameMatches = constantTimeEquals(username.toLocaleLowerCase(), configuration.adminUsername.toLocaleLowerCase());
  const operatorUsernameMatches = constantTimeEquals(username.toLocaleLowerCase(), configuration.operatorUsername.toLocaleLowerCase());
  const adminPasswordMatches = constantTimeEquals(password, configuration.adminPassword);
  const operatorPasswordMatches = constantTimeEquals(password, configuration.operatorPassword);
  if (adminUsernameMatches && adminPasswordMatches) {
    return { username: configuration.adminUsername, fullName: "Administrador del Sistema", role: "admin" };
  }
  if (operatorUsernameMatches && operatorPasswordMatches) {
    return { username: configuration.operatorUsername, fullName: "Operador de Garita Principal", role: "operator" };
  }
  return null;
}
