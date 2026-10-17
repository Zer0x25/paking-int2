import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/core"),
    },
  },
  test: {
    include: ["tests/workers/**/*.worker.test.ts"],
    coverage: {
      provider: "istanbul",
      include: [
        "src/server/db/client.ts",
        "src/server/db/schema.ts",
        "src/server/db/repositories/**/*.ts",
        "src/server/middleware/**/*.ts",
        "src/server/routes/**/*.ts",
        "src/server/services/**/*.ts",
      ],
      exclude: ["tests/workers/support/**"],
      reportsDirectory: "./coverage/workers",
      reporter: ["text", "json"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
