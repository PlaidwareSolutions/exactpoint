import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnv } from "@exactpoint/config";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(connectionString?: string) {
  const url = connectionString ?? loadEnv().DATABASE_URL;
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return { db, pool };
}

let shared: ReturnType<typeof createDb> | undefined;

/** Process-wide shared connection pool (web app, worker). */
export function getDb(): Database {
  shared ??= createDb();
  return shared.db;
}
