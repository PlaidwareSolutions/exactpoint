"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setBusy(false);
    // Same message regardless of whether the account exists (no enumeration).
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        If an account exists for {email}, a reset link is on its way. The link
        expires in 1 hour — check spam if it doesn&apos;t appear within a few
        minutes.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-navy">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-navy focus:border-point focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-point py-2.5 font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
