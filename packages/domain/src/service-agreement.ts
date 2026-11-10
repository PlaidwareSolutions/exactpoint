import { BUSINESS } from "./business";

/**
 * Service Authorization, Repair Disclaimer & Customer Agreement.
 *
 * Owner-supplied text (Shams, 2026-11-04) — the wording is his; only
 * punctuation/typos were corrected and the contact email set to the real
 * address. Do not reword, add, or remove terms without the owner's approval.
 * Bump `version` whenever the terms change: it is recorded on every quote
 * email so we always know which terms a customer was sent.
 */
export interface AgreementSection {
  heading: string;
  paragraphs: string[];
}

const fee = `$${BUSINESS.diagnosticFeeCents / 100}`;

export const SERVICE_AGREEMENT = {
  version: "2026-11-04",
  title: "Service Authorization, Repair Disclaimer & Customer Agreement",
  path: "/policies/service-agreement",
  intro:
    "By approving a repair estimate and authorizing service, the customer acknowledges and agrees to the following terms:",
  sections: [
    {
      heading: "Diagnostic Fee",
      paragraphs: [
        `A diagnostic/service fee of ${fee} applies when a technician visits the property to inspect an appliance and/or air conditioning system. If the customer approves the recommended repair cost, the diagnostic fee will be waived.`,
      ],
    },
    {
      heading: "Repair Authorization",
      paragraphs: [
        `The customer authorizes ${BUSINESS.legalName} to perform the specific repairs and install the parts identified in the approved estimate. Any additional repairs or expenses require customer approval before proceeding.`,
      ],
    },
    {
      heading: "Repair Scope and Additional Problems",
      paragraphs: [
        "Our repair services address the specific problem diagnosed and authorized by the customer. Repairing one component does not guarantee that other existing, hidden, or unrelated problems within the appliance will be resolved.",
        "An appliance may develop additional symptoms or experience other component failures after a repair. Such problems may require separate diagnosis and repair.",
      ],
    },
    {
      heading: "Post-Repair Inspection",
      paragraphs: [
        "If a customer reports a problem following a completed repair, we request the opportunity to return and inspect the appliance to determine the cause.",
        "If the issue is related to our workmanship or a defective part covered under the applicable warranty, it will be handled according to the applicable warranty terms.",
      ],
    },
    {
      heading: "Refund and Cancellation Policy",
      paragraphs: [
        "Once a repair has been authorized and completed, refunds are not automatically guaranteed simply because the customer changes their mind, decides to purchase a replacement appliance, or reports a different problem.",
        "Refund requests will be evaluated individually based on the repair performed, parts installed, applicable warranties, and circumstances of the complaint.",
        "Any agreed refund or return of parts must be documented in writing, including the amount and conditions of the refund.",
      ],
    },
    {
      heading: "Customer Responsibility",
      paragraphs: [
        "Customers are responsible for reviewing and approving repair estimates before work begins. Approval may be documented electronically, through text messages, written authorization, or another agreed method.",
      ],
    },
    {
      heading: "Customer Acknowledgment",
      paragraphs: [
        "By approving the estimate, the customer acknowledges that they understand the scope of the authorized repair, associated charges, and the terms stated above.",
      ],
    },
  ] satisfies AgreementSection[],
  closing:
    "Thank you for choosing our services. We appreciate your business and are committed to providing professional, honest, and reliable appliance and HVAC repair services.",
} as const;

export const SERVICE_AGREEMENT_URL = `https://${BUSINESS.domain}${SERVICE_AGREEMENT.path}`;

/** Plain-text rendering for emails (numbered like the owner's original). */
export function serviceAgreementText(): string {
  const a = SERVICE_AGREEMENT;
  return [
    `${BUSINESS.legalName}`,
    a.title.toUpperCase(),
    "",
    a.intro,
    "",
    ...a.sections.flatMap((s, i) => [`${i + 1}. ${s.heading}`, ...s.paragraphs, ""]),
    `Business: ${BUSINESS.legalName}`,
    `Phone: ${BUSINESS.phone}`,
    `Email: ${BUSINESS.email}`,
    `Online: ${SERVICE_AGREEMENT_URL}`,
    "",
    a.closing,
  ].join("\n");
}
