import { BUSINESS, SERVICE_AGREEMENT } from "@exactpoint/domain";

export const metadata = {
  title: "Customer Agreement",
  description:
    "The service authorization, repair disclaimer and customer agreement that applies when you approve an ExactPoint repair estimate.",
};

export default function ServiceAgreementPage() {
  const a = SERVICE_AGREEMENT;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-sm font-semibold uppercase tracking-wider text-point">
        {BUSINESS.legalName}
      </p>
      <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">{a.title}</h1>
      <p className="mt-6 text-slate">{a.intro}</p>

      <ol className="mt-2">
        {a.sections.map((s, i) => (
          <li key={s.heading}>
            <h2 className="mt-8 text-xl font-bold text-navy">
              {i + 1}. {s.heading}
            </h2>
            <div className="mt-3 space-y-3 text-slate">
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-xl border border-line bg-white p-5 text-sm text-slate">
        <p>
          <strong className="text-navy">Business:</strong> {BUSINESS.legalName}
        </p>
        <p>
          <strong className="text-navy">Phone:</strong>{" "}
          <a href={BUSINESS.phoneHref} className="font-semibold text-point">
            {BUSINESS.phone}
          </a>
        </p>
        <p>
          <strong className="text-navy">Email:</strong>{" "}
          <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-point">
            {BUSINESS.email}
          </a>
        </p>
        <p className="mt-3">{a.closing}</p>
      </div>
      <p className="mt-4 text-xs text-slate">Version {a.version}</p>
    </section>
  );
}
