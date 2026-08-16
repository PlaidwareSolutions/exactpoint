import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { appointmentDetail, getDb, technicianProfiles } from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { canAccessManagerArea } from "@/lib/authz";
import { requireTechnician } from "@/lib/session";
import { JobActions } from "./job-actions";

export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TechJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireTechnician();
  const { id } = await params;
  const db = getDb();
  const job = await appointmentDetail(db, id);
  if (!job) notFound();

  // Privacy (spec §40): technicians open only their own jobs.
  if (!canAccessManagerArea(session.user.role)) {
    const [profile] = await db
      .select({ id: technicianProfiles.id })
      .from(technicianProfiles)
      .where(eq(technicianProfiles.userId, session.user.id));
    const mine = profile && job.assignments.some((a) => a.technicianId === profile.id);
    if (!mine) redirect("/tech");
  }

  const address = `${job.street}${job.unit ? `, ${job.unit}` : ""}, ${job.city}, ${job.state} ${job.zip}`;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  return (
    <main className="mx-auto max-w-md p-4 pb-10">
      <Link href="/tech" className="text-sm font-semibold text-point">
        ← Today
      </Link>
      <header className="mt-2">
        <h1 className="text-xl font-extrabold text-navy">
          {job.serviceName ?? "Service"} · {job.customerFirst} {job.customerLast}
        </h1>
        <p className="text-sm text-slate">
          {timeFmt.format(job.windowStart)} window · status:{" "}
          <span className="font-semibold text-navy">{job.status.replace(/_/g, " ")}</span>
        </p>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`tel:${job.customerPhone}`}
          className="rounded-xl bg-navy py-3 text-center text-sm font-bold text-white"
        >
          Call customer
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-point py-3 text-center text-sm font-bold text-white"
        >
          Navigate
        </a>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <p className="font-semibold text-navy">{address}</p>
        {job.warranties.length > 0 && (
          <p className="mt-2 rounded-lg bg-point/10 px-3 py-2 text-xs font-semibold text-point">
            Completed repair on file — check warranty before quoting.
          </p>
        )}
      </section>

      {job.photos.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate">Photos</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {job.photos.map((p) => (
              <a key={p.id} href={`/api/media/${p.id}`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/media/${p.id}`}
                  alt={p.category.replace(/_/g, " ")}
                  className="size-20 rounded-lg border border-line object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      <JobActions appointmentId={job.appointmentId} status={job.status} />

      <section className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate">Job notes</h2>
        <ul className="mt-2 space-y-2">
          {job.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line bg-white p-3 text-sm text-navy">
              {n.body}
            </li>
          ))}
          {job.notes.length === 0 && (
            <li className="text-sm text-slate">No notes yet.</li>
          )}
        </ul>
      </section>

      {job.history.length > 0 && (
        <p className="mt-4 text-xs text-slate">
          {job.history.map((h) => h.toStatus.replace(/_/g, " ")).join(" → ")}
        </p>
      )}
    </main>
  );
}
