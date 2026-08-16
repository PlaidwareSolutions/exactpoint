import { requireOwner } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Service Manager" };

/** Owner-only. The full dashboard ships in Milestone 3. */
export default async function ManagerPage() {
  const session = await requireOwner();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ExactPoint Service Manager</h1>
          <p className="text-sm text-neutral-500">
            Signed in as {session.user.email} · role: {session.user.role}
          </p>
        </div>
        <SignOutButton />
      </header>
      <section className="mt-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="font-semibold">Foundation phase</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Authentication, roles, database schema, and scheduling-conflict
          protection are in place. Team management, the multi-technician
          calendar, and the intelligent scheduler arrive in Milestone 3.
        </p>
      </section>
    </main>
  );
}
