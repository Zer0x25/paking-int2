import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/client/utils/**/*.ts",
        "src/client/App.tsx",
        "src/client/components/LoginView.tsx",
        "src/core/rules/**/*.ts",
        "src/core/types/schema.ts",
        "src/server/middleware/auth.ts",
        "src/server/services/allocation-service.ts",
      ],
      reportsDirectory: "./coverage/unit",
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
        ".wrangler/",
        "tests/",
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
