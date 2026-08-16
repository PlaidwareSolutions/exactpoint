import Link from "next/link";

const TABS = [
  { href: "/manager/settings", label: "Business" },
  { href: "/manager/settings/scheduling", label: "Scheduling" },
  { href: "/manager/settings/services", label: "Services" },
  { href: "/manager/settings/zones", label: "Service Zones" },
  { href: "/account/password", label: "Password" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Settings</h1>
      <nav className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate hover:text-navy"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
