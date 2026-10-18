import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/agentic-factory-dod.yml", "utf8");

describe("Cloudflare release quality gates in GitHub Actions", () => {
  it("uses the locked npm dependency graph and required repository gates", () => {
    expect(workflow).toContain("npm ci");
    for (const command of [
      "npm run test:coverage",
      "npm run typecheck",
      "npm run lint",
      "npm audit",
      "npm run build",
      "npm run worker:dry-run",
    ]) {
      expect(workflow).toContain(command);
    }
  });

  it("does not deploy or require Cloudflare credentials in CI", () => {
    expect(workflow).not.toMatch(/wrangler deploy --env|worker:deploy:|wrangler-action|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/i);
  });
});
