import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { BUSINESS, DEFAULT_BUSINESS_HOURS } from "@exactpoint/domain";
import { createDb, type Database } from "../client";
import {
  businessSettings,
  organizations,
  schedulingSettings,
  serviceCategories,
  serviceTypes,
  serviceZones,
  serviceZoneZips,
  skills,
} from "../schema";
import { DEFAULT_SCHEDULING_WEIGHTS, SERVICE_TYPE_SEEDS, ZONE_SEEDS } from "./seed-data";

/** Idempotent configuration seed — safe to re-run. */
export async function seed(db: Database): Promise<void> {
  const existingOrg = await db.select().from(organizations).limit(1);
  if (existingOrg.length === 0) {
    await db.insert(organizations).values({ name: BUSINESS.legalName });
  }

  await db
    .insert(businessSettings)
    .values({
      id: 1,
      legalName: BUSINESS.legalName,
      displayName: BUSINESS.displayName,
      phone: BUSINESS.phone,
      email: BUSINESS.email,
      timezone: BUSINESS.timezone,
      hours: DEFAULT_BUSINESS_HOURS,
      diagnosticFeeCents: BUSINESS.diagnosticFeeCents,
      laborWarrantyMonths: BUSINESS.laborWarrantyMonths,
    })
    .onConflictDoNothing();

  await db
    .insert(schedulingSettings)
    .values({ id: 1, weights: DEFAULT_SCHEDULING_WEIGHTS })
    .onConflictDoNothing();

  await db
    .insert(serviceCategories)
    .values([
      { slug: "appliance", name: "Appliance", sortOrder: 1 },
      { slug: "hvac", name: "HVAC", sortOrder: 2 },
    ])
    .onConflictDoNothing();
  const categories = await db.select().from(serviceCategories);
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const s of SERVICE_TYPE_SEEDS) {
    await db
      .insert(skills)
      .values({ slug: s.slug, name: s.name, category: s.category })
      .onConflictDoNothing();
  }
  const allSkills = await db.select().from(skills);
  const skillBySlug = new Map(allSkills.map((s) => [s.slug, s.id]));

  for (const s of SERVICE_TYPE_SEEDS) {
    const categoryId = categoryBySlug.get(s.category);
    if (!categoryId) throw new Error(`Missing service category: ${s.category}`);
    await db
      .insert(serviceTypes)
      .values({
        categoryId,
        slug: s.slug,
        name: s.name,
        defaultDurationMinutes: s.defaultDurationMinutes,
        requiredSkillId: skillBySlug.get(s.slug),
        sortOrder: s.sortOrder,
      })
      .onConflictDoNothing();
  }

  for (const z of ZONE_SEEDS) {
    await db
      .insert(serviceZones)
      .values({ slug: z.slug, name: z.name, color: z.color, priority: z.priority })
      .onConflictDoNothing();
    const [zone] = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.slug, z.slug));
    if (!zone) throw new Error(`Zone not found after insert: ${z.slug}`);
    for (const zip of z.zips) {
      await db
        .insert(serviceZoneZips)
        .values({ zoneId: zone.id, zip })
        .onConflictDoNothing();
    }
  }
}

const isCliInvocation = process.argv[1] === fileURLToPath(import.meta.url);
if (isCliInvocation) {
  const { db, pool } = createDb();
  seed(db)
    .then(() => {
      console.log("Seed complete.");
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
