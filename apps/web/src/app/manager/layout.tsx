import Link from "next/link";
import { requireOwner } from "@/lib/session";
import { LogoBadge } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/manager", label: "Today" },
  { href: "/manager/new-booking", label: "＋ New Booking" },
  { href: "/manager/requests", label: "Requests" },
  { href: "/manager/calendar", label: "Calendar" },
  { href: "/manager/routes", label: "Routes" },
  { href: "/manager/map", label: "Map" },
  { href: "/manager/area", label: "Area View" },
  { href: "/manager/customers", label: "Customers" },
  { href: "/manager/team", label: "Team" },
  { href: "/manager/settings", label: "Settings" },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-40 border-b border-line bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link href="/manager" className="flex items-center gap-2.5">
            <LogoBadge size={30} />
            <span className="text-sm font-extrabold tracking-wide">
              SERVICE MANAGER
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-sm font-medium">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
