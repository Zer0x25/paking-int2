import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const persistArguments = process.argv.slice(2);

if (persistArguments.length !== 0 && (persistArguments.length !== 2 || persistArguments[0] !== "--persist-to")) {
  console.error("Uso: npm run db:local:init -- [--persist-to <directorio-local>]");
  process.exit(2);
}

function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["d1", "migrations", "apply", "paking-db", "--local", ...persistArguments]);
const seed = spawnSync(
  process.execPath,
  [path.join(projectRoot, "scripts", "db", "seed-local-catalog.mjs"), ...persistArguments],
  { cwd: projectRoot, stdio: "inherit" },
);
if (seed.error) throw seed.error;
process.exit(seed.status ?? 1);
