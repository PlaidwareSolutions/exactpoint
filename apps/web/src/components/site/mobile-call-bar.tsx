import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";

/** One-tap call + book, pinned on phones (spec §44). */
export function MobileCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-px border-t border-line bg-line sm:hidden">
      <a
        href={BUSINESS.phoneHref}
        className="flex items-center justify-center gap-2 bg-navy py-3.5 text-sm font-bold text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z" />
        </svg>
        Call {BUSINESS.phone}
      </a>
      <Link
        href="/book"
        className="flex items-center justify-center bg-point py-3.5 text-sm font-bold text-white"
      >
        Book Service
      </Link>
    </div>
  );
}
