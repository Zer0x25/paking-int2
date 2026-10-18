import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectEnvironment } from "../../../scripts/deploy/validate-environment.mjs";

const configPath = path.join(process.cwd(), "wrangler.toml");
const originalConfig = readFileSync(configPath, "utf8")
  .replace(/(\[\[env\.staging\.d1_databases\]\][\s\S]*?database_id\s*=\s*)"[^"]*"/, '$1"__STAGING_D1_DATABASE_ID__"')
  .replace(/(\[\[env\.production\.d1_databases\]\][\s\S]*?database_id\s*=\s*)"[^"]*"/, '$1"__PRODUCTION_D1_DATABASE_ID__"');
const expectedSecretNames = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "OPERATOR_USERNAME",
  "OPERATOR_PASSWORD",
  "JWT_SECRET",
];

describe("Cloudflare named environment preflight", () => {
  it.each(["staging", "production"] as const)("rejects a missing or placeholder %s target before network access", (target) => {
    const result = inspectEnvironment(originalConfig, target);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/D1|database/i);
    expect(result.workerName).toBeTruthy();
  });

  it.each(["staging", "production"] as const)("accepts a complete %s environment with a real isolated D1 identifier", (target) => {
    const id = target === "staging"
      ? "11111111-1111-4111-8111-111111111111"
      : "22222222-2222-4222-8222-222222222222";
    const config = originalConfig.replace(`__${target.toUpperCase()}_D1_DATABASE_ID__`, id);
    const result = inspectEnvironment(config, target);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.workerName).toContain(target);
    expect(result.databaseId).toBe(id);
    expect(result.requiredSecrets).toEqual(expectedSecretNames);
  });

  it("rejects unknown targets, malformed IDs, and reuse of local or another environment's D1", () => {
    expect(inspectEnvironment(originalConfig, "development").valid).toBe(false);

    const malformed = originalConfig.replace("__STAGING_D1_DATABASE_ID__", "local-d1-paking-db");
    expect(inspectEnvironment(malformed, "staging").errors.join(" ")).toMatch(/D1|database/i);

    const duplicate = originalConfig
      .replace("__STAGING_D1_DATABASE_ID__", "11111111-1111-4111-8111-111111111111")
      .replace("__PRODUCTION_D1_DATABASE_ID__", "11111111-1111-4111-8111-111111111111");
    expect(inspectEnvironment(duplicate, "production").errors.join(" ")).toMatch(/distinct|unique|reuse/i);
  });

  it("rejects missing environment bindings, mismatched ENVIRONMENT, hostname, secrets, and DO migration", () => {
    const complete = originalConfig
      .replace("__STAGING_D1_DATABASE_ID__", "11111111-1111-4111-8111-111111111111")
      .replace("__PRODUCTION_D1_DATABASE_ID__", "22222222-2222-4222-8222-222222222222");
    const missingEnvironment = complete.replace("[env.production.vars]\nENVIRONMENT = \"production\"", "[env.production.vars]");
    const missingHostname = complete.replace("[env.production]\nname = \"paking-int2-worker-production\"\nworkers_dev = true", "[env.production]\nname = \"paking-int2-worker-production\"\nworkers_dev = false");
    const missingSecrets = complete.replaceAll('"JWT_SECRET"', '"REMOVED_JWT_SECRET"');
    const missingObject = complete.replace(/(\[\[env\.production\.migrations\]\][\s\S]*?new_sqlite_classes = )\["FacilityEventHub"\]/, "$1[]");
    const mismatch = complete.replace("ENVIRONMENT = \"production\"", "ENVIRONMENT = \"staging\"");

    expect(inspectEnvironment(missingEnvironment, "production").errors.join(" ")).toMatch(/ENVIRONMENT/i);
    expect(inspectEnvironment(missingHostname, "production").errors.join(" ")).toMatch(/hostname|workers.dev/i);
    expect(inspectEnvironment(missingSecrets, "production").errors.join(" ")).toMatch(/JWT_SECRET/i);
    expect(inspectEnvironment(missingObject, "production").errors.join(" ")).toMatch(/Durable Object|migration/i);
    expect(inspectEnvironment(mismatch, "production").errors.join(" ")).toMatch(/ENVIRONMENT/i);
  });
});
