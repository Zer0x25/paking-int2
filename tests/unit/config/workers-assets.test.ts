import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const wranglerConfig = readFileSync(path.join(root, "wrangler.toml"), "utf8");
const packageConfig = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("Workers Static Assets configuration contract", () => {
  it("serves the built SPA through Assets instead of Workers Sites", () => {
    expect(wranglerConfig).toMatch(/^\[assets\]$/m);
    expect(wranglerConfig).toMatch(/^directory\s*=\s*"\.\/dist"$/m);
    expect(wranglerConfig).toMatch(
      /^not_found_handling\s*=\s*"single-page-application"$/m,
    );
    expect(wranglerConfig).toContain('"assets_navigation_prefers_asset_serving"');
    expect(wranglerConfig).not.toMatch(/^\[site\]$/m);
  });

  it("keeps the existing runtime date and D1 binding", () => {
    expect(wranglerConfig).toMatch(/^compatibility_date\s*=\s*"2024-10-15"$/m);
    expect(wranglerConfig).toContain('"nodejs_compat"');
    expect(wranglerConfig).toMatch(/^binding\s*=\s*"PARKING_DB"$/m);
  });

  it("builds the current frontend before starting or deploying Wrangler", () => {
    expect(packageConfig.scripts["worker:dev"]).toMatch(/^npm run build && /);
    expect(packageConfig.scripts["worker:deploy"]).toMatch(/^npm run build && /);
    expect(packageConfig.scripts["worker:deploy"]).toContain(
      "wrangler deploy src/server/index.ts",
    );
  });
});
