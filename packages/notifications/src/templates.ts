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
    case "quote_issued": {
      // kind: "quote" (first or revised) | "change_order" (after approval).
      const changeOrder = str(payload, "kind") === "change_order";
      const revision = Number(payload["revision"] ?? 1);
      const subject = changeOrder
        ? `${business.displayName} — updated quote for your repair (change order)`
        : revision > 1
          ? `${business.displayName} — your revised quote`
          : `${business.displayName} — your quote`;
      const intro = changeOrder
        ? "While working on your repair we found additional work is needed. Here is the updated quote — it replaces the one you approved only if you approve this one too; otherwise the approved work stands as quoted:"
        : revision > 1
          ? `Here is your revised quote from ${business.displayName}. It replaces the quote we sent earlier:`
          : `Here is your quote from ${business.displayName}:`;
      return {
        to: recipient,
        subject,
        text: [
          `Hi ${first},`,
          "",
          intro,
          "",
          str(payload, "linesText"),
          "",
          str(payload, "totalsText"),
          "",
          changeOrder
            ? "Your invoice is updated to the new total once you approve this change."
            : "Approve the quote and the $80 diagnostic/service-call fee is waived — you pay only the quoted amount.",
          `Ready to go ahead, or have questions? Call ${business.phone} or just reply to this email.`,
          "",
          "Completed repairs carry a two-month labor warranty on the specific work performed.",
          `— ${business.displayName}`,
        ].join("\n"),
      };
    }
    case "invoice_issued":
      return {
        to: recipient,
        subject: `${business.displayName} — invoice ${reference}`,
        text: [
          `Hi ${first},`,
          "",
          `Here is your invoice ${reference} from ${business.displayName}:`,
          "",
          str(payload, "linesText"),
          "",
          str(payload, "totalsText"),
          "",
          `Payment accepted by ${str(payload, "paymentMethods") || "Zelle, Cash, Check"}.`,
          `Questions or ready to pay? Call ${business.phone}.`,
          "",
          "Completed repairs carry a two-month labor warranty on the specific work performed.",
          `— ${business.displayName}`,
        ].join("\n"),
      };
    case "payment_receipt": {
      // One receipt per ledger row: payments and refunds alike.
      const refund = str(payload, "kind") === "refund";
      const receiptNumber = str(payload, "receiptNumber");
      const amount = str(payload, "amountLabel");
      const method = str(payload, "methodLabel");
      const ref = str(payload, "paymentReference");
      const paidInFull = payload["paidInFull"] === true || str(payload, "paidInFull") === "yes";
      return {
        to: recipient,
        subject: `${business.displayName} — ${refund ? "refund" : "receipt"} ${receiptNumber}${reference ? ` for ${reference}` : ""}`,
        text: [
          `Hi ${first},`,
          "",
          refund
            ? `We've issued a refund of ${amount} by ${method}${ref ? ` (${ref})` : ""} on invoice ${reference}.`
            : `Payment received — thank you! ${amount} by ${method}${ref ? ` (${ref})` : ""} on invoice ${reference}.`,
          "",
          `Receipt number: ${receiptNumber}`,
          `Invoice total: ${str(payload, "totalLabel")}`,
          `Paid to date: ${str(payload, "paidToDateLabel")}`,
          paidInFull ? "Balance: $0.00 — paid in full." : `Balance remaining: ${str(payload, "balanceLabel")}`,
          "",
          paidInFull
            ? "Your repair is covered by our two-month labor warranty on the specific work performed."
            : `You can settle the balance by ${str(payload, "paymentMethods") || "Zelle, Cash, Check"}. Questions? Call ${business.phone}.`,
          `— ${business.displayName}`,
        ].join("\n"),
      };
    }
    default:
      return {
        to: recipient,
        subject: `${business.displayName} — update`,
        text: `Hi ${first},\n\nThere's an update on your service. Call ${business.phone} with any questions.\n— ${business.displayName}`,
      };
  }
}
