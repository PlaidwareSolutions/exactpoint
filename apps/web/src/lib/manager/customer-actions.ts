"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auditLogs, customers, getDb } from "@exactpoint/db";
import { requireOwner } from "@/lib/session";
import type { ActionResult } from "./schedule-actions";

const customerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).default(""),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s().+-]{7,20}$/, "Enter a valid phone number"),
  email: z.email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/**
 * Edits customer contact details (spec §34). Addresses stay separate — they
 * are validated/geocoded/zoned, so changing one goes through re-validation
 * (future round), never a free-text edit.
 */
export async function updateCustomer(
  customerId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await requireOwner();
  const idOk = z.uuid().safeParse(customerId);
  if (!idOk.success) return { ok: false, error: "Invalid customer." };
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const db = getDb();

  const [existing] = await db.select().from(customers).where(eq(customers.id, idOk.data));
  if (!existing) return { ok: false, error: "Customer not found." };

  const phone = d.phone.replace(/[^\d+]/g, "");
  const email = d.email ? d.email.toLowerCase() : null;
  await db
    .update(customers)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      phone,
      email,
      notes: d.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, idOk.data));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "customer.updated",
    entityType: "customer",
    entityId: idOk.data,
    oldValue: {
      firstName: existing.firstName,
      lastName: existing.lastName,
      phone: existing.phone,
      email: existing.email,
    },
    newValue: { firstName: d.firstName, lastName: d.lastName, phone, email },
  });
  revalidatePath(`/manager/customers/${idOk.data}`);
  revalidatePath("/manager/customers");
  return { ok: true };
}
