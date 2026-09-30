import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

/**
 * Root document metadata. `metadataBase` is what turns every relative
 * `og:image` into an absolute URL, so it has to be set at the root — share
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
};

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
