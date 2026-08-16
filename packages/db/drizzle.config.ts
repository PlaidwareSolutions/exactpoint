import { defineConfig } from "drizzle-kit";
import { loadEnv } from "@exactpoint/config";

const env = loadEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
