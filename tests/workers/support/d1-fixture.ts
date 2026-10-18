import { env } from "cloudflare:test";
import { exports as workerExports } from "cloudflare:workers";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1TestDatabase {
  prepare(query: string): D1Statement;
  exec(query: string): Promise<unknown>;
}

interface WorkerTestBindings {
  PARKING_DB?: D1TestDatabase;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  OPERATOR_USERNAME?: string;
  OPERATOR_PASSWORD?: string;
  JWT_SECRET?: string;
}

const testBindings = env as unknown as WorkerTestBindings;

// Vite bundles migration SQL as raw text so the test fixture applies the same
// migration files configured for the Worker without reproducing their schema.
const migrations = import.meta.glob("../../../src/server/db/migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;
const localCatalogSeed = import.meta.glob("../../../src/server/db/seed.local.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export function getD1Database(): D1TestDatabase {
  if (!testBindings.PARKING_DB) throw new Error("Worker test binding PARKING_DB is unavailable");
  return testBindings.PARKING_DB;
}

export function getMigrationFileCount(): number {
  return Object.keys(migrations).length;
}

function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let statementStart = 0;
  let quote: "single" | "double" | "backtick" | "bracket" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n" || character === "\r") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote === "single" || quote === "double" || quote === "backtick") {
      const closingCharacter = quote === "single" ? "'" : quote === "double" ? '"' : "`";
      if (character === closingCharacter && nextCharacter === closingCharacter) {
        index += 1;
      } else if (character === closingCharacter) {
        quote = null;
      }
      continue;
    }
    if (quote === "bracket") {
      if (character === "]" && nextCharacter === "]") {
        index += 1;
      } else if (character === "]") {
        quote = null;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'") quote = "single";
    else if (character === '"') quote = "double";
    else if (character === "`") quote = "backtick";
    else if (character === "[") quote = "bracket";
    else if (character === ";") {
      const current = source.slice(statementStart, index).trim();
      if (current) statements.push(current);
      statementStart = index + 1;
    }
  }

  const trailingStatement = source.slice(statementStart).trim();
  if (trailingStatement) statements.push(trailingStatement);
  return statements;
}

export async function applyD1Migrations(
  database = getD1Database(),
  throughMigration?: string,
): Promise<void> {
  await database.exec("CREATE TABLE IF NOT EXISTS __vitest_d1_migrations (name TEXT PRIMARY KEY)");

  const orderedMigrations = Object.entries(migrations).sort(([left], [right]) => left.localeCompare(right));
  let migrationFound = throughMigration === undefined;
  for (const [path, sql] of orderedMigrations) {
    const applied = await database.prepare(
      "SELECT name FROM __vitest_d1_migrations WHERE name = ?",
    ).bind(path).first();
    if (applied) {
      if (throughMigration && path.endsWith(throughMigration)) {
        migrationFound = true;
        break;
      }
      continue;
    }

    for (const statement of splitSqlStatements(sql)) {
      await database.prepare(statement).run();
    }
    await database.prepare("INSERT INTO __vitest_d1_migrations (name) VALUES (?)").bind(path).run();
    if (throughMigration && path.endsWith(throughMigration)) {
      migrationFound = true;
      break;
    }
  }
  if (!migrationFound) throw new Error(`Migration ${throughMigration} was not found in the Worker migration directory`);
}

export async function applyLocalCatalogSeed(database = getD1Database()): Promise<void> {
  const seedSql = Object.values(localCatalogSeed)[0];
  if (!seedSql) throw new Error("The local catalog seed SQL file was not bundled into the test fixture");
  for (const statement of splitSqlStatements(seedSql)) {
    await database.prepare(statement).run();
  }
}

export async function readRows<T extends Record<string, unknown>>(
  database: D1TestDatabase,
  query: string,
  ...values: unknown[]
): Promise<T[]> {
  const result = await database.prepare(query).bind(...values).all<T>();
  return result.results;
}

export async function countRows(
  database: D1TestDatabase,
  query: string,
  ...values: unknown[]
): Promise<number> {
  const row = await database.prepare(query).bind(...values).first<{ count: number }>();
  return row?.count ?? 0;
}

export type LocalRole = "admin" | "operator";

export async function loginAs(role: LocalRole): Promise<string> {
  const username = role === "admin" ? testBindings.ADMIN_USERNAME : testBindings.OPERATOR_USERNAME;
  const password = role === "admin" ? testBindings.ADMIN_PASSWORD : testBindings.OPERATOR_PASSWORD;
  const response = await workerFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json() as { token?: string };
  if (response.status !== 200 || !payload.token) {
    throw new Error(`Configured ${role} test login failed with HTTP ${response.status}`);
  }
  return payload.token;
}

export async function workerFetch(path: string, init?: RequestInit): Promise<Response> {
  return await testWorker.fetch(`http://localhost${path}`, init);
}

const testWorker = (workerExports as unknown as {
  default: { fetch: (request: string, init?: RequestInit) => Promise<Response> };
}).default;
