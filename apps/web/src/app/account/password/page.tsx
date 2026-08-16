import Link from "next/link";
import { requireTechnician } from "@/lib/session";
import { canAccessManagerArea } from "@/lib/authz";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change Password" };

/** Any signed-in team member (owner or technician) can change their password. */
export default async function AccountPasswordPage() {
  const session = await requireTechnician();
  const backHref = canAccessManagerArea(session.user.role) ? "/manager" : "/tech";
  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href={backHref} className="text-sm font-semibold text-point">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-navy">Change password</h1>
      <p className="mt-1 text-sm text-slate">Signed in as {session.user.email}</p>
      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </main>
  );
}
