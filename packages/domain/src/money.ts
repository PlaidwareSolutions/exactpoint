/**
 * Estimate/invoice math (spec §85). All amounts are integer cents; tax rate
 * is basis points (825 = 8.25%). Tax applies to line items only — the
 * diagnostic fee is charged untaxed unless the owner adjusts the invoice.
 */

export interface LineItemAmount {
  quantity: number;
  unitPriceCents: number;
}

export function lineTotalCents(item: LineItemAmount): number {
  return Math.round(item.quantity * item.unitPriceCents);
}

export function subtotalCents(items: LineItemAmount[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}

export function taxCents(subtotal: number, taxRateBps: number): number {
  return Math.round((subtotal * taxRateBps) / 10_000);
}

export interface InvoiceAmounts {
  subtotalCents: number;
  diagnosticFeeCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * The §85 rule, in one place:
 * - Repair APPROVED → the diagnostic fee is waived; the customer pays the
 *   quoted items plus tax.
 * - Repair DECLINED → the $80 diagnostic/service-call fee is due; nothing else.
 */
export function invoiceAmountsForDecision(
  decision: "approved" | "declined",
  items: LineItemAmount[],
  taxRateBps: number,
  diagnosticFeeCents: number,
): InvoiceAmounts {
  if (decision === "declined") {
    return {
      subtotalCents: 0,
      diagnosticFeeCents,
      taxCents: 0,
      totalCents: diagnosticFeeCents,
    };
  }
  const subtotal = subtotalCents(items);
  const tax = taxCents(subtotal, taxRateBps);
  return {
    subtotalCents: subtotal,
    diagnosticFeeCents: 0,
    taxCents: tax,
    totalCents: subtotal + tax,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/* ---------- payments ledger (spec §42 — partial payments, refunds) ---------- */

export interface LedgerRowAmount {
  kind: "payment" | "refund";
  amountCents: number;
}

/** Net amount received: payments minus refunds. */
export function paidCents(rows: LedgerRowAmount[]): number {
  return rows.reduce(
    (sum, row) => sum + (row.kind === "payment" ? row.amountCents : -row.amountCents),
    0,
  );
}

export function balanceCents(totalCents: number, paid: number): number {
  return totalCents - paid;
}

/**
 * Invoice status is a pure function of total vs. net paid, so it can never
 * drift from the ledger. "void" is handled by the caller — a void invoice
 * takes no payments.
 */
export function invoiceStatusFor(
  totalCents: number,
  paid: number,
): "unpaid" | "partially_paid" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid >= totalCents) return "paid";
  return "partially_paid";
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  void: "Void",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  zelle: "Zelle",
  cash: "Cash",
  check: "Check",
};
