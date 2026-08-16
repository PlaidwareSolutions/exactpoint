import { sql } from "drizzle-orm";
import type { Database } from "../client";

/**
 * Expires stale booking holds and frees their schedule reservations so the
 * time becomes bookable again. Run by the worker every minute.
 */
export async function expireSlotHolds(db: Database): Promise<number> {
  const result = await db.execute(sql`
    WITH expired AS (
      UPDATE slot_holds
      SET status = 'expired'
      WHERE status = 'active' AND expires_at < now()
      RETURNING id
    ),
    removed AS (
      DELETE FROM schedule_reservations
      WHERE slot_hold_id IN (SELECT id FROM expired)
      RETURNING id
    )
    SELECT (SELECT count(*) FROM expired) AS expired_count
  `);
  const row = result.rows[0] as { expired_count?: string | number } | undefined;
  return Number(row?.expired_count ?? 0);
}
