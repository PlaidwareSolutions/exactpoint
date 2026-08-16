import { notFound } from "next/navigation";
import { ServicePage } from "@/components/site/service-page";
import { APPLIANCE_SERVICES, getService } from "@/content/services";

export function generateStaticParams() {
  return APPLIANCE_SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const service = getService((await params).slug);
  if (!service || service.category !== "appliance") return {};
  return { title: service.name, description: service.intro };
}

export default async function ApplianceServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const service = getService((await params).slug);
  if (!service || service.category !== "appliance") notFound();
  return <ServicePage service={service} />;
}
