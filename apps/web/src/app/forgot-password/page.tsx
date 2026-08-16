import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-extrabold text-navy">Reset your password</h1>
        <p className="mt-1 text-sm text-slate">
          Enter your team account email and we&apos;ll send a reset link.
        </p>
        <div className="mt-5">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-sm text-slate">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-point">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
