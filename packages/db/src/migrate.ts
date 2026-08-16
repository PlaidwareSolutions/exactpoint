import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Applies pending SQL migrations to the given database (defaults to DATABASE_URL). */
export async function runMigrations(connectionString?: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const isCliInvocation = process.argv[1] === fileURLToPath(import.meta.url);
if (isCliInvocation) {
  runMigrations()
    .then(() => {
      console.log("Migrations applied.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
