import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Test files share one scratch database and each resets it — run serially.
    fileParallelism: false,
  },
});
