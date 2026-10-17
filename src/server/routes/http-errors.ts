import { MissingD1BindingError } from "../db/client";
import { PersistenceConflictError } from "../db/repositories/write-transaction";

export function mutationFailure(error: unknown, fallback: string): {
  status: 409 | 500;
  error: string;
} {
  if (error instanceof PersistenceConflictError) return { status: 409, error: error.message };
  if (error instanceof MissingD1BindingError) return { status: 500, error: error.message };
  if (error instanceof Error && /constraint failed|UNIQUE constraint|FOREIGN KEY constraint|CHECK constraint/i.test(error.message)) {
    return { status: 409, error: "El cambio entra en conflicto con datos o reglas vigentes" };
  }
  return { status: 500, error: fallback };
}

export function readFailure(error: unknown, fallback: string): { status: 500; error: string } {
  return {
    status: 500,
    error: error instanceof Error ? error.message : fallback,
  };
}
