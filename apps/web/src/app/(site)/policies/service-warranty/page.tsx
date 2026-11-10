import { BUSINESS, SERVICE_AGREEMENT } from "@exactpoint/domain";

export const metadata = {
  title: "Service & Warranty Policy",
  description:
    "ExactPoint's diagnostic fee and 2-month labor warranty, explained plainly.",
};

export default function ServiceWarrantyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
        Service &amp; Warranty Policy
      </h1>

      <h2 className="mt-8 text-xl font-bold text-navy">
        Diagnostic &amp; service-call fee
      </h2>
      <div className="mt-3 space-y-3 text-slate">
        <p>
          An <strong className="text-navy">$80 diagnostic/service-call fee</strong>{" "}
          applies when ExactPoint visits, diagnoses the problem, and you choose
          not to proceed with the recommended repair.
        </p>
        <p>
          If you approve the quoted repair, the $80 fee is{" "}
          <strong className="text-navy">waived</strong> — you pay the agreed
          repair amount only.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-bold text-navy">Labor warranty</h2>
      <div className="mt-3 space-y-3 text-slate">
        <p>
          Every repair we complete carries a{" "}
          <strong className="text-navy">two-month labor warranty</strong>{" "}
          covering the specific repair performed and the workmanship associated
          with it.
        </p>
        <p>
          The warranty applies to the repaired issue and component. It does not
          automatically cover unrelated failures — if an oven is repaired
          because it doesn&apos;t heat and an unrelated oven light later fails,
          that is a separate problem. When you call about a repeat issue,
          we&apos;ll review it against the original repair and let you know
          whether it qualifies.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-bold text-navy">Customer agreement</h2>
      <p className="mt-3 text-slate">
        Every quote we send includes our{" "}
        <a href={SERVICE_AGREEMENT.path} className="font-semibold text-point">
          {SERVICE_AGREEMENT.title}
        </a>
        . Approving a quote means you accept those terms, including repair scope,
        post-repair inspection and refunds.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy">Payments</h2>
      <p className="mt-3 text-slate">
        We currently accept {BUSINESS.paymentMethods.join(", ")}.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy">Questions</h2>
      <p className="mt-3 text-slate">
        Call{" "}
        <a href={BUSINESS.phoneHref} className="font-semibold text-point">
          {BUSINESS.phone}
        </a>{" "}
        or email{" "}
        <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-point">
          {BUSINESS.email}
        </a>
        .
      </p>
    </section>
  );
}
