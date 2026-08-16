export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Vendor-neutral email interface (spec §84); a real provider plugs in at Phase 11. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<{ ok: boolean; providerId?: string; error?: string }>;
}

export { renderEmail } from "./templates";
export { ResendEmailProvider } from "./resend";

/** Dev/test provider: records and logs instead of sending. */
export class ConsoleEmailProvider implements EmailProvider {
  public readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<{ ok: boolean }> {
    this.sent.push(message);
    console.log(`[email] to=${message.to} subject=${message.subject}`);
    return { ok: true };
  }
}
