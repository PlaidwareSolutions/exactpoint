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
  { href: "/manager/invoices", label: "Invoices" },
  { href: "/manager/team", label: "Team" },
  { href: "/manager/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-40 border-b border-line bg-navy text-white print:hidden">
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
          <form action="/manager/search" className="hidden md:block">
            <input
              type="search"
              name="q"
              placeholder="Search…"
              aria-label="Search customers, requests, invoices"
              className="w-36 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/50 focus:border-point focus:outline-none lg:w-48"
            />
          </form>
          <Link href="/manager/search" className="rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-white/10 md:hidden" aria-label="Search">
            🔍
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
