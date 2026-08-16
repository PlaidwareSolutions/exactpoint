import { BUSINESS } from "@exactpoint/domain";

/**
 * Placeholder home page — the full marketing site ships in Phase 2.
 * Only verified business facts appear here.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-sm font-semibold tracking-[0.3em] text-neutral-500">
        {BUSINESS.serviceArea.toUpperCase()}
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        EXACTPOINT
        <span className="mt-2 block text-xl font-semibold text-neutral-600 sm:text-2xl">
          APPLIANCE &amp; HVAC
        </span>
      </h1>
      <p className="max-w-md text-lg text-neutral-700">
        Appliance or HVAC problem? We can help. Our full website — including
        online booking — is on its way.
      </p>
      <a
        href={BUSINESS.phoneHref}
        className="rounded-xl bg-neutral-900 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-neutral-700"
      >
        Call {BUSINESS.phone}
      </a>
      <p className="text-sm text-neutral-500">
        Monday–Saturday, 7:00 AM–7:00 PM · Sunday closed
      </p>
    </main>
  );
}
