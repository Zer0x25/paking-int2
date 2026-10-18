import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const wranglerConfig = readFileSync(path.join(root, "wrangler.toml"), "utf8");
const viteConfig = readFileSync(path.join(root, "vite.config.ts"), "utf8");
const frontendEntry = readFileSync(path.join(root, "src/client/main.tsx"), "utf8");
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

  it("proxies WebSocket upgrades and never caches private API responses in Workbox", () => {
    expect(viteConfig).toMatch(/["']\/api["']\s*:\s*\{[^}]*target:\s*["']http:\/\/127\.0\.0\.1:8787["'][^}]*ws:\s*true/s);
    expect(viteConfig).not.toContain("api-cache");
    expect(viteConfig).not.toMatch(/urlPattern:[\s\S]*pathname\.startsWith\(["']\/api\//);
    expect(frontendEntry).toMatch(/caches\.delete\(["']api-cache["']\)/);
  });
});
