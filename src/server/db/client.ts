import { drizzle } from "drizzle-orm/d1";
import type { AppD1Database, AppEnvironment } from "../types/app-environment";
import * as schema from "./schema";

export class MissingD1BindingError extends Error {
  constructor() {
    super("La conexión PARKING_DB no está disponible");
    this.name = "MissingD1BindingError";
  }
}

export function requireD1(bindings: AppEnvironment["Bindings"] | undefined): AppD1Database {
  if (!bindings?.PARKING_DB) throw new MissingD1BindingError();
  return bindings.PARKING_DB;
}

export function createDrizzleDatabase(bindings: AppEnvironment["Bindings"]) {
  const database = requireD1(bindings);
  return drizzle(database as Parameters<typeof drizzle>[0], { schema });
}
