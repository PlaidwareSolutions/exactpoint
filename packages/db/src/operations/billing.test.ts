import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { loadEnv } from "@exactpoint/config";
import { createDb } from "../client";
import { runMigrations } from "../migrate";
import { customerAddresses, customers, users, workOrders } from "../schema";
import {
  billingForWorkOrder,
  decideEstimate,
  recordInvoicePayment,
  upsertEstimate,
} from "./billing";

const env = loadEnv();
const testUrl = env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("estimates & invoices (spec §85–86)", () => {
  const handle = createDb(testUrl);
  const db = handle.db;
  let workOrderA: string;
  let workOrderB: string;

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: testUrl, max: 1 });
    await admin.query(
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;",
    );
    await admin.end();
    await runMigrations(testUrl);

    await db.insert(users).values({ id: "owner-b", name: "Owner", email: "owner-b@example.com" });
    const [customer] = await db
      .insert(customers)
      .values({ firstName: "Bill", lastName: "Ing" })
      .returning();
    const [address] = await db
      .insert(customerAddresses)
      .values({ customerId: customer!.id, street: "1 Pay St", city: "Katy", zip: "77450" })
      .returning();
    const orders = await db
      .insert(workOrders)
      .values([
        { customerId: customer!.id, addressId: address!.id },
        { customerId: customer!.id, addressId: address!.id },
      ])
      .returning({ id: workOrders.id });
    workOrderA = orders[0]!.id;
    workOrderB = orders[1]!.id;
  }, 60_000);

  afterAll(async () => {
    await handle.pool.end();
  });

  it("approved estimate → invoice with items + tax, fee waived", async () => {
    const { estimateId } = await upsertEstimate(db, {
      workOrderId: workOrderA,
      items: [
        { kind: "part", description: "Evaporator fan motor", quantity: 1, unitPriceCents: 18500 },
        { kind: "labor", description: "Labor", quantity: 2, unitPriceCents: 9500 },
      ],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    const { invoiceNumber } = await decideEstimate(db, {
      estimateId,
      decision: "approved",
      actorId: "owner-b",
    });
    expect(invoiceNumber).toMatch(/^INV-\d+$/);

    const billing = await billingForWorkOrder(db, workOrderA);
    expect(billing.estimate?.status).toBe("approved");
    const invoice = billing.invoices[0]!;
    expect(invoice.subtotalCents).toBe(37500);
    expect(invoice.diagnosticFeeCents).toBe(0); // waived
    expect(invoice.taxCents).toBe(3094);
    expect(invoice.totalCents).toBe(40594);

    // Deciding twice must fail.
    await expect(
      decideEstimate(db, { estimateId, decision: "declined", actorId: "owner-b" }),
    ).rejects.toThrow(/already been decided/);

    await recordInvoicePayment(db, { invoiceId: invoice.id, method: "zelle", actorId: "owner-b" });
    const after = await billingForWorkOrder(db, workOrderA);
    expect(after.invoices[0]!.status).toBe("paid");
    expect(after.invoices[0]!.paymentMethod).toBe("zelle");
  });

  it("declined estimate → invoice for exactly the $80 diagnostic fee", async () => {
    const { estimateId } = await upsertEstimate(db, {
      workOrderId: workOrderB,
      items: [{ kind: "part", description: "Compressor", quantity: 1, unitPriceCents: 65000 }],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    await decideEstimate(db, { estimateId, decision: "declined", actorId: "owner-b" });
    const billing = await billingForWorkOrder(db, workOrderB);
    const invoice = billing.invoices[0]!;
    expect(invoice.subtotalCents).toBe(0);
    expect(invoice.diagnosticFeeCents).toBe(8000);
    expect(invoice.totalCents).toBe(8000);
  });
});
