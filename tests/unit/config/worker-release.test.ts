import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runRelease } from "../../../scripts/deploy/release.mjs";

const originalConfig = readFileSync("wrangler.toml", "utf8")
  .replace(/(\[\[env\.staging\.d1_databases\]\][\s\S]*?database_id\s*=\s*)"[^"]*"/, '$1"__STAGING_D1_DATABASE_ID__"')
  .replace(/(\[\[env\.production\.d1_databases\]\][\s\S]*?database_id\s*=\s*)"[^"]*"/, '$1"__PRODUCTION_D1_DATABASE_ID__"');
const stagingId = "11111111-1111-4111-8111-111111111111";
const completeConfig = originalConfig.replace("__STAGING_D1_DATABASE_ID__", stagingId);
const requiredSecrets = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "OPERATOR_USERNAME",
  "OPERATOR_PASSWORD",
  "JWT_SECRET",
];

describe("target-specific Worker release flow", () => {
  it("validates local target configuration before build or any Wrangler command", async () => {
    const runCommand = vi.fn();
    const build = vi.fn();

    await expect(runRelease({ target: "staging", configText: originalConfig, runCommand, build }))
      .rejects.toThrow(/D1|database/i);

    expect(build).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("builds, reads required secret names, then deploys only the selected environment", async () => {
    const steps: string[] = [];
    const runCommand = vi.fn(async (command: string, args: string[]) => {
      steps.push(`${command} ${args.join(" ")}`);
      if (args.includes("secret")) {
        return { code: 0, stdout: JSON.stringify(requiredSecrets.map((name) => ({ name }))), stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    const build = vi.fn(async () => { steps.push("build"); });
    const output: string[] = [];

    await runRelease({ target: "staging", configText: completeConfig, runCommand, build, output: (line: string) => output.push(line) });

    expect(build).toHaveBeenCalledOnce();
    expect(runCommand.mock.calls.map(([command, args]) => [command, ...args])).toEqual([
      ["wrangler", "secret", "list", "--env", "staging", "--format", "json"],
      ["wrangler", "deploy", "--env", "staging"],
    ]);
    expect(steps[0]).toBe("build");
    expect(steps[1]).toContain("secret list");
    expect(steps[2]).toContain("deploy --env staging");
    expect(output.join(" ")).not.toMatch(/secret-value|password-value|jwt-value/i);
  });

  it("stops without deploying when any required remote secret name is missing", async () => {
    const runCommand = vi.fn(async () => ({
      code: 0,
      stdout: JSON.stringify(requiredSecrets.filter((name) => name !== "JWT_SECRET").map((name) => ({ name }))),
      stderr: "",
    }));
    const output: string[] = [];

    await expect(runRelease({
      target: "staging",
      configText: completeConfig,
      runCommand,
      build: vi.fn(async () => undefined),
      output: (line: string) => output.push(line),
    })).rejects.toThrow(/JWT_SECRET/);

    expect(runCommand).toHaveBeenCalledOnce();
    expect(output.join(" ")).not.toMatch(/secret-value|password-value|jwt-value/i);
  });
});
