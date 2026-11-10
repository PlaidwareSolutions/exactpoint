import { describe, expect, it } from "vitest";
import { BUSINESS } from "./business";
import { SERVICE_AGREEMENT, serviceAgreementText } from "./service-agreement";

describe("service agreement", () => {
  it("keeps the owner's seven numbered terms", () => {
    expect(SERVICE_AGREEMENT.sections.map((s) => s.heading)).toEqual([
      "Diagnostic Fee",
      "Repair Authorization",
      "Repair Scope and Additional Problems",
      "Post-Repair Inspection",
      "Refund and Cancellation Policy",
      "Customer Responsibility",
      "Customer Acknowledgment",
    ]);
  });

  it("renders plain text with the real business contact details", () => {
    const text = serviceAgreementText();
    expect(text).toContain("1. Diagnostic Fee");
    expect(text).toContain("7. Customer Acknowledgment");
    expect(text).toContain(`$${BUSINESS.diagnosticFeeCents / 100}`);
    expect(text).toContain(`Email: ${BUSINESS.email}`);
    expect(text).toContain(BUSINESS.legalName);
    expect(text).not.toMatch(/repairtvs/);
  });
});
