import type { Metadata, Viewport } from 'next';
import { APP_BRAND, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

/**
 * Root document metadata. `metadataBase` is what turns every relative
 * `og:image` into an absolute URL, so it has to be set at the root: share
 * cards are silent about a missing base, they just don't render.
 */
export const rootMeta: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: ['PostgreSQL', 'row-level security', 'SQL injection', 'database security', 'learn SQL', 'Postgres tutorial'],
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: SITE_DESCRIPTION },
  alternates: { canonical: SITE_URL },
  // iOS installs from these two, not from the manifest: it wants an apple-touch-icon (a PNG it can
  // put on the home screen, so the generated one is reused) and the web-app meta pair that hides
  // Safari's chrome. statusBarStyle 'black-translucent' is the reading of the dark status bar the
  // light-paper app gets under it.
  appleWebApp: { title: SITE_NAME, statusBarStyle: 'black-translucent' },
  // Naming `icons` at all replaces what `app/icon.svg` would have contributed on its own, so the
  // favicon has to be repeated here: dropping it leaves browsers fetching /favicon.ico, which this
  // app does not have, and every page load logs a 404.
  icons: {
    icon: '/icon.svg',
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

/**
 * The browser chrome an installed or added-to-home-screen app is painted with. Separate export
 * because `themeColor` was pulled out of `metadata` in Next 14: it describes the window, not the
 * document. Named `rootViewport` and re-exported by `app/layout.tsx`, because Next reads these
 * exports only from route files: a `viewport` left unused in a lib is silently not rendered.
 * Same brand blue as the manifest's `theme_color`, for the same reason.
 */
export const rootViewport: Viewport = { themeColor: APP_BRAND };

/**
 * Document metadata for one lesson. The generic template covers the suffix; the
 * tagline is the description a search result or a preview shows, so it carries
 * the lesson's own promise rather than the site's.
 */
export function lessonMeta(title: string, tagline: string, slug: string): Metadata {
  return {
    title,
    description: tagline,
    keywords: [title, 'PostgreSQL', 'hands-on lab', 'Postgres Lab'],
    openGraph: {
      title,
      description: tagline,
      url: `${SITE_URL}/learn/${slug}`,
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description: tagline },
    alternates: { canonical: `${SITE_URL}/learn/${slug}` },
  };
}
