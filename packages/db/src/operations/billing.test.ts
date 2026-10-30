import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import pg from "pg";
import { loadEnv } from "@exactpoint/config";
import { createDb } from "../client";
import { runMigrations } from "../migrate";
import { auditLogs, customerAddresses, customers, users, workOrders } from "../schema";
import {
  billingForWorkOrder,
  decideEstimate,
  invoiceLedger,
  paymentReceipt,
  recordInvoicePayment,
  saveEstimateRevision,
} from "./billing";

const env = loadEnv();
const testUrl = env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("estimates, revisions, invoices & payments ledger (spec §42, §85–86)", () => {
  const handle = createDb(testUrl);
  const db = handle.db;
  let customerId: string;
  let addressId: string;

  async function newWorkOrder(): Promise<string> {
    const [wo] = await db
      .insert(workOrders)
      .values({ customerId, addressId })
      .returning({ id: workOrders.id });
    return wo!.id;
  }

  const fanMotor = { kind: "part" as const, description: "Evaporator fan motor", quantity: 1, unitPriceCents: 18500 };
  const labor = { kind: "labor" as const, description: "Labor", quantity: 2, unitPriceCents: 9500 };

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
    customerId = customer!.id;
    const [address] = await db
      .insert(customerAddresses)
      .values({ customerId, street: "1 Pay St", city: "Katy", zip: "77450" })
      .returning();
    addressId = address!.id;
  }, 60_000);

  afterAll(async () => {
    await handle.pool.end();
  });

  it("approved estimate → invoice with items + tax, fee waived; partial payments → receipts → paid in full", async () => {
    const workOrderId = await newWorkOrder();
    const { estimateId, revision } = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor, labor],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    expect(revision).toBe(1);
    const { invoiceNumber, invoiceId } = await decideEstimate(db, {
      estimateId,
      decision: "approved",
      actorId: "owner-b",
    });
    expect(invoiceNumber).toMatch(/^INV-\d+$/);

    const billing = await billingForWorkOrder(db, workOrderId);
    expect(billing.estimate?.status).toBe("approved");
    expect(billing.approvedRevision?.revision).toBe(1);
    const invoice = billing.invoices[0]!;
    expect(invoice.subtotalCents).toBe(37500);
    expect(invoice.diagnosticFeeCents).toBe(0); // waived
    expect(invoice.taxCents).toBe(3094);
    expect(invoice.totalCents).toBe(40594);
    expect(invoice.status).toBe("unpaid");
    expect(invoice.balanceCents).toBe(40594);

    // Deciding twice must fail.
    await expect(
      decideEstimate(db, { estimateId, decision: "declined", actorId: "owner-b" }),
    ).rejects.toThrow(/already been decided/);

    // Deposit → partially paid, with a receipt.
    const deposit = await recordInvoicePayment(db, {
      invoiceId,
      amountCents: 20000,
      method: "zelle",
      reference: "ZL-77A",
      actorId: "owner-b",
    });
    expect(deposit.receiptNumber).toMatch(/^RCT-\d+$/);
    expect(deposit.status).toBe("partially_paid");
    expect(deposit.balanceCents).toBe(20594);
    expect(deposit.paidInFull).toBe(false);

    // Overpayment is refused; zero/negative too.
    await expect(
      recordInvoicePayment(db, { invoiceId, amountCents: 20595, method: "cash", actorId: "owner-b" }),
    ).rejects.toThrow(/more than the \$205\.94 balance/);
    await expect(
      recordInvoicePayment(db, { invoiceId, amountCents: 0, method: "cash", actorId: "owner-b" }),
    ).rejects.toThrow(/greater than zero/);

    // Final payment → paid, paidAt stamped, no further payments.
    const final = await recordInvoicePayment(db, {
      invoiceId,
      amountCents: 20594,
      method: "check",
      reference: "1042",
      actorId: "owner-b",
    });
    expect(final.status).toBe("paid");
    expect(final.paidInFull).toBe(true);
    expect(final.balanceCents).toBe(0);
    await expect(
      recordInvoicePayment(db, { invoiceId, amountCents: 100, method: "cash", actorId: "owner-b" }),
    ).rejects.toThrow(/already paid in full/);

    const ledger = (await invoiceLedger(db, invoiceId))!;
    expect(ledger.invoice.status).toBe("paid");
    expect(ledger.invoice.paidAt).not.toBeNull();
    expect(ledger.payments).toHaveLength(2);
    expect(ledger.paidCents).toBe(40594);
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.payments[0]!.receiptNumber).not.toBe(ledger.payments[1]!.receiptNumber);

    // Each receipt reads as it did when issued.
    const first = (await paymentReceipt(db, deposit.paymentId))!;
    expect(first.paidThroughCents).toBe(20000);
    expect(first.balanceAfterCents).toBe(20594);
    expect(first.paidInFull).toBe(false);
    const second = (await paymentReceipt(db, final.paymentId))!;
    expect(second.paidThroughCents).toBe(40594);
    expect(second.paidInFull).toBe(true);

    // A refund reopens the balance; one above what was received is refused.
    await expect(
      recordInvoicePayment(db, { invoiceId, kind: "refund", amountCents: 50000, method: "zelle", actorId: "owner-b" }),
    ).rejects.toThrow(/can't exceed/);
    const refund = await recordInvoicePayment(db, {
      invoiceId,
      kind: "refund",
      amountCents: 5000,
      method: "zelle",
      note: "Part came in cheaper",
      actorId: "owner-b",
    });
    expect(refund.status).toBe("partially_paid");
    expect(refund.balanceCents).toBe(5000);
    const reopened = (await invoiceLedger(db, invoiceId))!;
    expect(reopened.invoice.paidAt).toBeNull();
    expect(reopened.payments).toHaveLength(3);

    const audit = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, invoiceId));
    expect(audit.map((a) => a.action).sort()).toEqual([
      "invoice.payment_recorded",
      "invoice.payment_recorded",
      "invoice.refund_recorded",
    ]);
  });

  it("concurrent payments can never overpay — the invoice row lock serialises them", async () => {
    const workOrderId = await newWorkOrder();
    const { estimateId } = await saveEstimateRevision(db, {
      workOrderId,
      items: [{ kind: "labor", description: "Labor", quantity: 1, unitPriceCents: 10000 }],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    const { invoiceId } = await decideEstimate(db, { estimateId, decision: "approved", actorId: "owner-b" });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        recordInvoicePayment(db, { invoiceId, amountCents: 6000, method: "cash", actorId: "owner-b" }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const ledger = (await invoiceLedger(db, invoiceId))!;
    expect(ledger.paidCents).toBe(6000);
    expect(ledger.invoice.status).toBe("partially_paid");
  });

  it("declined estimate → invoice for exactly the $80 diagnostic fee; no further revisions", async () => {
    const workOrderId = await newWorkOrder();
    const { estimateId } = await saveEstimateRevision(db, {
      workOrderId,
      items: [{ kind: "part", description: "Compressor", quantity: 1, unitPriceCents: 65000 }],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    await decideEstimate(db, { estimateId, decision: "declined", actorId: "owner-b" });
    const billing = await billingForWorkOrder(db, workOrderId);
    const invoice = billing.invoices[0]!;
    expect(invoice.subtotalCents).toBe(0);
    expect(invoice.diagnosticFeeCents).toBe(8000);
    expect(invoice.totalCents).toBe(8000);
    await expect(
      saveEstimateRevision(db, {
        workOrderId,
        items: [fanMotor],
        taxRateBps: 825,
        diagnosticFeeCents: 8000,
        createdBy: "owner-b",
      }),
    ).rejects.toThrow(/declined/);
  });

  it("saving before a decision creates a new revision and keeps the old one readable", async () => {
    const workOrderId = await newWorkOrder();
    const r1 = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    const r2 = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor, labor],
      taxRateBps: 825,
      diagnosticFeeCents: 8000,
      notes: "Added labor",
      createdBy: "owner-b",
    });
    expect(r1.estimateId).toBe(r2.estimateId);
    expect(r2.revision).toBe(2);
    expect(r2.kind).toBe("quote");

    const billing = await billingForWorkOrder(db, workOrderId);
    expect(billing.revisions.map((r) => [r.revision, r.status, r.items.length])).toEqual([
      [1, "superseded", 1],
      [2, "presented", 2],
    ]);
    expect(billing.currentRevision?.id).toBe(r2.revisionId);
    expect(billing.items).toHaveLength(2);

    // Approval attaches to revision 2 and the invoice is built from it.
    const decided = await decideEstimate(db, { estimateId: r1.estimateId, decision: "approved", actorId: "owner-b" });
    expect(decided.revision).toBe(2);
    const after = await billingForWorkOrder(db, workOrderId);
    expect(after.approvedRevision?.id).toBe(r2.revisionId);
    expect(after.invoices[0]!.estimateRevisionId).toBe(r2.revisionId);
    expect(after.invoices[0]!.totalCents).toBe(40594);
  });

  it("change order after approval: approved → invoice rebuilt (never below paid); declined → approved revision stands", async () => {
    const workOrderId = await newWorkOrder();
    const { estimateId, revisionId: rev1 } = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    const { invoiceId } = await decideEstimate(db, { estimateId, decision: "approved", actorId: "owner-b" });
    await recordInvoicePayment(db, { invoiceId, amountCents: 10000, method: "cash", actorId: "owner-b" });

    // Change order: more work discovered on site.
    const co = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor, labor],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    expect(co.kind).toBe("change_order");
    expect(co.revision).toBe(2);
    let billing = await billingForWorkOrder(db, workOrderId);
    expect(billing.estimate?.status).toBe("approved"); // still approved while the change order is pending
    expect(billing.currentRevision?.kind).toBe("change_order");
    expect(billing.approvedRevision?.id).toBe(rev1);
    expect(billing.invoices[0]!.totalCents).toBe(18500); // untouched until approved

    // Customer says no → approved revision stands, invoice untouched.
    await decideEstimate(db, { estimateId, decision: "declined", actorId: "owner-b" });
    billing = await billingForWorkOrder(db, workOrderId);
    expect(billing.estimate?.status).toBe("approved");
    expect(billing.currentRevision?.id).toBe(rev1);
    expect(billing.revisions.find((r) => r.revision === 2)?.status).toBe("declined");
    expect(billing.invoices[0]!.totalCents).toBe(18500);

    // Second change order, approved → invoice totals rebuilt, balance moves.
    const co2 = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor, labor],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    expect(co2.revision).toBe(3);
    const decided = await decideEstimate(db, { estimateId, decision: "approved", actorId: "owner-b" });
    expect(decided.kind).toBe("change_order");
    billing = await billingForWorkOrder(db, workOrderId);
    expect(billing.approvedRevision?.revision).toBe(3);
    expect(billing.revisions.find((r) => r.revision === 1)?.status).toBe("superseded");
    const inv = billing.invoices[0]!;
    expect(inv.totalCents).toBe(37500);
    expect(inv.estimateRevisionId).toBe(co2.revisionId);
    expect(inv.paidCents).toBe(10000);
    expect(inv.balanceCents).toBe(27500);
    expect(inv.status).toBe("partially_paid");
    const adjusted = await db
      .select({ action: auditLogs.action, oldValue: auditLogs.oldValue })
      .from(auditLogs)
      .where(eq(auditLogs.action, "invoice.adjusted"));
    expect(adjusted).toHaveLength(1);
    expect((adjusted[0]!.oldValue as { totalCents: number }).totalCents).toBe(18500);

    // Pay it off, then try to shrink the job below what was paid.
    await recordInvoicePayment(db, { invoiceId, amountCents: 27500, method: "zelle", actorId: "owner-b" });
    await saveEstimateRevision(db, {
      workOrderId,
      items: [{ kind: "labor", description: "Labor only", quantity: 1, unitPriceCents: 5000 }],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    await expect(
      decideEstimate(db, { estimateId, decision: "approved", actorId: "owner-b" }),
    ).rejects.toThrow(/record a refund/);
    // The invoice is unchanged after the refused approval.
    const ledger = (await invoiceLedger(db, invoiceId))!;
    expect(ledger.invoice.totalCents).toBe(37500);
    expect(ledger.invoice.status).toBe("paid");
  });

  it("no change orders once the job is paid in full and completed", async () => {
    const workOrderId = await newWorkOrder();
    const { estimateId } = await saveEstimateRevision(db, {
      workOrderId,
      items: [fanMotor],
      taxRateBps: 0,
      diagnosticFeeCents: 8000,
      createdBy: "owner-b",
    });
    const { invoiceId } = await decideEstimate(db, { estimateId, decision: "approved", actorId: "owner-b" });
    await recordInvoicePayment(db, { invoiceId, amountCents: 18500, method: "cash", actorId: "owner-b" });
    await db.update(workOrders).set({ status: "completed" }).where(eq(workOrders.id, workOrderId));
    await expect(
      saveEstimateRevision(db, {
        workOrderId,
        items: [fanMotor, labor],
        taxRateBps: 0,
        diagnosticFeeCents: 8000,
        createdBy: "owner-b",
      }),
    ).rejects.toThrow(/paid in full and completed/);
  });
});
