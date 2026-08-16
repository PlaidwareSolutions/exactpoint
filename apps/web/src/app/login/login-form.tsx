"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    if (signInError || !data) {
      setError("Sign-in failed. Check your email and password.");
      setSubmitting(false);
      return;
    }
    const { data: session } = await authClient.getSession();
    router.push(session?.user.role === "owner" ? "/manager" : "/tech");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">ExactPoint Team Sign-in</h1>
        <p className="mt-1 text-sm text-neutral-500">Owner &amp; technician access only</p>
      </div>
      {denied && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You don&apos;t have access to that area.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-neutral-900 py-2.5 font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
