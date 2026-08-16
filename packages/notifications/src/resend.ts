import type { EmailMessage, EmailProvider } from "./index";

/**
 * Resend implementation of EmailProvider (spec §84 abstraction) — plain
 * fetch, no SDK. Activates when RESEND_API_KEY + EMAIL_FROM are configured.
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ ok: boolean; providerId?: string; error?: string }> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `resend ${res.status}: ${body.slice(0, 300)}` };
      }
      const body = (await res.json()) as { id?: string };
      return { ok: true, providerId: body.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "network error" };
    }
  }
}
