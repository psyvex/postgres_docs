import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function base({ size = '1em', ...rest }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...rest };
}

/** Impact / breach burst (react-icons has no duotone explosion). */
export function BurstIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5l1.9 4.6 4.3-2.4-1 4.8 4.8 1.2-4 2.9 2.7 4.1-4.9-.4-.6 4.9-3.2-3.7-3.2 3.7-.6-4.9-4.9.4 2.7-4.1-4-2.9 4.8-1.2-1-4.8 4.3 2.4z" fill="currentColor" fillOpacity={0.2} />
      <path d="M12 9v3.5M12 15h.01" />
    </svg>
  );
}

/** Tenant hopping: a jump arc from one tenant box into another. */
export function TenantHopIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity={0.2} />
      <rect x="14.5" y="14" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity={0.2} />
      <path d="M6 12c0-5 3-8 6-8s6 3 6 8" strokeDasharray="2 2.2" />
      <path d="M15.5 10l2.5 2.5 2.5-2.5" />
    </svg>
  );
}

/**
 * The lab mascot: a Postgres elephant working the door as an RLS bouncer.
 * `asleep` closes the eyes and adds "z" marks for the RLS-off state.
 */
export function ElephantBouncer({ asleep = false, size = 96, ...rest }: IconProps & { asleep?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" {...rest}>
      {/* ears */}
      <ellipse cx="30" cy="50" rx="20" ry="24" fill="var(--brand)" opacity="0.55" />
      <ellipse cx="90" cy="50" rx="20" ry="24" fill="var(--brand)" opacity="0.55" />
      {/* head */}
      <ellipse cx="60" cy="52" rx="30" ry="28" fill="var(--brand)" />
      {/* trunk */}
      <path d="M60 66c0 14 2 24 10 30 4 3 9 1 9-3" stroke="var(--brand)" strokeWidth="11" strokeLinecap="round" />
      {/* tusks */}
      <path d="M47 70c-2 6 0 11 5 12M73 70c2 6 0 11-5 12" stroke="var(--surface)" strokeWidth="3.5" strokeLinecap="round" />
      {/* eyes: sunglasses when on duty, closed when asleep */}
      {asleep ? (
        <>
          <path d="M44 48q5 4 10 0M66 48q5 4 10 0" stroke="var(--on-brand)" strokeWidth="3" strokeLinecap="round" />
          <text x="92" y="24" fontSize="14" fontWeight="800" fill="var(--muted)">z</text>
          <text x="102" y="14" fontSize="10" fontWeight="800" fill="var(--muted)">z</text>
        </>
      ) : (
        <>
          <rect x="39" y="40" width="18" height="12" rx="5" fill="var(--code-bg)" />
          <rect x="63" y="40" width="18" height="12" rx="5" fill="var(--code-bg)" />
          <path d="M57 45h6" stroke="var(--code-bg)" strokeWidth="3" />
          <path d="M42 43l5 0" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {/* security badge */}
      <circle cx="60" cy="100" r="11" fill="var(--good)" />
      <path d="M55 100l3.5 3.5 6.5-7" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
