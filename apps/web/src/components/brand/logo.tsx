/**
 * EP Badge mark (owner-selected concept 2). The icon is pure SVG geometry;
 * the wordmark is HTML text so no font embedding is needed.
 */
export function LogoBadge({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="6" width="108" height="108" rx="26" fill="#16233B" />
      <g stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" fill="none">
        <line x1="44" y1="33" x2="44" y2="87" />
        <line x1="44" y1="33" x2="72" y2="33" />
        <line x1="44" y1="60" x2="64" y2="60" />
        <line x1="44" y1="87" x2="72" y2="87" />
        <path d="M72 33 a13.5 13.5 0 0 1 0 27 L64 60" />
      </g>
      <circle cx="71" cy="46.5" r="6" fill="#F26A21" />
    </svg>
  );
}

export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoBadge size={compact ? 34 : 40} />
      <span className="leading-none">
        <span className="block text-lg font-extrabold tracking-wide text-navy">
          EXACTPOINT
        </span>
        {!compact && (
          <span className="mt-0.5 block text-[0.6rem] font-semibold tracking-[0.28em] text-slate">
            APPLIANCE &amp; HVAC
          </span>
        )}
      </span>
    </span>
  );
}
