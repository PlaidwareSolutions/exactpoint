import { requireTechnician } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "My Day" };

/** Technician area (owner can view too). The full PWA ships in Phase 9. */
export default async function TechPage() {
  const session = await requireTechnician();
  return (
    <main className="mx-auto max-w-md p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Today</h1>
          <p className="text-sm text-neutral-500">{session.user.email}</p>
        </div>
        <SignOutButton />
      </header>
      <section className="mt-6 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600">
        Your assigned jobs will appear here once scheduling goes live.
      </section>
    </main>
  );
}
