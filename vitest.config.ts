import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    exclude: ["tests/e2e/**", "node_modules/**"],
    environmentMatchGlobs: [["tests/ui/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
