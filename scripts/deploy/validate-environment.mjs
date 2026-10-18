import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_SECRET_NAMES = Object.freeze([
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "OPERATOR_USERNAME",
  "OPERATOR_PASSWORD",
  "JWT_SECRET",
]);

const REMOTE_TARGETS = ["staging", "production"];
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function getHeader(line) {
  const match = line.match(/^\s*(\[\[|\[)([^\]]+)(\]\]|\])\s*$/);
  if (!match) return null;
  return { name: match[2].trim(), isArray: match[1] === "[[" && match[3] === "]]" };
}

function tableBlocks(source, name, isArray = false) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = getHeader(lines[index]);
    if (!header || header.name !== name || header.isArray !== isArray) continue;
    const body = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (getHeader(lines[next])) break;
      body.push(lines[next]);
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

function tableBlock(source, name, isArray = false) {
  return tableBlocks(source, name, isArray)[0] ?? "";
}

function rootBlock(source) {
  const firstHeader = source.search(/^\s*\[\[/m);
  const firstTable = source.search(/^\s*\[/m);
  const end = [firstHeader, firstTable].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return end === undefined ? source : source.slice(0, end);
}

function valueFrom(block, key) {
  const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`^\\s*${keyPattern}\\s*=\\s*(.*?)\\s*$`, "m"))?.[1] ?? "";
}

function stringFrom(block, key) {
  return valueFrom(block, key).match(/^"([^"]*)"$/)?.[1] ?? "";
}

function booleanFrom(block, key) {
  return valueFrom(block, key) === "true";
}

function numberFrom(block, key) {
  const value = Number(valueFrom(block, key));
  return Number.isFinite(value) ? value : null;
}

function arrayFrom(block, key) {
  const value = valueFrom(block, key);
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function fail(errors, message) {
  if (!errors.includes(message)) errors.push(message);
}

function checkObservability(source, target, errors) {
  const base = `env.${target}.observability`;
  const observability = tableBlock(source, base);
  const logs = tableBlock(source, `${base}.logs`);
  const traces = tableBlock(source, `${base}.traces`);
  if (!booleanFrom(observability, "enabled")) fail(errors, `${target}: Workers observability must be enabled`);
  if (!booleanFrom(logs, "enabled")) fail(errors, `${target}: Workers Logs must be enabled`);
  if (!booleanFrom(traces, "enabled")) fail(errors, `${target}: Workers Traces must be enabled`);

  for (const [label, block] of [["Logs", logs], ["Traces", traces]]) {
    const sampleRate = numberFrom(block, "head_sampling_rate");
    if (sampleRate === null || sampleRate < 0 || sampleRate > 1) {
      fail(errors, `${target}: ${label} head_sampling_rate must be between 0 and 1`);
    }
  }
}

export function inspectEnvironment(source, target) {
  const errors = [];
  if (!REMOTE_TARGETS.includes(target)) {
    return { valid: false, errors: [`Unknown deployment target: ${target}`], workerName: "", databaseId: "", requiredSecrets: [] };
  }

  const root = rootBlock(source);
  const environment = tableBlock(source, `env.${target}`);
  if (!environment) {
    return { valid: false, errors: [`Missing [env.${target}] configuration`], workerName: "", databaseId: "", requiredSecrets: [] };
  }

  const workerName = stringFrom(environment, "name");
  if (!workerName || !workerName.endsWith(`-${target}`)) fail(errors, `${target}: Worker name must end in -${target}`);

  const vars = tableBlock(source, `env.${target}.vars`);
  if (stringFrom(vars, "ENVIRONMENT") !== target) fail(errors, `${target}: ENVIRONMENT must equal ${target}`);

  const d1Blocks = tableBlocks(source, `env.${target}.d1_databases`, true);
  if (d1Blocks.length !== 1) fail(errors, `${target}: exactly one PARKING_DB D1 binding is required`);
  const d1 = d1Blocks[0] ?? "";
  if (stringFrom(d1, "binding") !== "PARKING_DB") fail(errors, `${target}: D1 binding must be PARKING_DB`);
  if (stringFrom(d1, "database_name") !== `paking-db-${target}`) fail(errors, `${target}: D1 database must be named paking-db-${target}`);
  const databaseId = stringFrom(d1, "database_id");
  if (!UUID_PATTERN.test(databaseId)) fail(errors, `${target}: D1 database_id must be a real Cloudflare UUID, not a placeholder`);
  const localD1 = tableBlocks(source, "d1_databases", true).map((block) => stringFrom(block, "database_id"));
  if (databaseId && localD1.includes(databaseId)) fail(errors, `${target}: remote D1 must not reuse the local database ID`);
  if (stringFrom(d1, "migrations_dir") !== "src/server/db/migrations") fail(errors, `${target}: D1 migrations_dir must be src/server/db/migrations`);

  for (const otherTarget of REMOTE_TARGETS.filter((candidate) => candidate !== target)) {
    const otherEnvironment = tableBlock(source, `env.${otherTarget}`);
    const otherWorker = stringFrom(otherEnvironment, "name");
    if (workerName && workerName === otherWorker) fail(errors, "Staging and production Worker names must be distinct");
    const otherD1 = tableBlocks(source, `env.${otherTarget}.d1_databases`, true)[0] ?? "";
    const otherId = stringFrom(otherD1, "database_id");
    if (UUID_PATTERN.test(databaseId) && databaseId === otherId) fail(errors, "Staging and production D1 IDs must be distinct; do not reuse a database");
  }

  const workersDev = valueFrom(environment, "workers_dev");
  if (workersDev !== "true") {
    const routeBlocks = tableBlocks(source, `env.${target}.routes`, true);
    const hasConfiguredHostname = routeBlocks.some((route) => {
      const pattern = stringFrom(route, "pattern");
      return pattern.includes(".") && !/[<>]|__|placeholder/i.test(pattern);
    });
    if (!hasConfiguredHostname) fail(errors, `${target}: enable workers.dev or configure a non-placeholder hostname route`);
  }

  const asset = tableBlock(source, `env.${target}.assets`);
  if (stringFrom(asset, "directory") !== "./dist" || stringFrom(asset, "not_found_handling") !== "single-page-application") {
    fail(errors, `${target}: Workers Static Assets must serve ./dist with SPA fallback`);
  }

  const durableObject = tableBlocks(source, `env.${target}.durable_objects.bindings`, true);
  if (durableObject.length !== 1 || stringFrom(durableObject[0] ?? "", "name") !== "FACILITY_EVENTS" || stringFrom(durableObject[0] ?? "", "class_name") !== "FacilityEventHub") {
    fail(errors, `${target}: FACILITY_EVENTS must bind the FacilityEventHub Durable Object`);
  }
  const migrations = tableBlocks(source, `env.${target}.migrations`, true);
  if (!migrations.some((migration) => arrayFrom(migration, "new_sqlite_classes").includes("FacilityEventHub"))) {
    fail(errors, `${target}: Durable Object migration must create FacilityEventHub`);
  }

  const requiredSecrets = arrayFrom(tableBlock(source, `env.${target}.secrets`), "required");
  for (const secretName of REQUIRED_SECRET_NAMES) {
    if (!requiredSecrets.includes(secretName)) fail(errors, `${target}: required secret name ${secretName} is missing`);
  }

  const compatibilityDate = stringFrom(environment, "compatibility_date") || stringFrom(root, "compatibility_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate)) fail(errors, `${target}: compatibility_date must be an ISO calendar date`);
  const compatibilityFlags = arrayFrom(environment, "compatibility_flags").length
    ? arrayFrom(environment, "compatibility_flags")
    : arrayFrom(root, "compatibility_flags");
  if (!compatibilityFlags.includes("nodejs_compat")) fail(errors, `${target}: nodejs_compat compatibility flag is required`);
  const sourceMaps = valueFrom(environment, "upload_source_maps") || valueFrom(root, "upload_source_maps");
  if (sourceMaps !== "true") fail(errors, `${target}: Worker source map upload must be enabled`);

  checkObservability(source, target, errors);
  return { valid: errors.length === 0, errors, workerName, databaseId, requiredSecrets };
}

function isMainModule() {
  const scriptPath = process.argv[1];
  return scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href;
}

if (isMainModule()) {
  const target = process.argv[2] ?? "";
  const configPath = path.resolve(process.cwd(), "wrangler.toml");
  const configText = readFileSync(configPath, "utf8");
  const result = inspectEnvironment(configText, target);
  if (!result.valid) {
    console.error(`Local preflight failed for ${target || "(missing target)"}:\n- ${result.errors.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Local preflight passed for ${target} (${result.workerName}). Required remote secret names: ${result.requiredSecrets.join(", ")}. No Cloudflare API request was made.`);
  }
}
