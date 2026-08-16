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
