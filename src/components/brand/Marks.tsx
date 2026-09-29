import type { SVGProps } from 'react';
import { PG_BLUE, PG_ELEPHANT, WL_BLUE, WL_BOTTOM, WL_NAVY, WL_TOP, WL_VIEWBOX } from './paths';

/** Static Webelight symbol (blue top wave, navy bottom bowl). */
export function WebelightMark({ size = 64, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={WL_VIEWBOX} {...rest}>
      <path d={WL_TOP} fill={WL_BLUE} />
      <path d={WL_BOTTOM} fill={WL_NAVY} />
    </svg>
  );
}

/** Postgres elephant inside a round badge. */
export function PgBadge({ size = 64, bg = PG_BLUE, fg = '#fff', ...rest }: SVGProps<SVGSVGElement> & { size?: number; bg?: string; fg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <circle cx="12" cy="12" r="12" fill={bg} />
      <g transform="translate(4.5 4.5) scale(0.625)">
        <path d={PG_ELEPHANT} fill={fg} />
      </g>
    </svg>
  );
}

/** Raw elephant path positioned inside an arbitrary viewBox: (x, y) top-left, s = rendered size. */
export function ElephantAt({ x, y, s, fill = '#fff' }: { x: number; y: number; s: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 24})`}>
      <path d={PG_ELEPHANT} fill={fill} />
    </g>
  );
}
