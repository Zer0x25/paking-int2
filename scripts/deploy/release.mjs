import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectEnvironment } from "./validate-environment.mjs";

function runProcess(command, args, { cwd = process.cwd(), capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
      child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function secretNamesFromJson(stdout) {
  const parsed = JSON.parse(stdout);
  const entries = Array.isArray(parsed) ? parsed : parsed?.secrets;
  if (!Array.isArray(entries)) throw new Error("La respuesta de Wrangler no contiene una lista de nombres de secretos");
  return entries.flatMap((entry) => typeof entry?.name === "string" ? [entry.name] : []);
}

export async function runRelease({
  target,
  configText,
  cwd = process.cwd(),
  runCommand = runProcess,
  build,
  output = (line) => console.log(line),
} = {}) {
  const source = configText ?? readFileSync(path.join(cwd, "wrangler.toml"), "utf8");
  const config = inspectEnvironment(source, target);
  if (!config.valid) throw new Error(config.errors.join("\n"));

  const buildResult = await (build ?? (() => runCommand("npm", ["run", "build"], { cwd })))();
  if (buildResult && buildResult.code !== undefined && buildResult.code !== 0) {
    throw new Error(`Build failed for ${target}; Wrangler was not invoked.`);
  }

  let secretResult;
  try {
    secretResult = await runCommand("wrangler", ["secret", "list", "--env", target, "--format", "json"], { cwd, capture: true });
  } catch {
    throw new Error(`Could not list required secret names for ${target}; deployment was not attempted.`);
  }
  if (secretResult.code !== 0) {
    throw new Error(`Could not list required secret names for ${target}; deployment was not attempted.`);
  }

  let presentSecretNames;
  try {
    presentSecretNames = new Set(secretNamesFromJson(secretResult.stdout));
  } catch {
    throw new Error(`Could not read secret names for ${target}; deployment was not attempted.`);
  }
  const missingSecretNames = config.requiredSecrets.filter((name) => !presentSecretNames.has(name));
  if (missingSecretNames.length > 0) {
    throw new Error(`Missing required secret names for ${target}: ${missingSecretNames.join(", ")}. Deployment was not attempted.`);
  }

  const deployResult = await runCommand("wrangler", ["deploy", "--env", target], { cwd });
  if (deployResult && deployResult.code !== undefined && deployResult.code !== 0) {
    throw new Error(`Wrangler deployment failed for ${target}.`);
  }
  output(`Deployment command completed for ${target} (${config.workerName}).`);
}

function isMainModule() {
  const scriptPath = process.argv[1];
  return scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href;
}

if (isMainModule()) {
  const target = process.argv[2] ?? "";
  runRelease({ target }).catch((error) => {
    console.error(`Release failed for ${target || "(missing target)"}: ${error instanceof Error ? error.message : "Unexpected release error"}`);
    process.exitCode = 1;
  });
}
