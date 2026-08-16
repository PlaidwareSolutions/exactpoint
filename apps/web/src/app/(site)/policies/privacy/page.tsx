import { BUSINESS } from "@exactpoint/domain";

export const metadata = {
  title: "Privacy Policy",
  description: "How ExactPoint handles the information you share when booking service.",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-slate">
        <p>
          {BUSINESS.legalName} collects the information you provide when you
          book service — your name, phone number, email, service address, and
          details or photos of the equipment you want repaired.
        </p>
        <p>
          We use this information for one purpose: scheduling and performing
          your service. That includes contacting you about your appointment,
          routing our technicians, keeping a service history for your equipment
          and warranty, and sending service-related messages.
        </p>
        <p>
          We do not sell your information. We do not share it with third
          parties except the service providers we rely on to operate (such as
          hosting and communications), and only as needed to serve you.
        </p>
        <p>
          Photos you upload are stored privately and used to prepare for and
          document your repair. We never publish customer photos without
          explicit permission.
        </p>
        <p>
          To ask about or request deletion of your information, contact{" "}
          <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-point">
            {BUSINESS.email}
          </a>{" "}
          or call{" "}
          <a href={BUSINESS.phoneHref} className="font-semibold text-point">
            {BUSINESS.phone}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
