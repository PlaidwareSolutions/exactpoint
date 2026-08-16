import { PgBoss } from "pg-boss";
import { loadEnv } from "@exactpoint/config";
import { createDb, expireSlotHolds } from "@exactpoint/db";

/**
 * Background worker (spec §57): async jobs that must never block customer
 * booking. Queues grow with later phases (email, reminders, route recalc).
 */
const env = loadEnv();
const { db } = createDb();

const boss = new PgBoss({ connectionString: env.DATABASE_URL });
boss.on("error", (err) => console.error("[pg-boss]", err));

const EXPIRE_HOLDS_QUEUE = "expire-slot-holds";

await boss.start();
await boss.createQueue(EXPIRE_HOLDS_QUEUE);
await boss.schedule(EXPIRE_HOLDS_QUEUE, "* * * * *");
await boss.work(EXPIRE_HOLDS_QUEUE, async () => {
  const expired = await expireSlotHolds(db);
  if (expired > 0) {
    console.log(`[worker] expired ${expired} slot hold(s)`);
  }
});

console.log("[worker] started — queues: expire-slot-holds");
