import { PgBoss } from "pg-boss";
import { loadEnv } from "@exactpoint/config";
import {
  createDb,
  expireSlotHolds,
  markNotification,
  pendingNotifications,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import {
  ConsoleEmailProvider,
  renderEmail,
  ResendEmailProvider,
  type EmailProvider,
} from "@exactpoint/notifications";

/**
 * Background worker (spec §57): async jobs that must never block customer
 * booking — expired-hold reaping and outbound notifications.
 */
const env = loadEnv();
const { db } = createDb();

const resendKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const email: EmailProvider =
  resendKey && emailFrom
    ? new ResendEmailProvider(resendKey, emailFrom)
    : new ConsoleEmailProvider();
console.log(
  `[worker] email provider: ${resendKey && emailFrom ? "resend" : "console (set RESEND_API_KEY + EMAIL_FROM to send)"}`,
);

const boss = new PgBoss({ connectionString: env.DATABASE_URL });
boss.on("error", (err) => console.error("[pg-boss]", err));

const EXPIRE_HOLDS = "expire-slot-holds";
const SEND_NOTIFICATIONS = "send-notifications";

await boss.start();
await boss.createQueue(EXPIRE_HOLDS);
await boss.createQueue(SEND_NOTIFICATIONS);
await boss.schedule(EXPIRE_HOLDS, "* * * * *");
await boss.schedule(SEND_NOTIFICATIONS, "* * * * *");

await boss.work(EXPIRE_HOLDS, async () => {
  const expired = await expireSlotHolds(db);
  if (expired > 0) console.log(`[worker] expired ${expired} slot hold(s)`);
});

/** Fixture/test recipients must never leave the building. */
const BLOCKED_RECIPIENT_DOMAINS = ["example.com", "exactpoint.local", "invalid"];

function isBlockedRecipient(recipient: string): boolean {
  const domain = recipient.split("@")[1]?.toLowerCase() ?? "";
  return BLOCKED_RECIPIENT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

await boss.work(SEND_NOTIFICATIONS, async () => {
  const pending = await pendingNotifications(db);
  for (const notification of pending) {
    if (isBlockedRecipient(notification.recipient)) {
      await markNotification(db, notification.id, {
        ok: false,
        error: "blocked test recipient domain",
      });
      continue;
    }
    if (notification.channel !== "email") {
      await markNotification(db, notification.id, {
        ok: false,
        error: `channel ${notification.channel} not configured`,
      });
      continue;
    }
    const message = renderEmail(
      notification.template,
      notification.recipient,
      (notification.payload as Record<string, unknown>) ?? {},
      { displayName: BUSINESS.displayName, phone: BUSINESS.phone },
    );
    if (process.env.EMAIL_REPLY_TO) message.replyTo = process.env.EMAIL_REPLY_TO;
    const result = await email.send(message);
    await markNotification(db, notification.id, result);
  }
  if (pending.length > 0) {
    console.log(`[worker] processed ${pending.length} notification(s)`);
  }
});

console.log("[worker] started — queues: expire-slot-holds, send-notifications");
