import { describe, expect, it } from "vitest";
import { invoiceAmountsForDecision, subtotalCents, taxCents } from "./money";

const items = [
  { quantity: 1, unitPriceCents: 18500 }, // part
  { quantity: 2, unitPriceCents: 9500 }, // labor hours
];

describe("estimate math (spec §85)", () => {
  it("computes subtotal and tax in integer cents", () => {
    expect(subtotalCents(items)).toBe(37500);
    expect(taxCents(37500, 825)).toBe(3094); // 8.25%
  });

  it("approved repair waives the $80 diagnostic fee", () => {
    const amounts = invoiceAmountsForDecision("approved", items, 825, 8000);
    expect(amounts.diagnosticFeeCents).toBe(0);
    expect(amounts.subtotalCents).toBe(37500);
    expect(amounts.totalCents).toBe(37500 + 3094);
  });

  it("declined repair owes exactly the diagnostic fee", () => {
    const amounts = invoiceAmountsForDecision("declined", items, 825, 8000);
    expect(amounts).toEqual({
      subtotalCents: 0,
      diagnosticFeeCents: 8000,
      taxCents: 0,
      totalCents: 8000,
    });
  });
});
