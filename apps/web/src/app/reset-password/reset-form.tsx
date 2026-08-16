"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || params.get("error")) {
    return (
      <p className="max-w-sm rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        This reset link is invalid or has expired. Request a new one from the
        &quot;Forgot password&quot; page.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message ?? "Could not reset — the link may have expired.");
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Set a new password</h1>
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}
      <label className="block text-sm font-semibold text-navy">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-navy focus:border-point focus:outline-none"
        />
      </label>
      <label className="block text-sm font-semibold text-navy">
        Confirm password
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-navy focus:border-point focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-point py-2.5 font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
