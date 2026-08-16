import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Set New Password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
