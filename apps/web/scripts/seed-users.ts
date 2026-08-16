import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { loadEnv } from "@exactpoint/config";
import * as schema from "@exactpoint/db";
import {
  createDb,
  skills,
  technicianAvailability,
  technicianProfiles,
  technicianSkills,
  users,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";

/**
 * Seeds the owner account (and, in development, a limited-skill test
 * technician). Idempotent. Uses a signup-enabled Better Auth instance so the
 * password hash format matches the app exactly; the app itself keeps public
 * signup disabled.
 */
const env = loadEnv();
const { db, pool } = createDb();

const seedAuth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true },
});

async function ensureUser(opts: {
  email: string;
  name: string;
  role: "owner" | "technician";
  password?: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await db.select().from(users).where(eq(users.email, opts.email));
  const found = existing[0];
  if (found) return { id: found.id, created: false };

  const password = opts.password ?? randomBytes(12).toString("base64url");
  await seedAuth.api.signUpEmail({
    body: { email: opts.email, name: opts.name, password },
  });
  await db
    .update(users)
    .set({ role: opts.role, emailVerified: true })
    .where(eq(users.email, opts.email));
  const [created] = await db.select().from(users).where(eq(users.email, opts.email));
  if (!created) throw new Error(`User not found after creation: ${opts.email}`);
  if (!opts.password) {
    console.log(`Created ${opts.role} ${opts.email} with generated password: ${password}`);
    console.log("Store it securely and change it after first login.");
  } else {
    console.log(`Created ${opts.role} ${opts.email} (password from SEED_OWNER_PASSWORD).`);
  }
  return { id: created.id, created: true };
}

async function ensureTechnicianProfile(opts: {
  userId: string;
  firstName: string;
  lastName: string;
  color: string;
  skillSlugs: string[] | "all";
  days: number[];
  startTime: string;
  endTime: string;
}): Promise<void> {
  const existing = await db
    .select()
    .from(technicianProfiles)
    .where(eq(technicianProfiles.userId, opts.userId));
  if (existing.length > 0) return;

  const [profile] = await db
    .insert(technicianProfiles)
    .values({
      userId: opts.userId,
      firstName: opts.firstName,
      lastName: opts.lastName,
      color: opts.color,
      emergencyAvailable: true,
    })
    .returning();
  if (!profile) throw new Error("Failed to create technician profile");

  const allSkills = await db.select().from(skills);
  const selected =
    opts.skillSlugs === "all"
      ? allSkills
      : allSkills.filter((s) => opts.skillSlugs.includes(s.slug));
  if (selected.length > 0) {
    await db
      .insert(technicianSkills)
      .values(selected.map((s) => ({ technicianId: profile.id, skillId: s.id })))
      .onConflictDoNothing();
  }
  await db.insert(technicianAvailability).values(
    opts.days.map((dayOfWeek) => ({
      technicianId: profile.id,
      dayOfWeek,
      startTime: opts.startTime,
      endTime: opts.endTime,
    })),
  );
}

const owner = await ensureUser({
  email: BUSINESS.email,
  name: "Shams",
  role: "owner",
  password: env.SEED_OWNER_PASSWORD,
});

// Shams also works in the field: all skills, Mon–Sat 7–7.
await ensureTechnicianProfile({
  userId: owner.id,
  firstName: "Shams",
  lastName: "",
  color: "#4f46e5",
  skillSlugs: "all",
  days: [1, 2, 3, 4, 5, 6],
  startTime: "07:00",
  endTime: "19:00",
});

if (env.NODE_ENV === "development") {
  // Dev-only fixture matching spec Test C: appliance-only technician.
  const tech = await ensureUser({
    email: "dev-technician@exactpoint.local",
    name: "Dev Technician",
    role: "technician",
  });
  await ensureTechnicianProfile({
    userId: tech.id,
    firstName: "Dev",
    lastName: "Technician",
    color: "#0891b2",
    skillSlugs: ["refrigerator", "washer", "dryer"],
    days: [1, 2, 3, 4, 5],
    startTime: "08:00",
    endTime: "17:00",
  });
}

console.log("User seed complete.");
await pool.end();
