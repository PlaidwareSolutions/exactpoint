import { notFound } from "next/navigation";
import { ServicePage } from "@/components/site/service-page";
import { getService, HVAC_SERVICES } from "@/content/services";

export function generateStaticParams() {
  return HVAC_SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const service = getService((await params).slug);
  if (!service || service.category !== "hvac") return {};
  return { title: service.name, description: service.intro };
}

export default async function HvacServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const service = getService((await params).slug);
  if (!service || service.category !== "hvac") notFound();
  return <ServicePage service={service} />;
}
