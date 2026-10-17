import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const seedFile = path.join(projectRoot, "src", "server", "db", "seed.local.sql");
const persistArguments = process.argv.slice(2);

if (persistArguments.length !== 0 && (persistArguments.length !== 2 || persistArguments[0] !== "--persist-to")) {
  console.error("Uso: node scripts/db/seed-local-catalog.mjs [--persist-to <directorio-local>]");
  process.exit(2);
}

const args = ["d1", "execute", "paking-db", "--local", "--file", seedFile, ...persistArguments];
const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: projectRoot, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
