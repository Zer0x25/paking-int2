import type { Context } from "hono";
import type { AppEnvironment } from "../types/app-environment";
import { PersistenceConflictError } from "../db/repositories/write-transaction";
import { logServerError } from "../middleware/request-logging";

export const GENERIC_SERVER_ERROR = "Error interno del servidor";

export function mutationFailure(error: unknown, _fallback: string, c?: Context<AppEnvironment>): {
  status: 409 | 500;
  error: string;
} {
  if (error instanceof PersistenceConflictError) {
    return { status: 409, error: error.message };
  }
  if (error instanceof Error && /constraint failed|UNIQUE constraint|FOREIGN KEY constraint|CHECK constraint/i.test(error.message)) {
    return { status: 409, error: "El cambio entra en conflicto con datos o reglas vigentes" };
  }
  if (c) logServerError(c, error);
  return { status: 500, error: GENERIC_SERVER_ERROR };
}

export function readFailure(error: unknown, _fallback: string, c?: Context<AppEnvironment>): { status: 500; error: string } {
  if (c) logServerError(c, error);
  return { status: 500, error: GENERIC_SERVER_ERROR };
}
