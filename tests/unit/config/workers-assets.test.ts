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
    expect(wranglerConfig).not.toContain("assets_navigation_prefers_asset_serving");
    expect(wranglerConfig).not.toMatch(/^\[site\]$/m);
  });

  it("keeps the existing runtime date and D1 binding", () => {
    expect(wranglerConfig).toMatch(/^compatibility_date\s*=\s*"2026-10-18"$/m);
    expect(wranglerConfig).toContain('"nodejs_compat"');
    expect(wranglerConfig).toMatch(/^binding\s*=\s*"PARKING_DB"$/m);
  });

  it("declares isolated staging and production bindings and observability", () => {
    for (const environment of ["staging", "production"]) {
      expect(wranglerConfig).toMatch(new RegExp(`^\\[env\\.${environment}\\]$`, "m"));
      expect(wranglerConfig).toContain(`ENVIRONMENT = "${environment}"`);
      expect(wranglerConfig).toContain(`database_name = "paking-db-${environment}"`);
      const database = wranglerConfig.match(new RegExp(`\\[\\[env\\.${environment}\\.d1_databases\\]\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] ?? "";
      expect(database).toMatch(/database_id\s*=\s*"(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|__[A-Z0-9_]+__)"/i);
      expect(wranglerConfig).toContain(`[[env.${environment}.durable_objects.bindings]]`);
      expect(wranglerConfig).toContain(`[[env.${environment}.migrations]]`);
      expect(wranglerConfig).toContain(`[env.${environment}.secrets]`);
      expect(wranglerConfig).toContain(`[env.${environment}.observability]`);
    }
    expect(wranglerConfig).toMatch(/^upload_source_maps\s*=\s*true$/m);
  });

  it("builds the current frontend before starting or deploying Wrangler", () => {
    expect(packageConfig.scripts["worker:dev"]).toMatch(/^npm run build && /);
    expect(packageConfig.scripts).not.toHaveProperty("worker:deploy");
    expect(packageConfig.scripts["worker:deploy:staging"]).toContain("staging");
    expect(packageConfig.scripts["worker:deploy:production"]).toContain("production");
    expect(packageConfig.scripts["worker:dry-run"]).toContain("--dry-run");
    expect(packageConfig.scripts["worker:dry-run"]).toContain('--env=""');
  });

  it("proxies WebSocket upgrades and never caches private API responses in Workbox", () => {
    expect(viteConfig).toMatch(/["']\/api["']\s*:\s*\{[^}]*target:\s*["']http:\/\/127\.0\.0\.1:8787["'][^}]*ws:\s*true/s);
    expect(viteConfig).not.toContain("api-cache");
    expect(viteConfig).not.toMatch(/urlPattern:[\s\S]*pathname\.startsWith\(["']\/api\//);
    expect(frontendEntry).toMatch(/caches\.delete\(["']api-cache["']\)/);
  });
});
