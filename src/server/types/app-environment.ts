import type { UserRole } from "@core/types/schema";

export interface AppD1Statement {
  bind(...values: unknown[]): AppD1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}

export interface AppD1Database {
  prepare(query: string): AppD1Statement;
  batch(statements: AppD1Statement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface AppEnvironment {
  Bindings: {
    PARKING_DB?: AppD1Database;
    JWT_SECRET?: string;
    ENVIRONMENT?: string;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    OPERATOR_USERNAME?: string;
    OPERATOR_PASSWORD?: string;
  };
  Variables: {
    user: {
      userId: string;
      username: string;
      role: UserRole;
      facilityId?: string | null;
      exp: number;
    };
  };
}
