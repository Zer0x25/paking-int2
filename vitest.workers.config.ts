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
  },
});
