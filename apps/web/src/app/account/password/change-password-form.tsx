"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-navy focus:border-point focus:outline-none";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setMessage({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMessage({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      setMessage({
        ok: false,
        text: error.message ?? "Could not change the password — check your current password.",
      });
    } else {
      setMessage({ ok: true, text: "Password changed. Other devices were signed out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {message && (
        <p
          className={`rounded-lg px-4 py-2.5 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
      <label className="block text-sm font-semibold text-navy">
        Current password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="block text-sm font-semibold text-navy">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="block text-sm font-semibold text-navy">
        Confirm new password
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-point py-2.5 font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
