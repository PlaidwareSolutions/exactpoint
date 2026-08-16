import type { EmailMessage } from "./index";

/**
 * Email templates (spec §78). Text-first, honest wording — no invented
 * claims. Payload keys come from the enqueue sites.
 */
type Payload = Record<string, unknown>;

const str = (payload: Payload, key: string, fallback = ""): string =>
  typeof payload[key] === "string" ? (payload[key] as string) : fallback;

export function renderEmail(
  template: string,
  recipient: string,
  payload: Payload,
  business: { displayName: string; phone: string },
): EmailMessage {
  const first = str(payload, "firstName", "there");
  const reference = str(payload, "reference");
  const windowLabel = str(payload, "windowLabel");

  switch (template) {
    case "booking_received":
      return {
        to: recipient,
        subject: `${business.displayName} — request received${reference ? ` (${reference})` : ""}`,
        text: [
          `Hi ${first},`,
          "",
          `We've received your service request${reference ? ` (reference ${reference})` : ""}.`,
          "We'll contact you to confirm your appointment window.",
          "",
          `The $80 diagnostic/service-call fee is waived when you approve the quoted repair.`,
          "",
          `Need anything sooner? Call ${business.phone}.`,
          `— ${business.displayName}`,
        ].join("\n"),
      };
    case "appointment_confirmed":
      return {
        to: recipient,
        subject: `${business.displayName} — appointment confirmed${reference ? ` (${reference})` : ""}`,
        text: [
          `Hi ${first},`,
          "",
          `Your appointment is confirmed${windowLabel ? ` for ${windowLabel}` : ""}.`,
          "Our technician will head your way in that window.",
          "",
          `Questions or changes? Call ${business.phone}.`,
          `— ${business.displayName}`,
        ].join("\n"),
      };
    case "job_complete":
      return {
        to: recipient,
        subject: `${business.displayName} — your repair is complete`,
        text: [
          `Hi ${first},`,
          "",
          "Your repair is complete. The work we performed is covered by our two-month labor warranty on that specific repair.",
          "",
          `If anything doesn't seem right, call ${business.phone} and we'll make it right.`,
          `— ${business.displayName}`,
        ].join("\n"),
      };
    case "password_reset":
      return {
        to: recipient,
        subject: `${business.displayName} — reset your password`,
        text: [
          `Hi ${first},`,
          "",
          "A password reset was requested for your ExactPoint team account.",
          "Set a new password here (link expires in 1 hour):",
          "",
          str(payload, "resetUrl"),
          "",
          "If you didn't request this, you can ignore this email — your password is unchanged.",
          `— ${business.displayName}`,
        ].join("\n"),
      };
    case "invoice_receipt":
      return {
        to: recipient,
        subject: `${business.displayName} — receipt${reference ? ` for ${reference}` : ""}`,
        text: [
          `Hi ${first},`,
          "",
          `Payment received${str(payload, "totalLabel") ? ` (${str(payload, "totalLabel")})` : ""}${reference ? ` for invoice ${reference}` : ""}. Thank you!`,
          "",
          "Your repair is covered by our two-month labor warranty on the specific work performed.",
          `— ${business.displayName}`,
        ].join("\n"),
      };
    default:
      return {
        to: recipient,
        subject: `${business.displayName} — update`,
        text: `Hi ${first},\n\nThere's an update on your service. Call ${business.phone} with any questions.\n— ${business.displayName}`,
      };
  }
}
