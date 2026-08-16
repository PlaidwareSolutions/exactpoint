import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, technicianDayJobs, technicianProfiles } from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { addDays, ymdInTimeZone, zonedTimeToUtc } from "@exactpoint/scheduling";
import { requireTechnician } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  hour: "numeric",
  minute: "2-digit",
});

/** Technician PWA home (spec §38): my jobs, today and tomorrow. */
export default async function TechTodayPage() {
  const session = await requireTechnician();
  const db = getDb();
  const [profile] = await db
    .select()
    .from(technicianProfiles)
    .where(eq(technicianProfiles.userId, session.user.id));

  const today = ymdInTimeZone(new Date(), BUSINESS.timezone);
  const range = {
    start: zonedTimeToUtc(today, "00:00", BUSINESS.timezone),
    end: zonedTimeToUtc(addDays(today, 2), "00:00", BUSINESS.timezone),
  };
  const jobs = profile ? await technicianDayJobs(db, profile.id, range) : [];
  const todayJobs = jobs.filter(
    (j) => ymdInTimeZone(j.scheduledStart, BUSINESS.timezone) === today,
  );
  const tomorrowJobs = jobs.filter(
    (j) => ymdInTimeZone(j.scheduledStart, BUSINESS.timezone) !== today,
  );

  return (
    <main className="mx-auto max-w-md p-4 pb-10">
      <header className="flex items-center justify-between py-2">
        <div>
          <h1 className="text-xl font-extrabold text-navy">Today</h1>
          <p className="text-sm text-slate">
            {profile ? `${profile.firstName} ${profile.lastName}`.trim() : session.user.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      {!profile && (
        <p className="mt-4 rounded-xl border border-line bg-white p-4 text-sm text-slate">
          Your login isn&apos;t linked to a technician profile yet — ask the
          office to connect it.
        </p>
      )}

      <JobList jobs={todayJobs} empty="No jobs scheduled today." />

      {tomorrowJobs.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate">
            Tomorrow
          </h2>
          <JobList jobs={tomorrowJobs} empty="" />
        </>
      )}
    </main>
  );
}

function JobList({
  jobs,
  empty,
}: {
  jobs: Awaited<ReturnType<typeof technicianDayJobs>>;
  empty: string;
}) {
  if (jobs.length === 0 && empty) {
    return (
      <p className="mt-4 rounded-xl border border-line bg-white p-5 text-sm text-slate">
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-2">
      {jobs.map((j) => (
        <li key={j.appointmentId}>
          <Link
            href={`/tech/jobs/${j.appointmentId}`}
            className="block rounded-xl border border-line bg-white p-4 active:bg-mist"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-extrabold tabular-nums text-navy">
                {timeFmt.format(j.scheduledStart)}
              </span>
              <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-slate">
                {j.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 font-semibold text-navy">
              {j.serviceName ?? "Service"} · {j.customerFirst}
            </p>
            <p className="text-sm text-slate">{j.city}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
