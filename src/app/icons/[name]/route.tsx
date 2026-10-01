import { ImageResponse } from 'next/og';
import { PG_BLUE, PG_ELEPHANT, WL_BOTTOM, WL_BLUE, WL_NAVY, WL_TOP } from '@/components/brand/paths';
import { APP_BG } from '@/lib/site';

/**
 * Manifest icons, drawn from the same path data as `src/app/icon.svg` so the favicon, the header
 * mark and the installed app are one drawing rather than three guesses.
 *
 * Rasterized at build time, not stored: a committed PNG cannot import the path constants, so it
 * drifts the moment the mark does, and `next/og` is already a dependency for the share cards.
 *
 * The artwork is placed with the favicon's own framing (viewBox `-1 -1 94 92`), which is the
 * composition already proven legible at 16px. Only the fill of the canvas and the scale of the
 * mark change between the three: a `maskable` icon gets its full canvas painted and the mark shrunk
 * into the safe zone, because launchers crop that variant to a circle or squircle and the badge
 * lives in the bottom-right corner. The `any` variants keep the same background and a larger mark,
 * since the launcher masks nothing and letterboxing would show as a coloured frame.
 */
// Only these three URLs exist; anything else at this path is a 404, not a render.
export const dynamicParams = false;

/** `mark` is the artwork's share of the canvas edge; the safe zone is the central 80% circle. */
const ICONS = {
  'icon-192.png': { size: 192, mark: 0.72 },
  'icon-512.png': { size: 512, mark: 0.72 },
  'icon-maskable-512.png': { size: 512, mark: 0.56 },
} as const;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS[name as keyof typeof ICONS];
  if (!icon) return new Response('Not found', { status: 404 });
  const { size, mark } = icon;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: APP_BG,
        }}
      >
        <svg width={size * mark} height={size * mark} viewBox="-1 -1 94 92">
          <path d={WL_TOP} fill={WL_BLUE} />
          <path d={WL_BOTTOM} fill={WL_NAVY} />
          <g transform="translate(53.72 52.04) scale(1.5417)">
            <circle cx="12" cy="12" r="12.9" fill="#fff" />
            <circle cx="12" cy="12" r="12" fill={PG_BLUE} />
            <g transform="translate(4.5 4.5) scale(0.625)">
              <path d={PG_ELEPHANT} fill="#fff" />
            </g>
          </g>
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      // A week, not a year: the URL is not content-hashed, so an icon that changes has to be
      // refetchable by someone who already installed the app.
      headers: { 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400' },
    },
  );
}
