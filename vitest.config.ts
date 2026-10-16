import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "src/server/db/schema.ts",
        "src/client/components/**",
        "src/client/App.tsx",
        "src/client/main.tsx",
        ".specify/",
        "specs/",
        "history/",
        "feedback/",
        "vitest.config.ts",
        "vite.config.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/core"),
      "@server": path.resolve(__dirname, "./src/server"),
      "@client": path.resolve(__dirname, "./src/client"),
    },
  },
});
